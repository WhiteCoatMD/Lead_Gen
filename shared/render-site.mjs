import { businessId, openingHoursSpecification, postalAddress, serviceCatalog } from "./schema.mjs";

export const jsonLd = (schema) => JSON.stringify(schema).replace(/</g, "\\u003c");
const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export const escapeHtml = esc;
export const phoneHref = (phone) => `tel:+1${phone.replace(/\D/g, "").slice(-10)}`;
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

export function renderSite(site) {
  const areaNames = site.serviceAreas || [site.city];
  const services = site.services.map((service, index) => `
    <article class="service-card">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <h3>${esc(service.title)}</h3>
      <p>${esc(service.description)}</p>
    </article>`).join("");
  const areas = areaNames.map((area) => `<span>${esc(area)}</span>`).join("");

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
    telephone: site.phone,
    email: site.email,
    description: site.seoDescription,
    image: site.logo ? absolute(site.domain, site.logo) : undefined,
    logo: site.logo ? absolute(site.domain, site.logo) : undefined,
    address: postalAddress(site, stateCode),
    areaServed: areaNames.map((name) => ({ "@type": "Place", name })),
    openingHoursSpecification: openingHoursSpecification(site.hours),
    hasOfferCatalog: serviceCatalog(site, site.services),
    contactPoint: { "@type": "ContactPoint", contactType: "customer service", telephone: site.phone, areaServed: "US", availableLanguage: "English" }
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
<html lang="en"><head>
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
  <div class="topbar"><p>Serving ${esc(areaNames.slice(0, 3).join(", "))}</p><a href="${phoneHref(site.phone)}">Call ${esc(site.phone)}</a></div>
  <header>
    <a class="brand${site.logo ? "" : " brand-wordmark"}" href="#top" aria-label="${esc(site.name)} home">${brand}</a>
    <nav id="site-nav" aria-label="Primary">
      <a href="#services">Services</a><a href="#process">How it works</a><a href="#areas">Service area</a>
    </nav>
    <div class="header-actions">
      <a class="nav-call" href="${phoneHref(site.phone)}">${esc(site.navCall || "Free estimate")}</a>
      <button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu"><span></span><span></span><span></span></button>
    </div>
  </header>
  <main>
    <section class="hero${heroImage ? "" : " hero-plain"}" id="top"${heroStyle}>
      <div class="shell hero-content"><p class="eyebrow">${esc(site.kicker)}</p><h1>${esc(site.headline)}</h1><p class="hero-copy">${esc(site.intro)}</p><div class="actions"><a class="button primary" href="${phoneHref(site.phone)}">${esc(site.primaryCta || "Call for a free estimate")}</a><a class="button ghost" href="#services">Explore services</a></div><div class="trust"><span>Local service</span><span>Clear estimates</span><span>Call-ready help</span></div></div>
    </section>
    <section class="shell intro"><div><p class="eyebrow accent">${esc(site.sectionKicker)}</p><h2>${esc(site.sectionHeadline)}</h2></div><p>${esc(site.about)}</p></section>
    <section class="shell services" id="services"><div class="section-heading"><p class="eyebrow accent">Services</p><h2>${esc(site.servicesHeadline)}</h2></div><div class="service-grid">${services}</div></section>
    <section class="process shell" id="process"><div class="section-heading centered"><p class="eyebrow accent">Three simple steps</p><h2>From first call to finished work.</h2></div><div class="steps"><article><strong>1</strong><h3>Call or email</h3><p>Tell us what you need and where the property is located.</p></article><article><strong>2</strong><h3>Review the project</h3><p>We discuss the scope, practical options, and the next available step.</p></article><article><strong>3</strong><h3>Schedule service</h3><p>Approve the plan and arrange a time that works for the project.</p></article></div></section>
    ${gallery ? `<section class="shell gallery" id="gallery"><div class="section-heading"><p class="eyebrow accent">${esc(site.galleryKicker || "Gallery")}</p><h2>${esc(site.galleryHeadline || "A closer look.")}</h2></div><div class="gallery-grid">${gallery}</div></section>` : ""}
    <section class="areas" id="areas"><div class="shell areas-inner"><div><p class="eyebrow">Service area</p><h2>${esc(site.areaHeadline)}</h2></div><div class="area-list">${areas}</div></div></section>
    <section class="shell contact"><div><p class="eyebrow accent">Ready to get started?</p><h2>${esc(site.ctaHeadline)}</h2><p>${esc(site.ctaCopy)}</p></div><div class="contact-card"><a class="phone" href="${phoneHref(site.phone)}">${esc(site.phone)}</a>${site.email ? `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ""}<p>Serving ${esc(areaNames.join(", "))}.</p></div></section>
  </main>
  <footer><div class="shell footer-inner"><p>© <span id="year"></span> ${esc(site.name)}</p><p>${esc(site.footerLine)}</p></div></footer>
  <a class="mobile-call" href="${phoneHref(site.phone)}">Call now · ${esc(site.phone)}</a><script src="/site.js" defer></script>
</body></html>`;
}
