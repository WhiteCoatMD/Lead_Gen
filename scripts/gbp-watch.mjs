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

// regularOpeningHours added 2026-09-22. Scaffolding LA went from
// CLOSED_PERMANENTLY to "Open 24 hours" and this script could not have seen
// it, because it watched the status flip and not the hours. Hours are the more
// dangerous of the two to get wrong: a closed profile is invisible, which is
// obvious, while an overstated opening time is visible and generates calls
// nobody answers.
const FIELDS = "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,businessStatus,regularOpeningHours";
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

  // Hours the profile publishes, against whatever is recorded for it. A
  // 24-hour claim gets called out specifically rather than lumped in with any
  // other change: round-the-clock is true for a towing dispatch line and
  // almost never true for a trade that sends a crew to a site, and it is the
  // claim most likely to have been set by accident.
  const openNow = place.regularOpeningHours?.weekdayDescriptions || [];
  const summary = openNow.join(" | ");
  const isAlwaysOpen = /open 24 hours/i.test(summary) && !/closed/i.test(summary);
  if (isAlwaysOpen && !entry.hours_confirmed_24h) {
    issues.push(
      "profile publishes OPEN 24 HOURS — confirm that is true and that somebody answers, " +
      "or narrow it. Set hours_confirmed_24h on this entry once confirmed."
    );
  }
  if (entry.hours_seen && summary && entry.hours_seen !== summary) {
    issues.push(`hours changed since last check
           was: ${entry.hours_seen}
           now: ${summary}`);
  }
  if (summary) entry.hours_seen = summary;

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

// Persist what was seen, so the next run can compare against it. Change
// detection needs a previous value and there is nowhere else to keep one.
//
// In CI this write goes nowhere: the audit workflow checks out, runs and
// discards, so hours_seen only accumulates when this is run locally and the
// result committed. That weakens change detection there but not the OPEN 24
// HOURS check, which needs no history to fire.
await fs.writeFile(
  path.join(root, "deploy", "gbp-place-ids.json"),
  `${JSON.stringify(known, null, 2)}\n`,
  "utf8"
);

const alerting = results.filter((r) => r.issues.length);
console.log(`\n${results.length - alerting.length} ok, ${alerting.length} needing attention.`);
process.exit(alerting.length ? 1 : 0);
