import { SANTA_SCHEMA } from "./config.mjs";

// PostgREST only. Every request is pinned to the santa schema. The service
// role bypasses RLS. anon and authenticated have no grants and no policies.
// The schema has to be in the project's exposed Data API schemas or these
// calls fail closed. This client never addresses public.

export function createSupabaseDb(env, fetchImpl = globalThis.fetch) {
  const base = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  async function call(method, path, { body, prefer } = {}) {
    if (path.includes("..") || /(^|\/)public(\.|\/|$)/.test(path)) {
      throw new Error("Refusing a request outside the santa schema");
    }
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Accept-Profile": SANTA_SCHEMA,
      "Content-Profile": SANTA_SCHEMA,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    const response = await fetchImpl(`${base}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(`Supabase ${method} santa.${path.split("?")[0]} failed (${response.status})`);
    return data;
  }

  function view(order, children, drafts, messages) {
    if (!order) return null;
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
      parentEmail: order.parent_email,
      recipientEmail: order.recipient_email || "",
      recipientConfirmed: order.recipient_confirmed,
      deliveryDate: order.delivery_date || "",
      stripeSessionId: order.stripe_session_id || "",
      stripePaymentIntentId: order.stripe_payment_intent_id || "",
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

  async function hydrate(rows) {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id).join(",");
    const [children, drafts, messages] = await Promise.all([
      call("GET", `children?order_id=in.(${ids})&select=id,order_id,position,first_name,age,town,friend_or_pet,accomplishment,work_on,wishlist&order=position.asc`),
      call("GET", `letter_drafts?order_id=in.(${ids})&select=id,order_id,child_id,body,model,status,reviewer,reviewed_at,sent_at,redacted_at,provider,provider_id`),
      call("GET", `order_messages?order_id=in.(${ids})&select=id,order_id,kind,to_email,subject,body,status,created_at`),
    ]);
    return rows.map((row) => view(
      row,
      (children || []).filter((child) => child.order_id === row.id),
      (drafts || []).filter((draft) => draft.order_id === row.id),
      (messages || []).filter((message) => message.order_id === row.id),
    ));
  }

  const orderSelect = "id,stripe_session_id,stripe_payment_intent_id,product,product_name,product_cents,postmark_cents,amount_cents,status,parent_email,recipient_email,recipient_confirmed,delivery_date,mailing_name,mailing_street,mailing_city,mailing_state,mailing_zip,postmark_addon,letter_count,created_at,updated_at";

  return {
    async insertPending(order) {
      const rows = await call("POST", "orders", {
        prefer: "return=representation",
        body: {
          product: order.slug,
          product_name: order.productName,
          product_cents: order.productCents,
          postmark_cents: order.postmarkCents,
          amount_cents: order.totalCents,
          status: "pending",
          parent_email: order.parentEmail,
          recipient_email: order.recipientEmail || null,
          recipient_confirmed: order.recipientConfirmed === true,
          delivery_date: order.deliveryDate || null,
          mailing_name: order.address?.name || null,
          mailing_street: order.address?.street || null,
          mailing_city: order.address?.city || null,
          mailing_state: order.address?.state || null,
          mailing_zip: order.address?.zip || null,
          postmark_addon: order.postmark === true,
          letter_count: order.letterCount,
        },
      });
      const row = rows[0];
      try {
        await call("POST", "children", {
          prefer: "return=representation",
          body: order.children.map((child, index) => ({
            order_id: row.id,
            position: index + 1,
            first_name: child.firstName,
            age: child.age,
            town: child.town,
            friend_or_pet: child.friendOrPet || null,
            accomplishment: child.accomplishment || null,
            work_on: child.workOn || null,
            wishlist: child.wishlist || null,
          })),
        });
      } catch (error) {
        await call("DELETE", `orders?id=eq.${row.id}`, { prefer: "return=minimal" });
        throw error;
      }
      const [hydrated] = await hydrate([row]);
      return hydrated;
    },
    async setSession(orderId, sessionId) {
      await call("PATCH", `orders?id=eq.${orderId}`, {
        prefer: "return=minimal",
        body: { stripe_session_id: sessionId, updated_at: new Date().toISOString() },
      });
      return this.getOrder(orderId);
    },
    async cancelOrder(orderId) {
      await call("PATCH", `orders?id=eq.${orderId}&status=eq.pending`, {
        prefer: "return=minimal",
        body: { status: "canceled", updated_at: new Date().toISOString() },
      });
      return this.getOrder(orderId);
    },
    async getOrder(id) {
      const rows = await call("GET", `orders?id=eq.${id}&select=${orderSelect}`);
      const [order] = await hydrate(rows || []);
      return order || null;
    },
    async findOrderBySession(sessionId) {
      const rows = await call("GET", `orders?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=${orderSelect}`);
      const [order] = await hydrate(rows || []);
      return order || null;
    },
    async markPaid(orderId, paymentIntentId) {
      await call("PATCH", `orders?id=eq.${orderId}&status=eq.pending`, {
        prefer: "return=minimal",
        body: {
          status: "paid",
          stripe_payment_intent_id: paymentIntentId || null,
          updated_at: new Date().toISOString(),
        },
      });
      return this.getOrder(orderId);
    },
    async hasEvent(id) {
      const rows = await call("GET", `stripe_events?id=eq.${encodeURIComponent(id)}&select=id`);
      return Array.isArray(rows) && rows.length > 0;
    },
    async saveEvent(id) {
      await call("POST", "stripe_events", { prefer: "return=minimal", body: { id } });
    },
    async insertDraft(draft) {
      const rows = await call("POST", "letter_drafts", {
        prefer: "return=representation",
        body: {
          order_id: draft.orderId,
          child_id: draft.childId,
          body: draft.body,
          model: draft.model || null,
          status: "draft",
        },
      });
      return fromDraft(rows[0]);
    },
    async insertMessage(message) {
      const rows = await call("POST", "order_messages", {
        prefer: "return=representation",
        body: {
          order_id: message.orderId,
          kind: message.kind,
          to_email: message.toEmail,
          subject: message.subject,
          body: message.body,
          status: "draft",
        },
      });
      return fromMessage(rows[0]);
    },
    async markMessage(id, status) {
      await call("PATCH", `order_messages?id=eq.${id}`, { prefer: "return=minimal", body: { status } });
    },
    async audit(entry) {
      await call("POST", "audit_log", {
        prefer: "return=minimal",
        body: {
          order_id: entry.orderId || null,
          draft_id: entry.draftId || null,
          action: entry.action,
          actor: entry.actor,
          detail: entry.detail || {},
        },
      });
    },
    async hasAudit(draftId, action) {
      const rows = await call("GET", `audit_log?draft_id=eq.${draftId}&action=eq.${encodeURIComponent(action)}&select=id`);
      return Array.isArray(rows) && rows.length > 0;
    },
    async listQueue() {
      const rows = await call("GET", `orders?select=${orderSelect}&order=created_at.desc`);
      return hydrate(rows || []);
    },
    async getDraft(id) {
      const rows = await call("GET", `letter_drafts?id=eq.${id}&select=id,order_id,child_id,body,model,status,reviewer,reviewed_at,sent_at,redacted_at,provider,provider_id`);
      return rows?.[0] ? fromDraft(rows[0]) : null;
    },
    async updateDraft(id, patch) {
      const body = {};
      if ("body" in patch) body.body = patch.body;
      if ("status" in patch) body.status = patch.status;
      if ("reviewer" in patch) body.reviewer = patch.reviewer;
      if ("reviewedAt" in patch) body.reviewed_at = patch.reviewedAt || null;
      if ("sentAt" in patch) body.sent_at = patch.sentAt || null;
      if ("redactedAt" in patch) body.redacted_at = patch.redactedAt || null;
      if ("provider" in patch) body.provider = patch.provider || null;
      if ("providerId" in patch) body.provider_id = patch.providerId || null;
      if ("childId" in patch) body.child_id = patch.childId;
      if ("model" in patch) body.model = patch.model;
      body.updated_at = new Date().toISOString();
      const rows = await call("PATCH", `letter_drafts?id=eq.${id}`, { prefer: "return=representation", body });
      return fromDraft(rows[0]);
    },
    async purgeDraft(id, now) {
      const draft = await this.getDraft(id);
      if (!draft || draft.redactedAt) return null;
      const childId = draft.childId;
      await this.updateDraft(id, { body: "", redactedAt: now.toISOString(), childId: null });
      if (childId) await call("DELETE", `children?id=eq.${childId}`, { prefer: "return=minimal" });
      const order = await this.getOrder(draft.orderId);
      if (order && order.children.length === 0) {
        await call("PATCH", `order_messages?order_id=eq.${draft.orderId}`, {
          prefer: "return=minimal",
          body: { body: "", subject: "Order record" },
        });
      }
      return this.getDraft(id);
    },
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
    status: row.status,
    reviewer: row.reviewer || "",
    reviewedAt: row.reviewed_at || "",
    sentAt: row.sent_at || "",
    redactedAt: row.redacted_at || "",
    provider: row.provider || "",
    providerId: row.provider_id || "",
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
