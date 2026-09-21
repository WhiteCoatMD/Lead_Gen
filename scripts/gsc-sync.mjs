// Pulls Search Console data for every SEO-target property and writes a
// per-property snapshot.
//
// This is the measurement layer the rest of the SEO work has been missing. Up
// to now every question has been answered by inference: the Wayback Machine
// said a URL used to exist, a 404 said it stopped existing, and whether either
// one ever earned a click was a guess. Search Console is the only source that
// answers it, and it is also the only way to find dead URLs the archive never
// captured.
//
// Read-only. It asks Google what it already knows and writes it to disk.
//
// Usage:
//   node scripts/gsc-sync.mjs                    # every SEO target
//   node scripts/gsc-sync.mjs twin-city-fences   # one property
//   node scripts/gsc-sync.mjs --days 90          # default is 480 (~16 months)
//   node scripts/gsc-sync.mjs --check            # just prove the connection
//
// Setup, once:
//   1. Enable the Search Console API for the service account's Google Cloud
//      project. The 403 you get without this names the project and links
//      straight to the switch.
//   2. In Search Console, add the service-account email as a user on each
//      property. `--check` prints the email and lists what it can currently
//      see, so this is easy to verify.
//   3. Point GSC_KEY_FILE at the service-account JSON, kept outside the repo.
//
// WHICH ACCOUNT WORKS, as of 2026-09-21:
//   bedsync-sheets@bed-sync-delivery.iam.gserviceaccount.com
// The Search Console API is enabled in its project (bed-sync-delivery) and
// sites.list returns 200. The other key on this machine,
// card-sync-sheets@card-sync-491400, authenticates fine but its project does
// NOT have the API enabled -- signing in as admin@shed-sync.com lands on
// bed-sync-delivery, so that is where the switch got flipped. Worth knowing
// before spending another ten minutes waiting for propagation that was never
// going to arrive.
//
// The key currently lives in ~/Downloads, which is not a good home for a
// private key: move it somewhere stable and point GSC_KEY_FILE there, or drop
// it at the default path (~/.lead-gen-gsc-key.json) and drop the env var.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAccessToken, googleFetch, keyFilePath } from "./lib/google-auth.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const daysArg = args.indexOf("--days");
const DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) : 480;
const only = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://searchconsole.googleapis.com/webmasters/v3";

const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const startDate = iso(new Date(today.getTime() - DAYS * 86400000));
// Search Console lags a couple of days; asking for today returns nothing and
// looks like a broken integration.
const endDate = iso(new Date(today.getTime() - 3 * 86400000));

let auth;
try {
  auth = await getAccessToken(SCOPE);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`authenticated as ${auth.clientEmail}`);

let visible;
try {
  visible = (await googleFetch(`${API}/sites`, auth.token))?.siteEntry || [];
} catch (error) {
  console.error(`\nCould not list properties (${error.status}): ${error.message}`);
  if (/has not been used in project|is disabled/i.test(error.message)) {
    console.error("\nThe Search Console API is not enabled for this service account's project.");
    console.error("The message above links directly to the switch. Enable it, wait a minute, re-run.");
  }
  process.exit(1);
}

console.log(`${visible.length} propert${visible.length === 1 ? "y" : "ies"} visible to this account:`);
for (const s of visible) console.log(`   ${s.permissionLevel.padEnd(18)} ${s.siteUrl}`);

if (!visible.length) {
  console.log("\nNone yet. In Search Console, add this account as a user on each property:");
  console.log(`   ${auth.clientEmail}`);
  console.log("Settings -> Users and permissions -> Add user. 'Full' is not needed; 'Restricted' is enough to read.");
}
if (checkOnly) process.exit(0);

// Match our properties to whatever GSC exposes. A domain property is
// `sc-domain:example.com`; a URL-prefix property is `https://example.com/`.
// Both are common and which one exists is not knowable from here.
const targets = JSON.parse(await fs.readFile(path.join(root, "deploy", "seo-targets.json"), "utf8"));
const slugs = (only.length ? only : Object.keys(targets.seo_target).filter((k) => !k.startsWith("_"))).sort();

const query = (siteUrl, dimensions, rowLimit = 1000) =>
  googleFetch(`${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, auth.token, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, dataState: "all" }),
  });

const outDir = path.join(root, "deploy", "gsc");
await fs.mkdir(outDir, { recursive: true });

const summary = [];
for (const slug of slugs) {
  const cfg = JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));
  const domain = cfg.domain;
  if (!domain || domain.endsWith(".invalid")) continue;

  const match = visible.find(
    (s) => s.siteUrl === `sc-domain:${domain}` || s.siteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") === domain
  );
  if (!match) {
    console.log(`skip  ${slug.padEnd(30)} not visible to this account`);
    summary.push({ slug, domain, connected: false });
    continue;
  }

  let pages = [], queries = [];
  try {
    [pages, queries] = await Promise.all([
      query(match.siteUrl, ["page"]).then((r) => r?.rows || []),
      query(match.siteUrl, ["query"]).then((r) => r?.rows || []),
    ]);
  } catch (error) {
    console.log(`FAIL  ${slug.padEnd(30)} ${error.status}: ${error.message.slice(0, 90)}`);
    continue;
  }

  const clicks = pages.reduce((n, r) => n + (r.clicks || 0), 0);
  const impressions = pages.reduce((n, r) => n + (r.impressions || 0), 0);

  // The question the lost-page work actually raised: are the URLs we rebuilt
  // ones that had earned anything? A page with impressions justifies itself.
  const rebuilt = (cfg.pages || []).map((page) => {
    const url = `https://${domain}/${page.slug}`;
    const row = pages.find((r) => r.keys[0].replace(/\/$/, "") === url.replace(/\/$/, ""));
    return { path: `/${page.slug}`, clicks: row?.clicks || 0, impressions: row?.impressions || 0, position: row?.position ?? null };
  });

  await fs.writeFile(
    path.join(outDir, `${slug}.json`),
    JSON.stringify({ slug, domain, siteUrl: match.siteUrl, startDate, endDate, clicks, impressions,
      pages: pages.slice(0, 300), queries: queries.slice(0, 300), rebuilt }, null, 2) + "\n",
    "utf8"
  );

  console.log(`ok    ${slug.padEnd(30)} ${String(clicks).padStart(6)} clicks ${String(impressions).padStart(8)} impressions  ${pages.length} pages, ${queries.length} queries`);
  for (const r of rebuilt.filter((x) => x.impressions > 0)) {
    console.log(`        rebuilt ${r.path.padEnd(28)} ${r.impressions} impressions, pos ${r.position?.toFixed(1)}`);
  }
  summary.push({ slug, domain, connected: true, clicks, impressions, pages: pages.length, queries: queries.length, rebuilt });
}

await fs.writeFile(path.join(outDir, "_summary.json"), JSON.stringify({ startDate, endDate, generated: new Date().toISOString(), summary }, null, 2) + "\n", "utf8");
const connected = summary.filter((s) => s.connected);
console.log(`\n${connected.length} of ${summary.length} properties connected. Written to deploy/gsc/.`);
if (connected.length < summary.length) {
  console.log(`Add ${auth.clientEmail} as a user on the missing properties to include them.`);
}
