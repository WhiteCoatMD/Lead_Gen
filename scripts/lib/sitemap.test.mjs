import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { indexablePages, sitemapUrls, sitemapXml, siteUrls } from "./sitemap.mjs";

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://twincityfences.com/</loc></url><url><loc>https://twincityfences.com/fence-calculator</loc></url><url><loc>https://twincityfences.com/a?x=1&amp;y=2</loc></url><url><loc>https://elsewhere.com/x</loc></url><url><loc>https://twincityfences.com/</loc></url></urlset>\n`;

test("sitemapUrls returns every page on the host, once, unescaped", () => {
  assert.deepEqual(sitemapUrls(xml, "twincityfences.com"), [
    "https://twincityfences.com/",
    "https://twincityfences.com/fence-calculator",
    "https://twincityfences.com/a?x=1&y=2",
  ]);
  assert.deepEqual(sitemapUrls("", "twincityfences.com"), []);
});

test("sitemapXml lists canonical pages only and adds lastmod when a date is set", () => {
  const pages = [
    { slug: "services", heading: "Services" },
    { slug: "services.html", canonicalTo: "services" },
    { slug: "secret", sitemap: false },
  ];
  assert.deepEqual(indexablePages(pages).map((p) => p.slug), ["services"]);
  const xml = sitemapXml("example.com", pages, "2026-10-18");
  assert.match(xml, /<loc>https:\/\/example.com\/<\/loc><lastmod>2026-10-18<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/example.com\/services<\/loc><lastmod>2026-10-18<\/lastmod>/);
  assert.equal(xml.includes("services.html"), false);
  assert.equal(xml.includes("secret"), false);
  assert.equal(sitemapXml("example.com", [{ slug: "a" }]).includes("lastmod"), false);
});

test("siteUrls reads the built sitemap and falls back to the home page", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sitemap-"));
  await fs.mkdir(path.join(root, "dist", "built"), { recursive: true });
  await fs.writeFile(path.join(root, "dist", "built", "sitemap.xml"), xml);
  assert.equal((await siteUrls(root, "built", "twincityfences.com")).length, 3);
  assert.deepEqual(await siteUrls(root, "unbuilt", "example.com"), ["https://example.com/"]);
  await fs.rm(root, { recursive: true, force: true });
});
