import type { CartItem, StoreSettings } from "./types";

// Checkout logic, kept out of the component so it can be tested without a
// browser or a database.
//
// The one rule that matters: the payload sent to the server carries product
// ids and quantities and NOTHING about money. place_order() looks up every
// price itself. The totals computed here are for display only — if they ever
// disagree with the server, the server is right and the receipt shows its
// numbers, not these.

export type FulfillmentType = "pickup" | "delivery";

export type CheckoutForm = {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  recipient_name: string;
  card_message: string;
  fulfillment_type: FulfillmentType;
  fulfillment_date: string;
  fulfillment_window: string;
  delivery_address: string;
  delivery_notes: string;
  discount_code: string;
};

export const emptyForm: CheckoutForm = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  recipient_name: "",
  card_message: "",
  fulfillment_type: "pickup",
  fulfillment_date: "",
  fulfillment_window: "",
  delivery_address: "",
  delivery_notes: "",
  discount_code: "",
};

export type OrderReceipt = {
  order_id: string;
  order_number: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  discount_cents: number;
  discount_applied: boolean;
  total_cents: number;
  payment_status: string;
  payment_provider: string;
};

export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Client-side validation. This is a courtesy to the customer, not a security
 * boundary — place_order() checks all of it again and is the version that
 * counts. Anything rejected here is rejected there too.
 */
export function validateCheckout(
  form: CheckoutForm,
  cart: CartItem[],
  settings: StoreSettings,
): string[] {
  const problems: string[] = [];

  if (cart.length === 0) problems.push("Your bag is empty.");
  if (!settings.accepting_orders) problems.push("The shop is not taking online orders right now.");
  if (!form.customer_name.trim()) problems.push("Please add your name.");
  if (!form.customer_phone.trim()) problems.push("Please add a phone number so we can reach you.");

  if (form.customer_email.trim() && !form.customer_email.includes("@")) {
    problems.push("That email address does not look right.");
  }

  if (form.fulfillment_type === "pickup" && !settings.pickup_enabled) {
    problems.push("Pickup is not available at the moment.");
  }
  if (form.fulfillment_type === "delivery") {
    if (!settings.delivery_enabled) problems.push("Delivery is not available at the moment.");
    if (!form.delivery_address.trim()) problems.push("Please add a delivery address.");
  }

  if (cart.some((item) => item.quantity < 1 || item.quantity > 99)) {
    problems.push("Quantities must be between 1 and 99.");
  }

  return problems;
}

/**
 * The payload for place_order(). Deliberately carries no prices: a browser
 * cannot talk itself into a cheaper order if nothing it says about money is
 * ever read.
 */
export function buildOrderPayload(form: CheckoutForm, cart: CartItem[]) {
  const delivery = form.fulfillment_type === "delivery";
  return {
    customer_name: form.customer_name.trim(),
    customer_phone: form.customer_phone.trim(),
    customer_email: form.customer_email.trim(),
    recipient_name: form.recipient_name.trim(),
    card_message: form.card_message,
    fulfillment_type: form.fulfillment_type,
    fulfillment_date: form.fulfillment_date || "",
    fulfillment_window: form.fulfillment_window,
    // Delivery-only fields are dropped on a pickup order rather than sent and
    // ignored, so the stored record says what actually happened.
    delivery_address: delivery ? form.delivery_address.trim() : "",
    delivery_notes: delivery ? form.delivery_notes : "",
    discount_code: form.discount_code.trim(),
    items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
  };
}

/** Display only. The server recomputes all of this and its answer wins. */
export function estimateTotals(cart: CartItem[], form: CheckoutForm, settings: StoreSettings) {
  const subtotal = cart.reduce((sum, item) => sum + item.product.price_cents * item.quantity, 0);
  const deliveryFee =
    form.fulfillment_type === "delivery" ? settings.delivery_fee_cents : 0;
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}
