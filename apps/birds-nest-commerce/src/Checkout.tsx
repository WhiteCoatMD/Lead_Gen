import { useState } from "react";
import { supabase, configured } from "./lib/supabase";
import type { CartItem, StoreSettings } from "./types";
import {
  buildOrderPayload,
  emptyForm,
  estimateTotals,
  money,
  validateCheckout,
  type CheckoutForm,
  type OrderReceipt,
} from "./order";

/**
 * The checkout the storefront was missing. The bag could be filled but never
 * turned into an order — only the admin could write to `orders`, so a customer
 * had nowhere to go.
 *
 * This submits to place_order(), which prices everything server-side. Payment
 * is deliberately not wired: an order lands as `unpaid` and the shop takes
 * payment its usual way until a processor is chosen. That seam is the whole
 * point — adding Stripe or Square later means handling the returned order,
 * not rebuilding this.
 */
export function Checkout({
  cart,
  settings,
  onPlaced,
  onCancel,
}: {
  cart: CartItem[];
  settings: StoreSettings;
  onPlaced: (receipt: OrderReceipt) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CheckoutForm>({
    ...emptyForm,
    fulfillment_type: settings.pickup_enabled ? "pickup" : "delivery",
  });
  const [problems, setProblems] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const totals = estimateTotals(cart, form, settings);
  const delivery = form.fulfillment_type === "delivery";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateCheckout(form, cart, settings);
    setProblems(found);
    if (found.length > 0) return;

    // Without a Supabase project this is preview mode. Say so plainly rather
    // than show a fake confirmation for an order nobody received.
    if (!configured || !supabase) {
      setProblems([
        "This is preview mode — no order was placed. Connect the shop's Supabase project to take real orders.",
      ]);
      return;
    }

    setSending(true);
    const { data, error } = await supabase.rpc("place_order", {
      payload: buildOrderPayload(form, cart),
    });
    setSending(false);

    if (error) {
      // place_order raises a plain message for anything a customer can fix
      // (out of stock, delivery unavailable, store closed).
      setProblems([error.message || "We could not place that order. Please call the shop."]);
      return;
    }
    onPlaced(data as OrderReceipt);
  }

  return (
    <form className="checkout-form" onSubmit={submit}>
      <p className="script">Almost there</p>
      <h2>Checkout</h2>

      {problems.length > 0 && (
        <ul className="checkout-problems" role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <label>
        Your name
        <input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} required />
      </label>
      <label>
        Phone
        <input type="tel" value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} required />
      </label>
      <label>
        Email <span>optional</span>
        <input type="email" value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} />
      </label>

      <fieldset className="fulfillment">
        <legend>How would you like it?</legend>
        {settings.pickup_enabled && (
          <label className="choice">
            <input
              type="radio"
              name="fulfillment"
              checked={form.fulfillment_type === "pickup"}
              onChange={() => set("fulfillment_type", "pickup")}
            />
            Pick up
          </label>
        )}
        {settings.delivery_enabled && (
          <label className="choice">
            <input
              type="radio"
              name="fulfillment"
              checked={delivery}
              onChange={() => set("fulfillment_type", "delivery")}
            />
            Delivery{settings.delivery_fee_cents > 0 && ` (${money(settings.delivery_fee_cents)})`}
          </label>
        )}
      </fieldset>

      <label>
        Date <span>optional</span>
        <input type="date" value={form.fulfillment_date} onChange={(e) => set("fulfillment_date", e.target.value)} />
      </label>

      {delivery && (
        <>
          <label>
            Delivery address
            <input value={form.delivery_address} onChange={(e) => set("delivery_address", e.target.value)} required />
          </label>
          <label>
            Delivery notes <span>optional</span>
            <input value={form.delivery_notes} onChange={(e) => set("delivery_notes", e.target.value)} />
          </label>
        </>
      )}

      <label>
        Who is it for? <span>optional</span>
        <input value={form.recipient_name} onChange={(e) => set("recipient_name", e.target.value)} />
      </label>
      <label>
        Card message <span>optional</span>
        <textarea rows={2} value={form.card_message} onChange={(e) => set("card_message", e.target.value)} />
      </label>
      <label>
        Discount code <span>optional</span>
        <input value={form.discount_code} onChange={(e) => set("discount_code", e.target.value)} />
      </label>

      <div className="checkout-totals">
        <div>
          <span>Subtotal</span>
          <b>{money(totals.subtotal)}</b>
        </div>
        {totals.deliveryFee > 0 && (
          <div>
            <span>Delivery</span>
            <b>{money(totals.deliveryFee)}</b>
          </div>
        )}
        <div className="grand">
          <span>Total</span>
          <b>{money(totals.total)}</b>
        </div>
        {/* Said out loud because a discount is only applied server-side. */}
        <p className="fineprint">
          Any discount code is checked when the order is placed, and the shop confirms the final total.
        </p>
      </div>

      <button type="submit" className="checkout" disabled={sending}>
        {sending ? "Placing your order…" : "Place order"}
      </button>
      <button type="button" className="linkish" onClick={onCancel}>
        Back to bag
      </button>
      <p className="fineprint">
        No payment is taken here. The shop will confirm your order and arrange payment.
      </p>
    </form>
  );
}

/** Shown once the server has accepted the order — its numbers, not ours. */
export function OrderPlaced({ receipt, phone }: { receipt: OrderReceipt; phone: string }) {
  return (
    <div className="order-placed">
      <p className="script">Thank you</p>
      <h2>Order {receipt.order_number}</h2>
      <p>
        We have your order and will call to confirm. Keep this number handy if you need to reach us.
      </p>
      <div className="checkout-totals">
        <div>
          <span>Subtotal</span>
          <b>{money(receipt.subtotal_cents)}</b>
        </div>
        {receipt.delivery_fee_cents > 0 && (
          <div>
            <span>Delivery</span>
            <b>{money(receipt.delivery_fee_cents)}</b>
          </div>
        )}
        {receipt.discount_applied && (
          <div>
            <span>Discount</span>
            <b>−{money(receipt.discount_cents)}</b>
          </div>
        )}
        <div className="grand">
          <span>Total</span>
          <b>{money(receipt.total_cents)}</b>
        </div>
      </div>
      <a className="phone-order" href={`tel:${phone.replace(/\D/g, "")}`}>
        Call {phone}
      </a>
    </div>
  );
}
