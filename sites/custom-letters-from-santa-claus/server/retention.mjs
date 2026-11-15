import { RETENTION_DAYS } from "./config.mjs";

const DAY = 24 * 60 * 60 * 1000;

export function retentionCutoff(now, days = RETENTION_DAYS) {
  return new Date(now.getTime() - days * DAY);
}

// Child details go 60 days after that letter was actually sent or mailed.
// A draft that is still in review is kept so it can still be fulfilled.
export function dueForPurge(draft, now, days = RETENTION_DAYS) {
  if (!draft || draft.redactedAt) return false;
  if (draft.status !== "sent" && draft.status !== "mailed") return false;
  if (!draft.sentAt) return false;
  return new Date(draft.sentAt).getTime() <= retentionCutoff(now, days).getTime();
}
