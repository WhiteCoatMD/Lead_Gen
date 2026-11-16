import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const DAY_MS = 12 * 60 * 60 * 1000;

export function passwordMatches(input, expected) {
  const a = createHash("sha256").update(String(input ?? "")).digest();
  const b = createHash("sha256").update(String(expected ?? "")).digest();
  return Boolean(expected) && timingSafeEqual(a, b);
}

export function signSession(password, exp) {
  const payload = `v1.${exp}`;
  const sig = createHmac("sha256", String(password)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(token, password, now = Date.now()) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const expected = signSession(password, parts[1]);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sessionCookie(password, { now = Date.now(), secure = true } = {}) {
  const exp = now + DAY_MS;
  const token = signSession(password, exp);
  const flags = ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=43200"];
  if (secure) flags.push("Secure");
  return `santa_admin=${token}; ${flags.join("; ")}`;
}

export function clearCookie(secure = true) {
  const flags = ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) flags.push("Secure");
  return `santa_admin=; ${flags.join("; ")}`;
}

export function cookieToken(header) {
  const parts = String(header || "").split(/;\s*/);
  for (const part of parts) {
    if (part.startsWith("santa_admin=")) return decodeURIComponent(part.slice("santa_admin=".length));
  }
  return "";
}
