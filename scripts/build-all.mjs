import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = await fs.readdir(path.join(root, "sites"), { withFileTypes: true });
for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "build-site.mjs"), entry.name], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
