// Weekly lead report: visits, call taps and delivered form leads per site.
//
// The question this answers is the one the business runs on — which sites
// produced calls and leads last week — and until 2026-09-23 it had no answer,
// because /api/event only wrote to Vercel logs that last about a day. Events
// now land in Supabase (see lead-gen-admin supabase/migrations/0003) and this
// reads them back as aggregates only.
//
// Counting rules:
//   leads  = lead_delivered, written server-side by api/lead.js only after
//            Resend accepted the email. form_submit comes from the browser and
//            can be posted by anyone, so it is never counted as a lead.
//   calls  = call_click: someone tapped a tel: link. A tap is not a connected
//            call, and the report says "call taps" to keep that honest.
//
// Fails (exit 1) on SILENCE: a site that logged visits in the previous four
// weeks and none in the last seven days. That is broken tracking or a dead
// site, not a quiet week — real traffic never drops to exactly zero.
//
// Usage:
//   EVENTS_REPORT_TOKEN=... node scripts/lead-report.mjs
//   EVENTS_REPORT_TOKEN=... node scripts/lead-report.mjs --markdown   # for the Actions summary

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pageRows } from "./lib/page-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdown = process.argv.includes("--markdown");

// Public by design; the report token is what authorises the read.
const URL = "https://oyrcjrcgvmzmkaipapjm.supabase.co/rest/v1/rpc/event_counts";
const KEY = "sb_publishable_vRcp_g2WW01D8SxjLVDTzA_HSoAdjBG";

const token = process.env.EVENTS_REPORT_TOKEN;
if (!token) {
  console.log("EVENTS_REPORT_TOKEN not set — skipping the lead report.");
  process.exit(0);
}

const res = await fetch(URL, {
  method: "POST",
  headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ p_token: token, p_days: 35 }),
  signal: AbortSignal.timeout(20000),
});
if (!res.ok) {
  console.log(`Lead report failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}
const rows = await res.json();

// Days are America/Chicago dates from the database. "This week" is the seven
// days ending yesterday, so a Monday-morning run reports Monday to Sunday.
const chicagoToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const dayOffset = (d) => Math.round((Date.parse(chicagoToday) - Date.parse(d)) / 86400000);
const thisWeek = (d) => dayOffset(d) >= 1 && dayOffset(d) <= 7;
const priorFour = (d) => dayOffset(d) >= 8 && dayOffset(d) <= 35;

const slugs = (await fs.readdir(path.join(root, "sites"), { withFileTypes: true }))
  .filter((e) => e.isDirectory()).map((e) => e.name).sort();

const stats = Object.fromEntries(slugs.map((s) => [s, { views: 0, calls: 0, leads: 0, priorViews: 0, priorLeads: 0, priorCalls: 0 }]));
for (const r of rows) {
  const s = stats[r.site];
  if (!s) continue; // a slug no longer in sites/ — ignore rather than report
  const n = Number(r.n);
  if (thisWeek(r.day)) {
    if (r.type === "page_view") s.views += n;
    if (r.type === "call_click") s.calls += n;
    if (r.type === "lead_delivered") s.leads += n;
  } else if (priorFour(r.day)) {
    if (r.type === "page_view") s.priorViews += n;
    if (r.type === "call_click") s.priorCalls += n;
    if (r.type === "lead_delivered") s.priorLeads += n;
  }
}

// Per-page view (lead-gen-admin migration 0006). Informational: a failure here
// prints a note and never fails the run — the SILENT gate above is the gate.
const pilotPages = {};
for (const slug of slugs) {
  const cfg = JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));
  const tools = (cfg.pages || []).filter((p) => p.type === "fence-calculator" || p.type === "fence-permit");
  if (tools.length) pilotPages[slug] = tools.map((p) => `/${p.slug}`);
}
let pages = null;
try {
  const pageRes = await fetch(URL.replace(/event_counts$/, "event_counts_by_path"), {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_days: 7 }),
    signal: AbortSignal.timeout(20000),
  });
  if (pageRes.ok) pages = pageRows(await pageRes.json(), pilotPages);
  else console.error(`Per-page counts unavailable: HTTP ${pageRes.status}`);
} catch (error) {
  console.error(`Per-page counts unavailable: ${error.message}`);
}

const silent = slugs.filter((s) => stats[s].priorViews > 0 && stats[s].views === 0);
const avg = (n) => (n / 4).toFixed(1);
const active = slugs.filter((s) => stats[s].views || stats[s].priorViews);
const totals = active.reduce((t, s) => ({ views: t.views + stats[s].views, calls: t.calls + stats[s].calls, leads: t.leads + stats[s].leads }), { views: 0, calls: 0, leads: 0 });

const header = ["site", "visits", "call taps", "form leads", "4-wk avg taps", "4-wk avg leads"];
const body = active
  .sort((a, b) => (stats[b].calls + stats[b].leads) - (stats[a].calls + stats[a].leads) || stats[b].views - stats[a].views)
  .map((s) => [s, stats[s].views, stats[s].calls, stats[s].leads, avg(stats[s].priorCalls), avg(stats[s].priorLeads)]);

if (markdown) {
  console.log(`## Leads, last 7 days\n`);
  console.log(`**${totals.calls} call taps and ${totals.leads} form leads** from ${totals.views} visits across ${active.length} sites.\n`);
  if (active.length) {
    console.log(`| ${header.join(" | ")} |\n|${header.map(() => "---").join("|")}|`);
    for (const row of body) console.log(`| ${row.join(" | ")} |`);
  } else {
    console.log("_No events recorded yet._");
  }
  if (silent.length) console.log(`\n**SILENT:** ${silent.join(", ")} — visits in the previous four weeks, none this week.`);
  if (pages) {
    console.log(`\n### Pages that produced leads\n`);
    console.log("Pages with a call tap or form lead this week. Calculator and permit-guide pages (pilot) are always listed.\n");
    if (pages.length) {
      console.log("| site | page | visits | call taps | form leads |\n|---|---|---|---|---|");
      for (const p of pages) console.log(`| ${p.site} | ${p.path}${p.pilot ? " (pilot)" : ""} | ${p.views} | ${p.calls} | ${p.leads} |`);
    } else {
      console.log("_No page produced a call tap or form lead this week._");
    }
  }
} else {
  console.log(header.map((h, i) => (i ? h.padStart(14) : h.padEnd(34))).join(""));
  for (const row of body) console.log(row.map((c, i) => (i ? String(c).padStart(14) : String(c).padEnd(34))).join(""));
  console.log(`\n${totals.calls} call taps, ${totals.leads} form leads, ${totals.views} visits across ${active.length} sites (seven days ending yesterday).`);
  const quiet = slugs.length - active.length;
  if (quiet) console.log(`${quiet} sites have recorded nothing in 35 days.`);
  if (silent.length) console.log(`SILENT: ${silent.join(", ")} — visits in the previous four weeks, none this week. Check tracking and the site.`);
  if (pages) {
    console.log(`\nPages that produced leads (pilot pages always listed):`);
    for (const p of pages) console.log(`  ${`${p.site}${p.path}${p.pilot ? " (pilot)" : ""}`.padEnd(60)} visits ${p.views}  taps ${p.calls}  leads ${p.leads}`);
  }
}

process.exit(silent.length ? 1 : 0);
