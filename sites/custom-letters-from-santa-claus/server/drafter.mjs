import { createHash, timingSafeEqual } from "node:crypto";
import { letterProblems } from "./draft.mjs";
import { denyUnlessSanta } from "./gate.mjs";
import { createDb } from "./postgres-db.mjs";

export const LETTER_TONE = "Warm Santa voice. Use only the details given. Be kind about anything the child is working on. Do not promise gifts. Do not mention a postmark or a USPS facility.";

export function bearerMatches(header, expected) {
  const presented = String(header || "").replace(/^Bearer\s+/i, "").trim();
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(String(expected || "")).digest();
  return Boolean(String(expected || "").trim()) && timingSafeEqual(a, b);
}

function authorized(request, env) {
  return bearerMatches(request.headers?.authorization || request.headers?.Authorization, env.DRAFTER_API_TOKEN);
}

export function pendingLetters(queue) {
  const letters = [];
  for (const order of queue || []) {
    if (order.status !== "paid") continue;
    for (const draft of order.drafts || []) {
      if (draft.redactedAt || draft.source !== "template" || draft.status !== "draft") continue;
      const child = (order.children || []).find((item) => item.id === draft.childId);
      if (!child) continue;
      letters.push({
        orderId: order.id,
        letterId: draft.id,
        letterType: order.kind === "email" ? "email" : "printed",
        tone: LETTER_TONE,
        firstName: child.firstName,
        age: child.age,
        details: {
          town: child.town || "",
          friendOrPet: child.friendOrPet || "",
          accomplishment: child.accomplishment || "",
          workOn: child.workOn || "",
          wishlist: child.wishlist || "",
        },
      });
    }
  }
  return letters;
}

export async function handleDrafter(request, deps = {}) {
  const env = deps.env || process.env;
  const denied = denyUnlessSanta(env);
  if (denied) return denied;
  if (!authorized(request, env)) return { status: 401, body: { error: "Unauthorized" } };
  const db = deps.db || createDb(env);
  const url = new URL(request.url || "/", "http://localhost");
  const letterMatch = url.pathname.match(/\/api\/santa\/drafter\/letters\/([^/]+)$/);

  if (request.method === "GET" && url.pathname.replace(/\/$/, "") === "/api/santa/drafter/pending") {
    const letters = pendingLetters(await db.listQueue());
    return { status: 200, body: { letters } };
  }

  if (request.method === "POST" && letterMatch) {
    const id = decodeURIComponent(letterMatch[1]);
    const draft = await db.getDraft(id);
    if (!draft || draft.redactedAt) return { status: 404, body: { error: "Letter not found" } };
    if (draft.status !== "draft") return { status: 409, body: { error: "That letter is no longer waiting for review." } };
    const text = String(request.body?.body || "").trim();
    if (!text) return { status: 400, body: { error: "The letter is empty." } };
    const problems = letterProblems(text);
    if (problems.length) return { status: 400, body: { error: `Take out ${problems.join(" and ")}.` } };
    await db.updateDraft(draft.id, { body: text, source: "assistant", model: "assistant" });
    await db.audit({ orderId: draft.orderId, draftId: draft.id, action: "draft_written_by_assistant", actor: "assistant", detail: {} });
    const saved = await db.getDraft(draft.id);
    return { status: 200, body: { ok: true, letterId: saved.id, source: saved.source, status: saved.status } };
  }

  return { status: 404, body: { error: "Not found" } };
}
