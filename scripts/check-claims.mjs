// Refuses to let an unverifiable claim reach a published page.
//
// Every site in this portfolio is a real business's shopfront, and the one
// thing that cannot be walked back is telling a customer something untrue. A
// warranty came off SeaCoast for this reason. "Over 20 years experience" came
// off Twin City's Yelp listing for the same one. "Licensed" came off Dallas on
// 2026-09-22 and went back the same day, but only after the owner confirmed it.
//
// The pattern in all three: the claim looked harmless, nobody could say where
// it came from, and it had been sitting there for months. This script is the
// thing that asks the question every build instead of every few months.
//
// WHAT IT CANNOT DO. It matches words, so it catches the claims that are
// phrased the usual way and misses one phrased unusually. A clean run means
// nothing known slipped through, not that the copy is true. Writing honestly
// is still the job; this is the net under it.
//
// Confirmations live in deploy/claim-allowances.json and are per site. A
// credential verified for one operator says nothing about another, which is
// why there is no global allow list and no inheritance.
//
// Usage:
//   npm run claims                  # every SEO-target site
//   node scripts/check-claims.mjs twin-city-fences [...]
//   node scripts/check-claims.mjs --all

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Claims that need evidence. `kind` groups them so an allowance can approve a
 * category rather than a regex, and so the report says what sort of problem it
 * is rather than only which word matched.
 */
const BANNED = [
  ["arrival-time", /\b\d+\s*-?\s*minute\b/i, "a specific arrival or response time"],
  ["arrival-time", /\bwithin\s+\d+\s*(min|minutes|hours?)\b/i, "a specific arrival or response time"],
  ["guarantee", /\bguarantee/i, "a guarantee"],
  ["warranty", /\bwarrant(y|ies)\b/i, "a warranty"],
  ["credential", /\blicensed\b/i, "a licence"],
  ["credential", /\binsured\b/i, "insurance"],
  ["credential", /\bbonded\b/i, "a bond"],
  ["credential", /\bcertified\b/i, "a certification"],
  ["credential", /\baccredited\b/i, "an accreditation"],
  ["tenure", /\b(\d+|\w+)\s+years\s+(of\s+)?(experience|in business)\b/i, "years in business"],
  ["tenure", /\bsince\s+(19|20)\d{2}\b/i, "a founding year"],
  ["ownership", /\bfamily[-\s]owned\b/i, "how the business is owned"],
  ["superlative", /\b(best|cheapest|lowest)\s+(price|rate|cost)/i, "a price superlative"],
  ["superlative", /\b(number\s*one|#1|no\.?\s*1)\b/i, "a ranking claim"],
  ["award", /\b(award[-\s]winning|voted\s+best)\b/i, "an award"],
  ["price", /\$\s?\d/, "a price"],
  ["volume", /\b\d[\d,]{2,}\+?\s+(customers|clients|jobs|projects)\b/i, "a customer or job count"],
];

const args = process.argv.slice(2);
const named = args.filter((a) => !a.startsWith("--"));

const targets = JSON.parse(await fs.readFile(path.join(root, "deploy", "seo-targets.json"), "utf8"));
const allowances = JSON.parse(await fs.readFile(path.join(root, "deploy", "claim-allowances.json"), "utf8"));

const built = async (slug) =>
  fs.access(path.join(root, "dist", slug)).then(() => true, () => false);

let slugs;
if (named.length) slugs = named;
else if (args.includes("--all")) {
  slugs = (await fs.readdir(path.join(root, "sites"), { withFileTypes: true }))
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
} else {
  // seo_target is an object of slug -> why, with a leading _note key.
  slugs = Object.keys(targets.seo_target || {}).filter((k) => !k.startsWith("_")).sort();
}

/** Visible words only. A claim inside JSON-LD came from the same config that
 *  produced the visible copy, so scanning the text is enough and scanning the
 *  markup would double-report every finding. */
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ");

let findings = 0;
let scanned = 0;
let skipped = 0;

for (const slug of slugs) {
  if (!(await built(slug))) { skipped++; continue; }

  const allowed = new Set(allowances.sites?.[slug]?.allow || []);
  const dir = path.join(root, "dist", slug);
  const files = (await fs.readdir(dir, { recursive: true })).filter((f) => String(f).endsWith(".html"));
  const hits = [];

  for (const file of files) {
    const text = visibleText(await fs.readFile(path.join(dir, String(file)), "utf8"));
    for (const [kind, re, describes] of BANNED) {
      if (allowed.has(kind)) continue;
      const match = text.match(re);
      if (match) hits.push({ file: String(file), kind, describes, quote: match[0].trim() });
    }
  }

  scanned++;
  if (!hits.length) continue;

  findings += hits.length;
  console.log(`\nFAIL ${slug} — ${hits.length} claim${hits.length === 1 ? "" : "s"} needing evidence`);
  for (const hit of hits) {
    console.log(`  ${hit.file}`);
    console.log(`    "${hit.quote}" — ${hit.describes} [${hit.kind}]`);
  }
}

console.log(`\n${scanned} site${scanned === 1 ? "" : "s"} scanned, ${findings} claim${findings === 1 ? "" : "s"} needing evidence.`);
if (skipped) console.log(`${skipped} not built — run npm run build first if that was unexpected.`);

if (findings) {
  console.log(
    "\nEach one is either true and confirmable, or it comes out.\n" +
    "Ask the owner about that specific site. If confirmed, add the kind to its\n" +
    "entry in deploy/claim-allowances.json with a dated note saying who confirmed\n" +
    "it. If not, rewrite the copy so the claim is not made."
  );
  process.exit(1);
}
