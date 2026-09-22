// Verifies every built site in dist/ against the portfolio launch checklist.
// Usage: npm run audit
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const digits = (value) => String(value).replace(/[^0-9]/g, "");
const between = (text, open, close) => {
  const start = text.indexOf(open);
  if (start === -1) return null;
  const rest = text.slice(start + open.length);
  const end = rest.indexOf(close);
  return end === -1 ? null : rest.slice(0, end);
};
const occurrences = (text, needle) => text.split(needle).length - 1;

const slugs = (await fs.readdir(path.join(root, "sites"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

let failures = 0;
const rows = [];

for (const slug of slugs) {
  const cfg = JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));
  const out = path.join(root, "dist", slug);
  const shared = !cfg.template;                   // the shared contractor template
  const problems = [];
  const check = (ok, message) => { if (!ok) problems.push(message); };

  let html;
  try { html = await fs.readFile(path.join(out, "index.html"), "utf8"); }
  catch { console.log(`FAIL ${slug}: no dist build`); failures++; continue; }

  // --- SEO ---
  const title = between(html, "<title>", "</title>");
  check(title && title.length > 10 && title.length <= 70, `title length (${title ? title.length : 0})`);
  const desc = between(html, '<meta name="description" content="', '"');
  check(desc && desc.length > 50 && desc.length <= 175, `description length (${desc ? desc.length : 0})`);
  check(html.includes(`<link rel="canonical" href="https://${cfg.domain}/">`), "canonical URL");
  check(!cfg.domain.startsWith("www."), "domain should be apex");
  check(html.includes('property="og:title"') && html.includes('property="og:url"'), "Open Graph tags");

  // A service-area business must not publish a street address. For Twin City
  // the address is shared with a competing fence company and publishing it is
  // what suppressed the listing; for Martins the yard is simply not somewhere
  // customers go. Both decisions are easy to undo by accident, so they are
  // asserted rather than remembered.
  if (cfg.serviceAreaBusiness) {
    check(!cfg.streetAddress, "service-area business must not set streetAddress");
    check(!/"streetAddress"/.test(html), "service-area business publishes a street address in schema");
  }

  // --- local-business structured data ---
  const ld = between(html, '<script type="application/ld+json">', "</script>");
  let schema = null;
  try { schema = JSON.parse(ld); } catch { check(false, "JSON-LD does not parse"); }
  if (schema) {
    check(schema.name === cfg.name, "schema name");
    if (cfg.phone) check(digits(schema.telephone) === digits(cfg.phone), "schema telephone");
    check(!!schema.address && schema.address.addressLocality === cfg.city, "schema address");
    check(Array.isArray(schema.areaServed) && schema.areaServed.length > 0, "schema areaServed");
    check(schema.url === `https://${cfg.domain}`, "schema url");
  }

  // --- responsive navigation ---
  check(html.includes('<nav id="site-nav"'), "nav element");
  check(occurrences(html, '<nav id="site-nav"') === 1, "duplicate nav");
  const navBlock = between(html, '<nav id="site-nav"', "</nav>") || "";
  check(occurrences(navBlock, "<a ") >= 3, "nav link count");
  if (shared) {
    check(html.includes('class="nav-toggle"'), "mobile nav toggle");
    check(html.includes('aria-controls="site-nav"'), "nav toggle aria-controls");
  }

  // --- phone CTAs ---
  // A site with no number at all fails here by name. Every check below
  // assumes one exists, and computing a tel: href from undefined would throw
  // before the checklist could report anything useful.
  if (!cfg.phone) {
    check(false, "no phone number on the site at all");
  } else {
    const expected = `tel:+1${digits(cfg.phone).slice(-10)}`;
    // a site must never ship with a stand-in number; every CTA is a tel: link
    check(new Set(digits(cfg.phone).slice(-7)).size > 1, "placeholder phone number (" + cfg.phone + ")");
    const tels = html.split('href="tel:').slice(1).map((part) => "tel:" + part.slice(0, part.indexOf('"')));
    check(tels.length >= 4, `tel link count (${tels.length})`);
    check(tels.every((href) => href === expected), `tel mismatch: ${[...new Set(tels)].join(", ")}`);
    check(html.includes('class="nav-call"'), "header call CTA");
    check(html.includes('class="mobile-call"'), "mobile sticky call button");
    check(html.includes(`>${cfg.phone}<`), "phone shown on page");
    if (shared) check(html.includes('class="button primary"'), "hero primary CTA");
  }

  // --- content sections ---
  check(html.includes('id="services"') || html.includes('id="store"'), "services section");
  check(occurrences(html, 'class="service-card"') + occurrences(html, 'class="product"') >= 3, "service/product cards");
  check(html.includes('id="areas"'), "service-area section");
  check(occurrences(between(html, 'class="area-list"', "</div>") || "", "<span>") >= 1, "service-area list");
  if (shared) check(html.includes('id="process"'), "process section");

  // --- assets ---
  const css = await fs.readFile(path.join(out, "site.css"), "utf8").catch(() => "");
  const refs = new Set();
  for (const part of html.split('src="').slice(1)) refs.add(part.slice(0, part.indexOf('"')));
  for (const part of html.split("url(&quot;").slice(1)) refs.add(part.slice(0, part.indexOf("&quot;")));
  for (const part of css.split('url("').slice(1)) refs.add(part.slice(0, part.indexOf('"')));
  for (const ref of refs) {
    if (ref.startsWith("http://")) { check(false, `insecure asset ${ref}`); continue; }
    if (ref.startsWith("https://")) { check(false, `remote asset still hotlinked: ${ref}`); continue; }
    if (ref.startsWith("data:")) continue;
    const onDisk = path.join(out, ref.replace(/^[/]/, ""));
    check(await fs.access(onDisk).then(() => true, () => false), `missing asset ${ref}`);
  }
  const combined = html + css;
  check(!combined.includes("cdn-website.com") && !combined.includes("snapps.ai") && !combined.includes("multiscreensite.com"), "old-host reference remains");

  // --- crawl files ---
  const robots = await fs.readFile(path.join(out, "robots.txt"), "utf8").catch(() => "");
  check(robots.includes(`https://${cfg.domain}/sitemap.xml`), "robots.txt sitemap line");
  const sitemap = await fs.readFile(path.join(out, "sitemap.xml"), "utf8").catch(() => "");
  check(sitemap.includes(`https://${cfg.domain}/`), "sitemap loc");
  check((await fs.access(path.join(out, "favicon.svg")).then(() => true, () => false)), "favicon.svg generated");
  check(html.includes('<link rel="icon" href="/favicon.svg"'), "favicon link tag");
  check(css.length > 0, "site.css copied");
  check((await fs.access(path.join(out, "site.js")).then(() => true, () => false)), "site.js copied");

  if (problems.length) failures++;
  rows.push([slug, cfg.domain, problems]);
}

for (const [slug, domain, problems] of rows) {
  console.log(`${(problems.length ? `FAIL (${problems.length})` : "PASS").padEnd(9)} ${slug.padEnd(26)} ${domain}`);
  for (const problem of problems) console.log(`          - ${problem}`);
}
console.log(`\n${rows.length - failures}/${rows.length} sites pass the checklist.`);
process.exit(failures ? 1 : 0);
