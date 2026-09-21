// Service-account auth for Google APIs, with no dependency.
//
// This repo has zero dependencies and is better for it, so rather than pull in
// googleapis (and its tree) for one token exchange, this signs the JWT with
// node:crypto directly. It is about thirty lines and the flow has not changed
// in a decade.
//
// A service account is the right shape here over a user OAuth flow: there is
// no consent screen, no refresh token to babysit, and no browser needed on a
// machine running a scheduled job. Access is granted by adding the account's
// email as a user on the Search Console property, which is revocable from the
// same screen.
//
// THE KEY FILE NEVER ENTERS THE REPOSITORY. Point GSC_KEY_FILE at it. The
// repo's .gitignore already covers *.token and .env, but the surest protection
// is that the file lives somewhere else entirely.

import fs from "node:fs/promises";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

const b64 = (value) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

/** Where the service-account JSON lives. Never inside the repo. */
export function keyFilePath() {
  return process.env.GSC_KEY_FILE || path.join(os.homedir(), ".lead-gen-gsc-key.json");
}

/**
 * Exchange a service-account key for an access token.
 *
 * Errors are deliberately passed through rather than summarised: Google's
 * messages here are unusually good and say precisely what is wrong -- API not
 * enabled, clock skew, wrong scope -- and each has a different fix.
 */
export async function getAccessToken(scope, keyPath = keyFilePath()) {
  let sa;
  try {
    sa = JSON.parse(await fs.readFile(keyPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read the service-account key at ${keyPath}.\n` +
        `Set GSC_KEY_FILE to its location, or place the JSON there.\n(${error.code || error.message})`
    );
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error(`${keyPath} is not a service-account key (no client_email / private_key).`);
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    `${b64({ alg: "RS256", typ: "JWT" })}.` +
    b64({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(body)}`);
  return { token: body.access_token, clientEmail: sa.client_email, projectId: sa.project_id };
}

/** A fetch that carries the token and surfaces Google's own error text. */
export async function googleFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const message = parsed?.error?.message || text.slice(0, 300);
    const err = new Error(message);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}
