import { clearCookie, cookieToken, passwordMatches, readSession, sessionCookie } from "./admin-auth.mjs";
import { DEFAULT_MODEL } from "./config.mjs";
import { draftForChild, generateWithGateway, letterProblems } from "./draft.mjs";
import { postmarkCsv, postmarkPdf } from "./export.mjs";
import { denyUnlessSanta } from "./gate.mjs";
import { chicagoDateString } from "./time.mjs";
import { createSupabaseDb } from "./supabase-db.mjs";

const LOCKED = new Set(["sent", "mailed"]);

export async function handleAdmin(request, deps = {}) {
  const env = deps.env || process.env;
  const denied = denyUnlessSanta(env);
  if (denied) return denied;
  const db = deps.db || createSupabaseDb(env, deps.fetch);
  const now = deps.now || new Date();
  const secure = String(request.headers?.["x-forwarded-proto"] || "").includes("https");
  const url = new URL(request.url || "/", "http://localhost");
  const body = request.body || {};

  if (request.method === "POST" && body.action === "login") {
    if (!env.ADMIN_PASSWORD) return { status: 503, body: { error: "ADMIN_PASSWORD is not set" } };
    if (!passwordMatches(body.password, env.ADMIN_PASSWORD)) return { status: 401, body: { error: "Wrong password" } };
    return {
      status: 200,
      headers: { "Set-Cookie": sessionCookie(env.ADMIN_PASSWORD, { now: now.getTime(), secure }) },
      body: { ok: true },
    };
  }
  if (request.method === "POST" && body.action === "logout") {
    return { status: 200, headers: { "Set-Cookie": clearCookie(secure) }, body: { ok: true } };
  }
  if (!env.ADMIN_PASSWORD || !readSession(cookieToken(request.headers?.cookie), env.ADMIN_PASSWORD, now.getTime())) {
    return { status: 401, body: { error: "Sign in required" } };
  }

  if (request.method === "GET" && url.searchParams.get("export") === "csv") {
    const queue = await present(db, now);
    return { status: 200, contentType: "text/csv; charset=utf-8", raw: postmarkCsv(queue), filename: "postmark-batch.csv" };
  }
  if (request.method === "GET" && url.searchParams.get("export") === "pdf") {
    const queue = await present(db, now);
    return { status: 200, contentType: "application/pdf", raw: postmarkPdf(queue), filename: "postmark-batch.pdf" };
  }
  if (request.method === "GET") {
    return { status: 200, body: { orders: await present(db, now) } };
  }
  if (request.method !== "POST") return { status: 405, body: { error: "Use POST" } };

  const draft = body.draftId ? await db.getDraft(body.draftId) : null;
  if (!draft) return { status: 404, body: { error: "Letter not found" } };
  if (LOCKED.has(draft.status) && body.action !== "logout") {
    return { status: 409, body: { error: "That letter has already gone out." } };
  }

  if (body.action === "edit") {
    const text = String(body.body || "").trim();
    if (!text) return { status: 400, body: { error: "The letter is empty." } };
    const problems = letterProblems(text);
    if (problems.length) return { status: 400, body: { error: `Take out ${problems.join(" and ")}.` } };
    const next = { body: text };
    if (draft.status === "approved") next.status = "draft";
    await db.updateDraft(draft.id, next);
    await db.audit({ orderId: draft.orderId, draftId: draft.id, action: "draft_edited", actor: "owner", detail: {} });
    return { status: 200, body: { ok: true } };
  }
  if (body.action === "approve") {
    const problems = letterProblems(draft.body);
    if (problems.length) return { status: 400, body: { error: `Take out ${problems.join(" and ")} before approving.` } };
    if (!String(draft.body || "").trim()) return { status: 400, body: { error: "The letter is empty." } };
    await db.updateDraft(draft.id, { status: "approved", reviewer: "owner", reviewedAt: now.toISOString() });
    await db.audit({ orderId: draft.orderId, draftId: draft.id, action: "draft_approved", actor: "owner", detail: {} });
    return { status: 200, body: { ok: true } };
  }
  if (body.action === "reject") {
    await db.updateDraft(draft.id, { status: "rejected", reviewer: "owner", reviewedAt: now.toISOString() });
    await db.audit({ orderId: draft.orderId, draftId: draft.id, action: "draft_rejected", actor: "owner", detail: {} });
    return { status: 200, body: { ok: true } };
  }
  if (body.action === "redraft") {
    const order = await db.getOrder(draft.orderId);
    const child = order?.children?.find((item) => item.id === draft.childId);
    if (!child) return { status: 409, body: { error: "That child's details are no longer on the order." } };
    const model = env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
    const generate = deps.generate || ((prompt) => generateWithGateway(prompt, env));
    const next = await draftForChild(child, { generate, model });
    await db.updateDraft(draft.id, { body: next.body, model: next.model === "fallback" ? "fallback" : model, status: "draft", reviewer: "", reviewedAt: "" });
    await db.audit({ orderId: draft.orderId, draftId: draft.id, action: "draft_redrafted", actor: "owner", detail: {} });
    return { status: 200, body: { ok: true } };
  }
  return { status: 400, body: { error: "Unknown action" } };
}

async function present(db, now) {
  const today = chicagoDateString(now);
  const orders = await db.listQueue();
  return orders.map((order) => ({
    ...order,
    drafts: (order.drafts || []).map((draft) => ({
      ...draft,
      held: order.slug === "email-from-santa"
        && !!order.deliveryDate
        && order.deliveryDate <= today
        && draft.status !== "approved"
        && draft.status !== "sent"
        && draft.status !== "mailed",
    })),
  }));
}
