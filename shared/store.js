import { addLine, cartTotal, checkoutHref, fieldKey, formatMoney, formatPrice, isCheckoutUrl, lineParams, notifyMailto, postmarkFeeCents } from "./store-cart.mjs";

const CART_KEY = "store-cart-v1";
const NOTIFY_KEY = "store-notify-v1";

function loadCart() {
  try {
    const data = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  paintCount(cart);
}

function paintCount(cart = loadCart()) {
  const count = cart.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
  for (const node of document.querySelectorAll("[data-cart-count]")) node.textContent = String(count);
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children || []) node.append(child);
  return node;
}

function formFields(form) {
  const fields = [];
  for (const input of form.querySelectorAll("[data-field]")) {
    const value = input.type === "checkbox"
      ? (input.checked ? String(input.value || "yes") : "")
      : input.value.trim();
    fields.push({
      name: input.name,
      label: input.getAttribute("data-label") || input.name,
      value,
    });
  }
  return fields;
}

function readLine(form) {
  const qtyInput = form.querySelector("[name=qty]");
  const qty = Math.max(1, Math.min(20, Number(qtyInput?.value) || 1));
  const fields = formFields(form);
  const slug = form.getAttribute("data-slug") || "";
  const letterCount = form.getAttribute("data-letter-count");
  return {
    slug,
    name: form.getAttribute("data-name") || slug,
    price: Number(form.getAttribute("data-price")),
    placeholder: form.getAttribute("data-placeholder") === "true",
    checkoutUrl: form.getAttribute("data-checkout") || "",
    qty,
    fields,
    fieldKey: fieldKey(fields),
    ...(letterCount ? { letterCount: Number(letterCount) || 1 } : {}),
  };
}

function checkoutParams(line) {
  if (document.documentElement.getAttribute("data-omit-checkout-query") === "true") {
    return { product: line.slug || "", qty: String(line.qty || 1) };
  }
  return lineParams(line);
}

function postmarkOfferFromPage() {
  const root = document.documentElement;
  const single = Number(root.getAttribute("data-postmark-single"));
  const household = Number(root.getAttribute("data-postmark-household"));
  if (!Number.isInteger(single) || !Number.isInteger(household) || single <= 0 || household <= 0) return null;
  return { singleCents: single, householdCents: household };
}

function setStatus(scope, message) {
  const node = scope.querySelector(".form-status");
  if (node) node.textContent = message;
}

function rememberNotify(entry) {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(NOTIFY_KEY) || "[]"); } catch { saved = []; }
  if (!Array.isArray(saved)) saved = [];
  saved.push({ ...entry, at: new Date().toISOString() });
  localStorage.setItem(NOTIFY_KEY, JSON.stringify(saved));
}

function inbox() {
  return document.documentElement.getAttribute("data-contact-email") || "";
}

function onProductForm(form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    saveCart(addLine(loadCart(), readLine(form)));
    setStatus(form, "Added to cart. It stays in this browser.");
  });

  const buy = form.querySelector("[data-buy-link]");
  if (buy) {
    buy.addEventListener("click", (event) => {
      if (!form.reportValidity()) {
        event.preventDefault();
        return;
      }
      const line = readLine(form);
      const href = checkoutHref(line.checkoutUrl, checkoutParams(line));
      if (!href) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      window.location.assign(href);
    });
  }

  const scope = form.closest(".buy-box") || form;
  const notify = scope.querySelector("[data-notify]");
  const panel = scope.querySelector("[data-notify-panel]");
  if (!notify || !panel) return;
  notify.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) panel.querySelector("input[type=email]")?.focus();
  });
  panel.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = panel.querySelector("input[type=email]")?.value.trim() || "";
    const line = readLine(form);
    const mailto = notifyMailto(inbox(), { product: line.name, email, fields: line.fields });
    if (mailto) {
      window.location.assign(mailto);
      return;
    }
    rememberNotify({ email, slug: line.slug, fields: line.fields });
    setStatus(panel, "Thanks. We'll be in touch.");
  });
}

function renderLine(line) {
  const wrap = el("article", { class: "cart-line" });
  const body = el("div", {});
  body.append(el("h2", {}, [line.name]));
  const price = formatPrice(line.price);
  body.append(el("p", { class: "line-price" }, [price]));
  const list = el("dl", { class: "cart-fields" });
  for (const field of line.fields || []) {
    if (!String(field.value || "").trim()) continue;
    list.append(el("dt", {}, [field.label || field.name]));
    list.append(el("dd", {}, [field.value]));
  }
  body.append(list);
  wrap.append(body);

  const controls = el("div", { class: "cart-controls" });
  const qty = el("input", {
    type: "number",
    min: "1",
    max: "20",
    value: String(line.qty || 1),
    "aria-label": `Quantity for ${line.name}`,
  });
  qty.addEventListener("change", () => {
    const next = loadCart().map((item) => item.fieldKey === line.fieldKey && item.slug === line.slug
      ? { ...item, qty: Math.max(1, Math.min(20, Number(qty.value) || 1)) }
      : item);
    saveCart(next);
    const root = document.getElementById("cart-root");
    if (root) renderCart(root);
  });
  controls.append(qty);
  const remove = el("button", { type: "button", class: "text-button" }, ["Remove"]);
  remove.addEventListener("click", () => {
    saveCart(loadCart().filter((item) => !(item.slug === line.slug && item.fieldKey === line.fieldKey)));
    const root = document.getElementById("cart-root");
    if (root) renderCart(root);
  });
  controls.append(remove);
  const href = checkoutHref(line.checkoutUrl, checkoutParams(line));
  if (href) controls.append(el("a", { class: "button primary", href }, ["Pay for this item"]));
  else controls.append(el("p", { class: "flag" }, ["Coming soon"]));
  wrap.append(controls);
  return wrap;
}

function renderCart(root) {
  const cart = loadCart();
  root.replaceChildren();
  if (!cart.length) {
    root.append(el("p", { class: "empty-cart" }, ["Your cart is empty."]));
    root.append(el("a", { class: "button primary", href: "/shop" }, ["Visit the shop"]));
    return;
  }
  for (const line of cart) root.append(renderLine(line));
  const extra = postmarkFeeCents(cart, postmarkOfferFromPage());
  const feeLabel = document.documentElement.getAttribute("data-postmark-label");
  if (extra && feeLabel) root.append(el("p", { class: "cart-fee" }, [`${feeLabel} ${formatMoney(extra)}`]));
  root.append(el("p", { class: "cart-total" }, [formatMoney(cartTotal(cart) + extra)]));
  if (cart.some((line) => !isCheckoutUrl(line.checkoutUrl))) {
    root.append(el("p", { class: "quiet" }, [
      "Payment is not open yet. Your details stay in this browser.",
    ]));
  }
}

function onContact(form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const fields = [
      { name: "name", label: "Name", value: String(data.get("name") || "").trim() },
      { name: "message", label: "Message", value: String(data.get("message") || "").trim() },
    ];
    const mailto = notifyMailto(inbox(), { product: "General question", email, fields });
    if (mailto) {
      window.location.assign(mailto);
      return;
    }
    rememberNotify({ email, slug: "contact", fields });
    setStatus(form, "Thanks. We'll be in touch.");
  });
}

paintCount();
for (const form of document.querySelectorAll("[data-product-form]")) onProductForm(form);
const cartRoot = document.getElementById("cart-root");
if (cartRoot) renderCart(cartRoot);
for (const form of document.querySelectorAll("[data-contact-form]")) onContact(form);
