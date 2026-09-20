const esc = (value = "") => String(value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const phoneHref = (phone) => `tel:+1${phone.replace(/\D/g, "").slice(-10)}`;

export function renderSite(site) {
  const services = site.services.map((service, index) => `
    <article class="service-card">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <h3>${esc(service.title)}</h3>
      <p>${esc(service.description)}</p>
    </article>`).join("");
  const areas = (site.serviceAreas || [site.city]).map((area) => `<span>${esc(area)}</span>`).join("");
  const schema = {
    "@context": "https://schema.org",
    "@type": site.schemaType || "LocalBusiness",
    name: site.name,
    url: `https://${site.domain}`,
    telephone: site.phone,
    email: site.email,
    areaServed: site.serviceAreas || [site.city, site.state]
  };

  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(site.seoTitle)}</title>
  <meta name="description" content="${esc(site.seoDescription)}">
  <link rel="canonical" href="https://${esc(site.domain)}/">
  <meta name="theme-color" content="${esc(site.accent || "#ef342f")}">
  <link rel="stylesheet" href="/site.css">
  <style>:root{--accent:${esc(site.accent || "#ef342f")};--accent-dark:${esc(site.accentDark || "#c82420")}}</style>
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
</head><body>
  <div class="topbar"><p>Serving ${esc((site.serviceAreas || [site.city]).slice(0, 3).join(", "))}</p><a href="${phoneHref(site.phone)}">Call ${esc(site.phone)}</a></div>
  <header><a class="brand" href="#top"><img src="/assets/${esc(site.logo)}" alt="${esc(site.name)}"></a><nav><a href="#services">Services</a><a href="#process">How it works</a><a href="#areas">Service area</a><a class="nav-call" href="${phoneHref(site.phone)}">Free estimate</a></nav></header>
  <main>
    <section class="hero" id="top" style="background-image:linear-gradient(90deg,rgba(10,12,14,.91),rgba(10,12,14,.68) 48%,rgba(10,12,14,.08)),url('/assets/${esc(site.hero)}')">
      <div class="shell hero-content"><p class="eyebrow">${esc(site.kicker)}</p><h1>${esc(site.headline)}</h1><p class="hero-copy">${esc(site.intro)}</p><div class="actions"><a class="button primary" href="${phoneHref(site.phone)}">Call for a free estimate</a><a class="button ghost" href="#services">Explore services</a></div><div class="trust"><span>Local service</span><span>Clear estimates</span><span>Call-ready help</span></div></div>
    </section>
    <section class="shell intro"><div><p class="eyebrow accent">${esc(site.sectionKicker)}</p><h2>${esc(site.sectionHeadline)}</h2></div><p>${esc(site.about)}</p></section>
    <section class="shell services" id="services"><div class="section-heading"><p class="eyebrow accent">Services</p><h2>${esc(site.servicesHeadline)}</h2></div><div class="service-grid">${services}</div></section>
    <section class="process shell" id="process"><div class="section-heading centered"><p class="eyebrow accent">Three simple steps</p><h2>From first call to finished work.</h2></div><div class="steps"><article><strong>1</strong><h3>Call or email</h3><p>Tell us what you need and where the property is located.</p></article><article><strong>2</strong><h3>Review the project</h3><p>We discuss the scope, practical options, and the next available step.</p></article><article><strong>3</strong><h3>Schedule service</h3><p>Approve the plan and arrange a time that works for the project.</p></article></div></section>
    <section class="areas" id="areas"><div class="shell areas-inner"><div><p class="eyebrow">Service area</p><h2>${esc(site.areaHeadline)}</h2></div><div class="area-list">${areas}</div></div></section>
    <section class="shell contact"><div><p class="eyebrow accent">Ready to get started?</p><h2>${esc(site.ctaHeadline)}</h2><p>${esc(site.ctaCopy)}</p></div><div class="contact-card"><a class="phone" href="${phoneHref(site.phone)}">${esc(site.phone)}</a><a href="mailto:${esc(site.email)}">${esc(site.email)}</a><p>Serving ${esc((site.serviceAreas || [site.city]).join(", "))}.</p></div></section>
  </main>
  <footer><div class="shell footer-inner"><p>© <span id="year"></span> ${esc(site.name)}</p><p>${esc(site.footerLine)}</p></div></footer>
  <a class="mobile-call" href="${phoneHref(site.phone)}">Call now · ${esc(site.phone)}</a><script src="/site.js" defer></script>
</body></html>`;
}
