import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { cleanPage } from "../api/lead.js";

test("cleanPage keeps a path and drops anything else", () => {
  assert.equal(cleanPage("/fence-calculator"), "/fence-calculator");
  assert.equal(cleanPage("  /fence-permit-monroe  "), "/fence-permit-monroe");
  assert.equal(cleanPage("/" + "a".repeat(200)).length, 120);
  for (const bad of ["https://evil.example/", "fence-calculator", "", undefined, null, 42, ["/x"], { p: "/x" }]) {
    assert.equal(cleanPage(bad), "", `kept ${JSON.stringify(bad)}`);
  }
});

// Runs the real handler with fetch stubbed: the Resend call and the event
// store call are captured instead of sent.
async function submit(body) {
  const calls = [];
  const realFetch = globalThis.fetch;
  const env = { ...process.env };
  process.env.RESEND_API_KEY = "test-key";
  process.env.EVENTS_INGEST_TOKEN = "test-token";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
  const res = { code: 0, out: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.out = o; return this; } };
  try {
    await handler({ method: "POST", headers: { "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` }, body }, res);
  } finally {
    globalThis.fetch = realFetch;
    process.env = env;
  }
  return { res, email: calls.find((c) => c.url.includes("resend")), event: calls.find((c) => c.url.includes("record_event")) };
}

test("a delivered lead records the page it came from, and the email does not mention it", async () => {
  const { res, email, event } = await submit({ site: "twin-city-fences", name: "Pat", phone: "318-555-0100", page: "/fence-calculator" });
  assert.equal(res.code, 200);
  assert.equal(event.body.p_type, "lead_delivered");
  assert.equal(event.body.p_site, "twin-city-fences");
  assert.equal(event.body.p_path, "/fence-calculator");
  assert.doesNotMatch(email.body.text, /fence-calculator/);
});

test("a lead with no page or a bad one is still delivered, with an empty path", async () => {
  for (const page of [undefined, "javascript:alert(1)"]) {
    const { res, event } = await submit({ site: "twin-city-fences", name: "Pat", phone: "318-555-0100", page });
    assert.equal(res.code, 200);
    assert.equal(event.body.p_path, "");
  }
});
