import test from "node:test";
import assert from "node:assert/strict";
import { loadSite } from "./config.mjs";
import { cutoffErrors, deliveryDateError, emailStillOpen, postmarkDeadline, printedDeadline } from "./cutoffs.mjs";
import { chicagoDateString } from "./time.mjs";

const ordering = {
  timezone: "America/Chicago",
  printed: { year: 2026, month: 12, day: 9, hour: 17, minute: 0 },
  emailThrough: "2026-12-24",
  postmark: { year: 2026, month: 11, day: 26, hour: 17, minute: 0 },
};

test("Chicago deadlines are 5:00 PM CT", () => {
  assert.equal(printedDeadline(ordering).toISOString(), "2026-12-09T23:00:00.000Z");
  assert.equal(postmarkDeadline(ordering).toISOString(), "2026-11-26T23:00:00.000Z");
  assert.equal(chicagoDateString(new Date("2026-12-25T05:59:00.000Z")), "2026-12-24");
  assert.equal(chicagoDateString(new Date("2026-12-25T06:00:00.000Z")), "2026-12-25");
});

test("printed orders close after December 9, 2026, 5:00 PM CT, and that minute is still open", () => {
  const deadline = printedDeadline(ordering);
  assert.deepEqual(cutoffErrors({ kind: "printed", postmark: false, now: deadline, ordering }), []);
  const after = new Date(deadline.getTime() + 1);
  assert.match(cutoffErrors({ kind: "printed", postmark: false, now: after, ordering }).join(" "), /December 9, 2026/);
});

test("email orders run through December 24, 2026 Chicago time", () => {
  const lastMinute = new Date("2026-12-25T05:59:00.000Z");
  const nextDay = new Date("2026-12-25T06:00:00.000Z");
  assert.equal(emailStillOpen(lastMinute, ordering), true);
  assert.equal(emailStillOpen(nextDay, ordering), false);
  assert.deepEqual(cutoffErrors({ kind: "email", postmark: false, now: lastMinute, ordering }), []);
  assert.match(cutoffErrors({ kind: "email", postmark: false, now: nextDay, ordering }).join(" "), /December 24, 2026/);
  assert.equal(deliveryDateError("2026-12-24", lastMinute, ordering), "");
  assert.match(deliveryDateError("2026-12-25", lastMinute, ordering), /December 24/);
  assert.match(deliveryDateError("2026-12-01", nextDay, ordering), /already passed/);
});

test("the postmark add-on closes after November 26, 2026, 5:00 PM CT", () => {
  const deadline = postmarkDeadline(ordering);
  assert.deepEqual(cutoffErrors({ kind: "printed", postmark: true, now: deadline, ordering }), []);
  const after = new Date(deadline.getTime() + 60 * 1000);
  assert.match(cutoffErrors({ kind: "printed", postmark: true, now: after, ordering }).join(" "), /November 26, 2026/);
  assert.deepEqual(cutoffErrors({ kind: "printed", postmark: false, now: after, ordering }), []);
});

test("site.json carries the same order-by clock", () => {
  const site = loadSite();
  assert.deepEqual(site.ordering, ordering);
  assert.equal(site.postmarkUpgrade.cutoffLabel.includes("November 26, 2026, 5:00 PM CT"), true);
});
