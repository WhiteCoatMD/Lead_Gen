import { DEFAULT_MODEL } from "./config.mjs";
import { draftForChild, generateWithGateway } from "./draft.mjs";
import { confirmationMessage, sendGraphMail } from "./email.mjs";
import { denyUnlessSanta } from "./gate.mjs";
import { verifyStripeSignature } from "./stripe-api.mjs";
import { createSupabaseDb } from "./supabase-db.mjs";

// Payment creates drafts and a confirmation template. It does not send the
// letter. A duplicate event must not draft the same child twice.

export async function handleWebhook(request, deps = {}) {
  const env = deps.env || process.env;
  const denied = denyUnlessSanta(env);
  if (denied) return denied;
  if (request.method !== "POST") return { status: 405, body: { error: "Use POST" } };
  const raw = request.rawBody || "";
  const header = request.headers?.["stripe-signature"] || "";
  if (!verifyStripeSignature(raw, header, env.STRIPE_WEBHOOK_SECRET || "", deps.now?.getTime?.() || Date.now())) {
    return { status: 400, body: { error: "Invalid Stripe signature" } };
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "Invalid Stripe event" } };
  }
  const db = deps.db || createSupabaseDb(env, deps.fetch);
  if (event?.id && await db.hasEvent(event.id)) return { status: 200, body: { ok: true, duplicate: true } };

  const type = event?.type;
  const session = event?.data?.object || {};
  const paidType = type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded";
  if (!paidType || session.payment_status !== "paid") return { status: 200, body: { ok: true, ignored: true } };

  const orderId = session.metadata?.order_id || session.client_reference_id;
  let order = orderId ? await db.getOrder(orderId) : null;
  if (!order) return { status: 200, body: { ok: true, missing: true } };
  if (order.status === "paid") {
    if (event.id) await db.saveEvent(event.id);
    return { status: 200, body: { ok: true, duplicate: true } };
  }
  if (Number(session.amount_total) !== Number(order.totalCents)) {
    await db.audit({ orderId: order.id, action: "amount_mismatch", actor: "stripe", detail: { amount: session.amount_total } });
    if (event.id) await db.saveEvent(event.id);
    return { status: 200, body: { ok: true, mismatch: true } };
  }
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "";
  order = await db.markPaid(order.id, paymentIntent);
  if (order.status !== "paid") return { status: 200, body: { ok: true, duplicate: true } };
  await storeConfirmation(db, env, deps, order);

  const generate = deps.generate || ((prompt) => generateWithGateway(prompt, env));
  const model = env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
  const draftedChildren = new Set((order.drafts || []).map((draft) => draft.childId));
  for (const child of order.children || []) {
    if (draftedChildren.has(child.id)) continue;
    const drafted = await draftForChild(child, { generate, model });
    await db.insertDraft({
      orderId: order.id,
      childId: child.id,
      body: drafted.body,
      model: drafted.model === "fallback" ? "fallback" : model,
    });
  }
  await db.audit({ orderId: order.id, action: "paid", actor: "stripe", detail: { drafts: (order.children || []).length } });
  if (event.id) await db.saveEvent(event.id);
  return { status: 200, body: { ok: true } };
}

async function storeConfirmation(db, env, deps, order) {
  const message = confirmationMessage(order);
  const stored = await db.insertMessage({ ...message, orderId: order.id });
  const log = deps.log || console.log;
  if (env.EMAIL_SENDING_ENABLED !== "true") {
    log(`would send confirmation ${stored.id} to ${message.toEmail}`);
    return;
  }
  try {
    const send = deps.sendMail || ((mail) => sendGraphMail(mail, env, deps.fetch || globalThis.fetch));
    await send({ to: message.toEmail, bcc: "", subject: message.subject, body: message.body });
    await db.markMessage(stored.id, "sent");
  } catch {
    log(`would send confirmation ${stored.id} to ${message.toEmail}`);
  }
}
