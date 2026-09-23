// Tells Bing, Yandex, Seznam and the rest of the IndexNow network that a site
// changed, instead of waiting for them to notice. Free, sanctioned by the
// search engines themselves, and about as far from link spam as an indexing
// tactic gets: it submits our own URLs on our own verified hosts.
//
// Google does not participate, so this is not a substitute for anything. It is
// a cheap win on the engines that do.
//
// The key is public by design. IndexNow proves ownership by fetching
// https://<host>/<key>.txt and checking it contains the key, which is why
// build-site.mjs writes that file into every site.
//
// Nothing is submitted for a host until that file is confirmed live. That
// ordering is deliberate: an unverified submission is rejected anyway, and
// checking first means this doubles as a deploy check. It also keeps dead and
// placeholder domains out of the request entirely — repeatedly submitting
// hosts that do not resolve is how a key gets throttled.
//
// Usage:
//   node scripts/indexnow.mjs              # submit every verifiable site
//   node scripts/indexnow.mjs crack-rx ... # just these slugs
//   node scripts/indexnow.mjs --dry-run    # report what would be submitted

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteUrls } from "./lib/sitemap.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.filter((a) => !a.startsWith("--"));

const { key } = JSON.parse(await fs.readFile(path.join(root, "deploy", "indexnow.json"), "utf8"));
if (!/^[a-f0-9]{8,128}$/i.test(key)) throw new Error("indexnow.json key looks malformed");

const slugs = only.length
  ? only
  : (await fs.readdir(path.join(root, "sites"), { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

let submitted = 0;
let skipped = 0;
let failed = 0;

for (const slug of slugs) {
  const config = JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));
  const host = config.domain;

  if (!host || host.endsWith(".invalid")) {
    console.log(`skip  ${slug.padEnd(34)} placeholder domain`);
    skipped++;
    continue;
  }

  // Verify the key file before claiming the host. A 404 here means either the
  // site has not been redeployed since the key was added, or the domain is not
  // actually serving our build — both are reasons not to submit.
  const keyLocation = `https://${host}/${key}.txt`;
  try {
    const probe = await fetch(keyLocation, { signal: AbortSignal.timeout(15000) });
    const text = probe.ok ? (await probe.text()).trim() : "";
    if (text !== key) {
      console.log(`skip  ${slug.padEnd(34)} key file not live (HTTP ${probe.status})`);
      skipped++;
      continue;
    }
  } catch (error) {
    console.log(`skip  ${slug.padEnd(34)} unreachable (${error.cause?.code || error.name})`);
    skipped++;
    continue;
  }

  // Every page the build wrote, from dist/<slug>/sitemap.xml; just the home
  // page if the site has not been built. Run after `npm run build`.
  const urlList = await siteUrls(root, slug, host);

  if (dryRun) {
    console.log(`would  ${slug.padEnd(33)} ${urlList.length} URL(s) on ${host}`);
    submitted++;
    continue;
  }

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation, urlList }),
      signal: AbortSignal.timeout(20000),
    });
    // 200 accepted, 202 accepted-pending-verification. Both are success.
    if (res.status === 200 || res.status === 202) {
      console.log(`ok    ${slug.padEnd(34)} submitted ${urlList.length} URL(s) (HTTP ${res.status})`);
      submitted++;
    } else {
      console.log(`FAIL  ${slug.padEnd(34)} HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
      failed++;
    }
  } catch (error) {
    console.log(`FAIL  ${slug.padEnd(34)} ${error.cause?.code || error.name}`);
    failed++;
  }
}

console.log(`\n${submitted} submitted, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 1 : 0);
