create extension if not exists pgcrypto;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  image_url text not null default '',
  category text not null default 'Arrangements',
  active boolean not null default true,
  featured boolean not null default false,
  inventory_count integer check (inventory_count is null or inventory_count >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  store_name text not null,
  phone text not null,
  email text not null default '',
  address text not null default '',
  hours text not null default '',
  announcement text not null default '',
  accepting_orders boolean not null default false,
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  payment_provider text not null default 'none' check (payment_provider in ('none','square','stripe')),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_email text not null default '',
  customer_phone text not null,
  recipient_name text not null default '',
  card_message text not null default '',
  fulfillment_type text not null check (fulfillment_type in ('pickup','delivery')),
  fulfillment_date date,
  fulfillment_window text not null default '',
  delivery_address text not null default '',
  delivery_notes text not null default '',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  status text not null default 'new' check (status in ('new','confirmed','ready','completed','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','refunded','failed')),
  payment_provider text not null default 'none',
  provider_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  line_total_cents integer not null check (line_total_cents >= 0)
);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent','fixed')),
  amount integer not null check (amount > 0),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  uses integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.discount_codes enable row level security;

grant select on public.categories, public.products, public.store_settings to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.store_settings, public.orders, public.order_items, public.discount_codes to authenticated;
grant select on public.orders, public.order_items, public.discount_codes to authenticated;

create policy "public reads active categories" on public.categories for select to anon, authenticated using (active = true or (select auth.jwt()->'app_metadata'->>'role') = 'shop_admin');
create policy "public reads active products" on public.products for select to anon, authenticated using (active = true or (select auth.jwt()->'app_metadata'->>'role') = 'shop_admin');
create policy "public reads store settings" on public.store_settings for select to anon, authenticated using (true);

create policy "admins manage categories" on public.categories for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin');
create policy "admins manage products" on public.products for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin');
create policy "admins manage settings" on public.store_settings for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin');
create policy "admins manage orders" on public.orders for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin');
create policy "admins manage order items" on public.order_items for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin');
create policy "admins manage discounts" on public.discount_codes for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'shop_admin');

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "product images are public" on storage.objects for select to anon, authenticated using (bucket_id='product-images');
create policy "admins upload product images" on storage.objects for insert to authenticated with check (bucket_id='product-images' and (select auth.jwt()->'app_metadata'->>'role')='shop_admin');
create policy "admins update product images" on storage.objects for update to authenticated using (bucket_id='product-images' and (select auth.jwt()->'app_metadata'->>'role')='shop_admin') with check (bucket_id='product-images' and (select auth.jwt()->'app_metadata'->>'role')='shop_admin');
create policy "admins delete product images" on storage.objects for delete to authenticated using (bucket_id='product-images' and (select auth.jwt()->'app_metadata'->>'role')='shop_admin');

insert into public.store_settings (id,store_name,phone,address,hours,announcement,accepting_orders,pickup_enabled,delivery_enabled)
values ('00000000-0000-0000-0000-000000000001','The Bird''s Nest Flower Shop','318-502-4055','Downtown Columbia, Louisiana','Monday–Friday 8:00–5:00 · Saturday 9:00–12:00','Fresh flowers, made right here in Columbia.',false,true,false)
on conflict (id) do nothing;

insert into public.products (name,slug,description,price_cents,image_url,category,active,featured,sort_order) values
('Medium Spring Mix','medium-spring-mix','A colorful seasonal mix arranged by our florists.',5500,'https://irp.cdn-website.com/cecc5eca/dms3rep/multi/opt/IMG_9967-1920w.png','Arrangements',true,true,1),
('Large Dozen Roses','large-dozen-roses','A classic dozen-rose arrangement for the moments that matter.',9500,'https://irp.cdn-website.com/cecc5eca/dms3rep/multi/opt/IMG_9969-1920w.png','Roses',true,true,2),
('3 Rose Arrangement','three-rose-arrangement','Three roses arranged with seasonal greenery and accents.',3000,'https://irp.cdn-website.com/cecc5eca/dms3rep/multi/opt/IMG_9970-1920w.png','Roses',true,false,3)
on conflict (slug) do nothing;
