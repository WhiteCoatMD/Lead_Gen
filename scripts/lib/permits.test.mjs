import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePermit, oldestCheckedDays } from "./permits.mjs";

const today = new Date("2026-09-23T12:00:00Z");
const fact = (over = {}) => ({ topic: "permit", question: "Do I need a permit?", answer: "Yes, for any new fence.", sourceUrl: "https://library.municode.com/la/monroe", sourceTitle: "Monroe Code of Ordinances §1", checked: "2026-09-20", ...over });
const valid = () => ({
  id: "monroe-la", name: "City of Monroe",
  office: { name: "Permits office", phone: "318-555-0100", address: "400 Lea Joyner Expy, Monroe, LA", url: "https://example.gov/permits", sourceUrl: "https://example.gov/permits", checked: "2026-09-20" },
  facts: [fact(), fact({ topic: "digging", question: "Call before digging?", answer: "Yes — call Louisiana 811." })],
});

test("a complete, fresh guide has no problems", () => {
  assert.deepEqual(validatePermit(valid(), today), []);
});

test("a fact with no source is a problem", () => {
  const d = valid(); delete d.facts[0].sourceUrl;
  assert.match(validatePermit(d, today).join("\n"), /source/i);
});

test("a fact checked more than a year ago is a problem", () => {
  const d = valid(); d.facts[0].checked = "2025-09-01";
  assert.match(validatePermit(d, today).join("\n"), /re-check/i);
});

test("a date in the future or not a date is a problem", () => {
  const d = valid(); d.facts[0].checked = "2027-01-01"; d.facts[1].checked = "last week";
  assert.equal(validatePermit(d, today).length, 2);
});

test("the permit question and the 811 fact are required", () => {
  const d = valid(); d.facts = [fact({ topic: "height" })];
  const out = validatePermit(d, today).join("\n");
  assert.match(out, /permit/); assert.match(out, /811|digging/);
});

test("answers may not carry prices or credential words", () => {
  const d = valid(); d.facts[0].answer = "Yes. The fee is $50 and it must be pulled by a licensed contractor.";
  const out = validatePermit(d, today).join("\n");
  assert.match(out, /\$/); assert.match(out, /licensed/);
});

test("oldestCheckedDays reports the stalest fact", () => {
  const d = valid(); d.facts[1].checked = "2025-11-02";
  assert.equal(oldestCheckedDays(d, today), 325);
});
