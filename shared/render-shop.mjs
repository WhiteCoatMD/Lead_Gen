import { escapeHtml as esc, phoneHref, assetUrl, absolute, jsonLd } from "./render-site.mjs";
import { businessId, openingHoursSpecification, postalAddress, primaryImage, productCatalog, serviceCatalog } from "./schema.mjs";

// A counter-service / retail template for businesses people visit or order
// from, rather than hire. The shared contractor template is wrong for these:
// its process section promises "tell us where the property is located" and
// "approve the plan", which describes a contracting engagement a snowball
// stand or a soap shop does not offer.
//
// Content comes from `menu` — an array of groups, each with a name, an
// optional price note, and its items. A group renders as one card, so a site
// needs at least three groups to satisfy the launch checklist.
//
// Nav and section labels default to a walk-in shop's wording ("Menu",
// "Visit", "Where we are", "Service area"). A mail-order business overrides
// them with navStore / navVisit / navAreas / visitKicker / areasKicker,
// because nothing about it is somewhere you visit.

const STATE_CODES = { Alabama: "AL", Arizona: "AZ", Arkansas: "AR", California: "CA", Florida: "FL", Georgia: "GA", Illinois: "IL", Louisiana: "LA", Mississippi: "MS", Missouri: "MO", Nevada: "NV", "New Mexico": "NM", "North Carolina": "NC", Ohio: "OH", Oklahoma: "OK", Tennessee: "TN", Texas: "TX" };
const stateCode = (state = "") => STATE_CODES[state] || (state.length === 2 ? state.toUpperCase() : state);

export function renderShop(site) {
  const tel = phoneHref(site.phone);
  const areas = site.serviceAreas || [site.city];
  const groups = site.menu || [];

  // Short items (flavour names) read well in two columns; a group with long
  // items ("Armadillo — Butterbeer & Ice Cream") gets one column so nothing
  // is squeezed into a sliver.
  const cards = groups.map((group) => `
        <article class="product">
          <h3>${esc(group.name)}</h3>
          ${group.note ? `<p class="price">${esc(group.note)}</p>` : ""}
          ${group.description ? `<p class="blurb">${esc(group.description)}</p>` : ""}
          ${group.items && group.items.length ? `<ul${group.items.some((item) => item.length > 22) ? ' class="long"' : ""}>${group.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
        </article>`).join("");

  // Same optional gallery contract as the contractor template: no `gallery`
  // key means no gallery section, and every entry carries its own alt text.
  const gallery = (site.gallery || []).map((shot) => `
        <figure>
          <img src="${esc(assetUrl(shot.image))}" alt="${esc(shot.alt)}" loading="lazy" decoding="async">
          ${shot.caption ? `<figcaption>${esc(shot.caption)}</figcaption>` : ""}
        </figure>`).join("");

  const hours = (site.hours || []).map((row) => `<div><dt>${esc(row.days)}</dt><dd>${esc(row.time)}</dd></div>`).join("");
  const areaList = areas.map((area) => `<span>${esc(area)}</span>`).join("");

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
    image: primaryImage(site, absolute),
    logo: site.logo ? absolute(site.domain, site.logo) : undefined,
    address: postalAddress(site, stateCode),
    areaServed: areas.map((name) => ({ "@type": "Place", name })),
    openingHoursSpecification: openingHoursSpecification(site.hours),
    // Menu groups on this template are the things the business actually
    // offers -- "Self-service laundry", "Wash and fold" -- so they read as
    // a service catalogue. Product prices are only emitted where the source
    // site published one; several of these deliberately have none.
    hasOfferCatalog: serviceCatalog(site, groups) || productCatalog(site, site.products),
    contactPoint: { "@type": "ContactPoint", contactType: "customer service", telephone: site.phone, areaServed: "US", availableLanguage: "English" }
  };

  // A hero photograph is optional. When present it sits behind a dark scrim so
  // the headline keeps its contrast; without one the hero is a plain accent
  // panel, which suits businesses whose only imagery is a menu board.
  const heroImage = site.hero && site.heroStyle !== "plain";
  const heroAttrs = heroImage
    ? ` class="shop-hero has-image" style="background-image:linear-gradient(90deg,rgba(10,12,14,.9),rgba(10,12,14,.62) 55%,rgba(10,12,14,.3)),url(&quot;${esc(assetUrl(site.hero))}&quot;)"`
    : ` class="shop-hero"`;

  const brand = site.logo
    ? `<img src="${esc(assetUrl(site.logo))}" alt="${esc(site.name)}" width="180" height="96" decoding="async">`
    : `<span class="brand-text">${esc(site.name)}</span>`;

  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(site.seoTitle)}</title>
  <meta name="description" content="${esc(site.seoDescription)}">
  <link rel="canonical" href="https://${esc(site.domain)}/">
  <meta name="theme-color" content="${esc(site.accent || "#e5288f")}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(site.seoTitle)}">
  <meta property="og:description" content="${esc(site.seoDescription)}">
  <meta property="og:url" content="https://${esc(site.domain)}/">
  <meta property="og:site_name" content="${esc(site.name)}">
  ${site.logo ? `<meta property="og:image" content="${esc(absolute(site.domain, site.logo))}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="mask-icon" href="/favicon.svg" color="${esc(site.accent || "#e5288f")}">
${site.logo ? `  <link rel="apple-touch-icon" href="${esc(assetUrl(site.logo))}">` : ""}
  <link rel="stylesheet" href="/site.css">
  <style>:root{--accent:${esc(site.accent || "#e5288f")};--accent-dark:${esc(site.accentDark || "#b41d6f")}}</style>
  <script type="application/ld+json">${jsonLd(schema)}</script>
</head><body>
  <div class="topbar"><p>${esc(site.kicker || `Serving ${areas.slice(0, 3).join(", ")}`)}</p><a href="${tel}">Call ${esc(site.phone)}</a></div>
  <header>
    <a class="brand${site.logo ? "" : " brand-wordmark"}" href="#top" aria-label="${esc(site.name)} home">${brand}</a>
    <nav id="site-nav" aria-label="Primary">
      <a href="#store">${esc(site.navStore || "Menu")}</a><a href="#visit">${esc(site.navVisit || "Visit")}</a><a href="#areas">${esc(site.navAreas || "Where we are")}</a>
    </nav>
    <div class="header-actions"><a class="nav-call" href="${tel}">${esc(site.navCall || "Call us")}</a></div>
  </header>
  <main>
    <section${heroAttrs} id="top">
      <div class="shell">
        <h1>${esc(site.headline)}</h1>
        ${site.intro ? `<p class="lede">${esc(site.intro)}</p>` : ""}
        <a class="button primary" href="${tel}">${esc(site.primaryCta || `Call ${site.phone}`)}</a>
      </div>
    </section>
    ${site.about ? `<section class="shell about"><p>${esc(site.about)}</p></section>` : ""}
    <section class="shell menu" id="store">
      <div class="section-heading"><p class="eyebrow accent">${esc(site.sectionKicker || "On the menu")}</p><h2>${esc(site.servicesHeadline || "What we serve")}</h2></div>
      <div class="products">${cards}</div>
      ${site.menuNote ? `<p class="menu-note">${esc(site.menuNote)}</p>` : ""}
    </section>
    ${gallery ? `<section class="shell gallery" id="gallery"><div class="section-heading"><p class="eyebrow accent">${esc(site.galleryKicker || "Gallery")}</p><h2>${esc(site.galleryHeadline || "A closer look.")}</h2></div><div class="gallery-grid">${gallery}</div></section>` : ""}
    <section class="visit" id="visit">
      <div class="shell visit-inner">
        <div>
          <p class="eyebrow">${esc(site.visitKicker || "Visit us")}</p>
          <h2>${esc(site.areaHeadline || "Come see us")}</h2>
          ${site.streetAddress ? `<address>${esc(site.streetAddress)}<br>${esc(site.city)}, ${esc(stateCode(site.state))} ${esc(site.postalCode || "")}</address>` : ""}
          <a class="phone" href="${tel}">${esc(site.phone)}</a>
          ${site.email ? `<a class="email" href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ""}
        </div>
        ${hours ? `<div class="hours"><h3>Hours</h3><dl>${hours}</dl></div>` : ""}
      </div>
    </section>
    <section class="areas" id="areas">
      <div class="shell areas-inner">
        <div><p class="eyebrow">${esc(site.areasKicker || "Service area")}</p><h2>${esc(site.ctaHeadline || "Who we serve")}</h2></div>
        <div class="area-list">${areaList}</div>
      </div>
    </section>
  </main>
  <footer><div class="shell footer-inner"><p>© <span id="year"></span> ${esc(site.name)}</p><p>${esc(site.footerLine || `Serving ${areas.join(", ")}.`)}</p></div></footer>
  <a class="mobile-call" href="${tel}">Call now · ${esc(site.phone)}</a><script src="/site.js" defer></script>
</body></html>`;
}
