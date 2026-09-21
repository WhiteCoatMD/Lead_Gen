# Bird's Nest Commerce

Dynamic storefront and owner dashboard for The Bird's Nest Flower Shop.

## Included

- Responsive flower storefront and shopping bag
- Password-protected shop dashboard
- Product, price, photo, inventory, and visibility management
- Order dashboard and fulfillment status
- Store hours, announcement, pickup, and delivery settings
- Customer checkout: bag to order, with pickup or delivery, card message and discount code
- Processor-neutral payment screen for Square or Stripe
- Supabase schema with RLS and product-image storage policies

## Local preview

```bash
npm install
npm run dev
```

Without environment variables, the app opens in safe preview mode using the three products from the current site. Add the values from a dedicated Bird's Nest Supabase project to `.env.local`:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

The shop's Supabase project is **`amjbzfugzprirflpydka`** ("Birds Nest
Commerce"). Both migrations are already applied to it, and the storefront
products and store settings are seeded.

Still to do by hand: create the owner in Supabase Auth and set that user's
protected `app_metadata.role` to `shop_admin`. Never use editable user
metadata for authorization. The store also ships with `accepting_orders`
**false** — turn it on in the dashboard when the shop is ready to take orders.

## Checkout

A customer can now place an order. `supabase/migrations/002_checkout.sql` adds
`place_order()`, which is the only sanctioned way an order is created.

The rule the design rests on: **the client never sends a price.** The browser
posts product ids and quantities; `place_order()` looks up every price,
delivery fee and discount from the database and computes the total itself. A
browser cannot talk itself into a cheaper order, because nothing it says about
money is read. That is also why `anon` has no INSERT policy on `orders` — the
function runs as its owner and is the only door in.

It also enforces, server-side: the store is accepting orders; the chosen
fulfillment type is enabled; a delivery order has an address; products are
active and in stock; quantities are 1–99; and a discount code is live and
within its usage limit. An unknown or expired code does not fail the order —
it is simply not applied, and the response says so.

Orders land as `status: new`, `payment_status: unpaid`. **No payment is taken.**
The shop confirms and arranges payment as it does today.

Raw card or bank information must never be saved in Supabase or this
application. When a processor is chosen, it hangs off the order this function
returns — nothing here needs rebuilding.
