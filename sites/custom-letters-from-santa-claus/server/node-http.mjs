export function nodeHandler(fn, { raw = false } = {}) {
  return async function handler(req, res) {
    try {
      const request = await toRequest(req, { raw });
      const result = await fn(request, { env: process.env, fetch: globalThis.fetch });
      writeResult(res, result);
    } catch (error) {
      console.error(error?.message || error);
      res.status(500).json({ error: "Something went wrong." });
    }
  };
}

export async function toRequest(req, { raw = false } = {}) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) headers[key.toLowerCase()] = value;
  let rawBody = "";
  let body = {};
  if (raw) {
    rawBody = await readRaw(req);
  } else if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    body = req.body;
  } else if (typeof req.body === "string" && req.body) {
    body = JSON.parse(req.body);
  } else {
    const text = await readRaw(req);
    body = text ? JSON.parse(text) : {};
  }
  return { method: req.method, url: req.url, headers, body, rawBody };
}

function readRaw(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString("utf8"));
  if (typeof req.body === "string") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function writeResult(res, result) {
  res.setHeader("Cache-Control", "no-store");
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
  }
  if (result.raw != null) {
    res.statusCode = result.status;
    res.setHeader("Content-Type", result.contentType || "application/octet-stream");
    if (result.filename) res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.end(result.raw);
    return;
  }
  res.status(result.status).json(result.body ?? {});
}
