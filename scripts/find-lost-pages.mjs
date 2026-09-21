// Finds URLs that used to exist on a property and now return 404.
//
// Every Snapps site was rebuilt from a multi-page original into a single page,
// and Google kept the old URLs. Twin City Fence had three of them indexed with
// descriptions, showing as sitelinks on its brand query, all 404 since the
// migration. That is ranking equity draining out of a live property, and it is
// invisible from inside the repo because the pages that are gone left nothing
// behind to notice.
//
// Search Console would answer this properly and needs OAuth. The Wayback
// Machine answers most of it for free and right now: it archived the old sites
// before the rebuild, so its CDX index is a record of what used to be there.
//
// A 404 here is a candidate, not a verdict. Plenty of archived URLs were never
// worth anything — tag pages, query strings, one-off assets. The output is for
// reading, not for acting on automatically.
//
// Usage:
//   node scripts/find-lost-pages.mjs                 # every SEO target
//   node scripts/find-lost-pages.mjs twin-city-fences

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const targets = JSON.parse(await fs.readFile(path.join(root, "deploy", "seo-targets.json"), "utf8"));
const slugs = (only.length ? only : Object.keys(targets.seo_target).filter((k) => !k.startsWith("_"))).sort();

// Paths that were never going to be worth recovering.
const IGNORE = /\.(jpg|jpeg|png|gif|svg|css|js|ico|woff2?|ttf|pdf|xml|txt|webp|mp4)$|^\/(wp-|cgi-bin|feed|tag\/|category\/|author\/|\?|#)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const report = [];

for (const slug of slugs) {
  const cfg = JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));
  const domain = cfg.domain;
  if (!domain || domain.endsWith(".invalid")) { console.log(`skip  ${slug.padEnd(34)} placeholder domain`); continue; }

  const cdx = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&matchType=domain` +
    `&output=json&fl=original&collapse=urlkey&limit=800&filter=statuscode:200`;

  let rows;
  try {
    const res = await fetch(cdx, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) { console.log(`FAIL  ${slug.padEnd(34)} wayback HTTP ${res.status}`); continue; }
    rows = await res.json();
  } catch (error) {
    console.log(`FAIL  ${slug.padEnd(34)} wayback ${error.cause?.code || error.name}`);
    continue;
  }

  // First row is the header.
  const paths = new Set();
  for (const row of rows.slice(1)) {
    try {
      const u = new URL(row[0]);
      if (u.search) continue;
      const p = u.pathname.replace(/\/+$/, "") || "/";
      if (p === "/" || IGNORE.test(p)) continue;
      paths.add(p);
    } catch { /* malformed archived URL */ }
  }

  const lost = [];
  const blocked = [];
  for (const p of [...paths].sort()) {
    // Pace the requests. Scanning every archived path back to back looks
    // exactly like the thing Vercel's automatic mitigation exists to stop,
    // and an earlier run tripped it on two projects.
    await sleep(400);
    try {
      const res = await fetch(`https://${domain}${p}`, { redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (res.status === 404) lost.push(p);
      // Anything that is neither a 200 nor a 404 is an unanswered question,
      // not a pass. A 403 challenge page used to be counted as "fine".
      else if (res.status !== 200) blocked.push(`${p} (HTTP ${res.status})`);
    } catch (error) {
      blocked.push(`${p} (${error.cause?.code || error.name})`);
    }
  }

  const flag = lost.length ? "LOST " : blocked.length ? "BLOCK" : "ok   ";
  console.log(`${flag} ${slug.padEnd(34)} ${String(paths.size).padStart(3)} archived paths, ${lost.length} now 404${blocked.length ? `, ${blocked.length} unanswered` : ""}`);
  for (const p of lost.slice(0, 12)) console.log(`        404 ${p}`);
  if (lost.length > 12) console.log(`        ... and ${lost.length - 12} more`);
  for (const b of blocked.slice(0, 5)) console.log(`        ??? ${b}`);
  if (blocked.length) console.log(`        (unanswered is not a pass — re-run before trusting this site is clean)`);
  report.push({ slug, domain, archived: paths.size, lost, blocked });
  await sleep(1500);
}

await fs.writeFile(path.join(root, "deploy", "lost-pages.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
const total = report.reduce((n, r) => n + r.lost.length, 0);
console.log(`\n${total} archived URLs across ${report.filter((r) => r.lost.length).length} properties now return 404.`);
console.log("Written to deploy/lost-pages.json. Candidates for review, not an action list.");
