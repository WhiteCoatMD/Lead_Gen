import { escapeHtml as esc } from "./render-site.mjs";

/**
 * Inline SVG diagrams.
 *
 * WHY THESE AND NOT PHOTOGRAPHS. Neither site has pictures of its own work,
 * and the honest options for fixing that were: get real photographs, or use
 * stock. Stock imagery of someone else's deck or someone else's tow truck,
 * placed on a page that says "we build these", is a portfolio the business
 * does not have — which is the one thing this rebuild has refused to do from
 * the start. It is the same line that took a warranty off SeaCoast.
 *
 * A diagram is not pretending to be anything. It explains something true about
 * the trade, it is genuinely useful to someone deciding what to ask for, and
 * it is honest about being a drawing.
 *
 * REAL PHOTOGRAPHS WOULD STILL BE BETTER and these do not replace them. The
 * shot list in docs/photo-shot-list.md stands.
 *
 * Inline rather than files: no extra request, they scale to any width, they
 * re-colour with the site accent, and they cost about 1KB each.
 */

const palette = (site) => ({
  accent: site.accent || "#ef342f",
  ink: "#12161a",
  mute: "#6b7580",
  line: "rgba(18,22,26,.18)",
  fill: "rgba(18,22,26,.05)",
});

/** Wraps any diagram with its caption, and keeps the a11y story straight. */
const figure = (title, desc, svg) => `
      <figure class="diagram">
        ${svg}
        <figcaption>${esc(title)}</figcaption>
      </figure>`;

/**
 * Fence height against what it actually does. Height is the decision people
 * get wrong, and it is invisible in a photograph.
 */
export function fenceHeightDiagram(site) {
  const c = palette(site);
  const bars = [
    { h: 36, label: "3 ft", use: "Boundary" },
    { h: 52, label: "4 ft", use: "Pets, front yard" },
    { h: 72, label: "6 ft", use: "Privacy" },
    { h: 96, label: "8 ft", use: "Full screen" },
  ];
  let x = 46;
  const parts = bars.map((b) => {
    const top = 150 - b.h;
    const g = `
      <rect x="${x}" y="${top}" width="46" height="${b.h}" fill="${c.fill}" stroke="${c.line}"/>
      ${Array.from({ length: 5 }, (_, i) => `<line x1="${x + 5 + i * 9}" y1="${top + 4}" x2="${x + 5 + i * 9}" y2="146" stroke="${c.line}"/>`).join("")}
      <text x="${x + 23}" y="${top - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="${c.accent}">${b.label}</text>
      <text x="${x + 23}" y="168" text-anchor="middle" font-size="10" fill="${c.mute}">${b.use}</text>`;
    x += 78;
    return g;
  }).join("");

  const svg = `<svg viewBox="0 0 370 180" role="img" aria-label="Fence heights compared: 3 feet for a boundary, 4 feet for pets and front yards, 6 feet for privacy, 8 feet for a full screen" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="150" x2="356" y2="150" stroke="${c.ink}" stroke-width="1.5"/>
      ${parts}
    </svg>`;
  return figure("Height is what decides whether a fence screens, contains or just marks a line.", "", svg);
}

/**
 * Why gates sag. The leverage is the whole explanation and a sentence does not
 * carry it nearly as well as a drawing.
 */
export function gatePostDiagram(site) {
  const c = palette(site);
  const svg = `<svg viewBox="0 0 370 180" role="img" aria-label="Diagram showing a gate hanging from a post: the weight of the gate pulls the top of the post toward it, which is why a gate post is set deeper and braced" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="132" x2="350" y2="132" stroke="${c.ink}" stroke-width="1.5"/>
      <rect x="48" y="40" width="14" height="92" fill="${c.fill}" stroke="${c.line}"/>
      <rect x="48" y="132" width="14" height="34" fill="${c.accent}" opacity=".18" stroke="${c.accent}" stroke-dasharray="3 2"/>
      <text x="55" y="178" text-anchor="middle" font-size="9" fill="${c.accent}">set deeper</text>
      <rect x="62" y="52" width="150" height="70" fill="${c.fill}" stroke="${c.line}"/>
      ${Array.from({ length: 7 }, (_, i) => `<line x1="${70 + i * 20}" y1="56" x2="${70 + i * 20}" y2="118" stroke="${c.line}"/>`).join("")}
      <path d="M62 58 L208 116" stroke="${c.line}" stroke-dasharray="4 3"/>
      <path d="M212 90 q26 0 26 22" fill="none" stroke="${c.accent}" stroke-width="2"/>
      <path d="M232 108 l6 6 l6 -6" fill="none" stroke="${c.accent}" stroke-width="2"/>
      <text x="252" y="118" font-size="11" font-weight="700" fill="${c.accent}">weight</text>
      <path d="M40 46 q-14 10 0 20" fill="none" stroke="${c.accent}" stroke-width="2"/>
      <text x="14" y="40" font-size="11" font-weight="700" fill="${c.accent}">pull</text>
      <text x="137" y="90" text-anchor="middle" font-size="11" fill="${c.mute}">gate</text>
    </svg>`;
  return figure("A gate is a weight on one side of a post. The wider it is, the harder it pulls.", "", svg);
}

/**
 * Vehicle class against truck type. This is the question dispatch actually
 * needs answered, and most people do not know where the line falls.
 */
export function towClassDiagram(site) {
  const c = palette(site);
  const rows = [
    { label: "Car, light pickup", truck: "Tow truck", w: 92 },
    { label: "Van, box truck", truck: "Heavy or wrecker", w: 150 },
    { label: "Bus, RV, tractor unit", truck: "Wrecker", w: 214 },
  ];
  const parts = rows.map((r, i) => {
    const y = 34 + i * 44;
    return `
      <text x="16" y="${y + 2}" font-size="11" fill="${c.ink}">${r.label}</text>
      <rect x="16" y="${y + 10}" width="${r.w}" height="14" rx="3" fill="${c.accent}" opacity="${0.25 + i * 0.25}"/>
      <text x="${r.w + 26}" y="${y + 21}" font-size="11" font-weight="700" fill="${c.accent}">${r.truck}</text>`;
  }).join("");

  const svg = `<svg viewBox="0 0 370 170" role="img" aria-label="Which truck each vehicle needs: cars and light pickups take a tow truck; vans and box trucks need heavy or wrecker equipment; buses, RVs and tractor units need a wrecker" xmlns="http://www.w3.org/2000/svg">
      <text x="16" y="16" font-size="11" font-weight="700" fill="${c.mute}">WEIGHT</text>
      ${parts}
    </svg>`;
  return figure("Weight decides which truck is sent. Knowing roughly where a vehicle falls saves a wasted trip.", "", svg);
}

export const DIAGRAM_CSS = `
/* Inline SVG diagrams. Not photographs and not pretending to be — they explain
   something rather than illustrate a claim. */
.diagram{margin:1.6rem 0 0;padding:1.1rem 1rem .9rem;border:1px solid rgba(10,12,14,.12);border-radius:.6rem;background:#fff}
.diagram svg{display:block;width:100%;height:auto;max-width:34rem;margin-inline:auto}
.diagram figcaption{margin-top:.7rem;font-size:.9rem;color:#5d6671;text-align:center;line-height:1.45}
`;

export const DIAGRAMS = {
  "fence-height": fenceHeightDiagram,
  "gate-post": gatePostDiagram,
  "tow-class": towClassDiagram,
};
