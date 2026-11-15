// Standard printed letters only. The North Pole postmark add-on is never
// handed to Lob. The return address has to be a real one the owner sets.
// A live Lob key is refused. Test keys start with test_.

export function assertLobKey(key) {
  const value = String(key || "");
  if (!value.startsWith("test_")) throw new Error("Refusing to call Lob without a test API key");
  return value;
}

export function lobPayload(order, draft, env) {
  const from = {
    name: String(env.LOB_FROM_NAME || "").trim(),
    address_line1: String(env.LOB_FROM_LINE1 || "").trim(),
    address_city: String(env.LOB_FROM_CITY || "").trim(),
    address_state: String(env.LOB_FROM_STATE || "").trim(),
    address_zip: String(env.LOB_FROM_ZIP || "").trim(),
    address_country: "US",
  };
  if (!from.name || !from.address_line1 || !from.address_city || !from.address_state || !from.address_zip) {
    throw new Error("Lob return address is not configured");
  }
  const html = `<!doctype html><html><body><article>${escapeHtml(draft.body).replaceAll("\n", "<br>")}</article></body></html>`;
  if (/postmark|usps facility/i.test(html)) throw new Error("Refusing to mail a letter that claims a postmark");
  return {
    description: `Santa letter ${draft.id}`,
    to: {
      name: order.address.name,
      address_line1: order.address.street,
      address_city: order.address.city,
      address_state: order.address.state,
      address_zip: order.address.zip,
      address_country: "US",
    },
    from,
    file: html,
    color: true,
    use_type: "operational",
    mail_type: "usps_first_class",
  };
}

export async function createLobLetter(order, draft, env, fetchImpl) {
  const key = assertLobKey(env.LOB_API_KEY);
  const payload = lobPayload(order, draft, env);
  const response = await fetchImpl("https://api.lob.com/v1/letters", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id) throw new Error("Lob did not accept the letter");
  return { id: body.id };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
