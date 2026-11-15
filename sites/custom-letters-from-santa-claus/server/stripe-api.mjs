import { createHmac, timingSafeEqual } from "node:crypto";

export function signStripePayload(secret, payload, timestamp) {
  const signed = `${timestamp}.${payload}`;
  const v1 = createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export function verifyStripeSignature(rawBody, header, secret, now = Date.now(), toleranceSec = 300) {
  if (!secret || !header || rawBody == null) return false;
  let timestamp = "";
  const signatures = [];
  for (const piece of String(header).split(",")) {
    const eq = piece.indexOf("=");
    if (eq === -1) continue;
    const key = piece.slice(0, eq).trim();
    const value = piece.slice(eq + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }
  const age = Math.abs(now / 1000 - Number(timestamp));
  if (!timestamp || !signatures.length || !Number.isFinite(age) || age > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  return signatures.some((sig) => {
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export function checkoutSessionBody({ order, successUrl, cancelUrl }) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("customer_email", order.parentEmail);
  params.set("client_reference_id", order.id);
  params.set("metadata[order_id]", order.id);
  params.set("payment_intent_data[metadata][order_id]", order.id);
  let index = 0;
  addLine(params, index, order.productName, order.productCents);
  if (order.postmarkCents > 0) {
    index += 1;
    addLine(params, index, "North Pole, Alaska postmark", order.postmarkCents);
  }
  return params;
}

function addLine(params, index, name, amount) {
  params.set(`line_items[${index}][quantity]`, "1");
  params.set(`line_items[${index}][price_data][currency]`, "usd");
  params.set(`line_items[${index}][price_data][unit_amount]`, String(amount));
  params.set(`line_items[${index}][price_data][product_data][name]`, name);
}

export async function createCheckoutSession({ order, successUrl, cancelUrl, secret, fetchImpl }) {
  const body = checkoutSessionBody({ order, successUrl, cancelUrl });
  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": order.id,
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.url || !payload.id) {
    const error = new Error("Stripe did not open checkout");
    error.status = response.status;
    throw error;
  }
  return { id: payload.id, url: payload.url };
}
