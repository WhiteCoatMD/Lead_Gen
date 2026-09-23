// node scripts/serve-dist.mjs <slug> [port] — serves dist/<slug> for a quick browser check.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [slug, port = "4173"] = process.argv.slice(2);
if (!slug) throw new Error("Usage: node scripts/serve-dist.mjs <slug> [port]");
const base = path.join(root, "dist", slug);
const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain" };

http.createServer(async (req, res) => {
  let p = path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  let file = path.join(base, p);
  if (file !== base && !file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
  try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html"); } catch {}
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404).end("not found"); }
}).listen(Number(port), () => console.log(`http://localhost:${port}/`));
