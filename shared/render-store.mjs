import { escapeHtml as esc, phoneHref, absolute, jsonLd, ANALYTICS_SCRIPT, displayPhone } from "./render-site.mjs";
import { areaNames, businessId, postalAddress, productCatalog } from "./schema.mjs";
import { formatPrice, isCheckoutUrl } from "./store-cart.mjs";
import { heroMark, illustrationSvg } from "./store-illustrations.mjs";

// A multi-page storefront for mail-order brands. The shop template stays a
// single-page menu board for the walk-in businesses. This one is a catalog:
// home, shop, a page per product, cart, and the usual policy pages.
//
// Checkout is a per-product URL in site.json (a Stripe Payment Link, a
// Shopify URL, or anything else https). An empty value is not filled in
// here. The button falls back to "Coming soon — notify me".

const STATE_CODES = { Alabama: "AL", Arizona: "AZ", Arkansas: "AR", California: "CA", Florida: "FL", Georgia: "GA", Illinois: "IL", Louisiana: "LA", Mississippi: "MS", Missouri: "MO", Nevada: "NV", "New Mexico": "NM", "North Carolina": "NC", Ohio: "OH", Oklahoma: "OK", Tennessee: "TN", Texas: "TX" };
const stateCode = (state = "") => STATE_CODES[state] || (state.length === 2 ? state.toUpperCase() : state);
const INFO_KEYS = ["faq", "shipping", "about", "contact", "privacy", "terms", "refunds"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const hex = (value, fallback) => (/^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback);

// Same stand-in rule as the launch checklist: fewer than 10 digits, or a
// last-seven that is all one digit (318-000-0000). Stores hide that number.
function isPlaceholderPhone(value) {
  const d = String(value || "").replace(/\D/g, "");
  if (d.length < 10) return true;
  return new Set(d.slice(-7)).size <= 1;
}

function publicPhone(site) {
  const shown = displayPhone(site);
  if (!shown || isPlaceholderPhone(shown)) return "";
  return shown;
}

function schemaPhone(site) {
  const nap = String(site.phone || "").trim();
  if (!nap || isPlaceholderPhone(nap)) return "";
  return nap;
}

function paletteOf(site) {
  const workshop = site.brand === "workshop";
  return {
    paper: hex(site.paper, workshop ? "#f2efe8" : "#f6efe4"),
    disc: hex(site.disc, workshop ? "#e4ddd2" : "#efe0cc"),
    card: hex(site.card, workshop ? "#fffdf8" : "#fffaf3"),
    ink: hex(site.ink, workshop ? "#161616" : "#2a2118"),
    accent: hex(site.accent, workshop ? "#e04e2a" : "#c2241f"),
    pine: hex(site.pine, workshop ? "#243024" : "#1d4034"),
    gold: hex(site.gold, workshop ? "#e04e2a" : "#b08958"),
    snow: !workshop,
  };
}

function typeStyle(site) {
  const palette = paletteOf(site);
  const festive = site.brand === "festive";
  const display = site.brand === "workshop"
    ? '"Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif'
    : festive
      ? '"Nunito", "Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif'
      : 'Palatino, "Palatino Linotype", "Iowan Old Style", Georgia, serif';
  const body = festive
    ? '"Nunito", "Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif'
    : '"Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif';
  return `:root{--accent:${palette.accent};--accent-dark:${hex(site.accentDark, palette.accent)};--paper:${palette.paper};--ink:${palette.ink};--muted:${hex(site.muted, "#5c564e")};--line:${hex(site.line, "#e3d9cc")};--card:${palette.card};--pine:${palette.pine};--gold:${palette.gold};--disc:${palette.disc};--display:${display};--body:${body}}`;
}

function assertSeo(label, title, description) {
  if (!title || title.length <= 10 || title.length > 70) {
    throw new Error(`${label} title length ${title ? title.length : 0} (need 11–70)`);
  }
  if (!description || description.length <= 50 || description.length > 175) {
    throw new Error(`${label} description length ${description ? description.length : 0} (need 51–175)`);
  }
  if (/[&']/.test(title + description)) {
    throw new Error(`${label} SEO text contains & or ' which the audit counts after escaping`);
  }
}

function productsOf(site) {
  if (!Array.isArray(site.products) || !site.products.length) {
    throw new Error(`${site.domain || site.name} store needs a products array`);
  }
  const seen = new Set();
  for (const product of site.products) {
    if (!product?.slug || !SLUG.test(product.slug)) throw new Error(`${site.name} product slug "${product?.slug}" is not a plain slug`);
    if (seen.has(product.slug)) throw new Error(`${site.name} duplicate product slug ${product.slug}`);
    seen.add(product.slug);
    if (!product.name) throw new Error(`${product.slug} is missing a name`);
    if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) {
      throw new Error(`${product.slug} needs a price above 0`);
    }
    assertSeo(product.slug, product.seoTitle, product.seoDescription);
  }
  return site.products;
}

function featuredProducts(site) {
  const products = productsOf(site);
  const flagged = products.filter((product) => product.featured);
  return flagged.length ? flagged : products.slice(0, 3);
}

function imageFile(product) {
  return product.image ? String(product.image).replace(/^\/assets\//, "") : `illu-${product.slug}.svg`;
}

function imageSrc(product) {
  return `/assets/${imageFile(product)}`;
}

function imageDims(product) {
  return {
    width: Number(product.imageWidth) || 640,
    height: Number(product.imageHeight) || 480,
  };
}

function assetPath(file) {
  return `/assets/${String(file || "").replace(/^\/assets\//, "")}`;
}

function heroVisual(site) {
  if (!site.heroImage) return heroMark(site.brand);
  const src = assetPath(site.heroImage);
  const alt = esc(site.heroImageAlt || site.headline || site.name);
  const width = Number(site.heroImageWidth) || 1200;
  const height = Number(site.heroImageHeight) || 900;
  const sizes = site.heroSizes ? ` sizes="${esc(site.heroSizes)}"` : "";
  const img = `<img class="hero-photo" src="${esc(src)}" alt="${alt}" width="${width}" height="${height}" decoding="async" fetchpriority="high">`;
  if (!site.heroWebpSrcset) return img;
  return `<picture><source type="image/webp" srcset="${esc(site.heroWebpSrcset)}"${sizes}>${img}</picture>`;
}

function heroPreload(site) {
  if (!site.heroImage) return "";
  if (site.heroWebpSrcset) {
    const sizes = site.heroSizes ? ` imagesizes="${esc(site.heroSizes)}"` : "";
    return `<link rel="preload" as="image" type="image/webp" imagesrcset="${esc(site.heroWebpSrcset)}"${sizes} fetchpriority="high">\n  `;
  }
  return `<link rel="preload" as="image" href="${esc(assetPath(site.heroImage))}" fetchpriority="high">\n  `;
}

function ornamentRow(items) {
  if (!Array.isArray(items) || !items.length) return "";
  const imgs = items.map((item) => {
    const width = Number(item.width) || 160;
    const height = Number(item.height) || 160;
    return `<img src="${esc(assetPath(item.src))}" alt="" width="${width}" height="${height}" loading="lazy" decoding="async">`;
  }).join("");
  return `<div class="ornament-row" aria-hidden="true">${imgs}</div>\n    `;
}

function pageFigure(page) {
  if (!page?.image) return "";
  const width = Number(page.imageWidth) || 960;
  const height = Number(page.imageHeight) || 720;
  return `<figure class="page-figure"><img src="${esc(assetPath(page.image))}" alt="${esc(page.imageAlt || "")}" width="${width}" height="${height}" loading="lazy" decoding="async"></figure>`;
}

// Flat household price: basePrice covers baseChildren, and extraChildPrice
// (default 0) is added only for children beyond that. A non-positive extra
// stays 0, so 2 or 6 children cost the same until the config says otherwise.
export function childBundlePrice({ basePrice, baseChildren = 2, extraChildPrice = 0, count = 0 }) {
  const base = Number(basePrice);
  const included = Number(baseChildren) > 0 ? Number(baseChildren) : 2;
  const extra = Number(extraChildPrice) > 0 ? Number(extraChildPrice) : 0;
  const more = Math.max(0, (Number(count) || 0) - included);
  return Math.round((base + more * extra) * 100) / 100;
}

function bundlePricingOf(product) {
  const raw = product?.bundlePricing;
  if (!raw || typeof raw !== "object") return null;
  const basePrice = Number(raw.basePrice);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    throw new Error(`${product.slug || "product"} bundlePricing.basePrice must be above 0`);
  }
  const extra = Number(raw.extraChildPrice);
  const baseChildren = Number(raw.baseChildren);
  return {
    basePrice,
    extraChildPrice: Number.isFinite(extra) && extra > 0 ? extra : 0,
    baseChildren: Number.isInteger(baseChildren) && baseChildren > 0 ? baseChildren : 2,
  };
}

function bundlePriceNote(product) {
  const pricing = bundlePricingOf(product);
  if (!pricing) return "";
  if (pricing.extraChildPrice > 0) {
    return `The price is ${formatPrice(pricing.basePrice)} for ${pricing.baseChildren} children at the same address, plus ${formatPrice(pricing.extraChildPrice)} for each additional child.`;
  }
  const max = Number(product.repeatChildren?.max);
  const capped = Number.isInteger(max) && max > pricing.baseChildren;
  const span = capped ? `${pricing.baseChildren} to ${max}` : "2 or more";
  const more = capped ? ` Families with more than ${max} children can add a separate letter.` : "";
  return `One flat price of ${formatPrice(pricing.basePrice)} for ${span} children in the same household.${more}`;
}

function navItems(site) {
  if (Array.isArray(site.nav) && site.nav.length) return site.nav;
  return [
    { href: "/shop", label: "Shop" },
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
    { href: "/shipping", label: "Shipping" },
  ];
}

function paragraphs(text) {
  return String(text || "").split(/\n\n+/).filter(Boolean).map((part) => `<p>${esc(part)}</p>`).join("");
}

function crumbs(parts) {
  const html = parts.map((part, index) => {
    if (index === parts.length - 1) return `<span aria-current="page">${esc(part.label)}</span>`;
    return `<a href="${esc(part.href)}">${esc(part.label)}</a>`;
  }).join(` <span aria-hidden="true">/</span> `);
  return `<nav class="crumbs" aria-label="Breadcrumb">${html}</nav>`;
}

function breadcrumbSchema(site, parts) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: parts.map((part, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: part.label,
      item: part.href === "/" ? `https://${site.domain}/` : `https://${site.domain}${part.href}`,
    })),
  };
}

// Official North Pole, AK postmark. Absent unless site.postmarkUpgrade.enabled
// is exactly true, so a missing flag and an explicit false render nothing.
function resolvePostmark(site) {
  const raw = site?.postmarkUpgrade;
  if (!raw || raw.enabled !== true) return null;
  const singlePrice = Number(raw.singlePrice);
  const householdPrice = Number(raw.householdPrice);
  if (!(singlePrice > 0) || !(householdPrice > 0)) return null;
  const products = raw.products && typeof raw.products === "object"
    ? raw.products
    : { "personalized-letter": 1, "sibling-bundle": 2 };
  return {
    singlePrice,
    householdPrice,
    products,
    cutoffLabel: String(raw.cutoffLabel || "Thursday, November 26, 2026, 5:00 PM CT"),
    singleCents: Math.round(singlePrice * 100),
    householdCents: Math.round(householdPrice * 100),
  };
}

function postmarkSentence(offer) {
  return `Letters with this option get the real hand-applied North Pole, Alaska postmark through the USPS holiday postmark program. One letter is ${formatPrice(offer.singlePrice)} extra. More than one letter to the same household is a flat ${formatPrice(offer.householdPrice)}. Order by ${offer.cutoffLabel}.`;
}

function mailedLetterCount(product, offer) {
  if (!offer) return 0;
  const count = Number(offer.products?.[product.slug]);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function checkoutEnabled(site) {
  return site?.checkout?.enabled === true;
}

function presentCheckout(site) {
  if (!checkoutEnabled(site)) return site;
  const next = structuredClone(site);
  next.checkoutNote = "Checkout sends the details to our server. They are not added to the address bar or a payment link.";
  const faq = next.info?.faq?.items?.find((item) => item.q === "Is checkout open?");
  if (faq) faq.a = "Yes. Checkout takes payment on Stripe. The letter is still reviewed before anything is sent or mailed. The details you type are not added to the payment link.";
  const payment = "Card numbers are not typed into this site. Checkout opens Stripe, and the price there is the price that is charged. The details you entered are posted to our server. They are not added to the payment link.";
  const privacy = next.info?.privacy?.sections?.find((section) => section.heading === "Payment");
  if (privacy) privacy.body = payment;
  const terms = next.info?.terms?.sections?.find((section) => section.heading === "Payment");
  if (terms) terms.body = payment;
  return next;
}

function presentSite(site) {
  site = presentCheckout(site);
  const offer = resolvePostmark(site);
  if (!offer) return site;
  const next = structuredClone(site);
  const sentence = postmarkSentence(offer);
  if (next.timing?.body) next.timing.body = `${next.timing.body} ${sentence}`;
  const info = next.info || (next.info = {});
  const faq = info.faq || (info.faq = {});
  faq.items = [...(faq.items || []), {
    q: "Can I add the real North Pole, Alaska postmark?",
    a: `${sentence} A standard printed letter without this option is printed in full color and mailed First-Class by USPS from the US mainland.`,
  }];
  const shipping = info.shipping || (info.shipping = {});
  shipping.sections = [...(shipping.sections || []), {
    heading: "North Pole, Alaska postmark",
    body: `${sentence} This option is separate from a standard printed letter.`,
  }];
  const terms = info.terms || (info.terms = {});
  terms.sections = [...(terms.sections || []), {
    heading: "The North Pole, Alaska postmark",
    body: `${sentence} Without this option, a printed letter is mailed First-Class from the US mainland.`,
  }];
  const where = info.about?.sections?.find((section) => section.heading === "Where the shop is");
  if (where) where.body = `${where.body} ${sentence}`;
  return next;
}

function fieldControl(field) {
  const required = field.required ? " required" : "";
  const autocomplete = field.autocomplete ? ` autocomplete="${esc(field.autocomplete)}"` : "";
  const hint = field.hint ? `<span class="hint">${esc(field.hint)}</span>` : "";
  const key = field.key ? ` data-key="${esc(field.key)}"` : "";
  if (field.type === "checkbox") {
    const value = esc(field.value || "yes");
    return `<label class="field"><span><input type="checkbox" name="${esc(field.name)}" value="${value}" data-field data-label="${esc(field.label)}"${key}${required}> ${esc(field.label)}</span>${hint}</label>`;
  }
  const max = field.type === "textarea" ? 800 : 160;
  const common = ` name="${esc(field.name)}" data-field data-label="${esc(field.label)}"${key}${required}${autocomplete} maxlength="${max}"`;
  const control = field.type === "textarea"
    ? `<textarea${common}></textarea>`
    : `<input type="${esc(field.type || "text")}"${common}${field.type === "date" ? "" : ""}>`;
  return `<label class="field">${esc(field.label)}${hint}${control}</label>`;
}

function fieldsHtml(fields = []) {
  let html = "";
  let current = null;
  for (const field of fields) {
    if (!field?.name || !field?.label) continue;
    const group = field.group || "";
    if (group !== current) {
      if (current) html += "</fieldset>";
      if (group) html += `<fieldset><legend>${esc(group)}</legend>`;
      current = group;
    }
    html += fieldControl(field);
  }
  if (current) html += "</fieldset>";
  return html;
}

function childFieldset(index, spec) {
  const fields = (spec.fields || []).map((field) => {
    if (!field?.key) throw new Error("A repeat child field needs a key");
    if (field.type === "email") throw new Error("A repeat child field cannot collect an email");
    return fieldControl({
      ...field,
      name: `child${index}${field.key}`,
      key: field.key,
    });
  }).join("");
  return `<fieldset data-child-slot data-child-index="${esc(String(index))}"><legend>${esc(`${spec.legend || "Child"} ${index}`)}</legend>${fields}<button type="button" class="text-button" data-remove-child hidden>${esc(spec.removeLabel || "Remove this child")}</button></fieldset>`;
}

function childSlotsHtml(spec) {
  if (!spec || !Array.isArray(spec.fields) || !spec.fields.length) return "";
  const min = Math.max(1, Number(spec.min) || 2);
  const max = Math.max(min, Number(spec.max) || 8);
  let html = `<div data-child-slots data-child-min="${min}" data-child-max="${max}">`;
  for (let index = 1; index <= min; index += 1) html += childFieldset(index, spec);
  html += `<template data-child-template>${childFieldset("__INDEX__", spec)}</template>`;
  html += `<button type="button" class="button ghost" data-add-child>${esc(spec.addLabel || "Add another child")}</button>`;
  html += `<p class="hint" data-child-status role="status"></p></div>`;
  return html;
}

const CHILD_SLOT_JS = `(function(){
  function money(n){
    var cents=Math.round(Number(n)*100);
    var abs=Math.abs(cents);
    return (cents<0?"-":"")+"$"+Math.floor(abs/100)+"."+String(abs%100).padStart(2,"0");
  }
  function priceFor(form,count){
    var base=Number(form.getAttribute("data-base-price"));
    var included=Number(form.getAttribute("data-base-children"))||2;
    var extra=Number(form.getAttribute("data-extra-child-price"));
    if(!(extra>0)) extra=0;
    var more=Math.max(0,count-included);
    return Math.round((base+more*extra)*100)/100;
  }
  function countOf(root){return root.querySelectorAll("[data-child-slot]").length;}
  function renumber(root){
    var min=Number(root.getAttribute("data-child-min"))||2;
    var max=Number(root.getAttribute("data-child-max"))||8;
    var slots=root.querySelectorAll("[data-child-slot]");
    slots.forEach(function(slot,i){
      var n=String(i+1);
      slot.setAttribute("data-child-index",n);
      var legend=slot.querySelector("legend");
      if(legend) legend.textContent="Child "+n;
      slot.querySelectorAll("[data-field]").forEach(function(input){
        var key=input.getAttribute("data-key");
        if(!key) return;
        input.name="child"+n+key;
      });
      var remove=slot.querySelector("[data-remove-child]");
      if(remove) remove.hidden=slots.length<=min;
    });
    var add=root.querySelector("[data-add-child]");
    if(add){
      var full=slots.length>=max;
      add.disabled=full;
      add.hidden=full;
    }
  }
  function paint(form){
    var root=form.querySelector("[data-child-slots]");
    if(!root) return 0;
    var count=countOf(root);
    var price=priceFor(form,count);
    form.setAttribute("data-price",String(price));
    var box=form.closest(".buy-box");
    var num=box&&box.querySelector(".price-num");
    if(num) num.textContent=money(price);
    if(form.hasAttribute("data-letter-count")) form.setAttribute("data-letter-count",String(count));
    return price;
  }
  document.querySelectorAll("[data-product-form]").forEach(function(form){
    var root=form.querySelector("[data-child-slots]");
    if(!root) return;
    renumber(root);
    paint(form);
    root.addEventListener("click",function(event){
      var add=event.target.closest&&event.target.closest("[data-add-child]");
      var remove=event.target.closest&&event.target.closest("[data-remove-child]");
      if(add){
        var max=Number(root.getAttribute("data-child-max"))||8;
        if(countOf(root)>=max) return;
        var tpl=root.querySelector("[data-child-template]");
        if(!tpl||!tpl.content||!tpl.content.firstElementChild) return;
        var node=tpl.content.firstElementChild.cloneNode(true);
        add.before(node);
        renumber(root);
        var price=paint(form);
        var status=root.querySelector("[data-child-status]");
        if(status) status.textContent="Child "+countOf(root)+" added. Household price "+money(price)+".";
        var focus=node.querySelector("input,textarea");
        if(focus) focus.focus();
      } else if(remove){
        var min=Number(root.getAttribute("data-child-min"))||2;
        if(countOf(root)<=min) return;
        var slot=remove.closest("[data-child-slot]");
        if(slot) slot.remove();
        renumber(root);
        var next=paint(form);
        var note=root.querySelector("[data-child-status]");
        if(note) note.textContent="A child was removed. "+countOf(root)+" children. Household price "+money(next)+".";
      }
    });
    form.addEventListener("submit",function(){paint(form);},true);
  });
})();`;

function childSlotScript(site) {
  if (!(site.products || []).some((product) => product.repeatChildren)) return "";
  return `<script>${CHILD_SLOT_JS}</script>\n  `;
}

function meter(product) {
  const n = Number(product.snark);
  if (!Number.isInteger(n) || n < 1 || n > 5) return "";
  const label = product.snarkLabel ? `${product.snarkLabel}. ` : "";
  return `<p class="meter"><span class="meter-label">Snark</span><span class="meter-bar" style="--n:${n}" aria-hidden="true"></span><span>${esc(`${label}${n} of 5`)}</span></p>`;
}

function productCard(product) {
  const href = `/products/${product.slug}`;
  const meta = [product.difficulty, product.snarkLabel].filter(Boolean);
  const dims = imageDims(product);
  return `<article class="product" data-placeholder="${product.placeholder ? "true" : "false"}">
    <a class="product-media" href="${href}">
      <img src="${esc(imageSrc(product))}" alt="${esc(product.imageAlt || product.name)}" width="${dims.width}" height="${dims.height}" loading="lazy" decoding="async">
    </a>
    <div class="product-body">
      <h3><a href="${href}">${esc(product.name)}</a></h3>
      <p class="price"><span class="price-num">${esc(formatPrice(product.price))}</span></p>
      ${meta.length ? `<p class="meta">${esc(meta.join(" · "))}</p>` : ""}
      ${product.blurb ? `<p class="blurb">${esc(product.blurb)}</p>` : ""}
      <a class="text-link" href="${href}">View details</a>
    </div>
  </article>`;
}

function fieldsFor(product, offer) {
  const letters = mailedLetterCount(product, offer);
  if (!letters) return { fields: product.fields || [], letters: 0 };
  const price = letters > 1 ? offer.householdPrice : offer.singlePrice;
  const label = letters > 1
    ? `Add the North Pole, Alaska postmark for this household (${formatPrice(price)})`
    : `Add the North Pole, Alaska postmark (+${formatPrice(price)})`;
  return {
    letters,
    fields: [...(product.fields || []), {
      name: "northPolePostmark",
      label,
      type: "checkbox",
      required: false,
      value: "yes",
      group: "Optional postmark",
      hint: postmarkSentence(offer),
    }],
  };
}

function buyBox(site, product) {
  const checkout = isCheckoutUrl(product.checkoutUrl) ? String(product.checkoutUrl).trim() : "";
  const ready = site.checkoutReadyLabel || "Buy now";
  const waiting = site.checkoutEmptyLabel || "Coming soon — notify me";
  const ownCheckout = !checkout && checkoutEnabled(site);
  const offer = resolvePostmark(site);
  const personalization = fieldsFor(product, offer);
  const pricing = bundlePricingOf(product);
  const unit = pricing ? pricing.basePrice : product.price;
  const note = bundlePriceNote(product);
  const slots = product.repeatChildren ? childSlotsHtml(product.repeatChildren) : "";
  const priceAttrs = pricing
    ? ` data-base-price="${esc(pricing.basePrice)}" data-base-children="${esc(pricing.baseChildren)}" data-extra-child-price="${esc(pricing.extraChildPrice)}"`
    : "";
  const action = checkout
    ? `<a class="button ghost" data-buy-link href="${esc(checkout)}">${esc(ready)}</a>`
    : ownCheckout
      ? `<button type="button" class="button primary" data-stripe-checkout>Checkout</button>`
      : `<button type="button" class="button ghost" data-notify>${esc(waiting)}</button>`;
  const notify = checkout || ownCheckout ? "" : `<div class="notify-panel" data-notify-panel hidden>
      <p>Leave your email. We'll be in touch.</p>
      <form>
        <label class="field">Email<input type="email" name="notifyEmail" required autocomplete="email" maxlength="160"></label>
        <button type="submit" class="button primary">Notify me</button>
        <p class="form-status" role="status"></p>
      </form>
    </div>`;
  const includes = (product.includes || []).length
    ? `<div><p class="kicker">What's included</p><ul class="includes">${product.includes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>`
    : "";
  return `<div class="buy-box">
    <p class="price"><span class="price-num">${esc(formatPrice(unit))}</span></p>${note ? `\n    <p class="bundle-note">${esc(note)}</p>` : ""}
    ${product.description ? `<p>${esc(product.description)}</p>` : ""}
    ${meter(product)}
    ${includes}
    ${product.timing ? `<p class="timing">${esc(product.timing)}</p>` : ""}${personalization.letters ? `\n    <p class="timing">${esc(postmarkSentence(offer))} A standard letter on this page, without the option, is printed in full color and mailed First-Class by USPS from the US mainland.</p>` : ""}
    <form data-product-form data-slug="${esc(product.slug)}" data-name="${esc(product.name)}" data-price="${esc(unit)}" data-placeholder="${product.placeholder ? "true" : "false"}" data-checkout="${esc(checkout)}"${priceAttrs}${personalization.letters ? ` data-letter-count="${personalization.letters}"` : ""}>
      ${slots}${fieldsHtml(personalization.fields)}
      <label class="field qty-field">Quantity<input type="number" name="qty" min="1" max="20" value="1" required></label>
      <div class="buy-actions">
        <button type="submit" class="button primary">Add to cart</button>
        ${action}
      </div>
      <p class="form-status" role="status"></p>
    </form>
    ${notify}
    <p class="quiet">${esc(ownCheckout ? "Checkout sends these details to our server. They are not added to the address bar." : (site.checkoutNote || "Add to cart keeps the details in this browser. Buy now uses the payment link on this product when one is set."))}</p>
  </div>`;
}

function productSchema(site, product) {
  const url = `https://${site.domain}/products/${product.slug}`;
  const availability = product.placeholder || (!isCheckoutUrl(product.checkoutUrl) && !checkoutEnabled(site))
    ? "https://schema.org/PreOrder"
    : "https://schema.org/InStock";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seoDescription,
    sku: product.slug,
    image: absolute(site.domain, imageFile(product)),
    brand: { "@type": "Brand", name: site.name },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: (Math.round(Number(product.price) * 100) / 100).toFixed(2),
      availability,
      seller: { "@id": businessId(site) },
    },
  };
}

function businessSchema(site) {
  const areas = areaNames(site);
  const first = featuredProducts(site)[0];
  return {
    "@context": "https://schema.org",
    "@type": site.schemaType || "Store",
    "@id": businessId(site),
    name: site.name,
    url: `https://${site.domain}`,
    mainEntityOfPage: `https://${site.domain}/`,
    telephone: schemaPhone(site) || undefined,
    email: (site.contactEmail || site.email || "").trim() || undefined,
    description: site.seoDescription,
    image: first ? absolute(site.domain, imageFile(first)) : undefined,
    address: postalAddress(site, stateCode),
    areaServed: areas.map((name) => ({ "@type": "Place", name })),
    hasOfferCatalog: productCatalog(site, site.products),
    contactPoint: schemaPhone(site)
      ? { "@type": "ContactPoint", contactType: "customer service", telephone: schemaPhone(site), areaServed: "US", availableLanguage: "English" }
      : undefined,
  };
}

function shell(site, slug, { title, description, path, current, main, schemas, image, ogType = "website" }) {
  assertSeo(path || "home", title, description);
  const brand = site.brand === "workshop" ? "workshop" : site.brand === "festive" ? "festive" : "hearth";
  const phone = publicPhone(site);
  const tel = phone ? phoneHref(phone) : "";
  const canonical = path ? `https://${site.domain}/${path}` : `https://${site.domain}/`;
  const contact = String(site.contactEmail || "").trim();
  const offer = resolvePostmark(site);
  const flags = `${site.omitCheckoutQuery ? ` data-omit-checkout-query="true"` : ""}${checkoutEnabled(site) ? ` data-checkout-enabled="true"` : ""}${offer ? ` data-postmark-single="${offer.singleCents}" data-postmark-household="${offer.householdCents}" data-postmark-label="${esc("North Pole, Alaska postmark")}"` : ""}`;
  const nav = navItems(site).map((item) => {
    const on = item.href === current;
    return `<a href="${esc(item.href)}"${on ? ` aria-current="page"` : ""}>${esc(item.label)}</a>`;
  }).join("");
  const footerLinks = [
    ["/shop", "Shop"],
    ["/cart", "Cart"],
    ["/faq", "FAQ"],
    ["/shipping", "Shipping"],
    ["/about", "About"],
    ["/contact", "Contact"],
    ["/privacy", "Privacy"],
    ["/terms", "Terms"],
    ["/refunds", "Refunds"],
  ].map(([href, label]) => `<a href="${href}">${label}</a>`).join("");
  const scripts = (schemas || []).map((schema) => `<script type="application/ld+json">${jsonLd(schema)}</script>`).join("");
  const ogImage = image ? `<meta property="og:image" content="${esc(image)}">` : "";
  return `<!doctype html>
<html lang="en" data-site="${esc(slug)}" data-brand="${brand}"${contact ? ` data-contact-email="${esc(contact)}"` : ""}${flags}><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta name="theme-color" content="${esc(paletteOf(site).accent)}">
  <meta property="og:type" content="${esc(ogType)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="${esc(site.name)}">
  ${ogImage}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  ${heroPreload(site)}<link rel="stylesheet" href="/site.css">
  <style>${typeStyle(site)}</style>
  ${scripts}
</head><body>
  <a class="skip" href="#main">Skip to content</a>
  <div class="mast">
    <div class="topbar"><p>${esc(site.kicker || site.name)}</p>${phone ? `<a class="nav-call" href="${tel}">${esc(phone)}</a>` : ""}</div>
    <header>
      <a class="brand" href="/" aria-label="${esc(site.name)} home"><span class="brand-text">${esc(site.name)}</span></a>
      <nav id="site-nav" aria-label="Primary">${nav}</nav>
      <div class="header-actions">
        <a class="button primary header-shop" href="/shop">${esc(site.primaryCta || "Shop")}</a>
        <a class="cart-link" href="/cart">Cart <span data-cart-count>0</span></a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">Menu</button>
      </div>
    </header>
  </div>
  <main id="main">${main}</main>
  <footer><div class="shell footer-grid">
    <div><p class="brand-text">${esc(site.name)}</p><p class="legal">${esc(site.footerLine || "")}</p><p class="legal">${esc(site.city)}, ${esc(stateCode(site.state))}</p><p class="legal">© <span id="year"></span> ${esc(site.name)}</p></div>
    <nav class="footer-links" aria-label="Footer">${footerLinks}</nav>
    <div>${phone ? `<a class="footer-phone" href="${tel}">${esc(phone)}</a>` : ""}${contact ? `<p class="legal"><a href="mailto:${esc(contact)}">${esc(contact)}</a></p>` : `<p class="legal">We'll be in touch.</p>`}</div>
  </div></footer>
  ${phone ? `<a class="mobile-call" href="${tel}" aria-label="Call ${esc(phone)}">${esc(phone)}</a>` : ""}
  <script src="/site.js" defer></script>
  ${childSlotScript(site)}<script src="/store.js" type="module"></script>
  ${checkoutEnabled(site) ? `<script src="/santa-checkout.js" type="module"></script>` : ""}
  ${site.analytics === false ? "" : `<script>${ANALYTICS_SCRIPT}</script>`}
</body></html>`;
}

function homeMain(site) {
  const phone = publicPhone(site);
  const tel = phone ? phoneHref(phone) : "";
  const featured = featuredProducts(site);
  const more = productsOf(site).length > featured.length
    ? `<p class="featured-note"><a class="text-link" href="/shop">See the full shop</a></p>`
    : "";
  const steps = (site.steps || []).map((step, index) => {
    const art = step.image
      ? `<img class="step-art" src="${esc(assetPath(step.image))}" alt="${esc(step.imageAlt || "")}" width="${Number(step.imageWidth) || 160}" height="${Number(step.imageHeight) || 160}" loading="lazy" decoding="async">`
      : "";
    return `
    <article class="step">${art}<span>${String(index + 1).padStart(2, "0")}</span><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p></article>`;
  }).join("");
  const timing = site.timing ? `<section class="band" id="timing"><div class="shell"><p class="kicker">${esc(site.timing.kicker || "Timing")}</p><h2>${esc(site.timing.heading)}</h2><p>${esc(site.timing.body)}</p>${site.timing.linkHref ? `<p><a href="${esc(site.timing.linkHref)}">${esc(site.timing.linkLabel || "Read more")}</a></p>` : ""}</div></section>` : "";
  const faqs = (site.info?.faq?.items || []).slice(0, 3);
  const faqBlock = faqs.length ? `<section class="section shell" id="faq"><div class="section-head"><p class="kicker">FAQ</p><h2>${esc(site.info.faq.heading || "Questions")}</h2></div><div class="faq-list">${faqItems(faqs)}</div><p class="featured-note"><a class="text-link" href="/faq">All questions</a></p></section>` : "";
  const areas = areaNames(site).map((area) => `<span>${esc(area)}</span>`).join("");
  return `
    <section class="shell hero" id="top">
      <div>
        <p class="kicker">${esc(site.heroKicker || site.kicker || "")}</p>
        <h1>${esc(site.headline)}</h1>
        ${site.intro ? `<p class="lede">${esc(site.intro)}</p>` : ""}
        <div class="hero-actions">
          <a class="button primary" href="/shop">${esc(site.primaryCta || "Shop")}</a>
          <a class="button ghost" href="#timing">${esc(site.secondaryCta || "Ordering")}</a>
        </div>
      </div>
      ${heroVisual(site)}
    </section>
    ${ornamentRow(site.ornaments)}<section class="section shell" id="store">
      <div class="section-head"><p class="kicker">${esc(site.sectionKicker || "Shop")}</p><h2>${esc(site.servicesHeadline || "Featured")}</h2></div>
      <div class="product-grid cols-3">${featured.map(productCard).join("")}</div>
      ${site.featuredNote ? `<p class="featured-note">${esc(site.featuredNote)}</p>` : ""}
      ${site.catalogNote ? `<p class="catalog-note">${esc(site.catalogNote)}</p>` : ""}
      ${more}
    </section>
    ${steps ? `<section class="section shell" id="how"><div class="section-head"><p class="kicker">${esc(site.stepsKicker || "How it works")}</p><h2>${esc(site.stepsHeading || "The order")}</h2></div><div class="steps">${steps}</div></section>` : ""}
    ${timing}
    ${site.about ? `<section class="section shell about-grid"><div><p class="kicker">About</p><h2>${esc(site.aboutHeading || site.name)}</h2></div><div><p>${esc(site.about)}</p>${phone ? `<p class="quiet-phone">Phone <a href="${tel}">${esc(phone)}</a></p>` : ""}<p class="featured-note"><a class="text-link" href="/about">More about the shop</a></p></div></section>` : ""}
    ${faqBlock}
    <section class="areas" id="areas"><div class="shell areas-inner"><div><p class="kicker">${esc(site.areasKicker || "Shipping")}</p><h2>${esc(site.areasHeading || "Where orders go")}</h2></div><div class="area-list">${areas}</div></div></section>`;
}

function faqItems(items) {
  return items.map((item) => `<details class="faq-item"><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join("");
}

function faqSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

function infoMain(site, key, page) {
  const trail = crumbs([{ href: "/", label: "Home" }, { href: `/${page.slug}`, label: page.heading }]);
  if (key === "faq") {
    return `${trail}<section class="shell page-hero"><p class="kicker">${esc(page.kicker || "FAQ")}</p><h1>${esc(page.heading)}</h1>${page.intro ? `<p class="lede">${esc(page.intro)}</p>` : ""}</section><section class="section shell"><div class="faq-list">${faqItems(page.items || [])}</div></section>`;
  }
  if (key === "contact") {
    const phone = publicPhone(site);
    const tel = phone ? phoneHref(phone) : "";
    const email = String(site.contactEmail || "").trim();
    const emailLine = email
      ? `<p>Email <a href="mailto:${esc(email)}">${esc(email)}</a></p>`
      : `<p>Leave a note. We'll be in touch.</p>`;
    const quiet = email
      ? "This opens your mail app addressed to the shop."
      : "We'll be in touch.";
    return `${trail}<section class="shell page-hero"><p class="kicker">${esc(page.kicker || "Contact")}</p><h1>${esc(page.heading)}</h1>${page.intro ? `<p class="lede">${esc(page.intro)}</p>` : ""}</section>
      <section class="shell prose">
        ${phone ? `<p>Phone <a href="${tel}">${esc(phone)}</a></p>` : ""}
        ${emailLine}
        ${(page.sections || []).map((section) => `<section><h2>${esc(section.heading)}</h2>${paragraphs(section.body)}</section>`).join("")}
        <form class="contact-form" data-contact-form>
          <label class="field">Your name<input type="text" name="name" required maxlength="160" autocomplete="name"></label>
          <label class="field">Your email<input type="email" name="email" required maxlength="160" autocomplete="email"></label>
          <label class="field">Message<textarea name="message" required maxlength="800"></textarea></label>
          <button type="submit" class="button primary">${email ? "Email the shop" : "Send a note"}</button>
          <p class="form-status" role="status"></p>
          <p class="quiet">${esc(quiet)}</p>
        </form>
      </section>`;
  }
  const sections = (page.sections || []).map((section) => `<section><h2>${esc(section.heading)}</h2>${paragraphs(section.body)}</section>`).join("");
  return `${trail}<section class="shell page-hero"><p class="kicker">${esc(page.kicker || "")}</p><h1>${esc(page.heading)}</h1>${page.intro ? `<p class="lede">${esc(page.intro)}</p>` : ""}</section>${pageFigure(page)}<section class="shell prose">${sections}</section>`;
}

export function renderStore(site, slug = "") {
  site = presentSite(site);
  const first = featuredProducts(site)[0];
  return shell(site, slug, {
    title: site.seoTitle,
    description: site.seoDescription,
    path: "",
    current: "/",
    main: homeMain(site),
    schemas: [businessSchema(site)],
    image: first ? absolute(site.domain, imageFile(first)) : "",
  });
}

export function storeDocuments(site, slug = "") {
  site = presentSite(site);
  const products = productsOf(site);
  const palette = paletteOf(site);
  const files = [];
  for (const product of products) {
    if (product.image) continue;
    files.push({
      path: `assets/${imageFile(product)}`,
      body: illustrationSvg(product.icon || "parcel", product.imageAlt || product.name, palette),
    });
  }

  const pages = [];
  const shopTitle = site.shopSeoTitle;
  const shopDescription = site.shopSeoDescription;
  pages.push({
    slug: "shop",
    html: shell(site, slug, {
      title: shopTitle,
      description: shopDescription,
      path: "shop",
      current: "/shop",
      image: absolute(site.domain, imageFile(products[0])),
      schemas: [breadcrumbSchema(site, [{ href: "/", label: "Home" }, { href: "/shop", label: site.shopHeading || "Shop" }])],
      main: `${crumbs([{ href: "/", label: "Home" }, { href: "/shop", label: site.shopHeading || "Shop" }])}
        <section class="shell page-hero"><p class="kicker">${esc(site.shopKicker || "Shop")}</p><h1>${esc(site.shopHeading || "Shop")}</h1>${site.shopIntro ? `<p class="lede">${esc(site.shopIntro)}</p>` : ""}</section>
        <section class="section shell"><div class="product-grid cols-3">${products.map(productCard).join("")}</div>${site.catalogNote ? `<p class="catalog-note">${esc(site.catalogNote)}</p>` : ""}</section>`,
    }),
  });

  for (const product of products) {
    const href = `/products/${product.slug}`;
    const related = products.filter((other) => other.slug !== product.slug).slice(0, 3);
    const trail = [
      { href: "/", label: "Home" },
      { href: "/shop", label: "Shop" },
      { href, label: product.name },
    ];
    pages.push({
      slug: `products/${product.slug}`,
      html: shell(site, slug, {
        title: product.seoTitle,
        description: product.seoDescription,
        path: `products/${product.slug}`,
        current: "/shop",
        ogType: "product",
        image: absolute(site.domain, imageFile(product)),
        schemas: [productSchema(site, product), breadcrumbSchema(site, trail)],
        main: `${crumbs(trail)}
          <article class="shell pdp">
            <div class="pdp-media"><img src="${esc(imageSrc(product))}" alt="${esc(product.imageAlt || product.name)}" width="${imageDims(product).width}" height="${imageDims(product).height}" decoding="async" fetchpriority="high"></div>
            <div>
              <p class="kicker">${esc(product.kicker || site.name)}</p>
              <h1>${esc(product.name)}</h1>
              ${buyBox(site, product)}
            </div>
          </article>
          ${related.length ? `<section class="shell related"><h2>Also in the shop</h2><div class="product-grid">${related.map(productCard).join("")}</div></section>` : ""}`,
      }),
    });
  }

  pages.push({
    slug: "cart",
    html: shell(site, slug, {
      title: site.cartSeoTitle,
      description: site.cartSeoDescription,
      path: "cart",
      current: "/cart",
      schemas: [breadcrumbSchema(site, [{ href: "/", label: "Home" }, { href: "/cart", label: "Cart" }])],
      main: `${crumbs([{ href: "/", label: "Home" }, { href: "/cart", label: "Cart" }])}
        <section class="shell page-hero"><p class="kicker">Cart</p><h1>${esc(site.cartHeading || "Your cart")}</h1><p class="lede">${esc(site.cartIntro || "Items you add stay in this browser, with the details you typed.")}</p></section>
        <section class="section shell"><div id="cart-root"></div><noscript><p>The cart is saved in this browser and needs JavaScript to show what you added. Each product page still lists the offer.</p></noscript></section>`,
    }),
  });

  const info = site.info || {};
  for (const key of INFO_KEYS) {
    const page = info[key];
    if (!page) continue;
    if (page.slug !== key) throw new Error(`${site.name} ${key} page slug must be "${key}"`);
    assertSeo(page.slug, page.seoTitle, page.seoDescription);
    const schemas = [breadcrumbSchema(site, [{ href: "/", label: "Home" }, { href: `/${page.slug}`, label: page.heading }])];
    if (key === "faq" && Array.isArray(page.items) && page.items.length) schemas.push(faqSchema(page.items));
    pages.push({
      slug: page.slug,
      html: shell(site, slug, {
        title: page.seoTitle,
        description: page.seoDescription,
        path: page.slug,
        current: `/${page.slug}`,
        schemas,
        main: infoMain(site, key, page),
      }),
    });
  }

  return { pages, files };
}
