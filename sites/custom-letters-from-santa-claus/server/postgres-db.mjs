// Direct Postgres through the Supabase pooler (POSTGRES_URL). The santa schema
// is not on the Data API. Prepared statements stay off so the transaction
// pooler accepts the session. SSL is required. Every statement names santa.
// The driver is imported only when a connection is opened, so unit tests can
// pass a fake client without installing it.

export function postgresConfig(env = {}) {
  const url = String(env.POSTGRES_URL || "").trim();
  if (!url) throw new Error("POSTGRES_URL is required");
  return {
    url,
    options: {
      prepare: false,
      ssl: "require",
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    },
  };
}

let cached;

export async function connect(env = process.env) {
  const config = postgresConfig(env);
  if (!cached || cached.url !== config.url) {
    if (cached?.sql?.end) cached.sql.end({ timeout: 1 }).catch(() => {});
    const { default: postgres } = await import("postgres");
    cached = { url: config.url, sql: postgres(config.url, config.options) };
  }
  return cached.sql;
}

export function createDb(env, injected) {
  let client = injected || null;
  async function open() {
    if (!client) client = await connect(env);
    return client;
  }

  async function rowsOf(sql, orderIds) {
    if (!orderIds.length) return new Map();
    const [children, drafts, messages] = await Promise.all([
      sql`select id, order_id, position, first_name, age, town, friend_or_pet, accomplishment, work_on, wishlist
          from santa.children
          where order_id in ${sql(orderIds)}
          order by position`,
      sql`select id, order_id, child_id, body, model, source, status, reviewer, reviewed_at, sent_at, redacted_at, provider, provider_id, send_error
          from santa.letter_drafts
          where order_id in ${sql(orderIds)}`,
      sql`select id, order_id, kind, to_email, subject, body, status, created_at
          from santa.order_messages
          where order_id in ${sql(orderIds)}`,
    ]);
    return { children, drafts, messages };
  }

  async function hydrate(sql, orderRows) {
    if (!orderRows.length) return [];
    const related = await rowsOf(sql, orderRows.map((row) => row.id));
    return orderRows.map((row) => view(
      row,
      related.children.filter((child) => child.order_id === row.id),
      related.drafts.filter((draft) => draft.order_id === row.id),
      related.messages.filter((message) => message.order_id === row.id),
    ));
  }

  return {
    async insertPending(order) {
      const sql = await open();
      const inserted = await sql.begin(async (tx) => {
        const [row] = await tx`
          insert into santa.orders (
            product, product_name, product_cents, postmark_cents, amount_cents, status,
            parent_email, recipient_email, recipient_confirmed, delivery_date,
            mailing_name, mailing_street, mailing_city, mailing_state, mailing_zip,
            postmark_addon, letter_count
          ) values (
            ${order.slug}, ${order.productName}, ${order.productCents}, ${order.postmarkCents}, ${order.totalCents}, 'pending',
            ${order.parentEmail}, ${emptyToNull(order.recipientEmail)}, ${order.recipientConfirmed === true}, ${emptyToNull(order.deliveryDate)},
            ${emptyToNull(order.address?.name)}, ${emptyToNull(order.address?.street)}, ${emptyToNull(order.address?.city)}, ${emptyToNull(order.address?.state)}, ${emptyToNull(order.address?.zip)},
            ${order.postmark === true}, ${order.letterCount}
          )
          returning *`;
        for (const [index, child] of order.children.entries()) {
          await tx`
            insert into santa.children (
              order_id, position, first_name, age, town, friend_or_pet, accomplishment, work_on, wishlist
            ) values (
              ${row.id}, ${index + 1}, ${child.firstName}, ${child.age}, ${child.town},
              ${emptyToNull(child.friendOrPet)}, ${emptyToNull(child.accomplishment)}, ${emptyToNull(child.workOn)}, ${emptyToNull(child.wishlist)}
            )`;
        }
        return row;
      });
      const [hydrated] = await hydrate(sql, [inserted]);
      return hydrated;
    },
    async setSession(orderId, sessionId) {
      const sql = await open();
      await sql`update santa.orders set stripe_session_id = ${sessionId}, updated_at = now() where id = ${orderId}`;
      return this.getOrder(orderId);
    },
    async cancelOrder(orderId) {
      const sql = await open();
      await sql`update santa.orders set status = 'canceled', updated_at = now() where id = ${orderId} and status = 'pending'`;
      return this.getOrder(orderId);
    },
    async getOrder(id) {
      const sql = await open();
      const rows = await sql`
        select id, stripe_session_id, stripe_payment_intent_id, product, product_name,
               product_cents, postmark_cents, amount_cents, status, parent_email, recipient_email,
               recipient_confirmed, delivery_date, mailing_name, mailing_street, mailing_city,
               mailing_state, mailing_zip, postmark_addon, letter_count, created_at, updated_at,
               identity_redacted_at, children_redacted_at
        from santa.orders where id = ${id}`;
      const [order] = await hydrate(sql, rows);
      return order || null;
    },
    async findOrderBySession(sessionId) {
      const sql = await open();
      const rows = await sql`
        select id, stripe_session_id, stripe_payment_intent_id, product, product_name,
               product_cents, postmark_cents, amount_cents, status, parent_email, recipient_email,
               recipient_confirmed, delivery_date, mailing_name, mailing_street, mailing_city,
               mailing_state, mailing_zip, postmark_addon, letter_count, created_at, updated_at,
               identity_redacted_at, children_redacted_at
        from santa.orders where stripe_session_id = ${sessionId}`;
      const [order] = await hydrate(sql, rows);
      return order || null;
    },
    async markPaid(orderId, paymentIntentId) {
      const sql = await open();
      await sql`
        update santa.orders
        set status = 'paid', stripe_payment_intent_id = ${paymentIntentId || null}, updated_at = now()
        where id = ${orderId} and status = 'pending'`;
      return this.getOrder(orderId);
    },
    async hasEvent(id) {
      const sql = await open();
      const rows = await sql`select id from santa.stripe_events where id = ${id}`;
      return rows.length > 0;
    },
    async saveEvent(id) {
      const sql = await open();
      await sql`insert into santa.stripe_events (id) values (${id}) on conflict (id) do nothing`;
    },
    async insertDraft(draft) {
      const sql = await open();
      const [row] = await sql`
        insert into santa.letter_drafts (order_id, child_id, body, model, source, status)
        values (
          ${draft.orderId}, ${draft.childId}, ${draft.body}, ${draft.model || null},
          ${draft.source === "assistant" ? "assistant" : "template"}, 'draft'
        )
        returning *`;
      return fromDraft(row);
    },
    async insertMessage(message) {
      const sql = await open();
      const [row] = await sql`
        insert into santa.order_messages (order_id, kind, to_email, subject, body, status)
        values (${message.orderId}, ${message.kind}, ${message.toEmail}, ${message.subject}, ${message.body}, 'draft')
        returning *`;
      return fromMessage(row);
    },
    async markMessage(id, status) {
      const sql = await open();
      await sql`update santa.order_messages set status = ${status} where id = ${id}`;
    },
    async audit(entry) {
      const sql = await open();
      await sql`
        insert into santa.audit_log (order_id, draft_id, action, actor, detail)
        values (${entry.orderId || null}, ${entry.draftId || null}, ${entry.action}, ${entry.actor}, ${sql.json(entry.detail || {})})`;
    },
    async hasAudit(draftId, action) {
      const sql = await open();
      const rows = await sql`select id from santa.audit_log where draft_id = ${draftId} and action = ${action}`;
      return rows.length > 0;
    },
    async listQueue() {
      const sql = await open();
      const rows = await sql`
        select id, stripe_session_id, stripe_payment_intent_id, product, product_name,
               product_cents, postmark_cents, amount_cents, status, parent_email, recipient_email,
               recipient_confirmed, delivery_date, mailing_name, mailing_street, mailing_city,
               mailing_state, mailing_zip, postmark_addon, letter_count, created_at, updated_at,
               identity_redacted_at, children_redacted_at
        from santa.orders order by created_at desc`;
      return hydrate(sql, rows);
    },
    async getDraft(id) {
      const sql = await open();
      const rows = await sql`
        select id, order_id, child_id, body, model, source, status, reviewer, reviewed_at, sent_at, redacted_at, provider, provider_id, send_error
        from santa.letter_drafts where id = ${id}`;
      return rows[0] ? fromDraft(rows[0]) : null;
    },
    async updateDraft(id, patch) {
      const sql = await open();
      const row = { updated_at: new Date() };
      const cols = ["updated_at"];
      const set = (column, value) => { row[column] = value; cols.push(column); };
      if ("body" in patch) set("body", patch.body);
      if ("status" in patch) set("status", patch.status);
      if ("reviewer" in patch) set("reviewer", patch.reviewer || null);
      if ("reviewedAt" in patch) set("reviewed_at", patch.reviewedAt || null);
      if ("sentAt" in patch) set("sent_at", patch.sentAt || null);
      if ("redactedAt" in patch) set("redacted_at", patch.redactedAt || null);
      if ("provider" in patch) set("provider", patch.provider || null);
      if ("providerId" in patch) set("provider_id", patch.providerId || null);
      if ("childId" in patch) set("child_id", patch.childId);
      if ("model" in patch) set("model", patch.model || null);
      if ("source" in patch) set("source", patch.source === "assistant" ? "assistant" : "template");
      if ("sendError" in patch) set("send_error", patch.sendError || null);
      const [updated] = await sql`update santa.letter_drafts set ${sql(row, cols)} where id = ${id} returning *`;
      return fromDraft(updated);
    },
    async purgeDraft(id, now) {
      const sql = await open();
      return sql.begin(async (tx) => {
        const [draft] = await tx`select id, order_id, child_id, redacted_at from santa.letter_drafts where id = ${id}`;
        if (!draft || draft.redacted_at) return null;
        await tx`
          update santa.letter_drafts
          set body = '', redacted_at = ${now}, child_id = null, updated_at = now()
          where id = ${id}`;
        if (draft.child_id) await tx`delete from santa.children where id = ${draft.child_id}`;
        const [{ count }] = await tx`select count(*)::int as count from santa.children where order_id = ${draft.order_id}`;
        if (count === 0) {
          await tx`update santa.order_messages set body = '', subject = 'Order record' where order_id = ${draft.order_id}`;
        }
        const [fresh] = await tx`
          select id, order_id, child_id, body, model, source, status, reviewer, reviewed_at, sent_at, redacted_at, provider, provider_id, send_error
          from santa.letter_drafts where id = ${id}`;
        return fromDraft(fresh);
      });
    },
    async purgeOrderChildren(orderId, now) {
      const sql = await open();
      const existing = await this.getOrder(orderId);
      if (!existing || existing.childrenRedactedAt) return null;
      await sql.begin(async (tx) => {
        await tx`
          update santa.letter_drafts
          set body = '', redacted_at = ${now}, child_id = null, updated_at = now()
          where order_id = ${orderId}`;
        await tx`delete from santa.children where order_id = ${orderId}`;
        await tx`update santa.orders set children_redacted_at = ${now}, updated_at = now() where id = ${orderId}`;
        await tx`update santa.order_messages set body = '', subject = 'Order record' where order_id = ${orderId}`;
      });
      return this.getOrder(orderId);
    },
    async redactOrderIdentity(orderId, now) {
      const sql = await open();
      await sql.begin(async (tx) => {
        await tx`
          update santa.orders
          set parent_email = '', recipient_email = null,
              mailing_name = null, mailing_street = null, mailing_city = null, mailing_state = null, mailing_zip = null,
              identity_redacted_at = ${now}, updated_at = now()
          where id = ${orderId}`;
        await tx`update santa.order_messages set body = '', subject = 'Order record', to_email = '' where order_id = ${orderId}`;
      });
      return this.getOrder(orderId);
    },
    async countLoginFailures(ip, since) {
      const sql = await open();
      const rows = await sql`select id from santa.admin_login_attempts where ip = ${ip} and attempted_at >= ${since}`;
      return rows.length;
    },
    async recordLoginFailure(ip, at) {
      const sql = await open();
      await sql`insert into santa.admin_login_attempts (ip, attempted_at) values (${ip}, ${at})`;
    },
  };
}

function emptyToNull(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function iso(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function view(order, children, drafts, messages) {
  return {
    id: order.id,
    status: order.status,
    slug: order.product,
    productName: order.product_name,
    productCents: order.product_cents,
    postmarkCents: order.postmark_cents,
    totalCents: order.amount_cents,
    postmark: order.postmark_addon,
    letterCount: order.letter_count,
    parentEmail: order.parent_email || "",
    recipientEmail: order.recipient_email || "",
    recipientConfirmed: order.recipient_confirmed,
    deliveryDate: dateOnly(order.delivery_date),
    stripeSessionId: order.stripe_session_id || "",
    stripePaymentIntentId: order.stripe_payment_intent_id || "",
    createdAt: iso(order.created_at),
    updatedAt: iso(order.updated_at),
    identityRedactedAt: iso(order.identity_redacted_at),
    childrenRedactedAt: iso(order.children_redacted_at),
    address: {
      name: order.mailing_name || "",
      street: order.mailing_street || "",
      city: order.mailing_city || "",
      state: order.mailing_state || "",
      zip: order.mailing_zip || "",
    },
    kind: order.product === "email-from-santa" ? "email" : "printed",
    children: children.map(fromChild),
    drafts: drafts.map(fromDraft),
    messages: messages.map(fromMessage),
  };
}

function fromChild(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    position: row.position,
    firstName: row.first_name,
    age: row.age,
    town: row.town,
    friendOrPet: row.friend_or_pet || "",
    accomplishment: row.accomplishment || "",
    workOn: row.work_on || "",
    wishlist: row.wishlist || "",
  };
}

function fromDraft(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    childId: row.child_id,
    body: row.body || "",
    model: row.model || "",
    source: row.source === "assistant" ? "assistant" : "template",
    status: row.status,
    reviewer: row.reviewer || "",
    reviewedAt: iso(row.reviewed_at),
    sentAt: iso(row.sent_at),
    redactedAt: iso(row.redacted_at),
    provider: row.provider || "",
    providerId: row.provider_id || "",
    sendError: row.send_error || "",
  };
}

function fromMessage(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    kind: row.kind,
    toEmail: row.to_email,
    subject: row.subject,
    body: row.body,
    status: row.status,
  };
}
