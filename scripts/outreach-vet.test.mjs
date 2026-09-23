import { test } from "node:test";
import assert from "node:assert/strict";
import { draftFromMarkdown, vetTask } from "./outreach-vet.mjs";

const allowances = { sites: { "lake-charles-fences": { allow: ["credential"] } } };
const base = { site: "twin-city-fences", kind: "backlink", target: "Chamber", url: "https://example.test/", copy_block: "Hello", why: "", steps: [] };

test("passes a clean task", () => {
  assert.deepEqual(vetTask(base, allowances), { ok: true });
});

test("drops a leftover [placeholder]", () => {
  const r = vetTask({ ...base, copy_block: "I am interested in [membership / a listing]." }, allowances);
  assert.equal(r.ok, false);
  assert.match(r.reason, /placeholder/);
});

test("drops a banned claim for a site without that allowance", () => {
  const r = vetTask({ ...base, copy_block: "We are licensed and insured." }, allowances);
  assert.equal(r.ok, false);
  assert.match(r.reason, /licen/);
});

test("allowances are per site, never inherited", () => {
  assert.deepEqual(vetTask({ ...base, site: "lake-charles-fences", copy_block: "We are licensed." }, allowances), { ok: true });
});

test("checks steps and why too, not only the draft", () => {
  assert.equal(vetTask({ ...base, why: "Over 20 years of experience in town." }, allowances).ok, false);
});

test("never allows a password into a task", () => {
  assert.equal(vetTask({ ...base, account_note: "login: x / password: hunter2" }, allowances).ok, false);
});

test("drops martins and seacoast outright", () => {
  assert.equal(vetTask({ ...base, site: "martins-trash-removal-demolition" }, allowances).ok, false);
  assert.equal(vetTask({ ...base, site: "seacoast-hurricane-shutters" }, allowances).ok, false);
});

test("extracts the email between the rules and fills the known placeholder", () => {
  const md = "# X\n\nintro\n\n---\n\nSubject: Hi\n\nI am interested in [membership / a listing] and wanted to ask.\n\n[ONE specific sentence about why this organisation in particular — if you cannot\nwrite one that is true, this is probably the wrong prospect.]\n\nThanks\n\n---\n\n*footer*";
  assert.equal(draftFromMarkdown(md), "Subject: Hi\n\nI am interested in membership and a directory listing and wanted to ask.\n\nThanks");
});
