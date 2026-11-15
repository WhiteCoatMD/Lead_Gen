import { checkoutOpen, loadSite } from "./config.mjs";
import { denyUnlessSanta } from "./gate.mjs";
import { validateOrder } from "./order.mjs";
import { assertStripeSecret, StripeKeyError } from "./stripe-guard.mjs";
import { createCheckoutSession } from "./stripe-api.mjs";
import { createDb } from "./postgres-db.mjs";

export async function handleCheckout(request, deps = {}) {
  const env = deps.env || process.env;
  const denied = denyUnlessSanta(env);
  if (denied) return denied;
  if (request.method !== "POST") return { status: 405, body: { error: "Use POST" } };
  const site = deps.site || loadSite();
  if (!checkoutOpen(site, env)) return { status: 403, body: { error: "Checkout is not open." } };
  let secret;
  try {
    secret = assertStripeSecret(env);
  } catch (error) {
    if (error instanceof StripeKeyError) return { status: 403, body: { error: error.message } };
    throw error;
  }
  const validated = validateOrder(request.body || {}, { now: deps.now || new Date(), site });
  if (!validated.ok) return { status: 400, body: { error: validated.errors.join(" ") } };
  const db = deps.db || createDb(env);
  const pending = await db.insertPending(validated.order);
  const base = publicBase(request);
  try {
    const session = await createCheckoutSession({
      order: { ...validated.order, id: pending.id },
      successUrl: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/checkout/cancel`,
      secret,
      fetchImpl: deps.fetch || globalThis.fetch,
    });
    await db.setSession(pending.id, session.id);
    await db.audit({ orderId: pending.id, action: "checkout_opened", actor: "checkout", detail: { session: session.id } });
    return { status: 200, body: { url: session.url } };
  } catch {
    await db.cancelOrder(pending.id);
    return { status: 502, body: { error: "Checkout did not open. Nothing was charged." } };
  }
}

function publicBase(request) {
  const host = String(request.headers?.["x-forwarded-host"] || request.headers?.host || "").split(",")[0].trim();
  const proto = String(request.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `${proto}://${host}`;
  if (host && /customlettersfromsantaclaus\.com$/.test(host)) return `https://${host}`;
  if (host && host.includes("custom-letters-from-santa") && host.endsWith(".vercel.app")) return `https://${host}`;
  return "https://customlettersfromsantaclaus.com";
}
