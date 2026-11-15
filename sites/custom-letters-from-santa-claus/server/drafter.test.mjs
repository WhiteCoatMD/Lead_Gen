import test from "node:test";
import assert from "node:assert/strict";
import { handleDrafter } from "./drafter.mjs";
import { handleWebhook } from "./webhook.mjs";
import { createMemoryDb } from "./memory-db.mjs";
import { loadSite } from "./config.mjs";
import { handleCheckout } from "./checkout.mjs";
import { signStripePayload } from "./stripe-api.mjs";
import { postgresConfig } from "./postgres-db.mjs";

const now = new Date("2026-11-15T18:00:00.000Z");
const token = "drafter-token-value";
const env = {
  SANTA_ORDERS_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  DRAFTER_API_TOKEN: token,
};

function auth(header) {
  return { authorization: header };
}

async function paidTemplateOrder(db) {
  const site = structuredClone(loadSite());
  site.checkout = { enabled: true };
  const fetch = async () => ({ ok: true, json: async () => ({ id: "cs_test_draft", url: "https://checkout.stripe.com/c/pay/cs_test_draft" }) });
  await handleCheckout({
    method: "POST",
    headers: { host: "localhost" },
    body: {
      slug: "personalized-letter",
      qty: 1,
      parentEmail: "parent@example.com",
      address: { name: "Pat Parent", street: "9 Secret Lane", city: "Grayson", state: "LA", zip: "71245" },
      children: [{ firstName: "Ada", age: "7", town: "Grayson", friendOrPet: "Milo", accomplishment: "She learned to ride a bike", workOn: "waiting her turn", wishlist: "a red kite" }],
    },
  }, { env, db, fetch, now, site });
  const order = (await db.listQueue())[0];
  const raw = JSON.stringify({
    id: "evt_template",
    type: "checkout.session.completed",
    data: { object: { payment_status: "paid", amount_total: order.totalCents, metadata: { order_id: order.id }, payment_intent: "pi_template" } },
  });
  await handleWebhook({
    method: "POST",
    headers: { "stripe-signature": signStripePayload("whsec_test", raw, Math.floor(now.getTime() / 1000)) },
    rawBody: raw,
  }, { env, db, now, log: () => {} });
  return db.getOrder(order.id);
}

test("a paid order without an AI key stores a template draft", async () => {
  const db = createMemoryDb();
  const order = await paidTemplateOrder(db);
  assert.equal(order.drafts.length, 1);
  assert.equal(order.drafts[0].source, "template");
  assert.match(order.drafts[0].body, /Dear Ada,/);
  assert.equal(env.AI_GATEWAY_API_KEY, undefined);
});

test("the drafter API requires the bearer token and hides parent contact details", async () => {
  const db = createMemoryDb();
  const order = await paidTemplateOrder(db);
  const pendingUrl = "/api/santa/drafter/pending";
  const missing = await handleDrafter({ method: "GET", url: pendingUrl, headers: {} }, { env, db });
  assert.equal(missing.status, 401);
  const wrong = await handleDrafter({ method: "GET", url: pendingUrl, headers: auth("Bearer nope") }, { env, db });
  assert.equal(wrong.status, 401);
  const listed = await handleDrafter({ method: "GET", url: pendingUrl, headers: auth(`Bearer ${token}`) }, { env, db });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.letters.length, 1);
  const letter = listed.body.letters[0];
  assert.equal(letter.orderId, order.id);
  assert.equal(letter.letterId, order.drafts[0].id);
  assert.equal(letter.letterType, "printed");
  assert.equal(letter.firstName, "Ada");
  assert.equal(letter.age, "7");
  assert.equal(letter.details.town, "Grayson");
  assert.equal(letter.details.wishlist, "a red kite");
  assert.match(letter.tone, /Do not promise gifts/);
  const dumped = JSON.stringify(listed.body);
  assert.equal(dumped.includes("parent@example.com"), false);
  assert.equal(dumped.includes("9 Secret Lane"), false);
  assert.equal(dumped.includes("Pat Parent"), false);

  const written = await handleDrafter({
    method: "POST",
    url: `/api/santa/drafter/letters/${letter.letterId}`,
    headers: auth(`Bearer ${token}`),
    body: { body: "Dear Ada,\n\nGrayson is lucky to have you. I cannot promise the kite.\n\nSanta" },
  }, { env, db });
  assert.equal(written.status, 200);
  assert.equal(written.body.source, "assistant");
  assert.equal(written.body.status, "draft");
  const saved = await db.getDraft(letter.letterId);
  assert.equal(saved.status, "draft");
  assert.equal(saved.source, "assistant");
  assert.match(saved.body, /lucky to have you/);

  const gone = await handleDrafter({ method: "GET", url: pendingUrl, headers: auth(`Bearer ${token}`) }, { env, db });
  assert.equal(gone.body.letters.length, 0);

  await db.updateDraft(saved.id, { status: "approved" });
  const late = await handleDrafter({
    method: "POST",
    url: `/api/santa/drafter/letters/${saved.id}`,
    headers: auth(`Bearer ${token}`),
    body: { body: "Dear Ada, this should not replace an approved letter." },
  }, { env, db });
  assert.equal(late.status, 409);
  assert.match((await db.getDraft(saved.id)).body, /lucky to have you/);
});

test("the database client uses POSTGRES_URL and not the Data API keys", () => {
  const config = postgresConfig({
    POSTGRES_URL: "postgres://postgres.oyrcjrcgvmzmkaipapjm:secret@aws-0.pooler.supabase.com:6543/postgres",
    SUPABASE_URL: "https://oyrcjrcgvmzmkaipapjm.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_SECRET_KEY: "other-secret",
  });
  assert.match(config.url, /^postgres:/);
  assert.equal(config.options.prepare, false);
  assert.equal(config.options.ssl, "require");
  assert.equal(JSON.stringify(config).includes("service-role"), false);
  assert.equal(JSON.stringify(config).includes("other-secret"), false);
});
