// Checks every site in the portfolio the way a person would: is the domain
// alive, does it point at us, is it serving OUR site, and is the page still
// SEO-sound. Run it on a schedule so a site going dark is something we're told
// about rather than something we discover months later.
//
// This exists because of 2026-09-21. Seven domains were quietly pointed at
// Duda's old Snapps hosting, which had started returning nginx 404. Every one
// of those businesses had a dead website and nothing anywhere said so. The
// deploys were green the whole time, because deploying a site and that site
// being reachable on its own domain are different questions and only one of
// them was being asked.
//
// Deliberately NOT a ranking tool. It checks facts that are true or false, not
// opinions about keyword density.
//
// Usage:
//   node scripts/audit-portfolio.mjs                # audit everything
//   node scripts/audit-portfolio.mjs crack-rx ...   # just these slugs
//   node scripts/audit-portfolio.mjs --json         # machine-readable
//
// Exit code is 1 if any site has a FAIL, so CI can gate on it. WARN does not
// fail the run: a placeholder domain is expected, not broken.

import fs from "node:fs/promises";
import path from "node:path";
import dns from "node:dns/promises";
import { fileURLToPath } from "node:url";
import { loadPermit, oldestCheckedDays, DUE_SOON_DAYS } from "./lib/permits.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const only = args.filter((a) => !a.startsWith("--"));

// Vercel's anycast ranges. Both generations are in use across this portfolio:
// the apex records use 216.150.x, and www CNAMEs land on either 216.150.x or
// the older 76.76.21.x / 66.33.60.x depending on which CNAME target was set.
const VERCEL_IPS = new Set(["216.150.1.1", "216.150.16.1", "76.76.21.21", "76.76.21.142", "66.33.60.66"]);
const VERCEL_IP_PREFIXES = ["216.150.", "76.76.21.", "66.33.60."];
const isVercelIp = (ip) => VERCEL_IPS.has(ip) || VERCEL_IP_PREFIXES.some((p) => ip.startsWith(p));

// The old Snapps platform. A domain still pointing here is the exact failure
// this script was written to catch, so it gets named rather than lumped into
// "somewhere else".
const DUDA_IPS = new Set(["100.24.208.97", "35.172.94.1"]);

// Strings that must never reach a live page. The Snapps template placeholder
// is 555-555-5555; our own build uses NNN-000-0000 to deliberately fail the
// launch checklist until a real number arrives.
const PLACEHOLDER_PATTERNS = [
  { re: /555[-.\s]?555[-.\s]?5555/, label: "Snapps placeholder phone 555-555-5555" },
  { re: /\b\d{3}[-.\s]?000[-.\s]?0000\b/, label: "placeholder phone NNN-000-0000" },
  { re: /ADD YOUR BUSINESS SLOGAN/i, label: "unedited template slogan" },
  { re: /lorem ipsum/i, label: "lorem ipsum" },
  { re: /myemail@/i, label: "placeholder email myemail@" },
  { re: /\byour (?:business|company) name\b/i, label: "template business-name placeholder" },
];

const fetchText = async (url, ms = 15000) => {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(ms) });
  return { status: res.status, url: res.url, body: await res.text() };
};

async function auditSite(slug) {
  const findings = [];
  const fail = (m) => findings.push({ level: "FAIL", message: m });
  const warn = (m) => findings.push({ level: "WARN", message: m });

  const config = JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));
  const domain = config.domain || "";
  const result = { slug, domain, name: config.name, findings };

  // A reserved-TLD domain is a deliberate placeholder, not a fault. Say so and
  // stop: there is nothing on the network to check.
  if (!domain || domain.endsWith(".invalid")) {
    warn("placeholder domain — not published yet");
    result.state = "placeholder";
    return result;
  }

  let addresses = [];
  try {
    addresses = await dns.resolve4(domain);
  } catch (error) {
    fail(`domain does not resolve (${error.code}) — lapsed or never registered`);
    result.state = "no-dns";
    return result;
  }
  result.addresses = addresses;

  const onDuda = addresses.some((ip) => DUDA_IPS.has(ip));
  const onVercel = addresses.some(isVercelIp);
  if (onDuda) fail(`still pointed at the old Snapps/Duda host (${addresses.join(", ")})`);
  else if (!onVercel) warn(`apex resolves off-Vercel (${addresses.join(", ")}) — may not be ours`);

  let page;
  try {
    page = await fetchText(`https://${domain}`);
  } catch (error) {
    fail(`request failed: ${error.cause?.code || error.name}`);
    result.state = "unreachable";
    return result;
  }
  result.status = page.status;
  if (page.status !== 200) fail(`HTTP ${page.status}`);

  // The load-bearing check. A 200 proves something answered, not that the
  // something is us — roofingcompanywarren.com returns a healthy 200 serving
  // an unrelated roofing company. Compare against what we actually built.
  let localHtml = null;
  try {
    localHtml = await fs.readFile(path.join(root, "dist", slug, "index.html"), "utf8");
  } catch {
    warn("no local build to compare against — run `npm run build` first");
  }
  const strip = (s) => s.replace(/\r/g, "");
  if (localHtml && strip(page.body) === strip(localHtml)) {
    result.match = "exact";
  } else if (config.name && page.body.includes(config.name)) {
    result.match = "stale";
    warn("serving our site but not the current build — deploy is behind");
  } else {
    result.match = "foreign";
    if (page.status === 200) fail("200, but the page is not our site — domain may not be ours");
  }

  // On-page essentials. Only meaningful once we know it is our page.
  if (result.match !== "foreign") {
    if (!/<title>[^<]{10,}<\/title>/i.test(page.body)) fail("missing or too-short <title>");
    if (!/<meta\s+name=["']description["']\s+content=["'][^"']{30,}/i.test(page.body)) fail("missing meta description");
    if (!/<link\s+rel=["']canonical["']/i.test(page.body)) fail("missing canonical link");
    if (!/<h1[^>]*>/i.test(page.body)) fail("missing <h1>");
    if (!/application\/ld\+json/i.test(page.body)) fail("missing JSON-LD structured data");

    const canonical = page.body.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)/i);
    if (canonical && !canonical[1].includes(domain)) {
      fail(`canonical points at ${canonical[1]}, not ${domain}`);
    }

    for (const { re, label } of PLACEHOLDER_PATTERNS) {
      if (re.test(page.body)) fail(`placeholder content on a live page: ${label}`);
    }
  }

  // www should reach the site too. A 308 to the apex is what this portfolio
  // standardised on; anything that refuses to connect is usually a certificate
  // that never finished issuing.
  try {
    const res = await fetch(`https://www.${domain}`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    result.www = res.status;
    if (![200, 301, 302, 307, 308].includes(res.status)) warn(`www returns ${res.status}`);
  } catch (error) {
    warn(`www unreachable (${error.cause?.code || error.name}) — certificate may still be issuing`);
  }

  // Can the lead form deliver? A page that loads with a form that drops every
  // submission passed this audit on 2026-09-23 (Deck Builders: no key, then an
  // unverified sender). The endpoint reports on itself without sending.
  if (config.leadForm && result.match !== "foreign") {
    try {
      const res = await fetch(`https://${domain}/api/lead?check=${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(15000),
      });
      const h = res.ok ? await res.json() : null;
      result.leadForm = h;
      if (!h) fail(`lead form: /api/lead health check returned HTTP ${res.status} — endpoint missing from deploy?`);
      else if (!h.known) fail("lead form: endpoint does not know this site — every submission is rejected");
      else if (!h.key) fail("lead form: RESEND_API_KEY not set on the project — every submission is dropped");
      else if (h.fromVerified === false) fail(`lead form: sender domain ${h.from} is not verified in Resend — every submission is rejected`);
      else if (h.fromVerified === null) warn(`lead form: could not confirm sender domain ${h.from} is verified in Resend`);
      if (h && h.events === false) warn("lead form: EVENTS_INGEST_TOKEN not set — leads deliver but are not counted");
    } catch (error) {
      fail(`lead form: health check failed (${error.cause?.code || error.name})`);
    }
  }

  for (const file of ["sitemap.xml", "robots.txt"]) {
    try {
      const res = await fetch(`https://${domain}/${file}`, { signal: AbortSignal.timeout(10000) });
      if (res.status !== 200) warn(`/${file} returns ${res.status}`);
    } catch {
      warn(`/${file} unreachable`);
    }
  }

  result.state = findings.some((f) => f.level === "FAIL") ? "broken" : "ok";
  return result;
}

const slugs = only.length
  ? only
  : (await fs.readdir(path.join(root, "sites"), { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

const results = [];
for (const slug of slugs) {
  try {
    results.push(await auditSite(slug));
  } catch (error) {
    results.push({ slug, state: "error", findings: [{ level: "FAIL", message: `audit threw: ${error.message}` }] });
  }
}

// Known-accepted breakage. Without this the audit fails on every run for the
// seven sites whose state is already understood and deliberate, and an alert
// that always fires is an alert nobody reads — which is the failure mode this
// script exists to end, not to recreate.
//
// The accepted value is the state, not "ignore this site". If a site moves to
// any other state the audit fails, including a move that looks like an
// improvement: a lapsed domain that suddenly resolves means someone else
// registered it, and that is worth waking up for.
const expectations = JSON.parse(
  await fs.readFile(path.join(root, "deploy", "audit-expectations.json"), "utf8").catch(() => "{}")
);

for (const r of results) {
  const expected = expectations[r.slug];
  r.expected = expected && expected.accept === r.state ? expected : null;
}

const broken = results.filter((r) => !r.expected && r.findings.some((f) => f.level === "FAIL"));
const drifted = results.filter((r) => expectations[r.slug] && !r.expected);
const accepted = results.filter((r) => r.expected);
const warned = results.filter((r) => !broken.includes(r) && !accepted.includes(r) && r.findings.length);

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    const worst = r.expected ? "known" : r.findings.some((f) => f.level === "FAIL") ? "FAIL " : r.findings.length ? "WARN " : "ok   ";
    console.log(`${worst} ${r.slug.padEnd(34)} ${(r.domain || "—").padEnd(32)} ${r.state}`);
    for (const f of r.findings) console.log(`        ${r.expected ? "note" : f.level}: ${f.message}`);
    if (r.expected) console.log(`        accepted: ${r.expected.reason}`);
  }
}

console.log(
  `\n${results.length - broken.length - warned.length - accepted.length} ok, ` +
  `${warned.length} with warnings, ${accepted.length} known-accepted, ${broken.length} newly broken.`
);
if (broken.length) console.log(`NEWLY BROKEN: ${broken.map((r) => r.slug).join(", ")}`);
for (const r of drifted) {
  console.log(`CHANGED: ${r.slug} was accepted as "${expectations[r.slug].accept}" but is now "${r.state}" — re-check and update deploy/audit-expectations.json`);
}
// Permit guides whose oldest fact is close to the one-year limit. A warning,
// not a failure: the offline checklist fails the site once it actually lapses.
const dueSoon = [];
for (const slug of slugs) {
  const cfg = JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));
  for (const page of cfg.pages || []) {
    if (page.type !== "fence-permit") continue;
    const days = oldestCheckedDays(await loadPermit(root, page.permit).catch(() => ({})));
    if (days >= DUE_SOON_DAYS) dueSoon.push(`${slug}/${page.slug} (oldest fact checked ${days === Infinity ? "never" : days + " days ago"})`);
  }
}
if (dueSoon.length) console.log(`\nPERMIT GUIDES DUE FOR RE-CHECK: ${dueSoon.join(", ")}`);

process.exit(broken.length ? 1 : 0);
