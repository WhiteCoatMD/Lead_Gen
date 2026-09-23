import { escapeHtml as esc, phoneHref, assetUrl, absolute, jsonLd, ANALYTICS_SCRIPT } from "./render-site.mjs";
import { businessId } from "./schema.mjs";
import { DIAGRAMS } from "./render-diagram.mjs";
import { renderFaq } from "./render-faq.mjs";
import { renderLeadForm, LEAD_FORM_SCRIPT } from "./render-form.mjs";
import { renderCalculator, renderPermitGuide } from "./render-tools.mjs";

/**
 * A secondary page on a site whose main template is a single scrolling page.
 *
 * This exists because the Snapps rebuilds collapsed multi-page originals into
 * one page each, and Google kept the old URLs. Twin City Fence still has
 * /wooden-fences, /chain-link-fence and /contact indexed with descriptions,
 * showing as sitelinks on the brand query, all returning 404 since the
 * migration. A 301 would recover most of that, but rebuilding the page
 * recovers the equity AND puts back a page targeting its own term, which a
 * redirect throws away.
 *
 * Deliberately reuses the main template's chrome — same header, footer, call
 * CTAs and stylesheet — so a rebuilt page is not a visibly different website
 * from the one it belongs to.
 *
 * Content comes from the site's own data. Nothing here generates prose: if a
 * page has nothing real to say, the answer is not to pad it out, it is to
 * redirect instead.
 *
 * Secondary pages carry the same analytics beacon, `data-site` and lead form
 * as the home page (2026-09-23). They used to carry neither, which meant the
 * pages built to recover search traffic were the ones nobody could measure —
 * and a page that is not measured cannot be judged.
 */
export function renderPage(site, page, slug = "", extras = {}) {
  const areaNames = site.serviceAreas || [site.city];
  const url = `https://${site.domain}/${page.slug}`;
  // A page may point its canonical at a different URL. Needed where two URLs
  // carry the same content because both were once live: Search Console shows
  // which one actually earns impressions, and that is the one worth
  // consolidating on, whatever the archive suggested.
  const canonical = page.canonicalTo ? `https://${site.domain}/${page.canonicalTo}` : url;

  const sections = (page.sections || []).map((section) => `
    <section class="shell intro">
      <div><p class="eyebrow accent">${esc(section.kicker || "")}</p><h2>${esc(section.heading)}</h2></div>
      <p>${esc(section.body)}</p>
    </section>`).join("");

  const points = (page.points || []).length
    ? `<section class="shell services"><div class="section-heading"><p class="eyebrow accent">${esc(page.pointsKicker || "What we build")}</p><h2>${esc(page.pointsHeading || "Options")}</h2></div><div class="service-grid">${
        page.points.map((point, index) => `
      <article class="service-card">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <h3>${esc(point.title)}</h3>
        <p>${esc(point.description)}</p>
      </article>`).join("")
      }</div></section>`
    : "";

  // Sibling pages plus the home page, so a visitor who lands here from search
  // has somewhere to go and the rebuilt pages are not orphans.
  // The calculator and permit guides are not services; they get their own
  // links, so they stay out of this list.
  const siblings = (site.pages || []).filter((other) => other.slug !== page.slug && other.type !== "fence-calculator" && other.type !== "fence-permit");
  const related = siblings.length
    ? `<section class="shell areas"><div class="areas-inner"><div><p class="eyebrow">More from ${esc(site.name)}</p><h2>Other services.</h2></div><div class="area-list">${
        siblings.map((other) => `<span><a href="/${esc(other.slug)}">${esc(other.navLabel || other.heading)}</a></span>`).join("")
      }</div></div></section>`
    : "";

  // Breadcrumbs give the page a place in the site rather than leaving it
  // floating, and they are one of the few rich results a service page can win.
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: `https://${site.domain}/` },
      { "@type": "ListItem", position: 2, name: page.heading, item: url },
    ],
  };

  // The page describes one service. Naming the provider by @id ties it to the
  // business entity the home page already publishes instead of describing a
  // second, anonymous one.
  const serviceSchema = page.service
    ? {
        "@context": "https://schema.org",
        "@type": "Service",
        name: page.service,
        description: page.seoDescription,
        provider: { "@id": businessId(site) },
        areaServed: areaNames.map((name) => ({ "@type": "Place", name })),
        url,
      }
    : null;

  const brand = site.logo
    ? `<img src="${esc(assetUrl(site.logo))}" alt="${esc(site.name)}" width="175" height="88" decoding="async">`
    : `<span class="brand-text">${esc(site.name)}</span>`;

  const guidePages = (site.pages || []).filter((p) => p.type === "fence-permit" && p.slug !== page.slug);
  const calcPage = (site.pages || []).find((p) => p.type === "fence-calculator");
  const tool =
    page.type === "fence-calculator" ? renderCalculator(site)
    : page.type === "fence-permit" && extras.permit ? renderPermitGuide(site, extras.permit, {
        calculator: calcPage ? { slug: calcPage.slug, label: calcPage.navLabel || "fence calculator" } : undefined,
        guides: guidePages.map((g) => ({ slug: g.slug, label: g.navLabel || g.heading })),
      })
    : "";

  return `<!doctype html>
<html lang="en" data-site="${esc(slug)}"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(page.seoTitle)}</title>
  <meta name="description" content="${esc(page.seoDescription)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta name="theme-color" content="${esc(site.accent || "#ef342f")}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(page.seoTitle)}">
  <meta property="og:description" content="${esc(page.seoDescription)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:site_name" content="${esc(site.name)}">
  ${site.logo ? `<meta property="og:image" content="${esc(absolute(site.domain, site.logo))}">` : ""}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/site.css">
  <style>:root{--accent:${esc(site.accent || "#ef342f")};--accent-dark:${esc(site.accentDark || "#c82420")}}</style>
  <script type="application/ld+json">${jsonLd(breadcrumb)}</script>
  ${serviceSchema ? `<script type="application/ld+json">${jsonLd(serviceSchema)}</script>` : ""}
</head><body${page.type === "fence-calculator" ? ' class="calc-page"' : ""}>
  <div class="topbar"><p>Serving ${esc(areaNames.slice(0, 3).join(", "))}</p>${site.phone ? `<a href="${phoneHref(site.phone)}">Call ${esc(site.phone)}</a>` : ""}</div>
  <header>
    <a class="brand${site.logo ? "" : " brand-wordmark"}" href="/" aria-label="${esc(site.name)} home">${brand}</a>
    <nav id="site-nav" aria-label="Primary">
      <a href="/">Home</a><a href="/#services">Services</a><a href="/#areas">Service area</a>
    </nav>
    <div class="header-actions">
      ${site.phone ? `<a class="nav-call" href="${phoneHref(site.phone)}">${esc(site.navCall || "Free estimate")}</a>` : ""}
      <button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu"><span></span><span></span><span></span></button>
    </div>
  </header>
  <main>
    <section class="hero hero-plain" id="top">
      <div class="shell hero-content">
        <p class="eyebrow">${esc(page.kicker || site.kicker)}</p>
        <h1>${esc(page.heading)}</h1>
        <p class="hero-copy">${esc(page.intro)}</p>
        <div class="actions">${site.phone ? `<a class="button primary" href="${phoneHref(site.phone)}">${esc(site.primaryCta || "Call for a free estimate")}</a>` : ""}<a class="button ${site.phone ? "ghost" : "primary"}" href="/#services">All services</a></div>
      </div>
    </section>
    ${tool}
    ${sections}
    ${page.diagram && DIAGRAMS[page.diagram] ? `<section class="shell intro">${DIAGRAMS[page.diagram](site)}</section>` : ""}
    ${page.faqs ? renderFaq({ ...site, faqs: page.faqs, faqHeading: page.faqHeading || "Questions about this.", faqKicker: "Common questions" }) : ""}
    ${points}
    ${related}
    ${renderLeadForm(site, slug, `/${page.slug}`)}
    ${site.phone || site.email ? `<section class="shell contact"><div><p class="eyebrow accent">Ready to get started?</p><h2>${esc(page.ctaHeadline || site.ctaHeadline)}</h2><p>${esc(page.ctaCopy || site.ctaCopy)}</p></div><div class="contact-card">${site.phone ? `<a class="phone" href="${phoneHref(site.phone)}">${esc(site.phone)}</a>` : ""}${site.email ? `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ""}<p>Serving ${esc(areaNames.join(", "))}.</p></div></section>` : ""}
  </main>
  <footer><div class="shell footer-inner"><p>© <span id="year"></span> ${esc(site.name)}</p><p>${esc(site.footerLine)}</p></div></footer>
  ${site.phone ? `<a class="mobile-call" href="${phoneHref(site.phone)}">Call now · ${esc(site.phone)}</a>` : ""}<script src="/site.js" defer></script>${site.leadForm ? `<script>${LEAD_FORM_SCRIPT}</script>` : ""}${site.analytics === false ? "" : `<script>${ANALYTICS_SCRIPT}</script>`}${page.type === "fence-calculator" ? `<script type="module" src="/fence-calc-ui.mjs"></script>` : ""}
</body></html>`;
}
