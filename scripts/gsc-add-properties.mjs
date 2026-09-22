// Claims each remaining domain as a Search Console DOMAIN property, without
// eleven trips through the browser.
//
// The manual route is: open Search Console, start Add property, copy the TXT
// token Google shows, add it at GoDaddy, come back, press verify. Eleven
// times. The Site Verification API does the first and last steps, and the
// GoDaddy workflow does the middle one, so the whole thing becomes two
// commands with a DNS propagation wait between them.
//
// Ownership note worth understanding before running it: whoever verifies a
// domain becomes an owner of it. Verifying as the service account makes the
// SERVICE ACCOUNT the owner, which is what makes the API work unattended. Pass
// --owner <email> to add a human owner alongside it, so the property also
// shows up in that person's Search Console.
//
// Usage:
//   node scripts/gsc-add-properties.mjs --tokens        # step 1: get tokens
//   ... run the "Add Search Console verification TXT" workflow with the JSON
//   ... wait a few minutes for DNS
//   node scripts/gsc-add-properties.mjs --verify --owner someone@gmail.com
//
// Needs the Site Verification API enabled in the service account's project,
// alongside the Search Console API.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAccessToken, googleFetch } from "./lib/google-auth.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const wantTokens = args.includes("--tokens");
const wantVerify = args.includes("--verify");
const ownerIdx = args.indexOf("--owner");
// Every property is managed from one account by the owner's choice, so that
// is the default rather than something to remember on each run. Search Console
// and Google Business Profile are separate systems -- a property does not need
// to sit in the same Google account as the business's GBP, and eleven logins
// would be worse than one.
const DEFAULT_OWNER = "twincityfences@gmail.com";
const owner = ownerIdx >= 0 ? args[ownerIdx + 1] : DEFAULT_OWNER;
const only = args.filter((a) => !a.startsWith("--") && a !== owner);

if (!wantTokens && !wantVerify) {
  console.error("Pass --tokens or --verify. See the header for the sequence.");
  process.exit(1);
}

const SCOPE = "https://www.googleapis.com/auth/siteverification https://www.googleapis.com/auth/webmasters";
const SV = "https://www.googleapis.com/siteVerification/v1";
const GSC = "https://searchconsole.googleapis.com/webmasters/v3";

const auth = await getAccessToken(SCOPE);
console.log(`authenticated as ${auth.clientEmail}\n`);

const targets = JSON.parse(await fs.readFile(path.join(root, "deploy", "seo-targets.json"), "utf8"));
const slugs = (only.length ? only : Object.keys(targets.seo_target).filter((k) => !k.startsWith("_"))).sort();

const domains = [];
for (const slug of slugs) {
  const cfg = JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));
  if (cfg.domain && !cfg.domain.endsWith(".invalid")) domains.push({ slug, domain: cfg.domain });
}

const site = (domain) => ({ type: "INET_DOMAIN", identifier: domain });

if (wantTokens) {
  const out = {};
  for (const { slug, domain } of domains) {
    try {
      const r = await googleFetch(`${SV}/token`, auth.token, {
        method: "POST",
        body: JSON.stringify({ site: site(domain), verificationMethod: "DNS_TXT" }),
      });
      out[domain] = r.token;
      console.log(`ok    ${slug.padEnd(32)} ${r.token.slice(0, 52)}...`);
    } catch (error) {
      console.log(`FAIL  ${slug.padEnd(32)} ${error.status}: ${String(error.message).slice(0, 110)}`);
    }
  }
  const file = path.join(root, "deploy", "gsc-verification-tokens.json");
  await fs.writeFile(file, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`\n${Object.keys(out).length} tokens written to deploy/gsc-verification-tokens.json`);
  console.log("Paste that JSON into the 'Add Search Console verification TXT' workflow,");
  console.log("run it with dry_run false, wait a few minutes, then --verify.");
  console.log("\nThe tokens are not secrets: they are published in DNS by design.");
  process.exit(0);
}

// --verify
let verified = 0, addedProps = 0, failed = 0;
// Fetched once on first use: one list call answers every domain.
let resourceIds = null;
for (const { slug, domain } of domains) {
  try {
    await googleFetch(`${SV}/webResource?verificationMethod=DNS_TXT`, auth.token, {
      method: "POST",
      body: JSON.stringify({ site: site(domain) }),
    });
    console.log(`verified  ${slug.padEnd(32)} ${domain}`);
    verified++;
  } catch (error) {
    // Already-verified is a success, not a failure.
    if (error.status === 400 && /already/i.test(String(error.message))) {
      console.log(`already   ${slug.padEnd(32)} ${domain}`);
      verified++;
    } else {
      console.log(`FAIL      ${slug.padEnd(32)} ${error.status}: ${String(error.message).slice(0, 110)}`);
      failed++;
      continue;
    }
  }

  // Verifying proves ownership; the property still has to be added.
  try {
    await googleFetch(`${GSC}/sites/${encodeURIComponent(`sc-domain:${domain}`)}`, auth.token, { method: "PUT" });
    addedProps++;
  } catch (error) {
    console.log(`          ${" ".repeat(32)} property add failed: ${String(error.message).slice(0, 80)}`);
  }

  if (owner) {
    // Put a human on the property too, so it is visible in their own Search
    // Console rather than existing only to a service account.
    //
    // The resource id is NOT "dns://<domain>/". The API returns it already
    // URL-encoded and with no trailing slash — dns%3A%2F%2Fexample.com — so
    // it goes into the path as-is. Constructing and re-encoding it gives
    // "The ID for this site is missing or invalid", which is what the first
    // run did on all thirteen.
    try {
      if (!resourceIds) {
        const all = await googleFetch(`${SV}/webResource`, auth.token);
        resourceIds = new Map((all.items || []).map((i) => [i.site?.identifier, i]));
      }
      const resource = resourceIds.get(domain);
      if (!resource) throw new Error("no verified web resource for this domain");
      if ((resource.owners || []).includes(owner)) {
        console.log(`          ${" ".repeat(32)} owner already present: ${owner}`);
      } else {
        await googleFetch(`${SV}/webResource/${resource.id}`, auth.token, {
          method: "PUT",
          body: JSON.stringify({ ...resource, owners: [...(resource.owners || []), owner] }),
        });
        console.log(`          ${" ".repeat(32)} owner added: ${owner}`);
      }
    } catch (error) {
      console.log(`          ${" ".repeat(32)} could not add owner: ${String(error.message).slice(0, 90)}`);
    }
  }
}

console.log(`\n${verified} verified, ${addedProps} properties added, ${failed} failed.`);
console.log("Run `npm run gsc` to pull data once Google has populated them.");
process.exit(failed ? 1 : 0);
