import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sitemapUrls, siteUrls } from "./sitemap.mjs";

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://twincityfences.com/</loc></url><url><loc>https://twincityfences.com/fence-calculator</loc></url><url><loc>https://twincityfences.com/a?x=1&amp;y=2</loc></url><url><loc>https://elsewhere.com/x</loc></url><url><loc>https://twincityfences.com/</loc></url></urlset>\n`;

test("sitemapUrls returns every page on the host, once, unescaped", () => {
  assert.deepEqual(sitemapUrls(xml, "twincityfences.com"), [
    "https://twincityfences.com/",
    "https://twincityfences.com/fence-calculator",
    "https://twincityfences.com/a?x=1&y=2",
  ]);
  assert.deepEqual(sitemapUrls("", "twincityfences.com"), []);
});

test("siteUrls reads the built sitemap and falls back to the home page", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sitemap-"));
  await fs.mkdir(path.join(root, "dist", "built"), { recursive: true });
  await fs.writeFile(path.join(root, "dist", "built", "sitemap.xml"), xml);
  assert.equal((await siteUrls(root, "built", "twincityfences.com")).length, 3);
  assert.deepEqual(await siteUrls(root, "unbuilt", "example.com"), ["https://example.com/"]);
  await fs.rm(root, { recursive: true, force: true });
});
