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
