import { atOrBefore, chicagoDateString, chicagoInstant } from "./time.mjs";

// Printed letters: December 9, 2026, 5:00 PM America/Chicago, inclusive.
// Emails: any Chicago calendar day through December 24, 2026.
// Postmark add-on: November 26, 2026, 5:00 PM America/Chicago, inclusive.

export function printedDeadline(ordering) {
  const p = ordering.printed;
  return chicagoInstant(p.year, p.month, p.day, p.hour, p.minute, 0);
}

export function postmarkDeadline(ordering) {
  const p = ordering.postmark;
  return chicagoInstant(p.year, p.month, p.day, p.hour, p.minute, 0);
}

export function emailStillOpen(now, ordering) {
  return chicagoDateString(now) <= ordering.emailThrough;
}

export function cutoffErrors({ kind, postmark, now, ordering }) {
  const errors = [];
  if (kind === "printed" && !atOrBefore(now, printedDeadline(ordering))) {
    errors.push("Printed letters can be ordered through December 9, 2026, 5:00 PM CT.");
  }
  if (kind === "email" && !emailStillOpen(now, ordering)) {
    errors.push("Email letters can be ordered through December 24, 2026.");
  }
  if (postmark && !atOrBefore(now, postmarkDeadline(ordering))) {
    errors.push("The North Pole postmark add-on can be ordered through November 26, 2026, 5:00 PM CT.");
  }
  return errors;
}

export function deliveryDateError(deliveryDate, now, ordering) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deliveryDate || ""))) return "Choose a delivery date.";
  const today = chicagoDateString(now);
  if (deliveryDate < today) return "The delivery date has already passed.";
  if (deliveryDate > ordering.emailThrough) return "Email delivery has to be on or before December 24, 2026.";
  return "";
}
