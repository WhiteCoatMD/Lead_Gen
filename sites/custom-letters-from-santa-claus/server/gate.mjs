import { SANTA_PROJECT_ID } from "./config.mjs";

// The repo-root vercel.json is shared by every site project. Crons and these
// routes deploy with all of them. Work runs only on the Santa project.

export function santaDeployment(env = process.env) {
  if (env?.SANTA_ORDERS_ENABLED === "true") return true;
  if (env?.VERCEL_PROJECT_ID) return env.VERCEL_PROJECT_ID === SANTA_PROJECT_ID;
  return false;
}

export function denyUnlessSanta(env, { cron = false } = {}) {
  if (santaDeployment(env)) return null;
  if (cron) return { status: 200, body: { ok: true, skipped: true } };
  return { status: 404, body: { error: "Not found" } };
}

export function cronAuthorized(request, env) {
  const secret = String(env?.CRON_SECRET || "");
  if (!secret) return !env?.VERCEL;
  const header = request?.headers?.authorization || request?.headers?.Authorization || "";
  return header === `Bearer ${secret}`;
}
