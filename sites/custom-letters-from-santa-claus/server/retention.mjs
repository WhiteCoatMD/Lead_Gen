import { RETENTION_DAYS, UNPAID_RETENTION_DAYS } from "./config.mjs";

const DAY = 24 * 60 * 60 * 1000;

export function retentionCutoff(now, days = RETENTION_DAYS) {
  return new Date(now.getTime() - days * DAY);
}

function ageReached(when, now, days) {
  if (!when) return false;
  const at = new Date(when).getTime();
  if (!Number.isFinite(at)) return false;
  return at <= retentionCutoff(now, days).getTime();
}

// Delivered letters: 60 days after sent/mailed.
// Rejected letters: 60 days after the rejection.
// A draft still in review is kept so it can still be fulfilled.
export function childPurgeDue(draft, now) {
  if (!draft || draft.redactedAt) return false;
  if (draft.status === "sent" || draft.status === "mailed") return ageReached(draft.sentAt, now, RETENTION_DAYS);
  if (draft.status === "rejected") return ageReached(draft.reviewedAt, now, RETENTION_DAYS);
  return false;
}

// Unpaid, canceled, and abandoned orders still hold child details.
// Those details go 7 days after the order was created.
export function unpaidChildPurgeDue(order, now) {
  if (!order || order.childrenRedactedAt || order.status === "paid") return false;
  const childrenLeft = (order.children || []).some((child) => child && !child.deleted);
  const draftsLeft = (order.drafts || []).some((draft) => draft && !draft.redactedAt && draft.body);
  if (!childrenLeft && !draftsLeft) return false;
  return ageReached(order.createdAt, now, UNPAID_RETENTION_DAYS);
}

// Parent name, email, and address go 60 days after the last letter in the
// order is delivered. An open draft or an approved letter that has not gone
// out keeps the contact details. Totals stay.
export function parentIdentityDue(order, now) {
  if (!order || order.identityRedactedAt || order.status !== "paid") return false;
  const drafts = order.drafts || [];
  if (!drafts.length) return false;
  if (drafts.some((draft) => draft.status === "draft" || draft.status === "approved")) return false;
  const delivered = drafts.filter((draft) => draft.status === "sent" || draft.status === "mailed");
  if (!delivered.length) return false;
  const latest = Math.max(...delivered.map((draft) => new Date(draft.sentAt || 0).getTime()));
  return ageReached(latest, now, RETENTION_DAYS);
}

export function dueForPurge(draft, now, days = RETENTION_DAYS) {
  if (days !== RETENTION_DAYS) return childPurgeDue({ ...draft, status: draft?.status }, now) && ageReached(draft?.sentAt, now, days);
  return childPurgeDue(draft, now);
}
