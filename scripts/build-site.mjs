import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite, renderFavicon } from "../shared/render-site.mjs";
import { renderBirdsNest } from "../shared/render-birds-nest.mjs";
import { renderShop } from "../shared/render-shop.mjs";

// slug in site.json `template` -> renderer. No entry means the shared
// contractor template in render-site.mjs.
const RENDERERS = { "birds-nest": renderBirdsNest, shop: renderShop };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) throw new Error("Usage: npm run build:site -- <site-slug>");

const siteDir = path.join(root, "sites", slug);
const config = JSON.parse(await fs.readFile(path.join(siteDir, "site.json"), "utf8"));
const outputDir = path.join(root, "dist", slug);
await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(path.join(outputDir, "assets"), { recursive: true });

// Every template needs the identity fields; each one also needs the array it
// actually renders its cards from, so the check follows the renderer rather
// than assuming every site sells "services".
const CONTENT_FIELD = { "birds-nest": "products", shop: "menu" };
// `phone` is deliberately absent from this list. A site can legitimately have
// no contact details for a while, and the build should still produce the
// page. The launch checklist in scripts/audit.mjs decides whether a site is
// fit to launch, and it fails any site without a real, non-placeholder number.
const required = ["name", "domain", "city", "state", "headline", CONTENT_FIELD[config.template] || "services"];
const missing = required.filter((key) => !config[key] || (Array.isArray(config[key]) && !config[key].length));
if (missing.length) throw new Error(`${slug} is missing required fields: ${missing.join(", ")}`);

const render = RENDERERS[config.template] || renderSite;
if (config.template && !RENDERERS[config.template]) throw new Error(`${slug} names unknown template "${config.template}"`);
await fs.writeFile(path.join(outputDir, "index.html"), render(config), "utf8");
await fs.writeFile(path.join(outputDir, "favicon.svg"), renderFavicon(config), "utf8");
// Stylesheet falls back in order: this site's own, then the one belonging to
// its template, then the shared contractor stylesheet.
const exists = async (file) => fs.stat(file).then(() => file, () => null);
const cssFile =
  (await exists(path.join(siteDir, "site.css"))) ||
  (config.template ? await exists(path.join(root, "shared", `${config.template}.css`)) : null) ||
  path.join(root, "shared", "site.css");
await fs.copyFile(cssFile, path.join(outputDir, "site.css"));
await fs.copyFile(path.join(root, "shared", "site.js"), path.join(outputDir, "site.js"));

for (const asset of config.assets || []) {
  await fs.copyFile(path.join(siteDir, "assets", asset), path.join(outputDir, "assets", asset));
}

await fs.writeFile(path.join(outputDir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: https://${config.domain}/sitemap.xml\n`, "utf8");
await fs.writeFile(path.join(outputDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${config.domain}/</loc></url></urlset>\n`, "utf8");

// IndexNow ownership proof. The protocol verifies a submission by fetching
// this file from the host and checking it contains the key, so it has to
// ship with every site. It is deliberately public -- that is the mechanism,
// not a leak. scripts/indexnow.mjs refuses to submit for a host until this
// file is actually live, which makes it a deploy check as well as a key.
const indexNow = JSON.parse(await fs.readFile(path.join(root, "deploy", "indexnow.json"), "utf8"));
await fs.writeFile(path.join(outputDir, `${indexNow.key}.txt`), indexNow.key, "utf8");
console.log(`Built ${slug} → dist/${slug}`);
