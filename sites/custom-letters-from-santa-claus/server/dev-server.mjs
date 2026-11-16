import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { handleAdmin } from "./admin.mjs";
import { handleCheckout } from "./checkout.mjs";
import { handleDrafter } from "./drafter.mjs";
import { handleJobs } from "./jobs.mjs";
import { toRequest, writeResult } from "./node-http.mjs";
import { handleWebhook } from "./webhook.mjs";

const routes = {
  "/api/santa/checkout": handleCheckout,
  "/api/santa/webhook": handleWebhook,
  "/api/santa/admin": handleAdmin,
  "/api/santa/jobs": handleJobs,
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(readFileSync(new URL("../admin/index.html", import.meta.url)));
    return;
  }
  const fn = routes[url.pathname] || (url.pathname.startsWith("/api/santa/drafter/") ? handleDrafter : null);
  if (!fn) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  try {
    const request = await toRequest(req, { raw: url.pathname === "/api/santa/webhook" });
    request.url = req.url;
    const result = await fn(request, { env: process.env, fetch: globalThis.fetch });
    writeResult(res, result);
  } catch (error) {
    console.error(error?.message || error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Something went wrong." }));
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => {
  console.log(`Santa order API on http://localhost:${port}`);
});
