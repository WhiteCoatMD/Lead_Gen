// Resolves Google place IDs for portfolio sites, so gbp-watch.mjs can watch
// them. Without an id there is nothing to poll, and on 2026-09-22 only 2 of 13
// entries had one - so eleven profiles, including the two most active sites,
// were not being watched at all.
//
// THE MATCHING RULE IS THE WHOLE SCRIPT. A text search for "Twin City Fence
// West Monroe" will cheerfully return a different fence company in the same
// town, and recording that id would mean monitoring a competitor's profile and
// reporting its drift as ours. Worse, it would look like it was working.
//
// So a candidate is accepted ONLY on hard evidence:
//
//   website domain matches, or
//   phone number matches (last 10 digits)
//
// Name similarity is not evidence and never accepts on its own. Two businesses
// in one town can share a name; only the domain and the phone are ours.
//
// A site with no match is left alone and reported as unresolved. That is an
// honest outcome, not a failure: service-area businesses that hide their
// address are frequently absent from Places entirely, which is exactly why
// Twin City could not be found in the September sweep.
//
// Usage:
//   GOOGLE_MAPS_API_KEY=... node scripts/gbp-find-ids.mjs
//   GOOGLE_MAPS_API_KEY=... node scripts/gbp-find-ids.mjs --dry-run

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

async function apiKey() {
  if (process.env.GOOGLE_MAPS_API_KEY) return process.env.GOOGLE_MAPS_API_KEY.trim();
  const file = process.env.MAPS_KEY_FILE || path.join(os.homedir(), ".lead-gen-maps-key");
  const text = await fs.readFile(file, "utf8").catch(() => {
    throw new Error("No Places key. Set GOOGLE_MAPS_API_KEY, or MAPS_KEY_FILE to a file containing it.");
  });
  const line = text.split(/\r?\n/).find((l) => l.startsWith("GOOGLE_MAPS_API_KEY="));
  return (line ? line.slice("GOOGLE_MAPS_API_KEY=".length) : text).trim().replace(/^["']|["']$/g, "");
}

const key = await apiKey();
const MASK = "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.businessStatus";
const digits = (v) => String(v || "").replace(/\D/g, "").slice(-10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(textQuery) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": MASK, "Content-Type": "application/json" },
    body: JSON.stringify({ textQuery, maxResultCount: 10 }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return { error: `HTTP ${res.status} ${(await res.text()).slice(0, 120)}` };
  return await res.json();
}

const idsPath = path.join(root, "deploy", "gbp-place-ids.json");
const known = JSON.parse(await fs.readFile(idsPath, "utf8"));

let resolved = 0;
let unresolved = 0;

for (const entry of known) {
  if (entry.placeId) continue;

  let cfg;
  try {
    cfg = JSON.parse(await fs.readFile(path.join(root, "sites", entry.slug, "site.json"), "utf8"));
  } catch {
    console.log(`skip  ${entry.slug.padEnd(34)} no site.json`);
    continue;
  }

  const domain = (cfg.domain || "").toLowerCase();
  const realDomain = domain && !domain.endsWith(".invalid");
  const phone = digits(cfg.phone);

  if (!realDomain && !phone) {
    console.log(`skip  ${entry.slug.padEnd(34)} nothing to match on (no real domain, no phone)`);
    unresolved++;
    continue;
  }

  // Several angles, because the profile name rarely matches the site name
  // exactly. The queries are just candidate generators - acceptance is decided
  // entirely by the domain and phone check below, so a loose query costs
  // nothing but an extra request.
  // entry.gbpName is the name the PROFILE uses when it differs from the site's.
  // That difference is why the first sweep found nothing for several of these:
  // the site is "Flooring Monroe" and the profile is "Flooring and Shed Sync
  // Monroe", so searching the site name returned twenty strangers. Acceptance
  // still rests entirely on the domain or phone check below - this only
  // changes which candidates get generated.
  const queries = [
    entry.gbpName ? `${entry.gbpName} ${cfg.city} ${cfg.state}` : null,
    `${cfg.name} ${cfg.city} ${cfg.state}`,
    realDomain ? domain : null,
    cfg.phone || null,
  ].filter(Boolean);

  let match = null;
  let sawAny = 0;
  const nameLike = [];

  for (const q of queries) {
    const out = await search(q);
    await sleep(400);
    if (out.error) { console.log(`ERR   ${entry.slug.padEnd(34)} ${out.error}`); break; }
    const places = out.places || [];
    sawAny += places.length;

    for (const p of places) {
      nameLike.push({ id: p.id, name: p.displayName?.text, phone: p.nationalPhoneNumber, website: p.websiteUri, status: p.businessStatus });
      const pDomain = (p.websiteUri || "").toLowerCase();
      const byDomain = realDomain && pDomain.includes(domain);
      const byPhone = phone && digits(p.nationalPhoneNumber) === phone;
      if (byDomain || byPhone) {
        match = { p, how: byDomain && byPhone ? "domain and phone" : byDomain ? "domain" : "phone" };
        break;
      }
    }
    if (match) break;
  }

  if (!match) {
    // Near misses are kept rather than thrown away. A profile carrying the
    // right business name in the right town, but a different phone and no
    // website, is either a stale listing of ours or somebody else entirely -
    // and nothing available here can tell those apart. That is a judgement for
    // whoever owns the business, so the evidence is recorded and the placeId
    // is left unset. Automation proposes; a person confirms.
    const near = nameLike.filter((c) => c.name && cfg.name &&
      c.name.toLowerCase().replace(/[^a-z]/g, "").includes(cfg.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12)));
    console.log(`none  ${entry.slug.padEnd(34)} ${sawAny} candidate(s), none matched on domain or phone`);
    for (const c of near.slice(0, 3)) {
      console.log(`        near: "${c.name}" — ${c.phone || "no phone"} — ${c.website || "NO WEBSITE"}`);
    }
    entry.lookup = {
      checked: new Date().toISOString().slice(0, 10),
      result: near.length ? "name match only — needs human confirmation" : "not found in Places",
      candidates: sawAny,
      near: near.slice(0, 3),
    };
    unresolved++;
    continue;
  }

  const { p, how } = match;
  entry.placeId = p.id;
  entry.via = how;
  entry.name = p.displayName?.text || entry.name;
  entry.address = p.formattedAddress;
  entry.phone = p.nationalPhoneNumber;
  entry.website = p.websiteUri;
  entry.status = p.businessStatus;
  entry.lookup = { checked: new Date().toISOString().slice(0, 10), result: "matched", how };
  resolved++;
  console.log(`FOUND ${entry.slug.padEnd(34)} ${p.displayName?.text} — matched on ${how} — ${p.businessStatus}`);
}

if (!dryRun) {
  await fs.writeFile(idsPath, `${JSON.stringify(known, null, 2)}\n`, "utf8");
}

const total = known.filter((k) => k.placeId).length;
console.log(`\n${resolved} newly resolved, ${unresolved} still unresolved. ${total} of ${known.length} entries now have a place id.`);
if (dryRun) console.log("(dry run — nothing written)");
