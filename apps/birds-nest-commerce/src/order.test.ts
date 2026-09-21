import { describe, expect, it } from "vitest";
import { demoProducts, demoSettings } from "./demo";
import { buildOrderPayload, emptyForm, estimateTotals, validateCheckout, type CheckoutForm } from "./order";
import type { CartItem, StoreSettings } from "./types";

const cart: CartItem[] = [
  { product: demoProducts[0], quantity: 2 },
  { product: demoProducts[1], quantity: 1 },
];
const good: CheckoutForm = { ...emptyForm, customer_name: "Jane", customer_phone: "318-555-0100" };
const settings = (over: Partial<StoreSettings> = {}): StoreSettings => ({ ...demoSettings, ...over });

describe("order payload", () => {
  // The whole security model: a browser cannot name its own price, because
  // nothing it says about money is read. place_order() prices every line.
  it("sends only product ids and quantities — never a price", () => {
    const payload = buildOrderPayload(good, cart);
    expect(payload.items).toEqual([
      { product_id: demoProducts[0].id, quantity: 2 },
      { product_id: demoProducts[1].id, quantity: 1 },
    ]);
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain("price");
    expect(serialised).not.toContain("total");
    expect(serialised).not.toContain(String(demoProducts[0].price_cents));
  });

  it("drops delivery fields from a pickup order so the record is honest", () => {
    const payload = buildOrderPayload(
      { ...good, fulfillment_type: "pickup", delivery_address: "12 Oak St", delivery_notes: "back door" },
      cart,
    );
    expect(payload.delivery_address).toBe("");
    expect(payload.delivery_notes).toBe("");
  });

  it("keeps delivery fields on a delivery order", () => {
    const payload = buildOrderPayload(
      { ...good, fulfillment_type: "delivery", delivery_address: " 12 Oak St " },
      cart,
    );
    expect(payload.delivery_address).toBe("12 Oak St");
  });
});

describe("checkout validation", () => {
  it("accepts a complete pickup order", () => {
    expect(validateCheckout(good, cart, settings())).toEqual([]);
  });

  it("requires a name and a phone number", () => {
    const problems = validateCheckout({ ...emptyForm }, cart, settings());
    expect(problems).toContain("Please add your name.");
    expect(problems).toContain("Please add a phone number so we can reach you.");
  });

  it("refuses an empty bag", () => {
    expect(validateCheckout(good, [], settings())).toContain("Your bag is empty.");
  });

  it("refuses orders when the shop is not accepting them", () => {
    expect(validateCheckout(good, cart, settings({ accepting_orders: false })))
      .toContain("The shop is not taking online orders right now.");
  });

  it("refuses delivery when delivery is switched off", () => {
    const problems = validateCheckout(
      { ...good, fulfillment_type: "delivery", delivery_address: "12 Oak St" },
      cart,
      settings({ delivery_enabled: false }),
    );
    expect(problems).toContain("Delivery is not available at the moment.");
  });

  it("requires an address for delivery", () => {
    const problems = validateCheckout(
      { ...good, fulfillment_type: "delivery" },
      cart,
      settings({ delivery_enabled: true }),
    );
    expect(problems).toContain("Please add a delivery address.");
  });
});

describe("displayed totals", () => {
  it("adds the delivery fee only on a delivery order", () => {
    const withFee = settings({ delivery_enabled: true, delivery_fee_cents: 1000 });
    const pickup = estimateTotals(cart, good, withFee);
    const delivery = estimateTotals(cart, { ...good, fulfillment_type: "delivery" }, withFee);
    expect(pickup.total).toBe(pickup.subtotal);
    expect(delivery.total).toBe(delivery.subtotal + 1000);
  });
});
