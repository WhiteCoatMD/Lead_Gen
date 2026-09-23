import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCalculator, renderPermitGuide, renderPermitLinks } from "./render-tools.mjs";
import { renderPage } from "./render-page.mjs";

const site = {
  name: "Twin City Fence", domain: "twincityfences.com", city: "West Monroe", phone: "318-351-2539",
  serviceAreas: ["Monroe", "West Monroe"], footerLine: "Fences.", ctaHeadline: "Call", ctaCopy: "Now",
  services: [{ title: "Wood Privacy Fences" }, { title: "Chain-Link Fences" }],
  leadForm: { heading: "Tell us about the fence." },
  pages: [
    { slug: "fence-calculator", type: "fence-calculator", heading: "Fence materials calculator.", navLabel: "Fence calculator", seoTitle: "t", seoDescription: "d" },
    { slug: "fence-permit-monroe", type: "fence-permit", permit: "monroe-la", heading: "Fence permits in Monroe.", navLabel: "Monroe fence permits", seoTitle: "t", seoDescription: "d" },
  ],
};
const permit = {
  id: "monroe-la", name: "City of Monroe",
  office: { name: "Monroe Planning & Permits", phone: "318-555-0100", address: "400 Main St", url: "https://monroe.example/permits", sourceUrl: "https://monroe.example/permits", checked: "2026-09-20" },
  facts: [
    { topic: "permit", question: "Do I need a permit?", answer: "Yes <for new fences>.", sourceUrl: "https://library.municode.com/la/monroe", sourceTitle: "Monroe Code §9-1", checked: "2026-09-20" },
    { topic: "digging", question: "Call before digging?", answer: "Yes, Louisiana 811.", sourceUrl: "https://www.laonecall.com/", sourceTitle: "Louisiana 811", checked: "2026-08-02" },
  ],
};

test("calculator page works without JavaScript: formulas and a real worked example", () => {
  const html = renderCalculator(site);
  assert.match(html, /<form[^>]*id="fence-calc"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /Line posts/); assert.match(html, /\b219\b/); // pickets in the worked example
  assert.match(html, /confirm quantities with your supplier/i);
  assert.doesNotMatch(html, /\$\s?\d/);
});

test("permit guide shows every fact with its source and the oldest checked date", () => {
  const html = renderPermitGuide(site, permit, { calculator: { slug: "fence-calculator", label: "Fence calculator" }, guides: [] });
  assert.match(html, /href="https:\/\/library\.municode\.com\/la\/monroe"/);
  assert.match(html, /Monroe Code §9-1/);
  assert.match(html, /Last checked:? August 2026/);
  assert.match(html, /Yes &lt;for new fences&gt;\./); // escaped
  assert.match(html, /tel:\+13185550100/);
  assert.match(html, /not legal advice/i);
  assert.match(html, /HOA/);
  assert.match(html, /href="\/fence-calculator"/);
});

test("homepage links section lists the tools, and is empty for sites without them", () => {
  assert.match(renderPermitLinks(site), /href="\/fence-permit-monroe"/);
  assert.equal(renderPermitLinks({ ...site, pages: [] }), "");
});

test("every secondary page carries data-site, the analytics beacon and the lead form", () => {
  const html = renderPage(site, { slug: "west-monroe", heading: "Fences in West Monroe.", seoTitle: "t", seoDescription: "d" }, "twin-city-fences");
  assert.match(html, /<html[^>]*data-site="twin-city-fences"/);
  assert.match(html, /\/api\/event/);
  assert.match(html, /action="\/api\/lead"/);
});

test("the calculator page loads the calculator module; the permit page renders the guide", () => {
  const calc = renderPage(site, site.pages[0], "twin-city-fences");
  assert.match(calc, /<script type="module" src="\/fence-calc-ui\.mjs"><\/script>/);
  const guide = renderPage(site, site.pages[1], "twin-city-fences", { permit });
  assert.match(guide, /Monroe Code §9-1/);
});

test("a site with analytics turned off gets no beacon on secondary pages either", () => {
  const html = renderPage({ ...site, analytics: false }, { slug: "x", heading: "X.", seoTitle: "t", seoDescription: "d" }, "twin-city-fences");
  assert.doesNotMatch(html, /\/api\/event/);
});

test("javascript: links never reach an href; the source title stays as text", () => {
  const bad = { ...permit, office: { ...permit.office, url: "javascript:alert(1)" }, facts: permit.facts.map((f, i) => (i ? f : { ...f, sourceUrl: "JavaScript:alert(1)" })) };
  const html = renderPermitGuide(site, bad, { guides: [] });
  assert.doesNotMatch(html, /href="javascript/i);
  assert.match(html, /Monroe Code §9-1/);
});

test("a guide with no facts renders nothing instead of throwing", () => {
  assert.equal(renderPermitGuide(site, { ...permit, facts: [] }, { guides: [] }), "");
  assert.equal(renderPermitGuide(site, { ...permit, facts: undefined }, { guides: [] }), "");
});

test("secondary pages leave the tool pages out of 'Other services'", () => {
  const html = renderPage(site, { slug: "west-monroe", heading: "Fences in West Monroe.", seoTitle: "t", seoDescription: "d" }, "twin-city-fences");
  assert.doesNotMatch(html, /Other services/);
});

test("the homepage tools band uses the same markup as the areas band", () => {
  assert.match(renderPermitLinks(site), /^<section class="areas"><div class="shell areas-inner">/);
});
