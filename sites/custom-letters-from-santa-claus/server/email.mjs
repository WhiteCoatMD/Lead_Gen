import { FROM_ADDRESS } from "./config.mjs";

export function formatMoney(cents) {
  const rounded = Math.round(Number(cents) || 0);
  const abs = Math.abs(rounded);
  return `${rounded < 0 ? "-" : ""}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function confirmationMessage(order) {
  const names = (order.children || []).map((child) => child.firstName).filter(Boolean);
  const who = names.length ? ` for ${names.join(", ")}` : "";
  const when = order.deliveryDate ? ` The date you chose is ${order.deliveryDate}. If the letter is still in review that day, it waits.` : "";
  return {
    kind: "confirmation",
    toEmail: order.parentEmail,
    subject: "We received your Santa letter order",
    body: [
      "Hello,",
      "",
      `We received your order${who} (${order.productName}). The amount is ${formatMoney(order.totalCents)}.`,
      "Nothing is sent or mailed until the letter is approved.",
      when.trim(),
      "",
      "Custom Letters from Santa Claus",
    ].filter((line) => line !== "").join("\n"),
  };
}

export function letterMessage(order, draft, child) {
  const to = order.recipientEmail || order.parentEmail;
  return {
    from: FROM_ADDRESS,
    to,
    bcc: to !== order.parentEmail ? order.parentEmail : "",
    subject: child?.firstName ? `A letter for ${child.firstName}` : "A letter from Santa",
    body: draft.body,
  };
}

export async function sendGraphMail(message, env, fetchImpl) {
  const tenant = env.MS_GRAPH_TENANT_ID;
  const client = env.MS_GRAPH_CLIENT_ID;
  const secret = env.MS_GRAPH_CLIENT_SECRET;
  if (!tenant || !client || !secret) throw new Error("Microsoft Graph is not configured");
  const tokenResponse = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client,
      client_secret: secret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) throw new Error("Microsoft Graph did not grant a token");
  const mail = {
    message: {
      subject: message.subject,
      body: { contentType: "Text", content: message.body },
      toRecipients: [{ emailAddress: { address: message.to } }],
      bccRecipients: message.bcc ? [{ emailAddress: { address: message.bcc } }] : [],
    },
    saveToSentItems: true,
  };
  const sent = await fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM_ADDRESS)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(mail),
  });
  if (!sent.ok && sent.status !== 202) throw new Error("Microsoft Graph did not accept the message");
  return { id: sent.headers?.get?.("request-id") || "graph" };
}
