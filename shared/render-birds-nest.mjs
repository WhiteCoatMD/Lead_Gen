import { escapeHtml as esc, phoneHref, assetUrl, absolute, jsonLd } from "./render-site.mjs";

// The Bird's Nest keeps the storefront layout of the original shop rather than
// the shared contractor template, so it renders from its own markup.
export function renderBirdsNest(site) {
  const tel = phoneHref(site.phone);
  const areas = site.serviceAreas || [site.city];
  const products = site.products.map((product) => `
      <article class="product">
        <img src="${esc(assetUrl(product.image))}" alt="${esc(product.name)}" loading="lazy" decoding="async">
        <h3>${esc(product.name)}</h3><p>$${esc(product.price)}</p>
      </article>`).join("");
  const hours = (site.hours || []).map((row) => `<div><dt>${esc(row.days)}</dt><dd>${esc(row.time)}</dd></div>`).join("");

  const schema = {
    "@context": "https://schema.org",
    "@type": site.schemaType || "Florist",
    name: site.name,
    url: `https://${site.domain}`,
    telephone: site.phone,
    description: site.seoDescription,
    image: absolute(site.domain, site.logo),
    logo: absolute(site.domain, site.logo),
    address: { "@type": "PostalAddress", addressLocality: site.city, addressRegion: "LA", addressCountry: "US" },
    areaServed: areas.map((name) => ({ "@type": "Place", name })),
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "17:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "12:00" }
    ],
    makesOffer: site.products.map((product) => ({
      "@type": "Offer", price: product.price, priceCurrency: "USD",
      itemOffered: { "@type": "Product", name: product.name }
    }))
  };

  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(site.seoTitle)}</title>
  <meta name="description" content="${esc(site.seoDescription)}">
  <link rel="canonical" href="https://${esc(site.domain)}/">
  <meta name="theme-color" content="${esc(site.accent || "#83c4ba")}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(site.seoTitle)}">
  <meta property="og:description" content="${esc(site.seoDescription)}">
  <meta property="og:url" content="https://${esc(site.domain)}/">
  <meta property="og:site_name" content="${esc(site.name)}">
  <meta property="og:image" content="${esc(absolute(site.domain, site.logo))}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${esc(assetUrl(site.logo))}">
  <link rel="stylesheet" href="/site.css">
  <script type="application/ld+json">${jsonLd(schema)}</script>
</head><body>
  <header class="masthead" id="home">
    <p>Welcome to The Birds Nest</p>
    <img src="${esc(assetUrl(site.logo))}" alt="${esc(site.name)}" width="190" height="135">
  </header>
  <nav id="site-nav" aria-label="Primary">
    <a href="#home">Home</a><a href="#about">About</a><a href="#store">Store</a><a href="#subscriptions">Flower Subscriptions</a>
    <a class="nav-call" href="${tel}">Call ${esc(site.phone)}</a>
  </nav>
  <main>
    <section class="hero" role="img" aria-label="Fresh flowers from The Bird's Nest"></section>
    <section class="shop" id="store">
      <a class="pill" id="subscriptions" href="${tel}">Flower Subscriptions</a>
      <h1>${esc(site.headline)}</h1>
      <div class="products">${products}</div>
    </section>
    <section class="about" id="about">
      <div><h2>Say it With Flowers</h2><p>${esc(site.about)}</p><p>${esc(site.aboutSecond)}</p></div>
      <img src="${esc(assetUrl(site.aboutImage))}" alt="Fresh flowers from The Bird's Nest" loading="lazy" decoding="async">
    </section>
    <section class="areas" id="areas">
      <h2>Where We Deliver</h2>
      <div class="area-list">${areas.map((area) => `<span>${esc(area)}</span>`).join("")}</div>
    </section>
    <section class="contact" id="contact">
      <div><h2>Call Us</h2><a class="phone" href="${tel}">${esc(site.phone)}</a></div>
      <div><h2>Business Hours</h2><dl>${hours}</dl></div>
    </section>
  </main>
  <footer><div class="footer-inner"><p>© <span id="year"></span> ${esc(site.name)}</p><p>Serving ${esc(areas.join(", "))}.</p></div></footer>
  <a class="mobile-call" href="${tel}">Call now · ${esc(site.phone)}</a><script src="/site.js" defer></script>
</body></html>`;
}
