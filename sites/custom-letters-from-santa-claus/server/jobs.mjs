import { letterMessage, sendGraphMail } from "./email.mjs";
import { cronAuthorized, denyUnlessSanta } from "./gate.mjs";
import { createLobLetter } from "./lob.mjs";
import { dueForPurge } from "./retention.mjs";
import { chicagoDateString } from "./time.mjs";
import { createSupabaseDb } from "./supabase-db.mjs";

// Approved letters only. Email and Lob stay off until their flags are true.
// While a flag is off, the job logs "would send" or "would mail" and leaves
// the letter approved. Postmark orders are never given to Lob.

export async function handleJobs(request, deps = {}) {
  const env = deps.env || process.env;
  const denied = denyUnlessSanta(env, { cron: true });
  if (denied) return denied;
  if (request.method !== "GET" && request.method !== "POST") return { status: 405, body: { error: "Use GET" } };
  if (!cronAuthorized(request, env)) return { status: 401, body: { error: "Unauthorized" } };
  const db = deps.db || createSupabaseDb(env, deps.fetch);
  const now = deps.now || new Date();
  const log = deps.log || console.log;
  const today = chicagoDateString(now);
  const summary = { wouldSend: 0, sent: 0, wouldMail: 0, mailed: 0, held: 0, purged: 0 };

  for (const order of await db.listQueue()) {
    if (order.status !== "paid") continue;
    for (const draft of order.drafts || []) {
      if (draft.redactedAt) continue;
      if (draft.status !== "approved") {
        if (order.slug === "email-from-santa" && order.deliveryDate && order.deliveryDate <= today && (draft.status === "draft" || draft.status === "rejected")) {
          summary.held += 1;
          if (!(await db.hasAudit(draft.id, "held_unapproved"))) {
            log(`ALERT held unapproved letter ${draft.id} order ${order.id}`);
            await db.audit({ orderId: order.id, draftId: draft.id, action: "held_unapproved", actor: "cron", detail: {} });
          }
        }
        continue;
      }
      if (order.slug === "email-from-santa") {
        if (!order.deliveryDate || order.deliveryDate > today) continue;
        if (!order.recipientConfirmed) continue;
        const child = (order.children || []).find((item) => item.id === draft.childId);
        if (env.EMAIL_SENDING_ENABLED !== "true") {
          summary.wouldSend += 1;
          log(`would send letter ${draft.id} to ${order.recipientEmail || order.parentEmail}`);
          continue;
        }
        const send = deps.sendMail || ((message) => sendGraphMail(message, env, deps.fetch || globalThis.fetch));
        await send(letterMessage(order, draft, child));
        await db.updateDraft(draft.id, { status: "sent", sentAt: now.toISOString(), provider: "graph" });
        summary.sent += 1;
        continue;
      }
      if (order.postmark) continue;
      if (env.LOB_SENDING_ENABLED !== "true") {
        summary.wouldMail += 1;
        log(`would mail letter ${draft.id}`);
        continue;
      }
      const send = deps.sendLob || ((current, item) => createLobLetter(current, item, env, deps.fetch || globalThis.fetch));
      const result = await send(order, draft);
      await db.updateDraft(draft.id, { status: "mailed", sentAt: now.toISOString(), provider: "lob", providerId: result?.id || "" });
      summary.mailed += 1;
    }
  }

  for (const order of await db.listQueue()) {
    for (const draft of order.drafts || []) {
      if (!dueForPurge(draft, now)) continue;
      await db.purgeDraft(draft.id, now);
      await db.audit({ orderId: order.id, draftId: draft.id, action: "child_details_deleted", actor: "cron", detail: {} });
      summary.purged += 1;
    }
  }
  return { status: 200, body: { ok: true, ...summary } };
}
