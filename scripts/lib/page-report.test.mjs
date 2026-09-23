import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePath, pageRows } from "./page-report.mjs";

test("paths are compared without trailing slashes, .html or query strings", () => {
  assert.equal(normalizePath("/fence-calculator/"), "/fence-calculator");
  assert.equal(normalizePath("/fence-calculator"), "/fence-calculator");
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath(""), "/");
  assert.equal(normalizePath("/contact-us.html"), "/contact-us.html");
  assert.equal(normalizePath("/west-monroe/?utm=x"), "/west-monroe");
});

const rows = [
  { site: "twin-city-fences", path: "/fence-calculator/", type: "page_view", n: 12 },
  { site: "twin-city-fences", path: "/fence-calculator", type: "lead_delivered", n: 1 },
  { site: "twin-city-fences", path: "/", type: "page_view", n: 80 },
  { site: "twin-city-fences", path: "/", type: "call_click", n: 3 },
  { site: "twin-city-fences", path: "/west-monroe/", type: "page_view", n: 9 },
  { site: "towing-dallas", path: "/", type: "call_click", n: 5 },
];
const pilot = { "twin-city-fences": ["/fence-calculator", "/fence-permit-monroe"] };

test("merges slash variants, keeps pages with calls or leads, always lists pilot pages", () => {
  const out = pageRows(rows, pilot);
  const key = (r) => `${r.site} ${r.path}`;
  assert.deepEqual(out.map(key), [
    "twin-city-fences /fence-calculator",
    "towing-dallas /",
    "twin-city-fences /",
    "twin-city-fences /fence-permit-monroe",
  ]);
  const calc = out.find((r) => r.path === "/fence-calculator");
  assert.deepEqual([calc.views, calc.calls, calc.leads, calc.pilot], [12, 0, 1, true]);
  const monroe = out.find((r) => r.path === "/fence-permit-monroe");
  assert.deepEqual([monroe.views, monroe.calls, monroe.leads], [0, 0, 0]);
  assert.ok(!out.some((r) => r.path === "/west-monroe"), "a page with visits only is left out");
});

test("sorted by leads, then call taps, then visits", () => {
  const out = pageRows([
    { site: "a", path: "/x", type: "call_click", n: 9 },
    { site: "b", path: "/y", type: "lead_delivered", n: 1 },
    { site: "c", path: "/z", type: "call_click", n: 2 },
  ], {});
  assert.deepEqual(out.map((r) => r.site), ["b", "a", "c"]);
});
