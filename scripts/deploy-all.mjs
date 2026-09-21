// Deploys every built site in dist/ to its own Vercel project and verifies the
// resulting public URL. Project links live in deploy/projects.json so the
// mapping survives `npm run build` wiping dist/.
// Usage: node scripts/deploy-all.mjs [slug ...]
//        node scripts/deploy-all.mjs --verify-only
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE = process.env.VERCEL_SCOPE || "mitch-brattons-projects";
const linkFile = path.join(root, "deploy", "projects.json");

const args = process.argv.slice(2);
const verifyOnly = args.includes("--verify-only");
const links = JSON.parse(await fs.readFile(linkFile, "utf8").catch(() => "{}"));
const all = (await fs.readdir(path.join(root, "sites"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const slugs = args.filter((a) => !a.startsWith("--")).length ? args.filter((a) => !a.startsWith("--")) : all;

const results = [];
for (const slug of slugs) {
  const dir = path.join(root, "dist", slug);
  if (!(await fs.access(dir).then(() => true, () => false))) { console.log(`skip ${slug}: not built`); continue; }

  if (!verifyOnly) {
    // restore the project link so every deploy targets the same project
    if (links[slug]) {
      await fs.mkdir(path.join(dir, ".vercel"), { recursive: true });
      await fs.writeFile(path.join(dir, ".vercel", "project.json"), JSON.stringify(links[slug]), "utf8");
    }
    const run = spawnSync("vercel", ["deploy", "--prod", "--yes", "--scope", SCOPE], { cwd: dir, encoding: "utf8", shell: true });
    if (run.status !== 0) {
      console.log(`FAIL ${slug}: ${(run.stderr || "").trim().split("\n").slice(-2).join(" | ")}`);
      results.push({ slug, ok: false });
      continue;
    }
    if (!links[slug]) {
      links[slug] = JSON.parse(await fs.readFile(path.join(dir, ".vercel", "project.json"), "utf8"));
      await fs.writeFile(linkFile, JSON.stringify(links, null, 2) + "\n", "utf8");
    }
    console.log(`deployed ${slug}`);
  }

  if (links[slug]) results.push({ slug });
}

// A project's public URL is NOT always https://<projectName>.vercel.app. That
// name is global, and when someone else already holds it Vercel gives the
// project a suffixed alias instead — cutting-edge-tree-service landed on
// ...-cyan.vercel.app because the bare name belongs to an unrelated site that
// answers 200. Assuming the bare name meant verifying a stranger's website, so
// ask Vercel what the alias actually is.
// `vercel project ls` prints its table to stderr, not stdout, so read both.
const aliasRun = spawnSync("vercel", ["project", "ls", "--scope", SCOPE], { encoding: "utf8", shell: true });
const aliasOutput = `${aliasRun.stdout || ""}\n${aliasRun.stderr || ""}`;
const aliasByProject = {};
for (const line of aliasOutput.split(/\r?\n/)) {
  const clean = line.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const match = clean.match(/^(\S+)\s+(https:\/\/\S+\.vercel\.app)/);
  if (match) aliasByProject[match[1]] = match[2];
}
for (const r of results) {
  const name = links[r.slug]?.projectName || r.slug;
  r.alias = aliasByProject[name] || `https://${name}.vercel.app`;
  if (links[r.slug]) links[r.slug].alias = r.alias;   // record it, so the mapping is the source of truth
}
await fs.writeFile(linkFile, JSON.stringify(links, null, 2) + "\n", "utf8");

console.log("\nVerifying public URLs:");
let bad = 0;
const checked = results.filter((r) => r.alias);
for (const r of checked) {
  const cfg = JSON.parse(await fs.readFile(path.join(root, "sites", r.slug, "site.json"), "utf8"));
  let status = 0, html = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(r.alias, { redirect: "follow" }).catch(() => null);
    if (res) { status = res.status; html = await res.text().catch(() => ""); }
    if (status === 200) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  const issues = [];
  if (status !== 200) issues.push(`HTTP ${status}`);
  if (!html.includes(cfg.name)) issues.push("business name missing");
  if (!html.includes(`tel:+1${cfg.phone.replace(/[^0-9]/g, "").slice(-10)}`)) issues.push("phone CTA missing");
  if (!html.includes(`<link rel="canonical" href="https://${cfg.domain}/">`)) issues.push("canonical missing");
  if (issues.length) bad++;
  console.log(`${issues.length ? "FAIL" : "ok  "} ${r.slug.padEnd(26)} ${r.alias.padEnd(48)} ${issues.join("; ")}`);
}
console.log(`\n${checked.length - bad}/${checked.length} deployments verified.`);
process.exit(bad ? 1 : 0);
