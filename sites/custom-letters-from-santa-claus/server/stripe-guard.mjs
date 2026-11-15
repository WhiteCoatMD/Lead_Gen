// Test-mode checkout only. A live secret refuses to run unless the owner sets
// LIVE_CHECKOUT_APPROVED=true. That flag stays unset.

export class StripeKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = "StripeKeyError";
  }
}

export function assertStripeSecret(env = process.env) {
  const key = String(env?.STRIPE_SECRET_KEY || "").trim();
  const approved = env?.LIVE_CHECKOUT_APPROVED === "true";
  if (!key) throw new StripeKeyError("STRIPE_SECRET_KEY is not set");
  if (key.startsWith("sk_live_")) {
    if (!approved) throw new StripeKeyError("Refusing to run with a live Stripe key");
    return key;
  }
  if (key.startsWith("sk_test_")) return key;
  throw new StripeKeyError("Refusing to run with an unrecognized Stripe key");
}
