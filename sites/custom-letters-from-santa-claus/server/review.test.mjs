import test from "node:test";
import assert from "node:assert/strict";
import { handleAdmin } from "./admin.mjs";
import { handleCheckout } from "./checkout.mjs";
import { handleJobs } from "./jobs.mjs";
import { handleWebhook } from "./webhook.mjs";
import { loadSite } from "./config.mjs";
import { createMemoryDb } from "./memory-db.mjs";
import { childPurgeDue, parentIdentityDue, unpaidChildPurgeDue } from "./retention.mjs";
import { signStripePayload } from "./stripe-api.mjs";

const now = new Date("2026-11-15T18:00:00.000Z");
const env = {
  SANTA_ORDERS_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  ADMIN_PASSWORD: "correct horse",
  CRON_SECRET: "cron-secret",
};

function loginRequest(password, ip = "203.0.113.8") {
  return {
    method: "POST",
    url: "/api/santa/admin",
    headers: { "x-forwarded-for": ip },
    body: { action: "login", password },
  };
}

test("admin login checks the lockout before the password", async () => {
  const calls = [];
  const broken = {
    async countLoginFailures() { calls.push("count"); throw new Error("database down"); },
    async recordLoginFailure() { calls.push("record"); throw new Error("database down"); },
  };
  const ok = await handleAdmin(loginRequest("correct horse"), { env, db: broken, now });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls, ["count"]);

  const down = await handleAdmin(loginRequest("nope"), { env, db: broken, now });
  assert.equal(down.status, 401);
  assert.doesNotMatch(String(down.body.error), /database/i);

  const db = createMemoryDb();
  for (let i = 0; i < 5; i += 1) {
    const failed = await handleAdmin(loginRequest("nope"), { env, db, now });
    assert.equal(failed.status, 401);
  }
  const blocked = await handleAdmin(loginRequest("nope"), { env, db, now });
  assert.equal(blocked.status, 429);
  const blockedRight = await handleAdmin(loginRequest("correct horse"), { env, db, now });
  assert.equal(blockedRight.status, 429);
  const other = await handleAdmin(loginRequest("correct horse", "203.0.113.9"), { env, db, now });
  assert.equal(other.status, 200);
  const later = new Date(now.getTime() + 15 * 60 * 1000 + 1000);
  const again = await handleAdmin(loginRequest("correct horse"), { env, db, now: later });
  assert.equal(again.status, 200);
});

test("the jobs run deletes login attempts older than one day", async () => {
  const db = createMemoryDb();
  await db.recordLoginFailure("203.0.113.8", new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000));
  await db.recordLoginFailure("203.0.113.8", new Date(now.getTime() - 2 * 60 * 60 * 1000));
  const result = await handleJobs(
    { method: "GET", headers: { authorization: "Bearer cron-secret" } },
    { env, db, now, log: () => {} },
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.loginAttemptsPurged, 1);
  assert.equal(await db.countLoginFailures("203.0.113.8", new Date(0)), 1);
});

test("delete family removes a Stripe customer when the order has one", async () => {
  const db = createMemoryDb();
  const pending = await db.insertPending({
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
    children: [{ firstName: "Ada", age: "7", town: "Grayson", accomplishment: "She learned to ride a bike" }],
  });
  await db.markPaid(pending.id, "pi_test", "cus_test123");
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization });
    return { status: 200, ok: true, json: async () => ({ id: "cus_test123", deleted: true }) };
  };
  const cookie = (await handleAdmin(loginRequest("correct horse"), { env, db, now })).headers["Set-Cookie"];
  const removed = await handleAdmin({
    method: "POST",
    url: "/api/santa/admin",
    headers: { cookie },
    body: { action: "delete_family", orderId: pending.id },
  }, { env, db, now, fetch });
  assert.equal(removed.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].url, "https://api.stripe.com/v1/customers/cus_test123");
  assert.equal(calls[0].auth, "Bearer sk_test_123");
  const gone = await db.getOrder(pending.id);
  assert.equal(gone.parentEmail, "");
  assert.equal(gone.children.length, 0);

  const plain = await db.insertPending({
    slug: "email-from-santa",
    productName: "Email from Santa",
    productCents: 695,
    postmarkCents: 0,
    totalCents: 695,
    postmark: false,
    letterCount: 1,
    parentEmail: "parent@example.com",
    recipientEmail: "parent@example.com",
    recipientConfirmed: true,
    deliveryDate: "2026-12-20",
    address: { name: "", street: "", city: "", state: "", zip: "" },
    children: [{ firstName: "Ada", age: "7", town: "Grayson" }],
  });
  calls.length = 0;
  const skipped = await handleAdmin({
    method: "POST",
    url: "/api/santa/admin",
    headers: { cookie },
    body: { action: "delete_family", orderId: plain.id },
  }, { env, db, now, fetch });
  assert.equal(skipped.status, 200);
  assert.equal(calls.length, 0);
});

test("CHECKOUT_ENABLED opens checkout only outside production", async () => {
  const site = loadSite();
  assert.equal(site.checkout.enabled, false);
  let calls = 0;
  const fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ id: "cs_test_env", url: "https://checkout.stripe.com/c/pay/cs_test_env" }) };
  };
  const db = createMemoryDb();
  const body = {
    slug: "email-from-santa",
    qty: 1,
    parentEmail: "parent@example.com",
    recipientEmail: "parent@example.com",
    recipientConfirmed: true,
    deliveryDate: "2026-12-20",
    children: [{ firstName: "Ada", age: "7", town: "Grayson", accomplishment: "She learned to ride a bike" }],
  };
  const request = { method: "POST", headers: { host: "localhost" }, body };
  const production = await handleCheckout(request, {
    env: { ...env, CHECKOUT_ENABLED: "true", VERCEL_ENV: "production" },
    db, fetch, now, site,
  });
  assert.equal(production.status, 403);
  assert.equal(calls, 0);
  const preview = await handleCheckout(request, {
    env: { ...env, CHECKOUT_ENABLED: "true", VERCEL_ENV: "preview" },
    db, fetch, now, site,
  });
  assert.equal(preview.status, 200);
  assert.equal(calls, 1);
  const live = await handleCheckout(request, {
    env: { ...env, CHECKOUT_ENABLED: "true", VERCEL_ENV: "preview", STRIPE_SECRET_KEY: "sk_live_no" },
    db, fetch, now, site,
  });
  assert.equal(live.status, 403);
  assert.match(live.body.error, /live Stripe key/);
});

test("purge rules cover delivery, rejection, unpaid orders, and parent details", () => {
  const sentAt = "2026-09-01T00:00:00.000Z";
  const later = new Date("2026-11-15T18:00:00.000Z");
  assert.equal(childPurgeDue({ status: "mailed", sentAt, redactedAt: "" }, later), true);
  assert.equal(childPurgeDue({ status: "draft", sentAt: "", redactedAt: "" }, later), false);
  assert.equal(childPurgeDue({ status: "rejected", reviewedAt: "2026-09-01T00:00:00.000Z", redactedAt: "" }, later), true);
  assert.equal(childPurgeDue({ status: "rejected", reviewedAt: "2026-11-01T00:00:00.000Z", redactedAt: "" }, later), false);
  const old = "2026-11-01T18:00:00.000Z";
  assert.equal(unpaidChildPurgeDue({ status: "pending", createdAt: old, children: [{ id: "c" }], drafts: [] }, later), true);
  assert.equal(unpaidChildPurgeDue({ status: "canceled", createdAt: old, children: [{ id: "c" }], drafts: [] }, later), true);
  assert.equal(unpaidChildPurgeDue({ status: "paid", createdAt: old, children: [{ id: "c" }], drafts: [] }, later), false);
  assert.equal(unpaidChildPurgeDue({ status: "pending", createdAt: "2026-11-14T18:00:00.000Z", children: [{ id: "c" }], drafts: [] }, later), false);
  const delivered = {
    status: "paid",
    drafts: [{ status: "mailed", sentAt }],
  };
  assert.equal(parentIdentityDue(delivered, later), true);
  assert.equal(parentIdentityDue({ status: "paid", drafts: [{ status: "approved" }, { status: "mailed", sentAt }] }, later), false);
  assert.equal(parentIdentityDue({ status: "paid", identityRedactedAt: sentAt, drafts: [{ status: "mailed", sentAt }] }, later), false);
});

test("a second paid event does not draft again, and one send failure does not stop the next letter", async () => {
  const db = createMemoryDb();
  const site = structuredClone(loadSite());
  site.checkout = { enabled: true };
  const fetch = async () => ({ ok: true, json: async () => ({ id: "cs_test_once", url: "https://checkout.stripe.com/c/pay/cs_test_once" }) });
  await handleCheckout({
    method: "POST",
    headers: { host: "localhost" },
    body: {
      slug: "sibling-bundle",
      qty: 1,
      parentEmail: "parent@example.com",
      address: { name: "Pat", street: "1 Main", city: "Grayson", state: "LA", zip: "71245" },
      children: [
        { firstName: "Ada", age: "7", town: "Grayson", accomplishment: "She learned to ride a bike" },
        { firstName: "Bea", age: "5", town: "Grayson", accomplishment: "She read a book" },
      ],
    },
  }, { env, db, fetch, now, site });
  const order = (await db.listQueue())[0];
  const raw = (id) => JSON.stringify({
    id,
    type: "checkout.session.completed",
    data: { object: { payment_status: "paid", amount_total: order.totalCents, metadata: { order_id: order.id }, payment_intent: "pi_once" } },
  });
  const first = raw("evt_first");
  await handleWebhook({
    method: "POST",
    headers: { "stripe-signature": signStripePayload("whsec_test", first, Math.floor(now.getTime() / 1000)) },
    rawBody: first,
  }, { env, db, now, log: () => {}, generate: async (prompt) => `Dear ${prompt.match(/Name: (\w+)/)[1]},\n\nGrayson is home.\n\nSanta` });
  assert.equal((await db.getOrder(order.id)).drafts.length, 2);
  const second = raw("evt_second");
  const again = await handleWebhook({
    method: "POST",
    headers: { "stripe-signature": signStripePayload("whsec_test", second, Math.floor(now.getTime() / 1000)) },
    rawBody: second,
  }, { env, db, now, log: () => {}, generate: async () => { throw new Error("should not draft"); } });
  assert.equal(again.body.duplicate, true);
  assert.equal((await db.getOrder(order.id)).drafts.length, 2);

  const cookie = (await handleAdmin(loginRequest("correct horse"), { env, db, now })).headers["Set-Cookie"];
  for (const draft of (await db.getOrder(order.id)).drafts) {
    await handleAdmin({
      method: "POST",
      url: "/api/santa/admin",
      headers: { cookie },
      body: { action: "approve", draftId: draft.id },
    }, { env, db, now });
  }
  const calls = [];
  const run = await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, {
    env: { ...env, LOB_SENDING_ENABLED: "true" },
    db,
    now,
    log: () => {},
    sendLob: async (_order, draft) => {
      calls.push(draft.id);
      if (calls.length === 1) throw new Error("Lob refused this one");
      return { id: "ltr_ok" };
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(run.body.failed, 1);
  assert.equal(run.body.mailed, 1);
  const after = await db.getOrder(order.id);
  assert.equal(after.drafts.filter((draft) => draft.status === "mailed").length, 1);
  assert.match(after.drafts.find((draft) => draft.status === "approved").sendError, /Lob refused/);
});

test("mark shipped starts the postmark retention clock, and delete family removes contact details", async () => {
  const db = createMemoryDb();
  const pending = await db.insertPending({
    slug: "personalized-letter",
    productName: "Personalized Letter from Santa",
    productCents: 1595,
    postmarkCents: 995,
    totalCents: 2590,
    postmark: true,
    letterCount: 1,
    parentEmail: "parent@example.com",
    recipientEmail: "",
    recipientConfirmed: false,
    deliveryDate: "",
    address: { name: "Pat", street: "1 Main", city: "Grayson", state: "LA", zip: "71245" },
    children: [{ firstName: "Ada", age: "7", town: "Grayson", accomplishment: "She learned to ride a bike" }],
  });
  await db.markPaid(pending.id, "pi");
  const draft = await db.insertDraft({
    orderId: pending.id,
    childId: pending.children[0].id,
    body: "Dear Ada,\n\nGrayson is home.\n\nSanta",
    model: "fallback",
    status: "approved",
  });
  const cookie = (await handleAdmin(loginRequest("correct horse"), { env, db, now })).headers["Set-Cookie"];
  const shipped = await handleAdmin({
    method: "POST",
    url: "/api/santa/admin",
    headers: { cookie },
    body: { action: "mark_shipped", draftId: draft.id },
  }, { env, db, now });
  assert.equal(shipped.status, 200);
  assert.equal((await db.getDraft(draft.id)).status, "mailed");
  const later = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, { env, db, now: later, log: () => {} });
  const purged = await db.getOrder(pending.id);
  assert.equal(purged.children.length, 0);
  assert.equal(purged.parentEmail, "");
  assert.equal(purged.address.name, "");
  assert.equal(purged.totalCents, 2590);

  const fresh = await db.insertPending({
    slug: "email-from-santa",
    productName: "Email from Santa",
    productCents: 695,
    postmarkCents: 0,
    totalCents: 695,
    postmark: false,
    letterCount: 1,
    parentEmail: "parent@example.com",
    recipientEmail: "parent@example.com",
    recipientConfirmed: true,
    deliveryDate: "2026-12-20",
    address: { name: "", street: "", city: "", state: "", zip: "" },
    children: [{ firstName: "Ada", age: "7", town: "Grayson", accomplishment: "She learned to ride a bike" }],
  });
  const removed = await handleAdmin({
    method: "POST",
    url: "/api/santa/admin",
    headers: { cookie },
    body: { action: "delete_family", orderId: fresh.id },
  }, { env, db, now });
  assert.equal(removed.status, 200);
  const gone = await db.getOrder(fresh.id);
  assert.equal(gone.children.length, 0);
  assert.equal(gone.parentEmail, "");
  assert.equal(gone.totalCents, 695);
});
