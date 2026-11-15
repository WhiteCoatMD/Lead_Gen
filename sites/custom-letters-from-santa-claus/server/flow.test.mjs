import test from "node:test";
import assert from "node:assert/strict";
import { loadSite } from "./config.mjs";
import { handleCheckout } from "./checkout.mjs";
import { handleWebhook } from "./webhook.mjs";
import { handleAdmin } from "./admin.mjs";
import { handleJobs } from "./jobs.mjs";
import { createMemoryDb } from "./memory-db.mjs";
import { signStripePayload } from "./stripe-api.mjs";
import { santaDeployment } from "./gate.mjs";
import { dueForPurge } from "./retention.mjs";

const now = new Date("2026-11-15T18:00:00.000Z");
const child = {
  firstName: "Ada",
  age: "7",
  town: "Grayson",
  friendOrPet: "Milo",
  accomplishment: "She learned to ride a bike",
  workOn: "waiting her turn",
  wishlist: "a red kite",
};

function env(extra = {}) {
  return {
    SANTA_ORDERS_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    ADMIN_PASSWORD: "correct horse",
    CRON_SECRET: "cron-secret",
    EMAIL_SENDING_ENABLED: "false",
    LOB_SENDING_ENABLED: "false",
    ...extra,
  };
}

function site(extra = {}) {
  const copy = structuredClone(loadSite());
  copy.checkout = { enabled: true };
  return Object.assign(copy, extra);
}

function orderBody(extra = {}) {
  return {
    slug: "personalized-letter",
    qty: 1,
    parentEmail: "parent@example.com",
    address: { name: "Pat Parent", street: "1 Main", city: "Grayson", state: "LA", zip: "71245" },
    children: [child],
    ...extra,
  };
}

test("other projects skip the cron and checkout is hidden there", async () => {
  assert.equal(santaDeployment({ VERCEL_PROJECT_ID: "prj_other" }), false);
  assert.equal(santaDeployment({ VERCEL_PROJECT_ID: "prj_Cooa6zu0wXv87rdhtKX7M4nj5gVG" }), true);
  const skipped = await handleJobs({ method: "GET", headers: {} }, { env: { VERCEL_PROJECT_ID: "prj_other", CRON_SECRET: "x" } });
  assert.equal(skipped.body.skipped, true);
  const hidden = await handleCheckout({ method: "POST", headers: {}, body: orderBody() }, { env: { VERCEL_PROJECT_ID: "prj_other" }, site: site() });
  assert.equal(hidden.status, 404);
});

test("checkout stays closed until the site flag is on, and a live key never calls Stripe", async () => {
  const db = createMemoryDb();
  let calls = 0;
  const fetch = async () => { calls += 1; throw new Error("should not be called"); };
  const closed = await handleCheckout({ method: "POST", headers: {}, body: orderBody() }, { env: env(), db, fetch, now, site: loadSite() });
  assert.equal(closed.status, 403);
  const live = await handleCheckout(
    { method: "POST", headers: {}, body: orderBody() },
    { env: env({ STRIPE_SECRET_KEY: "sk_live_nope" }), db, fetch, now, site: site() },
  );
  assert.equal(live.status, 403);
  assert.match(live.body.error, /live Stripe key/);
  assert.equal(calls, 0);
});

test("a paid test order drafts a letter and nothing is sent until it is approved", async () => {
  const db = createMemoryDb();
  const logs = [];
  const mail = [];
  const lob = [];
  let sessionBody = "";
  const fetch = async (url, options) => {
    sessionBody = String(options.body);
    return { ok: true, json: async () => ({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }) };
  };
  const opened = await handleCheckout(
    { method: "POST", headers: { host: "localhost:8787", "x-forwarded-proto": "http" }, body: orderBody() },
    { env: env(), db, fetch, now, site: site() },
  );
  assert.equal(opened.status, 200);
  assert.match(opened.body.url, /^https:\/\/checkout\.stripe\.com\//);
  assert.match(decodeURIComponent(sessionBody), /unit_amount\]=1595/);
  assert.doesNotMatch(sessionBody, /Ada|Grayson|kite/);
  const order = (await db.listQueue())[0];
  const event = {
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: { payment_status: "paid", amount_total: 1595, metadata: { order_id: order.id }, payment_intent: "pi_test" } },
  };
  const raw = JSON.stringify(event);
  const request = {
    method: "POST",
    headers: { "stripe-signature": signStripePayload("whsec_test", raw, Math.floor(now.getTime() / 1000)) },
    rawBody: raw,
  };
  const paid = await handleWebhook(request, {
    env: env(),
    db,
    now,
    log: (line) => logs.push(line),
    generate: async () => "Dear Adah, I guarantee you will get a bike and it will be postmarked.",
    sendMail: async () => mail.push("confirmation"),
  });
  assert.equal(paid.status, 200);
  const queued = (await db.listQueue())[0];
  assert.equal(queued.status, "paid");
  assert.equal(queued.drafts.length, 1);
  assert.equal(queued.drafts[0].status, "draft");
  assert.match(queued.drafts[0].body, /Dear Ada,/);
  assert.doesNotMatch(queued.drafts[0].body, /guarantee|postmark/i);
  assert.match(logs.join("\n"), /would send/);
  assert.equal(mail.length, 0);
  const again = await handleWebhook(request, { env: env(), db, now, log: () => {}, generate: async () => { throw new Error("second"); } });
  assert.equal(again.body.duplicate, true);
  assert.equal((await db.listQueue())[0].drafts.length, 1);

  const jobs = await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, {
    env: env(), db, now, log: (line) => logs.push(line), sendMail: async () => mail.push("letter"), sendLob: async () => lob.push("letter"),
  });
  assert.equal(jobs.body.sent, 0);
  assert.equal(jobs.body.wouldMail, 0);
  assert.equal(mail.length, 0);
  assert.equal(lob.length, 0);

  const cookie = (await handleAdmin(
    { method: "POST", url: "/api/santa/admin", headers: { "x-forwarded-proto": "https" }, body: { action: "login", password: "correct horse" } },
    { env: env(), db, now },
  )).headers["Set-Cookie"];
  const headers = { cookie, "x-forwarded-proto": "https" };
  const blocked = await handleAdmin(
    { method: "POST", url: "/api/santa/admin", headers, body: { action: "approve", draftId: queued.drafts[0].id } },
    { env: env(), db, now },
  );
  assert.equal(blocked.status, 200);
  const approvedRun = await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, {
    env: env(), db, now, log: (line) => logs.push(line), sendMail: async () => mail.push("letter"), sendLob: async () => lob.push("lob"),
  });
  assert.equal(approvedRun.body.wouldMail, 1);
  assert.equal(approvedRun.body.mailed, 0);
  assert.equal(lob.length, 0);
  assert.match(logs.join("\n"), /would mail/);
  assert.equal((await db.getDraft(queued.drafts[0].id)).status, "approved");
});

test("email letters wait for approval and the send flag, then a mailed letter is purged after 60 days", async () => {
  const db = createMemoryDb();
  const mail = [];
  const opened = await handleCheckout(
    { method: "POST", headers: { host: "localhost" }, body: orderBody({
      slug: "email-from-santa",
      recipientEmail: "parent@example.com",
      recipientConfirmed: true,
      deliveryDate: "2026-12-20",
      address: {},
    }) },
    {
      env: env(),
      db,
      now,
      site: site(),
      fetch: async () => ({ ok: true, json: async () => ({ id: "cs_test_email", url: "https://checkout.stripe.com/c/pay/cs_test_email" }) }),
    },
  );
  assert.equal(opened.status, 200);
  const order = (await db.listQueue())[0];
  const raw = JSON.stringify({
    id: "evt_email",
    type: "checkout.session.completed",
    data: { object: { payment_status: "paid", amount_total: order.totalCents, metadata: { order_id: order.id }, payment_intent: "pi_email" } },
  });
  await handleWebhook({
    method: "POST",
    headers: { "stripe-signature": signStripePayload("whsec_test", raw, Math.floor(now.getTime() / 1000)) },
    rawBody: raw,
  }, { env: env(), db, now, log: () => {}, generate: async () => fallbackSafe() });
  const draft = (await db.listQueue())[0].drafts[0];
  const due = new Date("2026-12-20T18:00:00.000Z");
  const heldLogs = [];
  const held = await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, {
    env: env(), db, now: due, log: (line) => heldLogs.push(line), sendMail: async () => mail.push("early-send"),
  });
  assert.equal(held.body.held, 1);
  assert.equal(held.body.wouldSend, 0);
  assert.match(heldLogs.join("\n"), /held unapproved/);
  assert.equal(mail.length, 0);
  const cookie = (await handleAdmin(
    { method: "POST", url: "/api/santa/admin", headers: {}, body: { action: "login", password: "correct horse" } },
    { env: env(), db, now },
  )).headers["Set-Cookie"];
  await handleAdmin(
    { method: "POST", url: "/api/santa/admin", headers: { cookie }, body: { action: "approve", draftId: draft.id } },
    { env: env(), db, now },
  );
  const early = new Date("2026-12-01T18:00:00.000Z");
  const waiting = await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, {
    env: env(), db, now: early, log: () => {}, sendMail: async () => mail.push("early"),
  });
  assert.equal(waiting.body.wouldSend, 0);
  assert.equal(mail.length, 0);
  const logged = [];
  const heldOff = await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, {
    env: env(), db, now: due, log: (line) => logged.push(line), sendMail: async () => mail.push("letter"),
  });
  assert.equal(heldOff.body.wouldSend, 1);
  assert.match(logged.join("\n"), /would send/);
  assert.equal(mail.length, 0);
  assert.equal((await db.getDraft(draft.id)).status, "approved");
  await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, {
    env: env({ EMAIL_SENDING_ENABLED: "true" }),
    db,
    now: due,
    log: () => {},
    sendMail: async () => mail.push("letter"),
  });
  assert.deepEqual(mail, ["letter"]);
  assert.equal((await db.getDraft(draft.id)).status, "sent");

  const sentAt = due;
  const tooSoon = new Date(sentAt.getTime() + 60 * 24 * 60 * 60 * 1000 - 1);
  assert.equal(dueForPurge(await db.getDraft(draft.id), tooSoon), false);
  const duePurge = new Date(sentAt.getTime() + 60 * 24 * 60 * 60 * 1000);
  assert.equal(dueForPurge(await db.getDraft(draft.id), duePurge), true);
  await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, {
    env: env(), db, now: duePurge, log: () => {}, sendMail: async () => mail.push("again"),
  });
  const purged = await db.getOrder(order.id);
  assert.equal(purged.children.length, 0);
  assert.equal(purged.drafts[0].body, "");
  assert.equal(mail.includes("again"), false);
  assert.equal(JSON.stringify(purged).includes("Ada"), false);
});

test("postmark export includes only approved letters and Lob does not get them", async () => {
  const db = createMemoryDb();
  const live = site();
  live.postmarkUpgrade = { ...live.postmarkUpgrade, enabled: true };
  await handleCheckout(
    { method: "POST", headers: { host: "localhost" }, body: orderBody({
      slug: "sibling-bundle",
      postmark: true,
      children: [
        child,
        { ...child, firstName: "Bea" },
      ],
    }) },
    {
      env: env(),
      db,
      now,
      site: live,
      fetch: async () => ({ ok: true, json: async () => ({ id: "cs_test_bundle", url: "https://checkout.stripe.com/c/pay/cs_test_bundle" }) }),
    },
  );
  const order = (await db.listQueue())[0];
  assert.equal(order.totalCents, 2895 + 1495);
  const raw = JSON.stringify({
    id: "evt_bundle",
    type: "checkout.session.completed",
    data: { object: { payment_status: "paid", amount_total: order.totalCents, client_reference_id: order.id, payment_intent: "pi_bundle" } },
  });
  await handleWebhook({
    method: "POST",
    headers: { "stripe-signature": signStripePayload("whsec_test", raw, Math.floor(now.getTime() / 1000)) },
    rawBody: raw,
  }, { env: env(), db, now, log: () => {}, generate: async (prompt) => `Dear ${prompt.match(/Name: (\w+)/)[1]},\n\nGrayson is home. I cannot promise every wish.\n\nSanta` });
  const drafts = (await db.listQueue())[0].drafts;
  const cookie = (await handleAdmin(
    { method: "POST", url: "/api/santa/admin", headers: {}, body: { action: "login", password: "correct horse" } },
    { env: env(), db, now },
  )).headers["Set-Cookie"];
  await handleAdmin(
    { method: "POST", url: "/api/santa/admin", headers: { cookie }, body: { action: "approve", draftId: drafts.find((item) => item.body.includes("Ada")).id } },
    { env: env(), db, now },
  );
  const csv = await handleAdmin({ method: "GET", url: "/api/santa/admin?export=csv", headers: { cookie } }, { env: env(), db, now });
  assert.match(csv.raw, /Ada/);
  assert.doesNotMatch(csv.raw, /Bea/);
  const pdf = await handleAdmin({ method: "GET", url: "/api/santa/admin?export=pdf", headers: { cookie } }, { env: env(), db, now });
  assert.match(pdf.raw, /^%PDF-1\.4/);
  assert.match(pdf.raw, /Ada/);
  assert.doesNotMatch(pdf.raw, /Bea/);
  const lob = [];
  const mailed = await handleJobs({ method: "GET", headers: { authorization: "Bearer cron-secret" } }, {
    env: env({ LOB_SENDING_ENABLED: "true" }),
    db,
    now,
    log: () => {},
    sendLob: async () => lob.push("lob"),
  });
  assert.equal(mailed.body.mailed, 0);
  assert.equal(lob.length, 0);
});

test("a bundle of six children and a missing parent email are refused", async () => {
  const db = createMemoryDb();
  const fetch = async () => { throw new Error("no"); };
  const six = await handleCheckout({
    method: "POST",
    headers: {},
    body: orderBody({ slug: "sibling-bundle", children: [child, child, child, child, child, child] }),
  }, { env: env(), db, now, site: site(), fetch });
  assert.equal(six.status, 400);
  assert.match(six.body.error, /2 to 5/);
  const noParent = await handleCheckout({
    method: "POST",
    headers: {},
    body: orderBody({ parentEmail: "" }),
  }, { env: env(), db, now, site: site(), fetch });
  assert.match(noParent.body.error, /parent or guardian email/i);
});

function fallbackSafe() {
  return "Dear Ada,\n\nGrayson is home. I cannot promise the kite.\n\nSanta";
}
