const CART_KEY = "store-cart-v1";

function fieldsFrom(form) {
  const fields = [];
  for (const input of form.querySelectorAll("[data-field]")) {
    const value = input.type === "checkbox" ? (input.checked ? String(input.value || "yes") : "") : input.value.trim();
    fields.push({ name: input.name, value });
  }
  const qty = form.querySelector("[name=qty]");
  return { slug: form.getAttribute("data-slug") || "", qty: Number(qty?.value) || 1, fields };
}

function status(form, message) {
  const node = form.querySelector(".form-status");
  if (node) node.textContent = message;
}

async function pay(payload, form) {
  status(form, "Opening checkout…");
  const response = await fetch("/api/santa/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) {
    status(form, data.error || "Checkout did not open.");
    return;
  }
  window.location.assign(data.url);
}

for (const button of document.querySelectorAll("[data-stripe-checkout]")) {
  const form = button.closest("form");
  if (!form) continue;
  button.addEventListener("click", () => {
    if (!form.reportValidity()) return;
    pay(fieldsFrom(form), form);
  });
}

const cartRoot = document.getElementById("cart-root");
if (cartRoot && document.documentElement.getAttribute("data-checkout-enabled") === "true") {
  const paint = () => {
    let cart = [];
    try { cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { cart = []; }
    const lines = cartRoot.querySelectorAll(".cart-line");
    lines.forEach((line, index) => {
      const item = cart[index];
      if (!item || line.querySelector("[data-stripe-checkout]")) return;
      const flag = line.querySelector(".flag");
      if (flag) flag.hidden = true;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button primary";
      button.setAttribute("data-stripe-checkout", "");
      button.textContent = "Checkout";
      button.addEventListener("click", () => pay({
        slug: item.slug,
        qty: item.qty || 1,
        fields: item.fields || [],
      }, line));
      (line.querySelector(".cart-controls") || line).append(button);
    });
  };
  paint();
  new MutationObserver(paint).observe(cartRoot, { childList: true });
}
