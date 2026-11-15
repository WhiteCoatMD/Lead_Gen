import test from "node:test";
import assert from "node:assert/strict";
import { StripeKeyError, assertStripeSecret } from "./stripe-guard.mjs";

test("a test secret is allowed and a live secret is refused unless the flag is exactly true", () => {
  assert.equal(assertStripeSecret({ STRIPE_SECRET_KEY: "sk_test_abc" }), "sk_test_abc");
  assert.throws(() => assertStripeSecret({ STRIPE_SECRET_KEY: "sk_live_abc" }), StripeKeyError);
  assert.throws(() => assertStripeSecret({ STRIPE_SECRET_KEY: "sk_live_abc", LIVE_CHECKOUT_APPROVED: "false" }), /live Stripe key/);
  assert.throws(() => assertStripeSecret({ STRIPE_SECRET_KEY: "sk_live_abc", LIVE_CHECKOUT_APPROVED: "TRUE" }), /live Stripe key/);
  assert.throws(() => assertStripeSecret({ STRIPE_SECRET_KEY: "sk_live_abc" }), /live Stripe key/);
  assert.equal(assertStripeSecret({ STRIPE_SECRET_KEY: "sk_live_abc", LIVE_CHECKOUT_APPROVED: "true" }), "sk_live_abc");
  assert.equal(assertStripeSecret({ STRIPE_SECRET_KEY: "rk_live_abc", LIVE_CHECKOUT_APPROVED: "true" }), "rk_live_abc");
  assert.throws(() => assertStripeSecret({ STRIPE_SECRET_KEY: "rk_live_abc" }), /live Stripe key/);
  assert.throws(() => assertStripeSecret({ STRIPE_SECRET_KEY: "rk_live_abc", LIVE_CHECKOUT_APPROVED: "false" }), /live Stripe key/);
  assert.equal(assertStripeSecret({ STRIPE_SECRET_KEY: "rk_test_abc" }), "rk_test_abc");
  assert.throws(() => assertStripeSecret({}), /not set/);
  assert.throws(() => assertStripeSecret({ STRIPE_SECRET_KEY: "pk_live_abc", LIVE_CHECKOUT_APPROVED: "true" }), /unrecognized/);
});
