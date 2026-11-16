import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDb, postgresConfig } from "./postgres-db.mjs";

test("Postgres uses POSTGRES_URL, turns prepared statements off, and requires SSL", () => {
  assert.throws(() => postgresConfig({ SUPABASE_SERVICE_ROLE_KEY: "service-role", SUPABASE_URL: "https://example.supabase.co" }), /POSTGRES_URL/);
  const config = postgresConfig({
    POSTGRES_URL: "postgres://postgres.oyrcjrcgvmzmkaipapjm:secret@aws-0.pooler.supabase.com:6543/postgres",
    SUPABASE_SERVICE_ROLE_KEY: "unused",
    SUPABASE_SECRET_KEY: "unused",
  });
  assert.match(config.url, /pooler\.supabase\.com:6543/);
  assert.equal(config.options.prepare, false);
  assert.equal(config.options.ssl, "require");
  assert.equal(config.options.max, 1);
  const source = readFileSync(new URL("./postgres-db.mjs", import.meta.url), "utf8");
  assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(source.includes("/rest/v1/"), false);
});

test("order writes are parameterized and stay in the santa schema", async () => {
  const calls = [];
  const sql = fakeSql(calls, (text, values) => {
    if (text.includes("insert into santa.orders")) {
      return [{
        id: "order-1",
        product: values[0],
        product_name: values[1],
        product_cents: values[2],
        postmark_cents: values[3],
        amount_cents: values[4],
        status: "pending",
        parent_email: values[5],
        recipient_email: values[6],
        recipient_confirmed: values[7],
        delivery_date: values[8],
        mailing_name: values[9],
        mailing_street: values[10],
        mailing_city: values[11],
        mailing_state: values[12],
        mailing_zip: values[13],
        postmark_addon: values[14],
        letter_count: values[15],
        created_at: null,
        updated_at: null,
        identity_redacted_at: null,
        children_redacted_at: null,
        stripe_session_id: null,
        stripe_payment_intent_id: null,
      }];
    }
    if (text.includes("from santa.children")) {
      return [{
        id: "child-1",
        order_id: "order-1",
        position: 1,
        first_name: "Ada",
        age: "7",
        town: "Grayson",
        friend_or_pet: null,
        accomplishment: "A bike",
        work_on: null,
        wishlist: null,
      }];
    }
    return [];
  });
  const db = createDb({ POSTGRES_URL: "postgres://example" }, sql);
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
  const childInsert = calls.find((call) => call.text.includes("insert into santa.children"));
  assert.ok(childInsert);
  assert.doesNotMatch(childInsert.text, /\bemail\b/);
  for (const call of calls) {
    assert.match(call.text, /\bsanta\./);
    assert.doesNotMatch(call.text, /\bpublic\./);
    assert.equal(call.text.includes("parent@example.com"), false);
    assert.equal(call.text.includes("1 Main"), false);
  }
  assert.equal(calls[0].values.includes("parent@example.com"), true);
});

test("login attempts older than the cutoff are deleted by parameter", async () => {
  const calls = [];
  const before = new Date("2026-11-14T18:00:00.000Z");
  const sql = fakeSql(calls, () => [{ id: "attempt-1" }]);
  const db = createDb({ POSTGRES_URL: "postgres://example" }, sql);
  const removed = await db.purgeLoginAttempts(before);
  assert.equal(removed, 1);
  assert.match(calls[0].text, /delete from santa\.admin_login_attempts where attempted_at </i);
  assert.equal(calls[0].text.includes("2026-11-14"), false);
  assert.equal(calls[0].values[0], before);
});

function fakeSql(calls, handler) {
  function sql(first, ...values) {
    if (first && Array.isArray(first.raw)) {
      const text = first.reduce((acc, part, index) => acc + part + (index < values.length ? `$${index + 1}` : ""), "");
      calls.push({ text, values });
      return Promise.resolve(handler(text, values) ?? []);
    }
    return { row: first, columns: values };
  }
  sql.begin = (fn) => fn(sql);
  sql.json = (value) => value;
  return sql;
}
