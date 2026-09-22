// Link prospecting: verify, draft, report. Never send.
//
// THE SENDING IS NOT MISSING, IT IS REFUSED. This script has no mail client,
// no API key and no transport of any kind, and that is the design rather than
// an unfinished edge. Every link-building tool that can send eventually does
// send, at volume, and the footprint that leaves is what loses local rankings
// rather than gains them. Drafts land on disk and a person decides.
//
// WHAT IS AND IS NOT AUTOMATABLE HERE, honestly:
//
//   Discovery is NOT. Finding pages that mention a business needs a search
//   index, and this repo has no key for one and should not acquire one for
//   this. The register carries the queries instead; run them by hand or with
//   an agent and add what they turn up.
//
//   Verification IS. Given a URL, checking whether the page is live, whether
//   it already links to us, and whether it names us without linking is exactly
//   the tedium worth automating - and an unlinked mention is the single
//   highest-value prospect there is, because the relationship already exists
//   and only the link is missing.
//
//   Drafting IS, up to a point. A draft assembled from the site's own facts
//   beats a blank page. It is still a draft: read it, change it, or throw it
//   away.
//
// Usage:
//   npm run links                 # report the register
//   npm run links -- --verify     # fetch each prospect, update what we know
//   npm run links -- --draft      # write outreach drafts to docs/outreach/

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registerPath = path.join(root, "deploy", "link-prospects.json");

const args = process.argv.slice(2);
const doVerify = args.includes("--verify");
const doDraft = args.includes("--draft");
const only = args.filter((a) => !a.startsWith("--"));

const register = JSON.parse(await fs.readFile(registerPath, "utf8"));
const siteConfig = async (slug) =>
  JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));

let prospects = register.prospects || [];
if (only.length) prospects = prospects.filter((p) => only.includes(p.site) || only.includes(p.id));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Three questions per prospect: is it live, does it already link to us, does it
 * name us without linking.
 *
 * The limits are worth stating. This reads one page, so a member directory
 * that paginates or loads over JavaScript will look like it does not mention us
 * when it might. A "no" here means not found on this page, not proven absent -
 * which is why nothing is ever marked `unsuitable` automatically.
 */
async function verify(prospect, site) {
  const result = { checked: new Date().toISOString().slice(0, 10) };
  let html;
  try {
    const res = await fetch(prospect.url, {
      redirect: "follow",
      headers: { "User-Agent": "lead-gen-link-prospector (+contact via site owner)" },
      signal: AbortSignal.timeout(20000),
    });
    result.http = res.status;
    if (!res.ok) return result;
    html = await res.text();
  } catch (error) {
    result.http = 0;
    result.error = error.name === "TimeoutError" ? "timeout" : error.message.slice(0, 60);
    return result;
  }

  const haystack = html.toLowerCase();
  const domain = (site.domain || "").toLowerCase();
  // A .invalid placeholder can never be linked to, so do not report its absence
  // as a finding - that would be noise on every check until a domain is bought.
  result.linksToUs = domain && !domain.endsWith(".invalid") ? haystack.includes(domain) : null;
  result.mentionsUs = haystack.includes((site.name || "").toLowerCase());
  return result;
}

if (doVerify) {
  console.log(`Verifying ${prospects.length} prospect${prospects.length === 1 ? "" : "s"}…\n`);
  const configs = new Map();
  for (const prospect of prospects) {
    if (!configs.has(prospect.site)) configs.set(prospect.site, await siteConfig(prospect.site));
    const site = configs.get(prospect.site);
    const found = await verify(prospect, site);
    Object.assign(prospect, found);

    const state = found.http === 0 ? `unreachable (${found.error})`
      : found.http !== 200 ? `HTTP ${found.http}`
      : found.linksToUs ? "already links to us"
      : found.mentionsUs ? "MENTIONS US, NO LINK — best kind of prospect"
      : "live, no mention";
    console.log(`  ${prospect.id.padEnd(18)} ${state}`);
    await sleep(1500); // these are other people's servers
  }
  await fs.writeFile(registerPath, JSON.stringify(register, null, 2) + "\n", "utf8");
  console.log("\nRegister updated.");
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

/**
 * Outreach assembled from the site's own facts, with the parts that need a
 * human left as visible blanks rather than plausible filler. A draft that
 * reads as finished is a draft that gets sent unread, and an outreach mail
 * that is obviously generated is worse than none - it tells the recipient
 * exactly how little thought went into it.
 */
function draftFor(prospect, site) {
  const services = (site.services || []).slice(0, 3).map((s) => s.title.toLowerCase()).join(", ");
  const where = (site.serviceAreas || []).slice(0, 3).join(", ");
  const unlinked = prospect.mentionsUs && prospect.linksToUs === false;

  const body = unlinked
    ? `Their page already names ${site.name} but does not link to it. That is the
easiest ask there is: the relationship exists, somebody just did not add an
href. Lead with gratitude, keep it to three sentences, and make the link
trivially easy to add by giving the exact URL.

---

Subject: Thanks for the mention — one small thing

Hello,

Thanks for mentioning ${site.name} on ${prospect.url} — much appreciated.

Would you mind linking it to https://${site.domain}? Saves anyone reading it
having to search for us.

Either way, thanks for the mention.

${site.name}
${site.phone || "[phone]"}`
    : `Not a mention — this is an application or an enquiry rather than a favour.
Check what ${prospect.org} actually requires before writing: most associations
want proof of trading and a fee, and a mail that ignores their stated process
reads as spam no matter how polite it is.

CHECK FIRST — cost is recorded as: ${prospect.cost || "unknown"}

---

Subject: Membership enquiry — ${site.name}, ${site.city} ${site.state}

Hello,

I run ${site.name}, a ${services || "[trade]"} business working across ${where || "[area]"}.

I am interested in [membership / a listing] and wanted to ask what the process
and current cost are.

[ONE specific sentence about why this organisation in particular — if you cannot
write one that is true, this is probably the wrong prospect.]

Website: https${site.domain.endsWith(".invalid") ? "" : "://" + site.domain}${site.domain.endsWith(".invalid") ? "[no domain yet]" : ""}
Phone: ${site.phone || "[phone]"}

Thanks,
${site.name}`;

  return `# ${prospect.org}

- **Site:** ${site.name}
- **Prospect:** \`${prospect.id}\` (${prospect.type})
- **URL:** ${prospect.url}
- **Cost:** ${prospect.cost || "unknown"}
- **Last checked:** ${prospect.checked || "never — run with --verify first"}

**Why this one:** ${prospect.why}

## Draft — read it, change it, then send it yourself

${body}

---

*Nothing sends this. When you have sent it, set this prospect's status to
\`sent\` in deploy/link-prospects.json so the next run does not offer it again.*
`;
}

if (doDraft) {
  const outDir = path.join(root, "docs", "outreach");
  const configs = new Map();
  let written = 0;
  for (const prospect of prospects) {
    if (["sent", "won", "declined", "unsuitable"].includes(prospect.status)) continue;
    if (!configs.has(prospect.site)) configs.set(prospect.site, await siteConfig(prospect.site));
    const dir = path.join(outDir, prospect.site);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${prospect.id}.md`), draftFor(prospect, configs.get(prospect.site)), "utf8");
    if (prospect.status === "candidate" || prospect.status === "qualified") prospect.status = "drafted";
    written++;
  }
  await fs.writeFile(registerPath, JSON.stringify(register, null, 2) + "\n", "utf8");
  console.log(`\n${written} draft${written === 1 ? "" : "s"} written to docs/outreach/. None sent — that is yours.`);
}

// ---------------------------------------------------------------------------
// Report (always)
// ---------------------------------------------------------------------------

const bySite = new Map();
for (const p of prospects) {
  if (!bySite.has(p.site)) bySite.set(p.site, []);
  bySite.get(p.site).push(p);
}

console.log("");
for (const [slug, list] of [...bySite].sort()) {
  console.log(`=== ${slug} — ${list.length} prospect${list.length === 1 ? "" : "s"}`);
  for (const p of list) {
    const flag = p.mentionsUs && p.linksToUs === false ? "  ← unlinked mention"
      : p.linksToUs ? "  ← already linked" : "";
    console.log(`  ${p.status.padEnd(10)} ${p.org}${flag}`);
    console.log(`             ${p.type} · ${p.cost || "cost unknown"}`);
  }
  console.log("");
}

const blocked = Object.entries(register.discovery || {})
  .filter(([k, v]) => !k.startsWith("_") && v._blocked);
for (const [slug, info] of blocked) console.log(`NOTE ${slug}: ${info._blocked}`);

const queries = Object.entries(register.discovery || {})
  .filter(([k]) => !k.startsWith("_"))
  .reduce((n, [, v]) => n + (v.queries || []).length, 0);
console.log(`\n${prospects.length} prospects tracked. ${queries} discovery queries waiting on a search engine.`);
console.log("Nothing here sends anything. Drafts go to docs/outreach/ for a person to read.");
