// Brings CLI-created Vercel projects in line with the ones created through the
// dashboard: sets the monorepo's build command and per-site output directory,
// and optionally connects the project to the git repo so a push to main
// redeploys it.
//
// Why this exists: `vercel deploy` from a prebuilt dist/ directory creates a
// project with Vercel's DEFAULT build settings ("public" if it exists, or ".").
// That is harmless while the project is only ever deployed from the CLI, but
// the moment it is connected to git the first build fails with "No Output
// Directory named public". Every site in this repo builds with
// `npm run build` into `dist/<slug>`, so that is what each project needs.
//
// Usage:
//   node scripts/wire-vercel-projects.mjs --check
//   node scripts/wire-vercel-projects.mjs                 # set build settings
//   node scripts/wire-vercel-projects.mjs --connect-git   # and connect the repo
//
// The token is read from a file so it never appears in a command line, in
// shell history, or in this repository. Point VERCEL_TOKEN_FILE at it, or drop
// it at the default path below. Keep that file OUTSIDE the repo.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEAM = process.env.VERCEL_TEAM_ID || "team_MVHBiqKAxVK5ml7HVd7qbhzX";
const REPO = "WhiteCoatMD/Lead_Gen";
const tokenFile = process.env.VERCEL_TOKEN_FILE || path.join(os.homedir(), ".vercel-wiring-token");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const connectGit = args.includes("--connect-git");

const token = (await fs.readFile(tokenFile, "utf8").catch(() => "")).trim();
if (!token) {
  console.error(`No token found at ${tokenFile}`);
  console.error("Create one at https://vercel.com/account/tokens scoped to the team, then write it to that file.");
  process.exit(1);
}

const links = JSON.parse(await fs.readFile(path.join(root, "deploy", "projects.json"), "utf8"));

const api = async (method, endpoint, body) => {
  const res = await fetch(`https://api.vercel.com${endpoint}${endpoint.includes("?") ? "&" : "?"}teamId=${TEAM}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* non-JSON error body */ }
  // Never surface the token: only status and the API's own message come back.
  return { ok: res.ok, status: res.status, body: parsed, message: parsed?.error?.message || text.slice(0, 200) };
};

const slugs = Object.keys(links).sort();
let changed = 0, already = 0, failed = 0;

for (const slug of slugs) {
  const id = links[slug].projectId;
  const want = { buildCommand: "npm run build", outputDirectory: `dist/${slug}` };

  const current = await api("GET", `/v9/projects/${id}`);
  if (!current.ok) {
    console.log(`FAIL  ${slug.padEnd(34)} read failed (${current.status}): ${current.message}`);
    failed++;
    continue;
  }

  const has = current.body.buildCommand === want.buildCommand && current.body.outputDirectory === want.outputDirectory;
  const gitRepo = current.body.link?.repo ? `${current.body.link.org}/${current.body.link.repo}` : null;

  if (checkOnly) {
    console.log(`${has ? "ok   " : "TODO "} ${slug.padEnd(34)} build=${String(current.body.buildCommand)} out=${String(current.body.outputDirectory)} git=${gitRepo || "none"}`);
    if (has) already++; else changed++;
    continue;
  }

  if (has) {
    console.log(`ok    ${slug.padEnd(34)} already correct${gitRepo ? "" : " (not git-connected)"}`);
    already++;
  } else {
    const patch = await api("PATCH", `/v9/projects/${id}`, want);
    if (!patch.ok) {
      console.log(`FAIL  ${slug.padEnd(34)} patch failed (${patch.status}): ${patch.message}`);
      failed++;
      continue;
    }
    console.log(`set   ${slug.padEnd(34)} build command and dist/${slug}`);
    changed++;
  }

  if (connectGit && !gitRepo) {
    const link = await api("POST", `/v9/projects/${id}/link`, { type: "github", repo: REPO });
    console.log(link.ok ? `      ${" ".repeat(34)} connected to ${REPO}` : `      ${" ".repeat(34)} git connect failed (${link.status}): ${link.message}`);
    if (!link.ok) failed++;
  }
}

console.log(`\n${already} already correct, ${changed} ${checkOnly ? "need changes" : "updated"}, ${failed} failed.`);
process.exit(failed ? 1 : 0);
