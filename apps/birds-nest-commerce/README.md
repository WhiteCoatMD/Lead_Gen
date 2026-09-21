# Bird's Nest Commerce

Dynamic storefront and owner dashboard for The Bird's Nest Flower Shop.

## Included

- Responsive flower storefront and shopping bag
- Password-protected shop dashboard
- Product, price, photo, inventory, and visibility management
- Order dashboard and fulfillment status
- Store hours, announcement, pickup, and delivery settings
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

Apply `supabase/migrations/001_birds_nest_store.sql`, create the owner in Supabase Auth, and set the owner's protected `app_metadata.role` to `shop_admin`. Never use editable user metadata for authorization.

Online checkout intentionally remains disabled until the shop chooses Square or Stripe. Raw card or bank information must never be saved in Supabase or this application.
