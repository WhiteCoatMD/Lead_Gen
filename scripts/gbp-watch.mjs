// Watches the Google Business Profiles we know about and reports drift.
//
// The brief asks to be told when a listing changes, disappears or becomes
// inaccurate. This is that, for the profiles whose place_id we have.
//
// It earns its place already: Scaffolding Rental Los Angeles was found flagged
// CLOSED_PERMANENTLY, which suppresses a business in Maps and the local pack
// no matter what its website does. Nothing on the website could have revealed
// that, and nobody would have thought to look.
//
// Checks per profile:
//   - business status, so a listing going closed or vanishing is noticed
//   - phone against site.json, because citation matching keys on it
//   - website, so a profile pointing at the wrong domain is caught
//   - name, reported as drift rather than an error, since the profile spelling
//     is usually the one to follow
//
// Compliance: the same field mask as everywhere else in this project. No
// ratings, no reviews, no photos, no editorial content -- those may not be
// stored under the Places terms, and the rule does not bend because this is a
// monitoring script.
//
// Usage:
//   node scripts/gbp-watch.mjs                 # check everything we have ids for
//   node scripts/gbp-watch.mjs --json          # machine-readable
//
// Key: GOOGLE_MAPS_API_KEY, or MAPS_KEY_FILE pointing at a file containing it.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const asJson = process.argv.includes("--json");

async function apiKey() {
  if (process.env.GOOGLE_MAPS_API_KEY) return process.env.GOOGLE_MAPS_API_KEY.trim();
  const file = process.env.MAPS_KEY_FILE;
  if (!file) {
    throw new Error(
      "No Places key. Set GOOGLE_MAPS_API_KEY, or MAPS_KEY_FILE to a file containing it.\n" +
        "The key belongs outside this repo."
    );
  }
  const text = await fs.readFile(file, "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith("GOOGLE_MAPS_API_KEY="));
  const value = (line ? line.slice("GOOGLE_MAPS_API_KEY=".length) : text).trim().replace(/^["']|["']$/g, "");
  if (!value) throw new Error(`No GOOGLE_MAPS_API_KEY found in ${file}`);
  return value;
}

const FIELDS = "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,businessStatus";
const digits = (v) => String(v || "").replace(/\D/g, "").slice(-10);

const key = await apiKey();
const known = JSON.parse(await fs.readFile(path.join(root, "deploy", "gbp-place-ids.json"), "utf8"));
const withIds = known.filter((k) => k.placeId);

if (!withIds.length) {
  console.log("No place ids recorded yet. deploy/gbp-inventory.json lists the profiles known from other sources.");
  process.exit(0);
}

const results = [];
for (const entry of withIds) {
  const cfg = JSON.parse(await fs.readFile(path.join(root, "sites", entry.slug, "site.json"), "utf8"));
  const issues = [];

  let place;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${entry.placeId}?fields=${FIELDS}`, {
      headers: { "X-Goog-Api-Key": key },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      // A profile that stops resolving is itself the alert.
      issues.push(`profile not retrievable (HTTP ${res.status}) — it may have been removed or merged`);
      results.push({ slug: entry.slug, issues, status: null });
      continue;
    }
    place = await res.json();
  } catch (error) {
    issues.push(`lookup failed (${error.cause?.code || error.name}) — not evidence of a problem, re-run`);
    results.push({ slug: entry.slug, issues, status: null });
    continue;
  }

  if (place.businessStatus && place.businessStatus !== "OPERATIONAL") {
    issues.push(`business status is ${place.businessStatus} — suppressed in Maps and the local pack until fixed`);
  }
  if (cfg.phone && place.nationalPhoneNumber && digits(cfg.phone) !== digits(place.nationalPhoneNumber)) {
    issues.push(`phone differs: profile ${place.nationalPhoneNumber}, site ${cfg.phone}`);
  }
  if (place.websiteUri && cfg.domain && !place.websiteUri.includes(cfg.domain)) {
    issues.push(`profile website points at ${place.websiteUri}, not ${cfg.domain}`);
  }

  const profileName = place.displayName?.text || "";
  const nameDrift = profileName && cfg.name && profileName.toLowerCase() !== cfg.name.toLowerCase();

  results.push({
    slug: entry.slug,
    status: place.businessStatus,
    profileName,
    siteName: cfg.name,
    nameDrift,
    address: place.formattedAddress,
    issues,
  });
}

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    const flag = r.issues.length ? "ALERT" : r.nameDrift ? "drift" : "ok   ";
    console.log(`${flag} ${r.slug.padEnd(30)} ${r.status || "(unknown)"}`);
    for (const i of r.issues) console.log(`        ${i}`);
    if (r.nameDrift) {
      console.log(`        name drift: profile "${r.profileName}" vs site "${r.siteName}"`);
      console.log(`        (not necessarily wrong — the profile spelling is usually the one to follow)`);
    }
  }
}

const alerting = results.filter((r) => r.issues.length);
console.log(`\n${results.length - alerting.length} ok, ${alerting.length} needing attention.`);
process.exit(alerting.length ? 1 : 0);
