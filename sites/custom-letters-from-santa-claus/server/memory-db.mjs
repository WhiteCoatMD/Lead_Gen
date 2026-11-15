import { randomUUID } from "node:crypto";

export function createMemoryDb() {
  const orders = [];
  const drafts = [];
  const messages = [];
  const audits = [];
  const events = new Set();
  const attempts = [];

  function orderOf(id) {
    return orders.find((order) => order.id === id) || null;
  }

  function view(order) {
    if (!order) return null;
    return {
      ...order,
      address: { ...order.address },
      children: order.children.filter((child) => !child.deleted).map((child) => ({ ...child })),
      drafts: drafts.filter((draft) => draft.orderId === order.id).map((draft) => ({ ...draft })),
      messages: messages.filter((message) => message.orderId === order.id).map((message) => ({ ...message })),
    };
  }

  return {
    async insertPending(order) {
      const stored = {
        ...order,
        id: randomUUID(),
        status: "pending",
        stripeSessionId: "",
        stripePaymentIntentId: "",
        address: { ...order.address },
        children: order.children.map((child, index) => ({ ...child, id: randomUUID(), position: index + 1 })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(stored);
      return view(stored);
    },
    async setSession(orderId, sessionId) {
      const order = orderOf(orderId);
      if (!order) throw new Error("Order not found");
      order.stripeSessionId = sessionId;
      order.updatedAt = new Date().toISOString();
      return view(order);
    },
    async cancelOrder(orderId) {
      const order = orderOf(orderId);
      if (!order || order.status === "paid") return view(order);
      order.status = "canceled";
      order.updatedAt = new Date().toISOString();
      return view(order);
    },
    async getOrder(id) {
      return view(orderOf(id));
    },
    async findOrderBySession(sessionId) {
      return view(orders.find((order) => order.stripeSessionId === sessionId));
    },
    async markPaid(orderId, paymentIntentId) {
      const order = orderOf(orderId);
      if (!order) throw new Error("Order not found");
      if (order.status !== "paid") {
        order.status = "paid";
        order.stripePaymentIntentId = paymentIntentId || "";
        order.updatedAt = new Date().toISOString();
      }
      return view(order);
    },
    async hasEvent(id) {
      return events.has(id);
    },
    async saveEvent(id) {
      events.add(id);
    },
    async insertDraft(draft) {
      const stored = {
        id: randomUUID(),
        status: "draft",
        reviewer: "",
        reviewedAt: "",
        sentAt: "",
        redactedAt: "",
        provider: "",
        providerId: "",
        ...draft,
      };
      drafts.push(stored);
      return { ...stored };
    },
    async insertMessage(message) {
      const stored = { id: randomUUID(), status: "draft", ...message, createdAt: new Date().toISOString() };
      messages.push(stored);
      return { ...stored };
    },
    async markMessage(id, status) {
      const message = messages.find((item) => item.id === id);
      if (message) message.status = status;
      return message ? { ...message } : null;
    },
    async audit(entry) {
      const stored = {
        id: randomUUID(),
        orderId: entry.orderId || null,
        draftId: entry.draftId || null,
        action: entry.action,
        actor: entry.actor,
        detail: entry.detail || {},
        createdAt: new Date().toISOString(),
      };
      audits.push(stored);
      return { ...stored };
    },
    async hasAudit(draftId, action) {
      return audits.some((entry) => entry.draftId === draftId && entry.action === action);
    },
    async listQueue() {
      return orders.map(view);
    },
    async getDraft(id) {
      const draft = drafts.find((item) => item.id === id);
      return draft ? { ...draft } : null;
    },
    async updateDraft(id, patch) {
      const draft = drafts.find((item) => item.id === id);
      if (!draft) throw new Error("Draft not found");
      Object.assign(draft, patch, { updatedAt: new Date().toISOString() });
      return { ...draft };
    },
    async purgeDraft(id, now) {
      const draft = drafts.find((item) => item.id === id);
      if (!draft || draft.redactedAt) return null;
      const order = orderOf(draft.orderId);
      const childId = draft.childId;
      draft.body = "";
      draft.redactedAt = now.toISOString();
      draft.childId = null;
      if (order && childId) {
        const child = order.children.find((item) => item.id === childId);
        if (child) child.deleted = true;
      }
      blankMessages(messages, order);
      return { ...draft };
    },
    async purgeOrderChildren(orderId, now) {
      const order = orderOf(orderId);
      if (!order || order.childrenRedactedAt) return null;
      for (const child of order.children) child.deleted = true;
      for (const draft of drafts) {
        if (draft.orderId !== orderId) continue;
        draft.body = "";
        draft.redactedAt = now.toISOString();
        draft.childId = null;
      }
      order.childrenRedactedAt = now.toISOString();
      blankMessages(messages, order);
      return view(order);
    },
    async redactOrderIdentity(orderId, now) {
      const order = orderOf(orderId);
      if (!order || order.identityRedactedAt) return null;
      order.parentEmail = "";
      order.recipientEmail = "";
      order.address = { name: "", street: "", city: "", state: "", zip: "" };
      order.identityRedactedAt = now.toISOString();
      for (const message of messages) {
        if (message.orderId !== orderId) continue;
        message.body = "";
        message.subject = "Order record";
        message.toEmail = "";
      }
      return view(order);
    },
    async countLoginFailures(ip, since) {
      return attempts.filter((item) => item.ip === ip && new Date(item.at).getTime() >= since.getTime()).length;
    },
    async recordLoginFailure(ip, at) {
      attempts.push({ ip, at: at.toISOString() });
    },
  };
}

function blankMessages(messages, order) {
  if (!order || order.children.some((child) => !child.deleted)) return;
  for (const message of messages) {
    if (message.orderId !== order.id) continue;
    message.body = "";
    message.subject = "Order record";
  }
}
