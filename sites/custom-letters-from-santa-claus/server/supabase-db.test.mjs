import test from "node:test";
import assert from "node:assert/strict";
import { SANTA_SCHEMA } from "./config.mjs";
import { createSupabaseDb } from "./supabase-db.mjs";

test("the service client talks only to the santa schema", async () => {
  const calls = [];
  const state = { order: null, children: [] };
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method, headers: options.headers, body: options.body });
    const path = url.split("/rest/v1/")[1];
    if (options.method === "POST" && path.startsWith("orders")) {
      state.order = { id: "order-1", ...JSON.parse(options.body) };
      return ok([state.order]);
    }
    if (options.method === "POST" && path.startsWith("children")) {
      const rows = JSON.parse(options.body);
      assert.equal(rows.some((row) => Object.keys(row).some((key) => /email/i.test(key))), false);
      state.children = rows.map((row, index) => ({ id: `child-${index}`, ...row }));
      return ok(state.children);
    }
    if (options.method === "GET" && path.startsWith("children")) return ok(state.children);
    if (options.method === "GET" && path.startsWith("orders")) return ok(state.order ? [state.order] : []);
    if (options.method === "GET") return ok([]);
    return ok([]);
  };
  const db = createSupabaseDb({
    SUPABASE_URL: "https://oyrcjrcgvmzmkaipapjm.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  }, fetchImpl);
  const order = await db.insertPending({
    slug: "personalized-letter",
    productName: "Personalized Letter from Santa",
    productCents: 1595,
    postmarkCents: 0,
    totalCents: 1595,
    postmark: false,
    letterCount: 1,
    parentEmail: "parent@example.com",
    recipientEmail: "",
    recipientConfirmed: false,
    deliveryDate: "",
    address: { name: "Pat", street: "1 Main", city: "Grayson", state: "LA", zip: "71245" },
    children: [{ firstName: "Ada", age: "7", town: "Grayson", accomplishment: "A bike" }],
  });
  assert.equal(order.parentEmail, "parent@example.com");
  assert.equal(order.children[0].firstName, "Ada");
  assert.equal(calls.length >= 2, true);
  for (const call of calls) {
    assert.match(call.url, /\/rest\/v1\//);
    assert.doesNotMatch(call.url, /\/rest\/v1\/public/);
    assert.equal(call.headers["Accept-Profile"], SANTA_SCHEMA);
    assert.equal(call.headers["Content-Profile"], SANTA_SCHEMA);
    assert.equal(call.headers.Authorization, "Bearer service-role-test");
  }
});

function ok(data) {
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
}
