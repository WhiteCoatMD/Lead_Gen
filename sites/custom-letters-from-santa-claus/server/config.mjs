import { readFileSync } from "node:fs";

// Owner decisions for the 2026 season. site.json is checked against these in
// tests. Runtime reads site.json so checkout.enabled and the postmark flag
// can be flipped without a code change.
export const DECISIONS = {
  prices: {
    "personalized-letter": 15.95,
    "email-from-santa": 6.95,
    "sibling-bundle": 28.95,
  },
  bundle: { min: 2, max: 5 },
  postmark: { single: 9.95, household: 14.95 },
  ordering: {
    timezone: "America/Chicago",
    printed: { year: 2026, month: 12, day: 9, hour: 17, minute: 0 },
    emailThrough: "2026-12-24",
    postmark: { year: 2026, month: 11, day: 26, hour: 17, minute: 0 },
  },
};

export const SANTA_PROJECT_ID = "prj_Cooa6zu0wXv87rdhtKX7M4nj5gVG";
export const SANTA_SCHEMA = "santa";
export const FROM_ADDRESS = "santa@customlettersfromsantaclaus.com";
export const DEFAULT_MODEL = "google/gemini-3.8-flash";
export const RETENTION_DAYS = 60;
export const UNPAID_RETENTION_DAYS = 7;

// site.json turns checkout on for every environment. CHECKOUT_ENABLED=true
// turns it on for preview and local only. Production ignores that override.
export function checkoutOpen(site = loadSite(), env = {}) {
  if (site?.checkout?.enabled === true) return true;
  return env?.CHECKOUT_ENABLED === "true" && env?.VERCEL_ENV !== "production";
}

let cached;

export function loadSite() {
  if (!cached) {
    cached = JSON.parse(readFileSync(new URL("../site.json", import.meta.url), "utf8"));
  }
  return cached;
}

export function checkoutEnabled(site = loadSite()) {
  return site?.checkout?.enabled === true;
}

export function postmarkEnabled(site = loadSite()) {
  return site?.postmarkUpgrade?.enabled === true;
}

export function orderingOf(site = loadSite()) {
  return site?.ordering || DECISIONS.ordering;
}
