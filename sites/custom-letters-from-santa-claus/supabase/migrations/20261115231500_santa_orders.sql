-- Santa letters orders for the existing Supabase project Lead Gen Admin
-- (ref oyrcjrcgvmzmkaipapjm).
--
-- This migration creates and changes objects in schema santa only.
-- It does not change objects outside schema santa.
-- It is safe to run more than once.
--
-- The server connects with POSTGRES_URL (the Supabase pooler) over SSL.
-- Schema santa is not added to the exposed Data API schemas. Do not expose it.
-- RLS stays on and there are no anon or authenticated policies. The pooler
-- user is the database owner, so it can read and write santa without the
-- Data API or the service role key.

create schema if not exists santa;

comment on schema santa is 'Custom Letters from Santa Claus. Not on the Data API. No anon or authenticated policies.';

revoke all on schema santa from public;
revoke all on schema santa from anon;
revoke all on schema santa from authenticated;
grant usage on schema santa to service_role;

create table if not exists santa.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  product text not null,
  product_name text not null,
  product_cents integer not null check (product_cents >= 0),
  postmark_cents integer not null default 0 check (postmark_cents >= 0),
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'canceled')),
  parent_email text not null check (position('@' in parent_email) > 1),
  recipient_email text check (recipient_email is null or position('@' in recipient_email) > 1),
  recipient_confirmed boolean not null default false,
  delivery_date date,
  mailing_name text,
  mailing_street text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  postmark_addon boolean not null default false,
  letter_count integer not null check (letter_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column santa.orders.parent_email is 'Adult placing the order. Required.';
comment on column santa.orders.recipient_email is 'Parent or guardian inbox for an email letter. Never a child address.';

-- Children do not have an email column. Delivery addresses belong to the parent on santa.orders.
create table if not exists santa.children (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references santa.orders (id) on delete cascade,
  position integer not null check (position > 0),
  first_name text not null,
  age text not null,
  town text not null,
  friend_or_pet text,
  accomplishment text,
  work_on text,
  wishlist text,
  created_at timestamptz not null default now(),
  unique (order_id, position)
);

create table if not exists santa.letter_drafts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references santa.orders (id) on delete cascade,
  child_id uuid references santa.children (id) on delete set null,
  body text not null,
  model text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'sent', 'mailed')),
  reviewer text,
  reviewed_at timestamptz,
  sent_at timestamptz,
  redacted_at timestamptz,
  provider text,
  provider_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists santa.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references santa.orders (id) on delete cascade,
  kind text not null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  created_at timestamptz not null default now()
);

create table if not exists santa.audit_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references santa.orders (id) on delete set null,
  draft_id uuid,
  action text not null,
  actor text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on column santa.audit_log.detail is 'No child name, letter text, or other child details.';

create table if not exists santa.stripe_events (
  id text primary key,
  received_at timestamptz not null default now()
);

create index if not exists orders_parent_email_idx on santa.orders (parent_email);
create index if not exists orders_delivery_date_idx on santa.orders (delivery_date);
create index if not exists letter_drafts_status_idx on santa.letter_drafts (status, sent_at);
create index if not exists audit_log_draft_idx on santa.audit_log (draft_id, action);

alter table santa.orders enable row level security;
alter table santa.children enable row level security;
alter table santa.letter_drafts enable row level security;
alter table santa.order_messages enable row level security;
alter table santa.audit_log enable row level security;
alter table santa.stripe_events enable row level security;

revoke all on table santa.orders from public, anon, authenticated;
revoke all on table santa.children from public, anon, authenticated;
revoke all on table santa.letter_drafts from public, anon, authenticated;
revoke all on table santa.order_messages from public, anon, authenticated;
revoke all on table santa.audit_log from public, anon, authenticated;
revoke all on table santa.stripe_events from public, anon, authenticated;

grant select, insert, update, delete on table santa.orders to service_role;
grant select, insert, update, delete on table santa.children to service_role;
grant select, insert, update, delete on table santa.letter_drafts to service_role;
grant select, insert, update, delete on table santa.order_messages to service_role;
grant select, insert, update, delete on table santa.audit_log to service_role;
grant select, insert, update, delete on table santa.stripe_events to service_role;

-- Columns added after the first run. Safe to apply again.
alter table santa.letter_drafts add column if not exists send_error text;
alter table santa.orders add column if not exists identity_redacted_at timestamptz;
alter table santa.orders add column if not exists children_redacted_at timestamptz;
alter table santa.orders add column if not exists stripe_customer_id text;

comment on column santa.orders.stripe_customer_id is 'Stripe Customer id when Checkout created one. Null when Checkout did not.';

-- Parent email is removed after the retention window. The original format
-- check would reject an empty value, so it is removed on santa.orders only.
alter table santa.orders drop constraint if exists orders_parent_email_check;
alter table santa.orders drop constraint if exists orders_recipient_email_check;

create table if not exists santa.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_ip_idx on santa.admin_login_attempts (ip, attempted_at);
create index if not exists admin_login_attempts_attempted_at_idx on santa.admin_login_attempts (attempted_at);

alter table santa.admin_login_attempts enable row level security;
revoke all on table santa.admin_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on table santa.admin_login_attempts to service_role;

alter table santa.letter_drafts add column if not exists source text not null default 'template';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'letter_drafts_source_check'
      and connamespace = 'santa'::regnamespace
  ) then
    alter table santa.letter_drafts
      add constraint letter_drafts_source_check
      check (source in ('template', 'assistant'));
  end if;
end $$;
