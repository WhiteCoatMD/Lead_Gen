-- Checkout: the write path that lets a customer turn a shopping bag into an
-- order. Everything else was already here — the orders and order_items tables,
-- discounts, delivery fees, payment_status — but nothing could create an order
-- except the shop admin, so the storefront had no way to finish a sale.
--
-- The whole design rests on one rule: THE CLIENT NEVER SENDS A PRICE. It sends
-- product ids and quantities. This function looks up every price, fee and
-- discount from the database and computes the total itself. A browser cannot
-- talk itself into a cheaper order, because nothing it says about money is
-- read.
--
-- That is also why anon gets no INSERT policy on orders. It calls this
-- function, which runs as its owner and is the only sanctioned way in.

-- A customer paying later needs a status that says so. 'unpaid' already exists
-- but reads as a failure; 'pending' is for a processor that has taken over.
-- Nothing is added here: the existing payment_status values already cover the
-- processor-agnostic case, and an order simply starts 'unpaid'.

create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings        public.store_settings%rowtype;
  item            jsonb;
  product         public.products%rowtype;
  requested_qty   integer;
  subtotal        integer := 0;
  delivery_fee    integer := 0;
  discount        integer := 0;
  total           integer := 0;
  fulfillment     text;
  code_text       text;
  discount_row    public.discount_codes%rowtype;
  new_order_id    uuid;
  new_order_no    text;
  item_count      integer;
begin
  select * into settings from public.store_settings limit 1;
  if not found then
    raise exception 'store is not configured' using errcode = '22023';
  end if;

  if not settings.accepting_orders then
    raise exception 'store is not accepting orders' using errcode = '22023';
  end if;

  fulfillment := coalesce(payload->>'fulfillment_type', '');
  if fulfillment not in ('pickup', 'delivery') then
    raise exception 'fulfillment_type must be pickup or delivery' using errcode = '22023';
  end if;
  if fulfillment = 'pickup' and not settings.pickup_enabled then
    raise exception 'pickup is not available' using errcode = '22023';
  end if;
  if fulfillment = 'delivery' and not settings.delivery_enabled then
    raise exception 'delivery is not available' using errcode = '22023';
  end if;
  if fulfillment = 'delivery' and coalesce(trim(payload->>'delivery_address'), '') = '' then
    raise exception 'delivery orders need an address' using errcode = '22023';
  end if;

  if coalesce(trim(payload->>'customer_name'), '') = '' then
    raise exception 'customer_name is required' using errcode = '22023';
  end if;
  if coalesce(trim(payload->>'customer_phone'), '') = '' then
    raise exception 'customer_phone is required' using errcode = '22023';
  end if;

  item_count := jsonb_array_length(coalesce(payload->'items', '[]'::jsonb));
  if item_count = 0 then
    raise exception 'an order needs at least one item' using errcode = '22023';
  end if;
  if item_count > 50 then
    raise exception 'too many items in one order' using errcode = '22023';
  end if;

  new_order_id := gen_random_uuid();
  new_order_no := 'BN-' || to_char(now(), 'YYMMDD') || '-' ||
                  upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  -- Price every line from the products table, never from the payload.
  for item in select * from jsonb_array_elements(payload->'items')
  loop
    requested_qty := coalesce((item->>'quantity')::integer, 0);
    if requested_qty < 1 or requested_qty > 99 then
      raise exception 'quantity must be between 1 and 99' using errcode = '22023';
    end if;

    select * into product
      from public.products
     where id = (item->>'product_id')::uuid
       and active
     for update;

    if not found then
      raise exception 'product % is not available', item->>'product_id' using errcode = '22023';
    end if;

    -- inventory_count null means "not tracked", which is not the same as zero.
    if product.inventory_count is not null and product.inventory_count < requested_qty then
      raise exception 'not enough % in stock', product.name using errcode = '22023';
    end if;

    subtotal := subtotal + (product.price_cents * requested_qty);

    insert into public.order_items
      (order_id, product_id, product_name, unit_price_cents, quantity, line_total_cents)
    values
      (new_order_id, product.id, product.name, product.price_cents, requested_qty,
       product.price_cents * requested_qty);

    if product.inventory_count is not null then
      update public.products
         set inventory_count = inventory_count - requested_qty,
             updated_at = now()
       where id = product.id;
    end if;
  end loop;

  if fulfillment = 'delivery' then
    delivery_fee := settings.delivery_fee_cents;
  end if;

  -- Discounts are validated here too, for the same reason prices are.
  code_text := upper(coalesce(trim(payload->>'discount_code'), ''));
  if code_text <> '' then
    select * into discount_row
      from public.discount_codes
     where upper(code) = code_text
       and active
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at >= now())
       and (usage_limit is null or uses < usage_limit)
     for update;

    if found then
      if discount_row.kind = 'percent' then
        discount := (subtotal * least(discount_row.amount, 100)) / 100;
      else
        discount := least(discount_row.amount, subtotal);
      end if;

      update public.discount_codes
         set uses = uses + 1
       where id = discount_row.id;
    else
      -- An unknown or expired code is not an error worth losing the sale over;
      -- the order goes through at full price and the response says so.
      discount := 0;
    end if;
  end if;

  total := greatest(subtotal + delivery_fee - discount, 0);

  insert into public.orders (
    id, order_number, customer_name, customer_email, customer_phone,
    recipient_name, card_message, fulfillment_type, fulfillment_date,
    fulfillment_window, delivery_address, delivery_notes,
    subtotal_cents, delivery_fee_cents, discount_cents, total_cents,
    status, payment_status, payment_provider
  ) values (
    new_order_id, new_order_no,
    trim(payload->>'customer_name'),
    coalesce(trim(payload->>'customer_email'), ''),
    trim(payload->>'customer_phone'),
    coalesce(trim(payload->>'recipient_name'), ''),
    coalesce(payload->>'card_message', ''),
    fulfillment,
    nullif(payload->>'fulfillment_date', '')::date,
    coalesce(payload->>'fulfillment_window', ''),
    coalesce(trim(payload->>'delivery_address'), ''),
    coalesce(payload->>'delivery_notes', ''),
    subtotal, delivery_fee, discount, total,
    'new', 'unpaid', settings.payment_provider
  );

  return jsonb_build_object(
    'order_id', new_order_id,
    'order_number', new_order_no,
    'subtotal_cents', subtotal,
    'delivery_fee_cents', delivery_fee,
    'discount_cents', discount,
    'discount_applied', discount > 0,
    'total_cents', total,
    'payment_status', 'unpaid',
    'payment_provider', settings.payment_provider
  );
end;
$$;

-- Only the storefront path is granted. `public` would hand it to every role
-- that ever gets created, which is how a definer function quietly becomes a
-- back door.
revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- A customer can create an order only through the function above. There is
-- deliberately no INSERT policy on orders or order_items for anon: direct
-- inserts stay blocked, so the price-checking path cannot be sidestepped.

-- Looking an order up after checkout, by its number, without exposing the
-- whole order book. Returns only what a receipt needs.
create or replace function public.get_order_receipt(p_order_number text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'fulfillment_type', o.fulfillment_type,
    'subtotal_cents', o.subtotal_cents,
    'delivery_fee_cents', o.delivery_fee_cents,
    'discount_cents', o.discount_cents,
    'total_cents', o.total_cents,
    'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'quantity', i.quantity,
        'unit_price_cents', i.unit_price_cents,
        'line_total_cents', i.line_total_cents
      ) order by i.product_name)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.order_number = p_order_number;
$$;

revoke all on function public.get_order_receipt(text) from public;
grant execute on function public.get_order_receipt(text) to anon, authenticated;
