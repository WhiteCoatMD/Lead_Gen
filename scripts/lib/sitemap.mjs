// Reads the page URLs back out of a sitemap this repo built, for scripts that
// need "every page on the site" (IndexNow). The build writes one <loc> per
// page it actually wrote, so the sitemap is the list of what really exists.

import fs from "node:fs/promises";
import path from "node:path";

const unescapeXml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const escapeXml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Pages that answer 200 at their own URL. A duplicate that only exists to
// point a canonical elsewhere, or a page flagged out of the sitemap, is not
// listed. Redirects live in site.redirects, not in this list.
export function indexablePages(pages = []) {
  return pages.filter((page) => page?.slug && !page.canonicalTo && page.sitemap !== false);
}

export function sitemapXml(domain, pages, updated) {
  const homeMod = ISO_DATE.test(updated || "") ? `<lastmod>${updated}</lastmod>` : "";
  const entries = [
    `<url><loc>https://${escapeXml(domain)}/</loc>${homeMod}</url>`,
    ...indexablePages(pages).map((page) => {
      const mod = page.updated || updated;
      const lastmod = ISO_DATE.test(mod || "") ? `<lastmod>${mod}</lastmod>` : "";
      return `<url><loc>https://${escapeXml(domain)}/${escapeXml(page.slug)}</loc>${lastmod}</url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>\n`;
}

// Only URLs on `host` are kept: IndexNow rejects a submission containing a URL
// on any other host, and a sitemap should never contain one anyway.
export function sitemapUrls(xml, host) {
  const urls = [...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => unescapeXml(m[1]));
  return [...new Set(urls.filter((u) => {
    try { return new URL(u).hostname === host; } catch { return false; }
  }))];
}

// Every page in dist/<slug>/sitemap.xml, or just the home page if the site
// has not been built (or its sitemap lists nothing usable).
export async function siteUrls(root, slug, host) {
  let xml = "";
  try { xml = await fs.readFile(path.join(root, "dist", slug, "sitemap.xml"), "utf8"); } catch {}
  const urls = sitemapUrls(xml, host);
  return urls.length ? urls : [`https://${host}/`];
}
