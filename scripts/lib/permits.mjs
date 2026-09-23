// Permit guides are only worth linking to if they are right, and only right if
// every fact can be traced to the official text and has been looked at
// recently. This is the check that enforces both; the offline checklist fails
// the owning site on any problem, the Monday audit warns before facts go stale.

import fs from "node:fs/promises";
import path from "node:path";

export const MAX_AGE_DAYS = 365;
export const DUE_SOON_DAYS = 335;
const REQUIRED_TOPICS = { permit: "whether a permit is needed", digging: "calling Louisiana 811 before digging" };
// Government facts, but published on a business's site: the same words the
// claims check refuses there are refused here, so a guide cannot fail it.
const BANNED = [
  [/\$\s?\d/, "a dollar figure ($) — say fees are set by the office instead"],
  [/\blicensed\b/i, "the word 'licensed'"],
  [/\binsured\b/i, "the word 'insured'"],
  [/\bbonded\b/i, "the word 'bonded'"],
  [/\bcertified\b/i, "the word 'certified'"],
];

export async function loadPermit(root, id) {
  return JSON.parse(await fs.readFile(path.join(root, "deploy", "permits", `${id}.json`), "utf8"));
}

const ageDays = (iso, today) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return NaN;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? NaN : Math.floor((today.getTime() - t) / 86400000);
};

function checkDate(label, iso, today, problems) {
  const age = ageDays(iso, today);
  if (Number.isNaN(age)) problems.push(`${label}: "checked" must be a date like 2026-09-23`);
  else if (age < 0) problems.push(`${label}: "checked" is in the future`);
  else if (age > MAX_AGE_DAYS) problems.push(`${label}: last checked ${age} days ago — re-check it against the source (limit ${MAX_AGE_DAYS})`);
}

export function validatePermit(data, today = new Date()) {
  const problems = [];
  if (!data?.name) problems.push("guide has no jurisdiction name");
  const office = data?.office || {};
  for (const key of ["name", "sourceUrl"]) if (!office[key]) problems.push(`office is missing "${key}"`);
  if (!office.phone && !office.url) problems.push("office needs a phone number or an official web page");
  // These become hrefs on a live page, so anything but http(s) is refused.
  for (const key of ["url", "sourceUrl"]) {
    if (office[key] && !/^https?:\/\//i.test(office[key])) problems.push(`office ${key} must be an http(s) link`);
  }
  if (office.sourceUrl) checkDate("office", office.checked, today, problems);
  const facts = Array.isArray(data?.facts) ? data.facts : [];
  if (!facts.length) problems.push("guide has no facts");
  facts.forEach((f, i) => {
    const label = `fact ${i + 1} (${f.question || "no question"})`;
    for (const key of ["topic", "question", "answer", "sourceUrl", "sourceTitle"]) {
      if (!f[key]) problems.push(`${label}: missing ${key === "sourceUrl" || key === "sourceTitle" ? "source " + key.slice(6).toLowerCase() : key}`);
    }
    if (f.sourceUrl && !/^https?:\/\//.test(f.sourceUrl)) problems.push(`${label}: source must be an http(s) link`);
    checkDate(label, f.checked, today, problems);
    for (const [re, what] of BANNED) if (re.test(`${f.question} ${f.answer}`)) problems.push(`${label}: contains ${what}`);
  });
  for (const [topic, what] of Object.entries(REQUIRED_TOPICS)) {
    if (!facts.some((f) => f.topic === topic)) problems.push(`guide must answer ${what} (a "${topic}" fact)`);
  }
  return problems;
}

export function oldestCheckedDays(data, today = new Date()) {
  const ages = (data?.facts || []).map((f) => ageDays(f.checked, today)).filter((n) => !Number.isNaN(n));
  return ages.length ? Math.max(...ages) : Infinity;
}
