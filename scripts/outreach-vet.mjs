// Vets outreach tasks before they reach the dashboard's queue, and builds the
// one-time import from the existing register.
//
// Every task passes through here — the weekly research routine and the import
// alike — so the rules live in one place:
//   * no Martins (on hold for a rename) and no SeaCoast (not launched);
//   * no [placeholder] left for someone else to fill in;
//   * no claim the site's owner has not confirmed (deploy/claim-allowances.json,
//     per site, no inheritance);
//   * no password anywhere.
// Eligibility (which site may get which KIND of task) is enforced again by the
// database, which is the source of truth for it.
//
// Usage:
//   node scripts/outreach-vet.mjs proposals.json   # vetted JSON to stdout, rejections to stderr
//   node scripts/outreach-vet.mjs --import         # build + vet the register import

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findClaims } from "./lib/claims.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXCLUDED = new Set(["martins-trash-removal-demolition", "seacoast-hurricane-shutters"]);

export function vetTask(task, allowances) {
  if (EXCLUDED.has(task.site)) return { ok: false, reason: `${task.site} gets no outreach tasks right now` };
  const fields = [task.target, task.why, task.copy_block, task.account_note, ...(task.steps ?? [])].map((v) => String(v ?? ""));
  const all = fields.join("\n");
  if (/[[\]]/.test(all)) return { ok: false, reason: "contains a [placeholder] someone would have to fill in" };
  if (/password|passcode/i.test(all)) return { ok: false, reason: "mentions a password — logins never go in a task" };
  const allowed = new Set(allowances.sites?.[task.site]?.allow ?? []);
  const hits = findClaims(all, allowed);
  if (hits.length) return { ok: false, reason: `unconfirmed claim: "${hits[0].quote}" (${hits[0].describes})` };
  return { ok: true };
}

/** The email between the two `---` rules of a docs/outreach draft, with the
 *  notes-to-Mitch removed and the one known fill-in resolved. */
export function draftFromMarkdown(md) {
  const parts = md.replace(/\r/g, "").split(/\n---\n/);
  if (parts.length < 3) throw new Error("draft has no --- delimited email");
  return parts[1]
    .replace(/\[membership \/ a listing\]/g, "membership and a directory listing")
    .replace(/\n\[[^\]]*\]\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const PAID_STEPS = [
  "Open the link and check it is the membership or directory page for this organisation.",
  "Send the email below from the account in the note. Do not pay for or sign up to anything.",
  "Mark this In progress while you wait for a reply.",
  "If they want payment or paperwork, mark it Blocked and put the cost and what they need in the notes — Mitch decides.",
  "Only mark it Done once the business is listed, with the link to the listing.",
];

const ACCOUNT = {
  "twin-city-fences": "Send from twincityfences@gmail.com — ask Mitch for access.",
  "towing-dallas": "Ask Mitch which inbox to send from before sending.",
};

async function buildImport() {
  const register = JSON.parse(await fs.readFile(path.join(root, "deploy", "link-prospects.json"), "utf8"));
  const seed = JSON.parse(await fs.readFile(path.join(root, "deploy", "outreach-seed.json"), "utf8"));
  const tasks = [];
  for (const p of register.prospects) {
    const md = await fs.readFile(path.join(root, "docs", "outreach", p.site, `${p.id}.md`), "utf8");
    tasks.push({
      site: p.site,
      kind: "backlink",
      target: p.org,
      url: p.url,
      why: p.why,
      cost: p.cost,
      steps: PAID_STEPS,
      copy_block: draftFromMarkdown(md),
      account_note: ACCOUNT[p.site] ?? "Ask Mitch which account to use.",
      checked_at: p.checked,
      page_live: p.http === 200,
      links_to_us: p.linksToUs ?? null,
    });
  }
  return [...tasks, ...seed.tasks];
}

const RPC = "https://oyrcjrcgvmzmkaipapjm.supabase.co/rest/v1/rpc/";
// Public by design; the token is what authorises the call.
const KEY = "sb_publishable_vRcp_g2WW01D8SxjLVDTzA_HSoAdjBG";

async function rpc(name, body) {
  const token = process.env.OUTREACH_PROPOSE_TOKEN;
  if (!token) throw new Error("OUTREACH_PROPOSE_TOKEN is not set");
  const res = await fetch(RPC + name, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, ...body }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--context")) {
    process.stdout.write(JSON.stringify(await rpc("outreach_context", {}), null, 2) + "\n");
    return;
  }
  const allowances = JSON.parse(await fs.readFile(path.join(root, "deploy", "claim-allowances.json"), "utf8"));
  const input = args.includes("--import")
    ? await buildImport()
    : JSON.parse(await fs.readFile(args.find((a) => !a.startsWith("--")), "utf8"));
  const kept = [];
  input.forEach((task, i) => {
    const r = vetTask(task, allowances);
    if (r.ok) kept.push(task);
    else console.error(`dropped #${i + 1} ${task.site} ${task.target}: ${r.reason}`);
  });
  console.error(`${kept.length} of ${input.length} tasks passed vetting.`);
  if (args.includes("--propose")) {
    if (!kept.length) return console.error("Nothing to propose.");
    console.log(JSON.stringify(await rpc("propose_outreach_tasks", { p_tasks: kept }), null, 2));
  } else {
    process.stdout.write(JSON.stringify(kept, null, 2) + "\n");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
