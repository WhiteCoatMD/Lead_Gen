import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite } from "../shared/render-site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) throw new Error("Usage: npm run build:site -- <site-slug>");

const siteDir = path.join(root, "sites", slug);
const config = JSON.parse(await fs.readFile(path.join(siteDir, "site.json"), "utf8"));
const outputDir = path.join(root, "dist", slug);
await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(path.join(outputDir, "assets"), { recursive: true });

const required = ["name", "domain", "phone", "city", "state", "headline", "services"];
const missing = required.filter((key) => !config[key] || (Array.isArray(config[key]) && !config[key].length));
if (missing.length) throw new Error(`${slug} is missing required fields: ${missing.join(", ")}`);

await fs.writeFile(path.join(outputDir, "index.html"), renderSite(config), "utf8");
await fs.copyFile(path.join(root, "shared", "site.css"), path.join(outputDir, "site.css"));
await fs.copyFile(path.join(root, "shared", "site.js"), path.join(outputDir, "site.js"));

for (const asset of config.assets || []) {
  await fs.copyFile(path.join(siteDir, "assets", asset), path.join(outputDir, "assets", asset));
}

await fs.writeFile(path.join(outputDir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: https://${config.domain}/sitemap.xml\n`, "utf8");
await fs.writeFile(path.join(outputDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${config.domain}/</loc></url></urlset>\n`, "utf8");
console.log(`Built ${slug} → dist/${slug}`);
