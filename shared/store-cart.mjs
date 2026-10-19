// Cart math and checkout links for the store template.
// Pure functions so the browser script and the tests share one implementation.
// A payment link is never invented here: an empty or non-http value stays empty.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toCents(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatMoney(cents) {
  const rounded = Math.round(Number(cents) || 0);
  const abs = Math.abs(rounded);
  return `${rounded < 0 ? "-" : ""}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function formatPrice(price) {
  if (price === null || price === undefined || price === "") return "";
  if (!Number.isFinite(Number(price))) return "";
  return formatMoney(toCents(price));
}

// Only an absolute http(s) URL is a checkout link. Anything else, including a
// blank string the owner has not filled in, is not a place to send a buyer.
export function isCheckoutUrl(url) {
  const raw = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function checkoutHref(url, params = {}) {
  if (!isCheckoutUrl(url)) return "";
  const parsed = new URL(String(url).trim());
  for (const [key, value] of Object.entries(params)) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    parsed.searchParams.set(key, text);
  }
  return parsed.toString();
}

export function fieldKey(fields = []) {
  return fields.map((field) => `${field.name}=${field.value ?? ""}`).join("&");
}

export function lineParams(line) {
  const params = { product: line.slug || "", qty: String(line.qty || 1) };
  for (const field of line.fields || []) {
    if (field?.name && String(field.value ?? "").trim()) params[field.name] = String(field.value).trim();
  }
  return params;
}

export function addLine(cart, line) {
  const next = (cart || []).map((item) => ({
    ...item,
    fields: (item.fields || []).map((field) => ({ ...field })),
  }));
  const key = line.fieldKey || fieldKey(line.fields);
  const match = next.find((item) => item.slug === line.slug && (item.fieldKey || fieldKey(item.fields)) === key);
  if (match) {
    match.qty = Math.min(20, (Number(match.qty) || 0) + (Number(line.qty) || 1));
    return next;
  }
  next.push({
    ...line,
    fieldKey: key,
    qty: Math.min(20, Number(line.qty) || 1),
    fields: (line.fields || []).map((field) => ({ ...field })),
  });
  return next;
}

export function lineTotal(line) {
  return toCents(line.price) * (Number(line.qty) || 0);
}

export function cartTotal(cart) {
  return (cart || []).reduce((sum, line) => sum + lineTotal(line), 0);
}

// Opens the visitor's mail app only when the store has a real inbox configured.
// The buyer's address goes in the body, not in the To line.
export function notifyMailto(inbox, { product = "Order", email = "", fields = [] } = {}) {
  const to = String(inbox || "").trim();
  if (!EMAIL.test(to)) return "";
  const lines = [
    `Product: ${product}`,
    email ? `From: ${email}` : "",
    ...fields.filter((field) => String(field?.value ?? "").trim()).map((field) => `${field.label || field.name}: ${String(field.value).trim()}`),
  ].filter(Boolean);
  return `mailto:${to}?subject=${encodeURIComponent(`Order note: ${product}`)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
