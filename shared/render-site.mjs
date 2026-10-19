import { areaNames, businessId, geoCoordinates, httpUrls, openingHoursSpecification, postalAddress, primaryImage, serviceCatalog } from "./schema.mjs";
import { renderLeadForm, LEAD_FORM_SCRIPT } from "./render-form.mjs";
import { renderFaq } from "./render-faq.mjs";
import { renderPermitLinks } from "./render-tools.mjs";

export const jsonLd = (schema) => JSON.stringify(schema).replace(/</g, "\\u003c");

export const ANALYTICS_SCRIPT = `
(function(){
  var site = document.documentElement.getAttribute("data-site") || "";
  function send(type, extra){
    var payload = JSON.stringify(Object.assign({
      type: type, site: site, path: location.pathname, ref: document.referrer
    }, extra || {}));
    // A call click navigates away immediately and cancels a normal fetch.
    // sendBeacon is the only thing that reliably survives the handoff.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([payload], {type:"application/json"}));
    } else {
      fetch("/api/event", {method:"POST", headers:{"Content-Type":"application/json"}, body:payload, keepalive:true}).catch(function(){});
    }
  }

  send("page_view");

  // Every tel: link on the page, however the visitor reaches it.
  document.addEventListener("click", function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
    if (a) send("call_click");
  }, true);

  var form = document.querySelector(".lead-form");
  if (form) {
    // Fires once, and only if the form actually came into view. Gives a
    // denominator for the submit rate rather than guessing at one.
    if (window.IntersectionObserver) {
      var seen = false;
      var io = new IntersectionObserver(function(entries){
        if (!seen && entries.some(function(x){ return x.isIntersecting; })) { seen = true; send("form_view"); io.disconnect(); }
      }, {threshold: 0.4});
      io.observe(form);
    }
    form.addEventListener("submit", function(){ send("form_submit"); });
  }
})();
`;

const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export const escapeHtml = esc;
export const phoneHref = (phone = "") => `tel:+1${String(phone).replace(/\D/g, "").slice(-10)}`;
export const assetUrl = (asset = "") => /^https?:\/\//i.test(asset) ? asset : `/assets/${asset}`;
export const absolute = (domain, asset = "") => /^https?:\/\//i.test(asset) ? asset : `https://${domain}${assetUrl(asset)}`;

const STATE_CODES = { Alabama:"AL", Arizona:"AZ", Arkansas:"AR", California:"CA", Florida:"FL", Georgia:"GA", Illinois:"IL", Louisiana:"LA", Mississippi:"MS", Missouri:"MO", Nevada:"NV", "New Mexico":"NM", "North Carolina":"NC", Ohio:"OH", Oklahoma:"OK", Tennessee:"TN", Texas:"TX" };
const stateCode = (state = "") => STATE_CODES[state] || (state.length === 2 ? state.toUpperCase() : state);


// Brand monogram used for the tab icon: first letters of up to two significant words.
const monogram = (name = "") => name
  .replace(/[^A-Za-z ]/g, " ")
  .split(" ")
  .filter((word) => word && !["the","and","of","llc","inc","co","hour","24"].includes(word.toLowerCase()))
  .slice(0, 2)
  .map((word) => word[0].toUpperCase())
  .join("") || "•";

export function renderFavicon(site) {
  const accent = site.accent || "#ef342f";
  const letters = monogram(site.name);
  const size = letters.length > 1 ? 28 : 38;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${site.name}"><rect width="64" height="64" rx="13" fill="${accent}"/><text x="32" y="${letters.length > 1 ? 42 : 46}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="700" fill="#ffffff">${letters}</text></svg>`;
}


// The number a visitor sees and dials. One config value: `trackingPhone` when
// a site is on call tracking, otherwise `phone`. Falls back so a site without
// tracking is unaffected.
// NEVER use this for schema, structured data or anything a machine reads —
// schema keeps `phone`, the permanent NAP number.
export const displayPhone = (site) => site.trackingPhone || site.phone;
const dialled = displayPhone;
// Street address is opt-in (`showAddress: true`) so a site that stores an
// address only for its own records, or hides it as a service-area business,
// does not suddenly publish it.
export function napBlock(site) {
  if (site.showAddress !== true || !site.streetAddress) return null;
  const region = stateCode(site.state);
  const cityLine = [site.city, region].filter(Boolean).join(", ") + (site.postalCode ? ` ${site.postalCode}` : "");
  return { street: site.streetAddress, cityLine };
}

export function mapLink(site) {
  const url = httpUrls(site.gbpUrl)[0];
  if (!url) return "";
  return `<a href="${esc(url)}">Find us on Google Maps</a>`;
}

export function licenseText(site) {
  const number = String(site.license?.number ?? "").trim();
  if (!number) return "";
  const label = String(site.license?.label || "License").trim();
  return `${label} ${number}`;
}

export function renderNav(site, { home = false } = {}) {
  const links = Array.isArray(site.nav) && site.nav.length
    ? site.nav
    : home
      ? [{ label: "Services", href: "#services" }, { label: "How it works", href: "#process" }, { label: "Service area", href: "#areas" }]
      : [{ label: "Home", href: "/" }, { label: "Services", href: "/#services" }, { label: "Service area", href: "/#areas" }];
  return links.map((link) => `<a href="${esc(link.href)}">${esc(link.label)}</a>`).join("");
}

export function renderFooter(site) {
  const nap = napBlock(site);
  const license = licenseText(site);
  const phone = displayPhone(site);
  const groups = footerGroups(site);
  if (!nap && !license && !groups.length) {
    return `<footer><div class="shell footer-inner"><p>© <span id="year"></span> ${esc(site.name)}</p><p>${esc(site.footerLine)}</p></div></footer>`;
  }
  const address = nap
    ? `<address class="footer-address"><span>${esc(nap.street)}</span><span>${esc(nap.cityLine)}</span>${phone ? `<a href="${phoneHref(phone)}">${esc(phone)}</a>` : ""}</address>`
    : "";
  const licenseHtml = license ? `<p class="footer-license">${esc(license)}</p>` : "";
  const nav = groups.length
    ? `<nav class="shell footer-links" aria-label="Site">${groups.map(([label, pages]) => `<div><p>${esc(label)}</p>${pages.map((page) => `<a href="/${esc(page.slug)}">${esc(page.navLabel || page.heading)}</a>`).join("")}</div>`).join("")}</nav>`
    : "";
  return `<footer><div class="shell footer-inner"><div class="footer-id"><p>© <span id="year"></span> ${esc(site.name)}</p>${address}${licenseHtml}</div><p>${esc(site.footerLine)}</p></div>${nav}</footer>`;
}

function footerGroups(site) {
  if (!site.footerNav) return [];
  const pages = (site.pages || []).filter((page) => page.slug && !page.canonicalTo && page.sitemap !== false && page.footer !== false);
  const groups = [
    ["Services", pages.filter((page) => page.kind === "service")],
    ["Service area", pages.filter((page) => page.kind === "area")],
    ["Guides", pages.filter((page) => page.kind === "tool")],
    ["More", pages.filter((page) => page.kind === "info" || !page.kind)],
  ];
  return groups.filter(([, items]) => items.length);
}

const DEFAULT_STEPS = [
  { title: "Call or email", text: "Tell us what you need and where the property is located." },
  { title: "Review the project", text: "We discuss the scope, practical options, and the next available step." },
  { title: "Schedule service", text: "Approve the plan and arrange a time that works for the project." },
];

export function renderSite(site, slug) {
  const areas = areaNames(site).map((name, index) => {
    const raw = (site.serviceAreas || [])[index];
    const href = raw && typeof raw === "object" ? (raw.href || raw.link || "") : "";
    return href
      ? `<span><a href="${esc(href)}">${esc(name)}</a></span>`
      : `<span>${esc(name)}</span>`;
  }).join("");
  const areaLabel = areaNames(site);
  const services = site.services.map((service, index) => `
    <article class="service-card">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <h3>${service.link ? `<a href="/${esc(service.link)}">${esc(service.title)}</a>` : esc(service.title)}</h3>
      <p>${esc(service.description)}</p>
    </article>`).join("");

  // Optional photo gallery. Sites without a `gallery` key render exactly as
  // before, so this is additive for the existing portfolio. Every entry needs
  // its own alt text — a gallery of unlabelled images helps nobody.
  const gallery = (site.gallery || []).map((shot) => `
      <figure>
        <img src="${esc(assetUrl(shot.image))}" alt="${esc(shot.alt)}" loading="lazy" decoding="async">
        ${shot.caption ? `<figcaption>${esc(shot.caption)}</figcaption>` : ""}
      </figure>`).join("");

  // The services are the entire substance of a contractor site and nothing
  // machine-readable used to say what they were, so they now ship as an offer
  // catalogue. @id gives the business a stable identity for those Service
  // entities to name as their provider. Everything else here is unchanged;
  // helpers return undefined when the data is absent and the key vanishes.
  const schema = {
    "@context": "https://schema.org",
    "@type": site.schemaType || "LocalBusiness",
    "@id": businessId(site),
    name: site.name,
    url: `https://${site.domain}`,
    mainEntityOfPage: `https://${site.domain}/`,
    // NAP number, deliberately NOT the tracking number. This is the field
    // Google matches against the Business Profile and every citation; a
    // tracking number here would break the consistency the citation work
    // exists to create.
    telephone: site.phone,
    email: site.email,
    description: site.seoDescription,
    image: primaryImage(site, absolute),
    logo: site.logo ? absolute(site.domain, site.logo) : undefined,
    address: postalAddress(site, stateCode),
    geo: geoCoordinates(site),
    hasMap: httpUrls(site.hasMap)[0] || httpUrls(site.gbpUrl)[0],
    sameAs: httpUrls(site.gbpUrl, site.sameAs).length ? httpUrls(site.gbpUrl, site.sameAs) : undefined,
    areaServed: areaLabel.map((name) => ({ "@type": "Place", name })),
    openingHoursSpecification: openingHoursSpecification(site.hours),
    hasOfferCatalog: serviceCatalog(site, site.services),
    identifier: licenseText(site) ? { "@type": "PropertyValue", name: site.license?.label || "License", value: String(site.license.number).trim() } : undefined,
    contactPoint: site.phone ? { "@type": "ContactPoint", contactType: "customer service", telephone: site.phone, areaServed: "US", availableLanguage: "English" } : undefined
  };

  // A site keeps its supplied logo as the hero only when that image is a real
  // hero photograph; otherwise the hero falls back to a plain accent panel.
  const heroImage = site.hero && site.heroStyle !== "plain";
  const heroStyle = heroImage
    ? ` style="background-image:linear-gradient(90deg,rgba(10,12,14,.91),rgba(10,12,14,.68) 48%,rgba(10,12,14,.08)),url(&quot;${esc(assetUrl(site.hero))}&quot;)"`
    : "";
  const brand = site.logo
    ? `<img src="${esc(assetUrl(site.logo))}" alt="${esc(site.name)}" width="175" height="88" decoding="async">`
    : `<span class="brand-text">${esc(site.name)}</span>`;

  return `<!doctype html>
<html lang="en" data-site="${esc(slug || "")}"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(site.seoTitle)}</title>
  <meta name="description" content="${esc(site.seoDescription)}">
  <link rel="canonical" href="https://${esc(site.domain)}/">
  <meta name="theme-color" content="${esc(site.accent || "#ef342f")}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(site.seoTitle)}">
  <meta property="og:description" content="${esc(site.seoDescription)}">
  <meta property="og:url" content="https://${esc(site.domain)}/">
  <meta property="og:site_name" content="${esc(site.name)}">
  ${site.logo ? `<meta property="og:image" content="${esc(absolute(site.domain, site.logo))}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="mask-icon" href="/favicon.svg" color="${esc(site.accent || "#ef342f")}">
${site.logo ? `<link rel="apple-touch-icon" href="${esc(assetUrl(site.logo))}">` : ""}
  <link rel="stylesheet" href="/site.css">
  <style>:root{--accent:${esc(site.accent || "#ef342f")};--accent-dark:${esc(site.accentDark || "#c82420")}}</style>
  <script type="application/ld+json">${jsonLd(schema)}</script>
</head><body>
  <div class="topbar"><p>Serving ${esc(areaLabel.slice(0, 3).join(", "))}</p>${site.phone ? `<a href="${phoneHref(dialled(site))}">Call ${esc(dialled(site))}</a>` : ""}</div>
  <header>
    <a class="brand${site.logo ? "" : " brand-wordmark"}" href="#top" aria-label="${esc(site.name)} home">${brand}</a>
    <nav id="site-nav" aria-label="Primary">
      ${renderNav(site, { home: true })}
    </nav>
    <div class="header-actions">
      ${site.phone ? `<a class="nav-call" href="${phoneHref(dialled(site))}">${esc(site.navCall || "Free estimate")}</a>` : ""}
      <button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu"><span></span><span></span><span></span></button>
    </div>
  </header>
  <main>
    <section class="hero${heroImage ? "" : " hero-plain"}" id="top"${heroStyle}>
      <div class="shell hero-content"><p class="eyebrow">${esc(site.kicker)}</p><h1>${esc(site.headline)}</h1><p class="hero-copy">${esc(site.intro)}</p><div class="actions">${site.phone ? `<a class="button primary" href="${phoneHref(dialled(site))}">${esc(site.primaryCta || "Call for a free estimate")}</a>` : ""}<a class="button ${site.phone ? "ghost" : "primary"}" href="#services">Explore services</a></div><div class="trust"><span>Local service</span><span>Clear estimates</span><span>Call-ready help</span></div></div>
    </section>
    <section class="shell intro"><div><p class="eyebrow accent">${esc(site.sectionKicker)}</p><h2>${esc(site.sectionHeadline)}</h2></div><p>${esc(site.about)}</p></section>
    <section class="shell services" id="services"><div class="section-heading"><p class="eyebrow accent">Services</p><h2>${esc(site.servicesHeadline)}</h2></div><div class="service-grid">${services}</div></section>
    <section class="process shell" id="process"><div class="section-heading centered"><p class="eyebrow accent">${esc(site.stepsKicker || "Three simple steps")}</p><h2>${esc(site.stepsHeadline || "From first call to finished work.")}</h2></div><div class="steps">${(Array.isArray(site.steps) && site.steps.length ? site.steps : DEFAULT_STEPS).map((step, index) => `<article><strong>${index + 1}</strong><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p></article>`).join("")}</div></section>
    ${gallery ? `<section class="shell gallery" id="gallery"><div class="section-heading"><p class="eyebrow accent">${esc(site.galleryKicker || "Gallery")}</p><h2>${esc(site.galleryHeadline || "A closer look.")}</h2></div><div class="gallery-grid">${gallery}</div></section>` : ""}
    ${renderPermitLinks(site)}
    <section class="areas" id="areas"><div class="shell areas-inner"><div><p class="eyebrow">Service area</p><h2>${esc(site.areaHeadline)}</h2></div><div class="area-list">${areas}</div></div></section>
    ${renderFaq(site)}
    ${renderLeadForm(site, slug, "/")}
    ${site.phone || site.email ? `<section class="shell contact"><div><p class="eyebrow accent">Ready to get started?</p><h2>${esc(site.ctaHeadline)}</h2><p>${esc(site.ctaCopy)}</p></div><div class="contact-card">${napBlock(site) ? `<address class="nap">${esc(napBlock(site).street)}<br>${esc(napBlock(site).cityLine)}</address>` : ""}${site.phone ? `<a class="phone" href="${phoneHref(dialled(site))}">${esc(dialled(site))}</a>` : ""}${site.email ? `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ""}${mapLink(site)}<p>Serving ${esc(areaLabel.join(", "))}.</p></div></section>` : ""}
  </main>
  ${renderFooter(site)}
  ${site.phone ? `<a class="mobile-call" href="${phoneHref(dialled(site))}">Call now · ${esc(dialled(site))}</a>` : ""}<script src="/site.js" defer></script>${site.leadForm ? `<script>${LEAD_FORM_SCRIPT}</script>` : ""}${site.analytics === false ? "" : `<script>${ANALYTICS_SCRIPT}</script>`}
</body></html>`;
}
