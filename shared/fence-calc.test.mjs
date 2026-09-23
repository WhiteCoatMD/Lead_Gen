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
  // 14 posts × 0.9207 cu ft (10 in hole, 24 in deep, less a 3.5 in post) = 12.89 cu ft ÷ 0.45 = 28.6 → 29
  assert.equal(qty(r, "Concrete"), 29);
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
  // 2 × 0.6366 + 9 × 0.3639 = 4.548 cu ft ÷ 0.45 = 10.1 → 11 (rounded once, not 2×2 + 9×1 = 13)
  assert.equal(qty(r, "Concrete"), 11);
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
