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
  const display = site.brand === "workshop"
    ? '"Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif'
    : 'Palatino, "Palatino Linotype", "Iowan Old Style", Georgia, serif';
  const body = '"Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif';
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

function fieldControl(field) {
  const required = field.required ? " required" : "";
  const autocomplete = field.autocomplete ? ` autocomplete="${esc(field.autocomplete)}"` : "";
  const hint = field.hint ? `<span class="hint">${esc(field.hint)}</span>` : "";
  const max = field.type === "textarea" ? 800 : 160;
  const common = ` name="${esc(field.name)}" data-field data-label="${esc(field.label)}"${required}${autocomplete} maxlength="${max}"`;
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

function meter(product) {
  const n = Number(product.snark);
  if (!Number.isInteger(n) || n < 1 || n > 5) return "";
  const label = product.snarkLabel ? `${product.snarkLabel}. ` : "";
  return `<p class="meter"><span class="meter-label">Snark</span><span class="meter-bar" style="--n:${n}" aria-hidden="true"></span><span>${esc(`${label}${n} of 5`)}</span></p>`;
}

function productCard(product) {
  const href = `/products/${product.slug}`;
  const sample = product.placeholder
    ? `<span class="flag">Sample</span>`
    : "";
  const priceFlag = product.placeholder ? ` <span class="flag">Sample price</span>` : "";
  const meta = [product.difficulty, product.snarkLabel].filter(Boolean);
  return `<article class="product" data-placeholder="${product.placeholder ? "true" : "false"}">
    <a class="product-media" href="${href}">
      <img src="${esc(imageSrc(product))}" alt="${esc(product.imageAlt || product.name)}" width="640" height="480" loading="lazy" decoding="async">
      ${sample}
    </a>
    <div class="product-body">
      <h3><a href="${href}">${esc(product.name)}</a></h3>
      <p class="price"><span class="price-num">${esc(formatPrice(product.price))}</span>${priceFlag}</p>
      ${meta.length ? `<p class="meta">${esc(meta.join(" · "))}</p>` : ""}
      ${product.blurb ? `<p class="blurb">${esc(product.blurb)}</p>` : ""}
      <a class="text-link" href="${href}">View details</a>
    </div>
  </article>`;
}

function buyBox(site, product) {
  const checkout = isCheckoutUrl(product.checkoutUrl) ? String(product.checkoutUrl).trim() : "";
  const ready = site.checkoutReadyLabel || "Buy now";
  const waiting = site.checkoutEmptyLabel || "Coming soon — notify me";
  const action = checkout
    ? `<a class="button ghost" data-buy-link href="${esc(checkout)}">${esc(ready)}</a>`
    : `<button type="button" class="button ghost" data-notify>${esc(waiting)}</button>`;
  const notify = checkout ? "" : `<div class="notify-panel" data-notify-panel hidden>
      <p>Checkout is not open for this product yet. Leave an email and this browser will remember it. Nothing is sent unless a contact address is added to the site.</p>
      <form>
        <label class="field">Email<input type="email" name="notifyEmail" required autocomplete="email" maxlength="160"></label>
        <button type="submit" class="button primary">Notify me</button>
        <p class="form-status" role="status"></p>
      </form>
    </div>`;
  const note = product.placeholderNote ? `<p class="draft-note">${esc(product.placeholderNote)}</p>` : "";
  const includes = (product.includes || []).length
    ? `<div><p class="kicker">What's included</p><ul class="includes">${product.includes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>`
    : "";
  return `<div class="buy-box">
    ${note}
    <p class="price"><span class="price-num">${esc(formatPrice(product.price))}</span>${product.placeholder ? ` <span class="flag">Sample price</span>` : ""}</p>
    ${product.description ? `<p>${esc(product.description)}</p>` : ""}
    ${meter(product)}
    ${includes}
    ${product.timing ? `<p class="timing">${esc(product.timing)}</p>` : ""}
    <form data-product-form data-slug="${esc(product.slug)}" data-name="${esc(product.name)}" data-price="${esc(product.price)}" data-placeholder="${product.placeholder ? "true" : "false"}" data-checkout="${esc(checkout)}">
      ${fieldsHtml(product.fields)}
      <label class="field qty-field">Quantity<input type="number" name="qty" min="1" max="20" value="1" required></label>
      <div class="buy-actions">
        <button type="submit" class="button primary">Add to cart</button>
        ${action}
      </div>
      <p class="form-status" role="status"></p>
    </form>
    ${notify}
    <p class="quiet">${esc(site.checkoutNote || "Add to cart keeps the details in this browser. Buy now uses the payment link on this product when one is set.")}</p>
  </div>`;
}

function productSchema(site, product) {
  const url = `https://${site.domain}/products/${product.slug}`;
  const availability = product.placeholder || !isCheckoutUrl(product.checkoutUrl)
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
    telephone: site.phone,
    email: (site.contactEmail || site.email || "").trim() || undefined,
    description: site.seoDescription,
    image: first ? absolute(site.domain, imageFile(first)) : undefined,
    address: postalAddress(site, stateCode),
    areaServed: areas.map((name) => ({ "@type": "Place", name })),
    hasOfferCatalog: productCatalog(site, site.products),
    contactPoint: site.phone
      ? { "@type": "ContactPoint", contactType: "customer service", telephone: site.phone, areaServed: "US", availableLanguage: "English" }
      : undefined,
  };
}

function shell(site, slug, { title, description, path, current, main, schemas, image, ogType = "website" }) {
  assertSeo(path || "home", title, description);
  const brand = site.brand === "workshop" ? "workshop" : "hearth";
  const phone = displayPhone(site);
  const tel = phone ? phoneHref(phone) : "";
  const canonical = path ? `https://${site.domain}/${path}` : `https://${site.domain}/`;
  const contact = String(site.contactEmail || "").trim();
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
<html lang="en" data-site="${esc(slug)}" data-brand="${brand}"${contact ? ` data-contact-email="${esc(contact)}"` : ""}><head>
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
  <link rel="stylesheet" href="/site.css">
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
    <div>${phone ? `<a class="footer-phone" href="${tel}">${esc(phone)}</a>` : ""}<p class="legal">A product without a payment link stays on coming soon.</p></div>
  </div></footer>
  ${phone ? `<a class="mobile-call" href="${tel}" aria-label="Call ${esc(phone)}">${esc(phone)}</a>` : ""}
  <script src="/site.js" defer></script>
  <script src="/store.js" type="module"></script>
  ${site.analytics === false ? "" : `<script>${ANALYTICS_SCRIPT}</script>`}
</body></html>`;
}

function homeMain(site) {
  const phone = displayPhone(site);
  const tel = phone ? phoneHref(phone) : "";
  const featured = featuredProducts(site);
  const more = productsOf(site).length > featured.length
    ? `<p class="featured-note"><a class="text-link" href="/shop">See the full shop</a></p>`
    : "";
  const steps = (site.steps || []).map((step, index) => `
    <article class="step"><span>${String(index + 1).padStart(2, "0")}</span><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p></article>`).join("");
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
      ${heroMark(site.brand)}
    </section>
    <section class="section shell" id="store">
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
  const draft = page.draft ? `<p class="draft-note">${esc(page.draftNote || "Working draft. Confirm this page before the store takes payment.")}</p>` : "";
  if (key === "faq") {
    return `${trail}<section class="shell page-hero"><p class="kicker">${esc(page.kicker || "FAQ")}</p><h1>${esc(page.heading)}</h1>${page.intro ? `<p class="lede">${esc(page.intro)}</p>` : ""}</section><section class="section shell"><div class="faq-list">${faqItems(page.items || [])}</div></section>`;
  }
  if (key === "contact") {
    const phone = displayPhone(site);
    const tel = phone ? phoneHref(phone) : "";
    const email = String(site.contactEmail || "").trim();
    return `${trail}<section class="shell page-hero"><p class="kicker">${esc(page.kicker || "Contact")}</p><h1>${esc(page.heading)}</h1>${page.intro ? `<p class="lede">${esc(page.intro)}</p>` : ""}</section>
      <section class="shell prose">
        ${draft}
        ${phone ? `<p>Phone <a href="${tel}">${esc(phone)}</a></p>` : ""}
        ${email ? `<p>Email <a href="mailto:${esc(email)}">${esc(email)}</a></p>` : `<p>A public email address is not listed on this site yet.</p>`}
        ${(page.sections || []).map((section) => `<section><h2>${esc(section.heading)}</h2>${paragraphs(section.body)}</section>`).join("")}
        <form class="contact-form" data-contact-form>
          <label class="field">Your name<input type="text" name="name" required maxlength="160" autocomplete="name"></label>
          <label class="field">Your email<input type="email" name="email" required maxlength="160" autocomplete="email"></label>
          <label class="field">Message<textarea name="message" required maxlength="800"></textarea></label>
          <button type="submit" class="button primary">Save this note</button>
          <p class="form-status" role="status"></p>
          <p class="quiet">If a contact email is configured, this opens your mail app. If it is not, the note stays in this browser and nothing is sent.</p>
        </form>
      </section>`;
  }
  const sections = (page.sections || []).map((section) => `<section><h2>${esc(section.heading)}</h2>${paragraphs(section.body)}</section>`).join("");
  return `${trail}<section class="shell page-hero"><p class="kicker">${esc(page.kicker || "")}</p><h1>${esc(page.heading)}</h1>${page.intro ? `<p class="lede">${esc(page.intro)}</p>` : ""}</section><section class="shell prose">${draft}${sections}</section>`;
}

export function renderStore(site, slug = "") {
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
            <div class="pdp-media"><img src="${esc(imageSrc(product))}" alt="${esc(product.imageAlt || product.name)}" width="640" height="480" decoding="async" fetchpriority="high"></div>
            <div>
              <p class="kicker">${esc(product.kicker || (product.placeholder ? "Sample" : site.name))}</p>
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
