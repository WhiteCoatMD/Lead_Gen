# Fence Linkable Assets (Pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fence materials calculator and seven sourced fence-permit guides on the two fence sites, built as reusable page types in the shared site builder, measurable in the existing lead report.

**Architecture:** A pure, dependency-free formula module (`shared/fence-calc.mjs`) runs in Node tests and, copied into each site's `dist/`, in the browser via a small UI module. Permit facts live as sourced JSON under `deploy/permits/`, validated by `scripts/lib/permits.mjs` in the offline checklist and listed by the Monday audit when a re-check is due. `renderPage` gains two page types and — so the pilot can be measured at all — the analytics beacon and lead form on every secondary page, which it currently omits.

**Tech Stack:** Node 22/24 ESM, zero npm dependencies, `node --test`, static HTML per site, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-23-fence-linkable-assets-design.md`

## Global Constraints

- Repo: `C:\Users\13183\Lead_Gen\lead-gen-monorepo` (`WhiteCoatMD/Lead_Gen`). Zero npm dependencies. Tests run with `npm run test:scripts`.
- A push to `main` redeploys all 28 sites: commit per task, push only in Task 6.
- **No prices, labour times, arrival times, credentials, warranties or other claims** on any page. `npm run claims` must stay at 0 findings. This includes permit *fees* (no `$` figures) and the words licensed / insured / bonded / certified — phrase around them.
- Every permit fact has `sourceUrl`, `sourceTitle` and `checked`. No official source → the page says it is not published online and gives the permit office's contact. Never guess.
- Calculator output is labelled "standard rules of thumb — confirm quantities with your supplier". It is a materials estimate only.
- Only `twin-city-fences` and `lake-charles-fences` get the new pages. Martins and SeaCoast are untouched.
- Commit messages: subject, blank line, `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (use `git commit -F` or a heredoc).

## Review Focus

1. **Bad calculator input** — blank, zero, negative, text, a gate wider than the fence, 50 corners on a 10 ft run → one plain sentence, never `NaN`, a negative count or a blank result. Pinned in Task 1.
2. **A very short run** (shorter than one post spacing) → one section, two end posts, zero line posts, sensible pickets — not zero sections. Pinned in Task 1.
3. **A permit answer containing a fee or "licensed"** → caught before publish by the claims check. Pinned in Task 5 (validator rejects `$` and banned words in answers) and Task 6 (`npm run claims`).
4. **A stale or unsourced permit fact** → that site fails the checklist; other sites still build and deploy. Pinned in Task 2.
5. **JavaScript off / slow** → the calculator page still shows the formulas and a worked example with real numbers. Pinned in Task 3 (rendered HTML contains the worked example).

---

### Task 1: Fence materials formulas

**Files:**
- Create: `shared/fence-calc.mjs`
- Test: `shared/fence-calc.test.mjs`
- Modify: `package.json` (`test:scripts` glob)

**Interfaces:**
- Produces: `fenceMaterials(input) → { ok: false, error: string } | { ok: true, type, lines: { item: string, qty: number, unit: string, working: string }[], notes: string[] }` where `input = { type: "wood" | "chain", length: number, height: number, corners: number, gates: number[], spacing?: number, picketWidth?: number, picketGap?: number, bag?: 50 | 60 | 80 }`. Also `EXAMPLE_INPUT` (the worked example shown with JavaScript off).

- [ ] **Step 1: Point the test script at `shared/` too**

In `package.json`, change `"test:scripts": "node --test scripts/**/*.test.mjs"` to:
```json
"test:scripts": "node --test scripts/**/*.test.mjs shared/**/*.test.mjs"
```

- [ ] **Step 2: Write the failing tests**

`shared/fence-calc.test.mjs` (reference numbers were computed and hand-checked):
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fenceMaterials, EXAMPLE_INPUT } from "./fence-calc.mjs";

const qty = (r, item) => {
  const line = r.lines.find((l) => l.item.startsWith(item));
  assert.ok(line, `no line starting "${item}" in ${r.lines.map((l) => l.item).join(" | ")}`);
  return line.qty;
};

test("wood privacy: 100 ft, 6 ft high, 2 corners, one 4 ft gate", () => {
  const r = fenceMaterials({ type: "wood", length: 100, height: 6, corners: 2, gates: [4] });
  assert.equal(r.ok, true);
  assert.equal(qty(r, "End, corner and gate posts"), 6);
  assert.equal(qty(r, "Line posts"), 8);
  assert.equal(qty(r, "Post length"), 8);
  assert.equal(qty(r, "Rails"), 36);
  assert.equal(qty(r, "Pickets"), 219);
  assert.equal(qty(r, "Concrete"), 42);
});

test("wood privacy 8 ft high needs 3 rails a section and 12 ft posts", () => {
  const r = fenceMaterials({ type: "wood", length: 16, height: 8, corners: 0, gates: [] });
  assert.equal(qty(r, "Rails"), 6);
  assert.equal(qty(r, "Post length"), 12);
});

test("wood privacy 4 ft high uses 2 rails a section", () => {
  const r = fenceMaterials({ type: "wood", length: 16, height: 4, corners: 0, gates: [] });
  assert.equal(qty(r, "Rails"), 4);
});

test("chain-link: 100 ft, 4 ft high, straight, no gates", () => {
  const r = fenceMaterials({ type: "chain", length: 100, height: 4, corners: 0, gates: [] });
  assert.equal(r.ok, true);
  assert.equal(qty(r, "Terminal posts"), 2);
  assert.equal(qty(r, "Line posts"), 9);
  assert.equal(qty(r, "Top rail"), 5);
  assert.equal(qty(r, "Fabric"), 2);
  assert.equal(qty(r, "Tension bars"), 2);
  assert.equal(qty(r, "Tension bands"), 6);
  assert.equal(qty(r, "Brace bands"), 2);
  assert.equal(qty(r, "Terminal post caps"), 2);
  assert.equal(qty(r, "Line post loop caps"), 9);
  assert.equal(qty(r, "Fence ties"), 86);
  assert.equal(qty(r, "Concrete"), 13);
});

test("a run shorter than one spacing is one section with no line posts", () => {
  const r = fenceMaterials({ type: "wood", length: 5, height: 6, corners: 0, gates: [] });
  assert.equal(qty(r, "Line posts"), 0);
  assert.equal(qty(r, "End, corner and gate posts"), 2);
  assert.equal(qty(r, "Pickets"), 11);
});

test("every quantity is a non-negative whole number and every line explains itself", () => {
  for (const input of [
    { type: "wood", length: 237.5, height: 5, corners: 3, gates: [3.5, 10], spacing: 6, picketWidth: 3.5, picketGap: 0.5, bag: 80 },
    { type: "chain", length: 333, height: 6, corners: 4, gates: [4, 12], bag: 50 },
    EXAMPLE_INPUT,
  ]) {
    const r = fenceMaterials(input);
    assert.equal(r.ok, true, JSON.stringify(r));
    for (const l of r.lines) {
      assert.ok(Number.isInteger(l.qty) && l.qty >= 0, `${l.item}: ${l.qty}`);
      assert.ok(l.working.length > 10, `${l.item} has no working`);
    }
    assert.ok(r.notes.some((n) => /confirm quantities with your supplier/i.test(n)));
  }
});

test("bad input gets one plain sentence, never NaN", () => {
  const cases = [
    [{ type: "vinyl", length: 100, height: 6, corners: 0, gates: [] }, /wood privacy or chain-link/],
    [{ type: "wood", length: 0, height: 6, corners: 0, gates: [] }, /length of the fence/],
    [{ type: "wood", length: -5, height: 6, corners: 0, gates: [] }, /length of the fence/],
    [{ type: "wood", length: "abc", height: 6, corners: 0, gates: [] }, /length of the fence/],
    [{ type: "wood", length: 6000, height: 6, corners: 0, gates: [] }, /5,000 ft/],
    [{ type: "wood", length: 100, height: 7, corners: 0, gates: [] }, /4, 5, 6 or 8 ft/],
    [{ type: "wood", length: 100, height: 6, corners: -1, gates: [] }, /corners/],
    [{ type: "wood", length: 100, height: 6, corners: 1.5, gates: [] }, /corners/],
    [{ type: "wood", length: 10, height: 6, corners: 50, gates: [] }, /corners/],
    [{ type: "wood", length: 100, height: 6, corners: 0, gates: [0] }, /gate width/],
    [{ type: "wood", length: 100, height: 6, corners: 0, gates: [25] }, /gate width/],
    [{ type: "wood", length: 10, height: 6, corners: 0, gates: [6, 6] }, /gates add up to more than the fence/],
    [{ type: "wood", length: 100, height: 6, corners: 0, gates: [], spacing: 20 }, /post spacing/i],
    [{ type: "wood", length: 100, height: 6, corners: 0, gates: [], bag: 70 }, /50, 60 or 80 lb/],
  ];
  for (const [input, message] of cases) {
    const r = fenceMaterials(input);
    assert.equal(r.ok, false, `${JSON.stringify(input)} was accepted`);
    assert.match(r.error, message);
    assert.doesNotMatch(r.error, /NaN|undefined/);
  }
});
```

- [ ] **Step 3: Run to confirm it fails**

Run: `node --test shared/fence-calc.test.mjs`
Expected: FAIL — `Cannot find module ... fence-calc.mjs`.

- [ ] **Step 4: Implement `shared/fence-calc.mjs`**

```js
// Fence materials estimate: posts, rails, pickets, fabric, hardware, concrete.
//
// Pure and dependency-free on purpose: the same file runs in node --test and,
// copied into dist/<site>/, in the visitor's browser. No prices, no labour —
// quantities only, with the arithmetic shown so a homeowner can check it and a
// blogger can trust it.
//
// Model: the fence (minus gate openings) is spread evenly across straight
// stretches separated by corners and gates. Ends, corners and both sides of
// each gate get a terminal post; each stretch is cut into sections no longer
// than the post spacing, with a line post between sections.

export const BAG_YIELD_CUFT = { 50: 0.375, 60: 0.45, 80: 0.6 };
const POST_LENGTHS_FT = [8, 10, 12, 14, 16];
const HEIGHTS = [4, 5, 6, 8];
const MAX_LENGTH = 5000;

export const EXAMPLE_INPUT = { type: "wood", length: 100, height: 6, corners: 2, gates: [4] };

const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const one = (n) => Number(n.toFixed(1));
const fail = (error) => ({ ok: false, error });

function holeBags(diaIn, depthIn, postAreaIn2, bag) {
  const cuft = (Math.PI * (diaIn / 2) ** 2 * depthIn - postAreaIn2 * depthIn) / 1728;
  return { cuft, bags: Math.ceil(cuft / BAG_YIELD_CUFT[bag]) };
}

export function fenceMaterials(input) {
  const type = input?.type;
  if (type !== "wood" && type !== "chain") return fail("Choose wood privacy or chain-link.");
  const length = num(input.length);
  if (!Number.isFinite(length) || length <= 0) return fail("Enter the length of the fence in feet.");
  if (length > MAX_LENGTH) return fail("This calculator handles up to 5,000 ft of fence. For longer runs, give us a call.");
  const height = num(input.height);
  if (!HEIGHTS.includes(height)) return fail("Choose a height of 4, 5, 6 or 8 ft.");
  const corners = num(input.corners ?? 0);
  if (!Number.isInteger(corners) || corners < 0 || corners > 40 || corners > length / 2) {
    return fail("Enter the number of corners as a whole number, no more than one for every 2 ft of fence.");
  }
  const gates = (input.gates ?? []).map(num);
  if (gates.some((w) => !Number.isFinite(w) || w < 1 || w > 20)) return fail("Each gate width must be between 1 and 20 ft.");
  const gateTotal = gates.reduce((a, b) => a + b, 0);
  if (gateTotal >= length) return fail("The gates add up to more than the fence. Check the length and the gate widths.");
  const spacing = num(input.spacing ?? (type === "wood" ? 8 : 10));
  if (!Number.isFinite(spacing) || spacing < 4 || spacing > 12) return fail("Post spacing must be between 4 and 12 ft.");
  const bag = num(input.bag ?? 60);
  if (!BAG_YIELD_CUFT[bag]) return fail("Choose a concrete bag size of 50, 60 or 80 lb.");

  const fence = length - gateTotal;
  const stretches = 1 + corners + gates.length;
  const stretch = fence / stretches;
  const perStretch = Math.ceil(stretch / spacing);
  const sections = stretches * perStretch;
  const linePosts = stretches * (perStretch - 1);
  const terminal = 2 + corners + 2 * gates.length;
  const depthIn = Math.max(24, Math.ceil((height * 12) / 3));
  const spread =
    `${one(fence)} ft of fence (${one(length)} ft minus ${one(gateTotal)} ft of gates) over ` +
    `${stretches} straight stretch${stretches === 1 ? "" : "es"} ≈ ${one(stretch)} ft each`;
  const terminalWorking = `2 ends + ${corners} corner${corners === 1 ? "" : "s"} + 2 per gate × ${gates.length} gate${gates.length === 1 ? "" : "s"}`;
  const notes = [
    "These are standard rules of thumb for estimating materials. Confirm quantities with your supplier before you buy.",
    `Assumes the fence is spread evenly across ${stretches} straight stretch${stretches === 1 ? "" : "es"}; very uneven stretches can need an extra post or two.`,
  ];

  if (type === "wood") {
    const neededIn = height * 12 + depthIn;
    const postFt = POST_LENGTHS_FT.find((ft) => ft * 12 >= neededIn) ?? POST_LENGTHS_FT.at(-1);
    const railsPer = height > 5 ? 3 : 2;
    const picketWidth = num(input.picketWidth ?? 5.5);
    const picketGap = num(input.picketGap ?? 0);
    if (!Number.isFinite(picketWidth) || picketWidth < 2 || picketWidth > 12) return fail("Picket width must be between 2 and 12 in.");
    if (!Number.isFinite(picketGap) || picketGap < 0 || picketGap > 3) return fail("The gap between pickets must be between 0 and 3 in.");
    const pitch = picketWidth + picketGap;
    const fencePickets = Math.ceil((fence * 12) / pitch);
    const gatePickets = gates.reduce((sum, w) => sum + Math.ceil((w * 12) / pitch), 0);
    const posts = terminal + linePosts;
    const perPost = holeBags(10, depthIn, 3.5 * 3.5, bag);
    return {
      ok: true, type, notes,
      lines: [
        { item: "End, corner and gate posts (4x4)", qty: terminal, unit: "posts", working: terminalWorking },
        { item: "Line posts (4x4)", qty: linePosts, unit: "posts", working: `${spread} → ${perStretch} section${perStretch === 1 ? "" : "s"} of up to ${spacing} ft per stretch → ${perStretch - 1} line post${perStretch - 1 === 1 ? "" : "s"} per stretch` },
        { item: "Post length", qty: postFt, unit: "ft each", working: `${height} ft above ground + ${depthIn} in in the ground (a third of the height, at least 24 in) = ${neededIn} in → next standard length` },
        { item: `Rails (at least ${spacing} ft long)`, qty: sections * railsPer, unit: "rails", working: `${sections} sections × ${railsPer} rails (${railsPer === 3 ? "3 for fences over 5 ft" : "2 for fences up to 5 ft"})` },
        { item: `Pickets (${picketWidth} in wide)`, qty: fencePickets + gatePickets, unit: "pickets", working: `${one(fence)} ft × 12 ÷ ${pitch} in per picket = ${fencePickets}, plus ${gatePickets} for the gate${gates.length === 1 ? "" : "s"}` },
        { item: `Concrete (${bag} lb bags)`, qty: posts * perPost.bags, unit: "bags", working: `10 in hole × ${depthIn} in deep ≈ ${perPost.cuft.toFixed(2)} cu ft per post → ${perPost.bags} bag${perPost.bags === 1 ? "" : "s"} each × ${posts} posts` },
      ],
    };
  }

  const tensionBars = 2 + 2 * corners + 2 * gates.length;
  const termBags = holeBags(8, depthIn, Math.PI * 1.1875 ** 2, bag);
  const lineBags = holeBags(6, depthIn, Math.PI * 0.8125 ** 2, bag);
  return {
    ok: true, type, notes,
    lines: [
      { item: "Terminal posts (2-3/8 in)", qty: terminal, unit: "posts", working: terminalWorking },
      { item: "Line posts (1-5/8 in)", qty: linePosts, unit: "posts", working: `${spread} → ${perStretch} section${perStretch === 1 ? "" : "s"} of up to ${spacing} ft per stretch → ${perStretch - 1} line post${perStretch - 1 === 1 ? "" : "s"} per stretch` },
      { item: "Top rail (21 ft lengths)", qty: Math.ceil(fence / 21), unit: "lengths", working: `${one(fence)} ft ÷ 21 ft, rounded up` },
      { item: `Fabric (50 ft rolls, ${height} ft high)`, qty: Math.ceil(fence / 50), unit: "rolls", working: `${one(fence)} ft ÷ 50 ft, rounded up` },
      { item: "Tension bars", qty: tensionBars, unit: "bars", working: "1 per end, 2 per corner, 1 per gate post" },
      { item: "Tension bands", qty: tensionBars * (height - 1), unit: "bands", working: `${tensionBars} tension bars × ${height - 1} (one per foot of height, less one)` },
      { item: "Brace bands", qty: tensionBars, unit: "bands", working: "1 per tension bar, for the top rail" },
      { item: "Terminal post caps", qty: terminal, unit: "caps", working: "1 per terminal post" },
      { item: "Line post loop caps", qty: linePosts, unit: "caps", working: "1 per line post" },
      { item: "Fence ties", qty: linePosts * height + Math.ceil(fence / 2), unit: "ties", working: `${height} per line post + 1 every 2 ft of top rail` },
      { item: `Concrete (${bag} lb bags)`, qty: terminal * termBags.bags + linePosts * lineBags.bags, unit: "bags", working: `terminal posts: 8 in hole ≈ ${termBags.cuft.toFixed(2)} cu ft → ${termBags.bags} each; line posts: 6 in hole ≈ ${lineBags.cuft.toFixed(2)} cu ft → ${lineBags.bags} each; ${depthIn} in deep` },
    ],
  };
}
```

- [ ] **Step 5: Run to confirm it passes**

Run: `npm run test:scripts`
Expected: all pass (existing 9 + the new file's 7).

- [ ] **Step 6: Commit**

```bash
git add shared/fence-calc.mjs shared/fence-calc.test.mjs package.json
git commit -F- <<'EOF'
Fence calculator formulas: quantities only, working shown, plain errors

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Permit data validation, checklist and Monday warning

**Files:**
- Create: `scripts/lib/permits.mjs`, `scripts/lib/permits.test.mjs`
- Modify: `scripts/audit.mjs` (per-site permit checks), `scripts/audit-portfolio.mjs` (due-soon list)

**Interfaces:**
- Produces:
  - `loadPermit(root: string, id: string) → Promise<object>` (reads `deploy/permits/<id>.json`)
  - `validatePermit(data, today = new Date()) → string[]` (problems; empty = valid)
  - `oldestCheckedDays(data, today = new Date()) → number`
  - `MAX_AGE_DAYS = 365`, `DUE_SOON_DAYS = 335`
- Data shape every later task writes:
```json
{
  "id": "monroe-la",
  "name": "City of Monroe",
  "office": { "name": "", "phone": "", "address": "", "url": "", "sourceUrl": "", "checked": "YYYY-MM-DD" },
  "facts": [
    { "topic": "permit|height|setback|corner|pool|materials|digging|other",
      "question": "", "answer": "", "sourceUrl": "https://…", "sourceTitle": "", "checked": "YYYY-MM-DD" }
  ]
}
```

- [ ] **Step 1: Write the failing tests** — `scripts/lib/permits.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePermit, oldestCheckedDays } from "./permits.mjs";

const today = new Date("2026-09-23T12:00:00Z");
const fact = (over = {}) => ({ topic: "permit", question: "Do I need a permit?", answer: "Yes, for any new fence.", sourceUrl: "https://library.municode.com/la/monroe", sourceTitle: "Monroe Code of Ordinances §1", checked: "2026-09-20", ...over });
const valid = () => ({
  id: "monroe-la", name: "City of Monroe",
  office: { name: "Permits office", phone: "318-555-0100", address: "400 Lea Joyner Expy, Monroe, LA", url: "https://example.gov/permits", sourceUrl: "https://example.gov/permits", checked: "2026-09-20" },
  facts: [fact(), fact({ topic: "digging", question: "Call before digging?", answer: "Yes — call Louisiana 811." })],
});

test("a complete, fresh guide has no problems", () => {
  assert.deepEqual(validatePermit(valid(), today), []);
});

test("a fact with no source is a problem", () => {
  const d = valid(); delete d.facts[0].sourceUrl;
  assert.match(validatePermit(d, today).join("\n"), /source/i);
});

test("a fact checked more than a year ago is a problem", () => {
  const d = valid(); d.facts[0].checked = "2025-09-01";
  assert.match(validatePermit(d, today).join("\n"), /re-check/i);
});

test("a date in the future or not a date is a problem", () => {
  const d = valid(); d.facts[0].checked = "2027-01-01"; d.facts[1].checked = "last week";
  assert.equal(validatePermit(d, today).length, 2);
});

test("the permit question and the 811 fact are required", () => {
  const d = valid(); d.facts = [fact({ topic: "height" })];
  const out = validatePermit(d, today).join("\n");
  assert.match(out, /permit/); assert.match(out, /811|digging/);
});

test("answers may not carry prices or credential words", () => {
  const d = valid(); d.facts[0].answer = "Yes. The fee is $50 and it must be pulled by a licensed contractor.";
  const out = validatePermit(d, today).join("\n");
  assert.match(out, /\$/); assert.match(out, /licensed/);
});

test("oldestCheckedDays reports the stalest fact", () => {
  const d = valid(); d.facts[1].checked = "2025-11-02";
  assert.equal(oldestCheckedDays(d, today), 325);
});
```

- [ ] **Step 2: Run to confirm it fails** — `node --test scripts/lib/permits.test.mjs` → FAIL, module not found.

- [ ] **Step 3: Implement `scripts/lib/permits.mjs`**:
```js
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
```

- [ ] **Step 4: Wire into the offline checklist** — in `scripts/audit.mjs`, add `import { loadPermit, validatePermit } from "./lib/permits.mjs";` beside the other imports, and add before the `// --- local-business structured data ---` comment:
```js
  // --- linkable assets ---
  // A permit guide with an unsourced or stale fact fails THIS site only;
  // other sites still build and deploy.
  for (const page of cfg.pages || []) {
    if (page.type === "fence-permit") {
      let data = null;
      try { data = await loadPermit(root, page.permit); }
      catch { check(false, `permit guide ${page.slug}: no deploy/permits/${page.permit}.json`); }
      if (data) for (const p of validatePermit(data)) check(false, `permit guide ${page.slug}: ${p}`);
    }
    if (page.type === "fence-calculator") {
      check(await fs.access(path.join(out, "fence-calc.mjs")).then(() => true, () => false), "calculator page but dist has no fence-calc.mjs");
    }
  }
```

- [ ] **Step 5: Add the Monday due-soon list** — in `scripts/audit-portfolio.mjs`, add `import { loadPermit, oldestCheckedDays, DUE_SOON_DAYS } from "./lib/permits.mjs";` and, immediately before the final `process.exit(...)`, add:
```js
// Permit guides whose oldest fact is close to the one-year limit. A warning,
// not a failure: the offline checklist fails the site once it actually lapses.
const dueSoon = [];
for (const slug of slugs) {
  const cfg = JSON.parse(await fs.readFile(path.join(root, "sites", slug, "site.json"), "utf8"));
  for (const page of cfg.pages || []) {
    if (page.type !== "fence-permit") continue;
    const days = oldestCheckedDays(await loadPermit(root, page.permit).catch(() => ({})));
    if (days >= DUE_SOON_DAYS) dueSoon.push(`${slug}/${page.slug} (oldest fact checked ${days === Infinity ? "never" : days + " days ago"})`);
  }
}
if (dueSoon.length) console.log(`\nPERMIT GUIDES DUE FOR RE-CHECK: ${dueSoon.join(", ")}`);
```

- [ ] **Step 6: Run tests and both audits** — `npm run test:scripts` → PASS; `npm run build && npm run audit` → same 6 known failures as before (no site has permit pages yet); `node scripts/audit-portfolio.mjs twin-city-fences` → runs, no due-soon line.

- [ ] **Step 7: Commit** — `git add scripts/lib/permits.mjs scripts/lib/permits.test.mjs scripts/audit.mjs scripts/audit-portfolio.mjs`, message "Permit guides: every fact sourced and checked within a year, enforced per site" + trailer.

---

### Task 3: Page types, tracking on every secondary page, and homepage links

**Files:**
- Create: `shared/render-tools.mjs`, `shared/render-tools.test.mjs`
- Modify: `shared/render-page.mjs` (signature `renderPage(site, page, slug, extras = {})`; `data-site`; lead form; analytics; tool bodies), `shared/render-site.mjs` (export `ANALYTICS_SCRIPT`; homepage permit links), `scripts/build-site.mjs` (pass slug + permit data; copy calculator modules), `shared/site.css` (styles)

**Interfaces:**
- Consumes: `fenceMaterials`, `EXAMPLE_INPUT` (Task 1); `loadPermit`, `oldestCheckedDays` (Task 2); `renderLeadForm(site, slug)`, `LEAD_FORM_SCRIPT` (existing `shared/render-form.mjs`).
- Produces: page config types `{ type: "fence-calculator" }` and `{ type: "fence-permit", permit: "<id>" }`; `renderCalculator(site) → string`; `renderPermitGuide(site, permit, links) → string` where `links = { calculator?: {slug,label}, guides: {slug,label}[] }`; `renderPermitLinks(site) → string` (homepage section or "").

- [ ] **Step 1: Write the failing tests** — `shared/render-tools.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCalculator, renderPermitGuide, renderPermitLinks } from "./render-tools.mjs";
import { renderPage } from "./render-page.mjs";

const site = {
  name: "Twin City Fence", domain: "twincityfences.com", city: "West Monroe", phone: "318-351-2539",
  serviceAreas: ["Monroe", "West Monroe"], footerLine: "Fences.", ctaHeadline: "Call", ctaCopy: "Now",
  services: [{ title: "Wood Privacy Fences" }, { title: "Chain-Link Fences" }],
  leadForm: { heading: "Tell us about the fence." },
  pages: [
    { slug: "fence-calculator", type: "fence-calculator", heading: "Fence materials calculator.", navLabel: "Fence calculator", seoTitle: "t", seoDescription: "d" },
    { slug: "fence-permit-monroe", type: "fence-permit", permit: "monroe-la", heading: "Fence permits in Monroe.", navLabel: "Monroe fence permits", seoTitle: "t", seoDescription: "d" },
  ],
};
const permit = {
  id: "monroe-la", name: "City of Monroe",
  office: { name: "Monroe Planning & Permits", phone: "318-555-0100", address: "400 Main St", url: "https://monroe.example/permits", sourceUrl: "https://monroe.example/permits", checked: "2026-09-20" },
  facts: [
    { topic: "permit", question: "Do I need a permit?", answer: "Yes <for new fences>.", sourceUrl: "https://library.municode.com/la/monroe", sourceTitle: "Monroe Code §9-1", checked: "2026-09-20" },
    { topic: "digging", question: "Call before digging?", answer: "Yes, Louisiana 811.", sourceUrl: "https://www.laonecall.com/", sourceTitle: "Louisiana 811", checked: "2026-08-02" },
  ],
};

test("calculator page works without JavaScript: formulas and a real worked example", () => {
  const html = renderCalculator(site);
  assert.match(html, /<form[^>]*id="fence-calc"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /Line posts/); assert.match(html, /\b219\b/); // pickets in the worked example
  assert.match(html, /confirm quantities with your supplier/i);
  assert.doesNotMatch(html, /\$\s?\d/);
});

test("permit guide shows every fact with its source and the oldest checked date", () => {
  const html = renderPermitGuide(site, permit, { calculator: { slug: "fence-calculator", label: "Fence calculator" }, guides: [] });
  assert.match(html, /href="https:\/\/library\.municode\.com\/la\/monroe"/);
  assert.match(html, /Monroe Code §9-1/);
  assert.match(html, /Last checked:? August 2026/);
  assert.match(html, /Yes &lt;for new fences&gt;\./); // escaped
  assert.match(html, /tel:\+13185550100/);
  assert.match(html, /not legal advice/i);
  assert.match(html, /HOA/);
  assert.match(html, /href="\/fence-calculator"/);
});

test("homepage links section lists the tools, and is empty for sites without them", () => {
  assert.match(renderPermitLinks(site), /href="\/fence-permit-monroe"/);
  assert.equal(renderPermitLinks({ ...site, pages: [] }), "");
});

test("every secondary page carries data-site, the analytics beacon and the lead form", () => {
  const html = renderPage(site, { slug: "west-monroe", heading: "Fences in West Monroe.", seoTitle: "t", seoDescription: "d" }, "twin-city-fences");
  assert.match(html, /<html[^>]*data-site="twin-city-fences"/);
  assert.match(html, /\/api\/event/);
  assert.match(html, /action="\/api\/lead"/);
});

test("the calculator page loads the calculator module; the permit page renders the guide", () => {
  const calc = renderPage(site, site.pages[0], "twin-city-fences");
  assert.match(calc, /<script type="module" src="\/fence-calc-ui\.mjs"><\/script>/);
  const guide = renderPage(site, site.pages[1], "twin-city-fences", { permit });
  assert.match(guide, /Monroe Code §9-1/);
});

test("a site with analytics turned off gets no beacon on secondary pages either", () => {
  const html = renderPage({ ...site, analytics: false }, { slug: "x", heading: "X.", seoTitle: "t", seoDescription: "d" }, "twin-city-fences");
  assert.doesNotMatch(html, /\/api\/event/);
});
```

- [ ] **Step 2: Run to confirm it fails** — `node --test shared/render-tools.test.mjs` → FAIL, module not found.

- [ ] **Step 3: Export the analytics script** — in `shared/render-site.mjs`, change `const ANALYTICS_SCRIPT = \`` to `export const ANALYTICS_SCRIPT = \``.

- [ ] **Step 4: Implement `shared/render-tools.mjs`**:
```js
import { escapeHtml as esc, phoneHref } from "./render-site.mjs";
import { fenceMaterials, EXAMPLE_INPUT } from "./fence-calc.mjs";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const monthOf = (iso) => MONTH.format(new Date(`${iso}T00:00:00Z`));
const toolPages = (site, type) => (site.pages || []).filter((p) => p.type === type);

function linesTable(result) {
  return `<table class="calc-table"><thead><tr><th>Material</th><th>Quantity</th><th>How it's worked out</th></tr></thead><tbody>${
    result.lines.map((l) => `<tr><td>${esc(l.item)}</td><td>${l.qty} ${esc(l.unit)}</td><td>${esc(l.working)}</td></tr>`).join("")
  }</tbody></table>`;
}

export function renderCalculator(site) {
  const example = fenceMaterials(EXAMPLE_INPUT);
  const guides = toolPages(site, "fence-permit");
  return `
    <section class="shell calc" id="calculator">
      <form id="fence-calc" class="calc-form" novalidate>
        <fieldset><legend>Fence type</legend>
          <label><input type="radio" name="type" value="wood" checked> Wood privacy</label>
          <label><input type="radio" name="type" value="chain"> Chain-link</label>
        </fieldset>
        <div class="field-row">
          <label>Total length (ft)<input type="number" name="length" min="1" max="5000" step="0.5" inputmode="decimal" required></label>
          <label>Height<select name="height"><option>4</option><option>5</option><option selected>6</option><option>8</option></select></label>
        </div>
        <div class="field-row">
          <label>Corners<input type="number" name="corners" min="0" step="1" value="0" inputmode="numeric"></label>
          <label>Gate widths (ft, comma-separated)<input type="text" name="gates" placeholder="e.g. 4, 10" inputmode="decimal"></label>
        </div>
        <details><summary>Advanced</summary>
          <div class="field-row">
            <label>Post spacing (ft)<input type="number" name="spacing" min="4" max="12" step="0.5" placeholder="8 wood / 10 chain-link"></label>
            <label>Picket width (in)<input type="number" name="picketWidth" min="2" max="12" step="0.25" value="5.5"></label>
            <label>Gap between pickets (in)<input type="number" name="picketGap" min="0" max="3" step="0.25" value="0"></label>
            <label>Concrete bag<select name="bag"><option>50</option><option selected>60</option><option>80</option></select></label>
          </div>
        </details>
        <button type="submit" class="button primary">Work it out</button>
        <p class="form-note" role="status" aria-live="polite"></p>
      </form>
      <div id="fence-calc-result" class="calc-result" hidden></div>
      <noscript><p>The calculator needs JavaScript. The worked example below uses the same formulas.</p></noscript>
    </section>
    <section class="shell intro">
      <div><p class="eyebrow accent">Worked example</p><h2>100 ft of 6 ft wood privacy, 2 corners, one 4 ft gate.</h2></div>
      ${linesTable(example)}
      <p class="fineprint">${example.notes.map(esc).join(" ")}</p>
    </section>
    ${guides.length ? `<section class="shell areas"><div class="areas-inner"><div><p class="eyebrow">Before you dig</p><h2>Fence permits by city.</h2></div><div class="area-list">${
      guides.map((g) => `<span><a href="/${esc(g.slug)}">${esc(g.navLabel || g.heading)}</a></span>`).join("")}</div></div></section>` : ""}`;
}

export function renderPermitGuide(site, permit, links) {
  const office = permit.office;
  const oldest = (permit.facts || []).map((f) => f.checked).sort()[0];
  return `
    <section class="shell permit">
      <p class="permit-checked">Last checked: ${esc(monthOf(oldest))}. Rules change — confirm with the office before you build.</p>
      <div class="permit-office">
        <h2>${esc(office.name)}</h2>
        ${office.address ? `<p>${esc(office.address)}</p>` : ""}
        ${office.phone ? `<p><a href="${phoneHref(office.phone)}">${esc(office.phone)}</a></p>` : ""}
        ${office.url ? `<p><a href="${esc(office.url)}" rel="noopener">Official permit page</a></p>` : ""}
      </div>
      ${(permit.facts || []).map((f) => `
      <article class="permit-fact">
        <h3>${esc(f.question)}</h3>
        <p>${esc(f.answer)}</p>
        <p class="source">Source: <a href="${esc(f.sourceUrl)}" rel="noopener">${esc(f.sourceTitle)}</a> · checked ${esc(monthOf(f.checked))}</p>
      </article>`).join("")}
      <p class="fineprint">If you live in a neighbourhood with an HOA, its rules can be stricter than ${esc(permit.name)}'s. This page is a plain-language summary of public rules, not legal advice.</p>
      <p>${links.calculator ? `<a href="/${esc(links.calculator.slug)}">Work out the materials with our ${esc(links.calculator.label)}</a>` : ""}${
        links.guides.length ? ` · Other areas: ${links.guides.map((g) => `<a href="/${esc(g.slug)}">${esc(g.label)}</a>`).join(", ")}` : ""}</p>
    </section>`;
}

export function renderPermitLinks(site) {
  const pages = [...toolPages(site, "fence-calculator"), ...toolPages(site, "fence-permit")];
  if (!pages.length) return "";
  return `<section class="shell areas"><div class="areas-inner"><div><p class="eyebrow">Planning a fence?</p><h2>Materials and permits.</h2></div><div class="area-list">${
    pages.map((p) => `<span><a href="/${esc(p.slug)}">${esc(p.navLabel || p.heading)}</a></span>`).join("")}</div></div></section>`;
}
```

- [ ] **Step 5: Update `shared/render-page.mjs`**
  - Imports: add `import { ANALYTICS_SCRIPT } from "./render-site.mjs";` (merge into the existing import from `./render-site.mjs`), `import { renderLeadForm, LEAD_FORM_SCRIPT } from "./render-form.mjs";`, `import { renderCalculator, renderPermitGuide } from "./render-tools.mjs";`.
  - Signature: `export function renderPage(site, page, slug = "", extras = {}) {`
  - Before the `return`, add:
```js
  const guidePages = (site.pages || []).filter((p) => p.type === "fence-permit" && p.slug !== page.slug);
  const calcPage = (site.pages || []).find((p) => p.type === "fence-calculator");
  const tool =
    page.type === "fence-calculator" ? renderCalculator(site)
    : page.type === "fence-permit" && extras.permit ? renderPermitGuide(site, extras.permit, {
        calculator: calcPage ? { slug: calcPage.slug, label: calcPage.navLabel || "fence calculator" } : undefined,
        guides: guidePages.map((g) => ({ slug: g.slug, label: g.navLabel || g.heading })),
      })
    : "";
```
  - In the template: `<html lang="en">` → `<html lang="en" data-site="${esc(slug)}">`; insert `${tool}` immediately before `${sections}`; insert `${renderLeadForm(site, slug)}` immediately before the contact `<section class="shell contact">` expression; replace `<script src="/site.js" defer></script>` with:
```js
<script src="/site.js" defer></script>${site.leadForm ? `<script>${LEAD_FORM_SCRIPT}</script>` : ""}${site.analytics === false ? "" : `<script>${ANALYTICS_SCRIPT}</script>`}${page.type === "fence-calculator" ? `<script type="module" src="/fence-calc-ui.mjs"></script>` : ""}
```
  - Update the file's header comment with one paragraph: secondary pages now carry the beacon and form because a page that is not measured cannot be judged (2026-09-23).

- [ ] **Step 6: Homepage links** — in `shared/render-site.mjs`, `import { renderPermitLinks } from "./render-tools.mjs";` and insert `${renderPermitLinks(site)}` immediately before `<section class="areas" id="areas">` (line ~176). (render-tools imports render-site; ES modules handle the cycle because both only use each other's exports at call time — if Node reports a TDZ error, move `renderPermitLinks` into render-site.mjs instead and import it from there in render-tools.)

- [ ] **Step 7: Build wiring** — in `scripts/build-site.mjs`: add `import { loadPermit } from "./lib/permits.mjs";`; in the pages loop, replace `const html = renderPage(config, page);` with:
```js
  const extras = page.type === "fence-permit" ? { permit: await loadPermit(root, page.permit) } : {};
  const html = renderPage(config, page, slug, extras);
```
and after the loop add:
```js
// The calculator runs in the browser from the same module the tests exercise.
if (pages.some((page) => page.type === "fence-calculator")) {
  for (const file of ["fence-calc.mjs", "fence-calc-ui.mjs"]) {
    await fs.copyFile(path.join(root, "shared", file), path.join(outputDir, file));
  }
}
```

- [ ] **Step 8: Styles** — append to `shared/site.css`:
```css
/* ---- linkable assets: calculator + permit guides ---- */
.calc-form{display:grid;gap:12px;max-width:760px}
.calc-form fieldset{border:0;display:flex;gap:16px;flex-wrap:wrap}
.calc-form .field-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.calc-form label{display:grid;gap:4px;font-weight:600}
.calc-form input,.calc-form select{font:inherit;padding:8px;border:1px solid #cfd6de;border-radius:6px}
.calc-result{margin-top:16px}
.calc-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:.95rem}
.calc-table th,.calc-table td{text-align:left;padding:8px;border-bottom:1px solid #e3e7ec;vertical-align:top}
.calc-table td:nth-child(2){white-space:nowrap;font-weight:700}
.permit-checked{font-weight:600}
.permit-office{border:1px solid #e3e7ec;border-radius:8px;padding:12px 16px;margin:12px 0}
.permit-fact{padding:12px 0;border-bottom:1px solid #e3e7ec}
.permit-fact .source{font-size:.85rem;opacity:.8}
@media print{header,footer,.topbar,.mobile-call,.leadform,.contact,.calc-form{display:none}}
```

- [ ] **Step 9: Stub the UI module so builds copy a real file** — create `shared/fence-calc-ui.mjs` containing only `// Implemented in Task 4.\nexport {};` (Task 4 replaces it).

- [ ] **Step 10: Run** — `npm run test:scripts` → PASS (render-tools tests included). `npm run build` → all 28 build. `npm run audit` → same 6 known failures. `npm run claims` → 0. `grep -c 'data-site="twin-city-fences"' dist/twin-city-fences/west-monroe/index.html` → 1.

- [ ] **Step 11: Commit** — all touched files, message "Calculator and permit page types; every secondary page tracked and carries the lead form" + trailer.

---

### Task 4: The calculator in the browser

**Files:**
- Modify: `shared/fence-calc-ui.mjs` (replace the stub)
- Create: `scripts/serve-dist.mjs` (tiny zero-dep static server for local checks)

**Interfaces:**
- Consumes: `fenceMaterials` from `/fence-calc.mjs`; the form markup ids/names from Task 3 (`#fence-calc`, `#fence-calc-result`, inputs `type,length,height,corners,gates,spacing,picketWidth,picketGap,bag`); the lead form's `select[name=service]`.

- [ ] **Step 1: Implement `shared/fence-calc-ui.mjs`**:
```js
// Wires the calculator form to the formulas and shows the materials list.
// Runs only in the browser; the formulas themselves are tested in node.
import { fenceMaterials } from "/fence-calc.mjs";

const form = document.getElementById("fence-calc");
const out = document.getElementById("fence-calc-result");
const note = form?.querySelector(".form-note");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function read() {
  const data = new FormData(form);
  const val = (k) => (data.get(k) ?? "").toString().trim();
  const gates = val("gates") ? val("gates").split(/[,\s]+/).filter(Boolean) : [];
  const input = { type: val("type"), length: val("length"), height: Number(val("height")), corners: val("corners") || "0", gates, bag: Number(val("bag")) };
  if (val("spacing")) input.spacing = val("spacing");
  if (input.type === "wood") { input.picketWidth = val("picketWidth") || "5.5"; input.picketGap = val("picketGap") || "0"; }
  return input;
}

function prefillQuoteForm(type) {
  const select = document.querySelector('.lead-form select[name="service"]');
  if (!select) return;
  const want = type === "wood" ? /wood/i : /chain/i;
  const option = [...select.options].find((o) => want.test(o.textContent));
  if (option) select.value = option.value;
}

function render(result) {
  const text = result.lines.map((l) => `${l.item}: ${l.qty} ${l.unit}`).join("\n");
  out.innerHTML = `
    <h2>Your materials list</h2>
    <table class="calc-table"><thead><tr><th>Material</th><th>Quantity</th><th>How it's worked out</th></tr></thead><tbody>${
      result.lines.map((l) => `<tr><td>${esc(l.item)}</td><td>${l.qty} ${esc(l.unit)}</td><td>${esc(l.working)}</td></tr>`).join("")}</tbody></table>
    <p class="fineprint">${result.notes.map(esc).join(" ")}</p>
    <p><button type="button" class="button ghost" data-act="copy">Copy list</button> <button type="button" class="button ghost" data-act="print">Print</button> <a class="button primary" href="#quote">Get a quote for this fence</a></p>`;
  out.hidden = false;
  out.querySelector('[data-act="copy"]').addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(text); e.target.textContent = "Copied"; } catch { e.target.textContent = "Select and copy the table"; }
  });
  out.querySelector('[data-act="print"]').addEventListener("click", () => window.print());
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const result = fenceMaterials(read());
  if (!result.ok) { note.textContent = result.error; out.hidden = true; return; }
  note.textContent = "";
  render(result);
  prefillQuoteForm(result.type);
  out.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Picket fields only make sense for wood.
form?.addEventListener("change", () => {
  const wood = form.querySelector('input[name="type"]:checked')?.value === "wood";
  for (const name of ["picketWidth", "picketGap"]) form.querySelector(`[name="${name}"]`).closest("label").hidden = !wood;
});
```

- [ ] **Step 2: Implement `scripts/serve-dist.mjs`** (local checks only, not deployed):
```js
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
  if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
  try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html"); } catch {}
  try { res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }); res.end(await fs.readFile(file)); }
  catch { res.writeHead(404).end("not found"); }
}).listen(Number(port), () => console.log(`http://localhost:${port}/`));
```

- [ ] **Step 3: Temporary local check** — exercise the UI on Twin City **locally only** (Task 6 adds the page for real): temporarily append `{ "slug": "fence-calculator", "type": "fence-calculator", "heading": "Fence materials calculator.", "seoTitle": "Fence calculator", "seoDescription": "Fence materials calculator." }` to the `pages` array in `sites/twin-city-fences/site.json`, run `npm run build:site -- twin-city-fences` and `node scripts/serve-dist.mjs twin-city-fences`, and afterwards **`git checkout -- sites/twin-city-fences/site.json`**. In a browser at `http://localhost:4173/fence-calculator/`: 100 ft, 6, 2 corners, gates "4" → table shows 219 pickets and 42 bags; switch to chain-link, 100 ft, 4, 0 corners → 86 ties; blank length → the plain error, no table; the quote form's service select changes to the fence type. Report what you saw (the controller repeats this with a real browser in Task 6).

- [ ] **Step 4: Run** — `npm run test:scripts` → PASS; `git status` shows only the two files from this task (site.json restored).

- [ ] **Step 5: Commit** — `git add shared/fence-calc-ui.mjs scripts/serve-dist.mjs`, message "Fence calculator in the browser: list, working, copy, print, quote prefill" + trailer.

---

### Task 5: Research the seven permit guides

**Files:**
- Create: `deploy/permits/monroe-la.json`, `west-monroe-la.json`, `ouachita-parish-la.json`, `lake-charles-la.json`, `sulphur-la.json`, `westlake-la.json`, `calcasieu-parish-la.json`
- Create: `docs/fence-permits-open-questions.md`

**Interfaces:**
- Consumes: the data shape and `validatePermit` from Task 2.
- Produces: seven JSON files that `validatePermit` accepts with zero problems.

- [ ] **Step 1: Research each jurisdiction from official sources only** — the city or parish code of ordinances (Municode `library.municode.com/la/<place>` or the jurisdiction's own site), the jurisdiction's permit/planning page, and for 811 the Louisiana statute or Louisiana 811's own site. For each, capture (only what the official text says):
  - `permit` — is a permit required for a residential fence; how to apply
  - `height` — maximum height front / side / rear
  - `setback` — setbacks from property lines or rights-of-way, if stated
  - `corner` — corner-lot / sight-triangle limits, if stated
  - `pool` — pool barrier requirements, if the code has them
  - `materials` — prohibited materials in residential zones (barbed/electric wire), if stated
  - `digging` — Louisiana 811 before digging (state source)
  - the permit office's name, phone, address and official page, from the official page only.
  Where the official text is silent, write the fact as "This isn't published online. Ask <office> at <phone>." with the office page as its source. Never state a fee amount (say fees are set by the office) and never use licensed/insured/bonded/certified — rephrase ("a contractor registered with the state", or leave it out).

- [ ] **Step 2: Write each file** in the Task 2 shape, `checked` = the date you actually read the source.

- [ ] **Step 3: Validate** — run:
```bash
node -e "import('./scripts/lib/permits.mjs').then(async m=>{let bad=0;for(const id of ['monroe-la','west-monroe-la','ouachita-parish-la','lake-charles-la','sulphur-la','westlake-la','calcasieu-parish-la']){const p=m.validatePermit(await m.loadPermit(process.cwd(),id));if(p.length){bad++;console.log(id,p)}}console.log(bad?'FAIL':'all 7 valid')})"
```
Expected: `all 7 valid`.

- [ ] **Step 4: Record what the official text leaves unclear** — `docs/fence-permits-open-questions.md`: one bullet per ambiguity (jurisdiction, question, what the text says, source link), for Mitch to decide. Nothing ambiguous goes on a page as settled.

- [ ] **Step 5: Commit** — the 8 files, message "Fence permit research: seven jurisdictions, every fact sourced" + trailer.

---

### Task 6: Put the pages on the sites, launch, verify

**Files:**
- Modify: `sites/twin-city-fences/site.json`, `sites/lake-charles-fences/site.json` (append `pages` entries), `deploy/outreach-research.md` (one paragraph)

**Interfaces:**
- Consumes: page types from Task 3, permit ids from Task 5.

- [ ] **Step 1: Add the pages** — append to `sites/twin-city-fences/site.json` `pages` (keep the file's formatting: insert objects before the closing `]` of `pages`, 2-space indent, CRLF):
```json
{ "slug": "fence-calculator", "type": "fence-calculator", "navLabel": "Fence materials calculator", "kicker": "Plan your fence", "heading": "Fence materials calculator.", "intro": "Enter the length, height, corners and gates, and get the posts, rails, pickets or fabric, and concrete you would need — with the arithmetic shown.", "seoTitle": "Fence Materials Calculator: Posts, Pickets, Concrete | Twin City Fence", "seoDescription": "Work out how many posts, rails, pickets and bags of concrete a wood privacy or chain-link fence needs. Free calculator with every number explained." },
{ "slug": "fence-permit-monroe", "type": "fence-permit", "permit": "monroe-la", "navLabel": "Monroe fence permits", "kicker": "Before you build", "heading": "Fence permits in Monroe, LA.", "intro": "What the City of Monroe's rules say about building a residential fence, with a link to the official source for every answer.", "seoTitle": "Monroe, LA Fence Permit Rules & Height Limits | Twin City Fence", "seoDescription": "Do you need a permit for a fence in Monroe, Louisiana? Height limits, setbacks, corner lots and who to call, each linked to the city's own rules." },
{ "slug": "fence-permit-west-monroe", "type": "fence-permit", "permit": "west-monroe-la", "navLabel": "West Monroe fence permits", "kicker": "Before you build", "heading": "Fence permits in West Monroe, LA.", "intro": "What the City of West Monroe's rules say about building a residential fence, with a link to the official source for every answer.", "seoTitle": "West Monroe, LA Fence Permit Rules & Height Limits | Twin City Fence", "seoDescription": "Do you need a permit for a fence in West Monroe, Louisiana? Height limits, setbacks, corner lots and who to call, each linked to the city's own rules." },
{ "slug": "fence-permit-ouachita-parish", "type": "fence-permit", "permit": "ouachita-parish-la", "navLabel": "Ouachita Parish fence permits", "kicker": "Before you build", "heading": "Fence permits in unincorporated Ouachita Parish.", "intro": "For homes outside Monroe and West Monroe city limits: what the parish rules say about fences, each answer linked to its source.", "seoTitle": "Ouachita Parish Fence Permit Rules | Twin City Fence", "seoDescription": "Fence rules for unincorporated Ouachita Parish, Louisiana: whether you need a permit, height limits and who to call, linked to the parish's own rules." }
```
and to `sites/lake-charles-fences/site.json` add a `pages` array (the site has none yet) with the same calculator object (seoTitle suffix `| Lake Charles Fences and Decks`) and four guides: `fence-permit-lake-charles` / `lake-charles-la`, `fence-permit-sulphur` / `sulphur-la`, `fence-permit-westlake` / `westlake-la`, `fence-permit-calcasieu-parish` / `calcasieu-parish-la`, worded exactly like the Twin City ones with the place names changed ("City of Lake Charles", "City of Sulphur", "City of Westlake", "unincorporated Calcasieu Parish").

- [ ] **Step 2: Outreach routine line** — in `deploy/outreach-research.md`, under the backlink list in step 2, add:
```markdown
For twin-city-fences and lake-charles-fences, also look for resource pages
that would genuinely use the site's fence materials calculator
(`/fence-calculator`) or a city's fence permit guide (`/fence-permit-<city>`):
HOA and neighbourhood association sites, realtors' moving or homeowner guides,
home-improvement blogs, and library or city resource lists. The task's
copy_block pitches that specific page, and its url is the prospect's page.
```

- [ ] **Step 3: Verify locally** — `npm run test:scripts`, `npm run build`, `npm run audit` (both fence sites PASS; the same 6 known failures otherwise), `npm run claims` (0). Serve each site (`node scripts/serve-dist.mjs twin-city-fences`) and check in a real browser (Playwright MCP or Chrome): the calculator's three scenarios from Task 4 Step 3; one guide page shows every fact with a working source link, "Last checked", the office phone link, the HOA and not-legal-advice lines; the homepage shows "Materials and permits." with 4 (Twin City) / 5 (Lake Charles) links; no console errors.

- [ ] **Step 4: Commit and push** — `git add sites/twin-city-fences/site.json sites/lake-charles-fences/site.json deploy/outreach-research.md`, message "Launch the fence calculator and permit guides on both fence sites" + trailer; `git push origin main`.

- [ ] **Step 5: Verify live** — after deploy: `curl -s -o /dev/null -w "%{http_code}"` returns 200 for `https://twincityfences.com/fence-calculator/`, the three Twin City guide URLs, `https://fenceslakecharles.com/fence-calculator/` and its four guides; `https://twincityfences.com/fence-calc.mjs` returns JavaScript; `node scripts/audit-portfolio.mjs twin-city-fences lake-charles-fences` → ok; run the calculator once on the live Twin City page in a browser. `npm run indexnow` if the workflow did not already submit.
