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

/**
 * Single-wide against double-wide. People frequently do not know which they
 * have, and it is the first thing that changes the job - a double-wide is two
 * units joined on site, so it has to come apart again before anything moves.
 */
export function mobileHomeSizeDiagram(site) {
  const c = palette(site);
  const unit = (x, y, w, h, seam) => `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.fill}" stroke="${c.line}"/>
      ${seam ? `<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${c.accent}" stroke-width="2" stroke-dasharray="5 3"/>` : ""}
      ${Array.from({ length: Math.round(w / 22) }, (_, i) => `<line x1="${x + 11 + i * 22}" y1="${y + 5}" x2="${x + 11 + i * 22}" y2="${y + h - 5}" stroke="${c.line}" stroke-width=".6"/>`).join("")}`;

  const svg = `<svg viewBox="0 0 370 200" role="img" aria-label="A single-wide is one unit; a double-wide is two halves joined on site along a seam, and has to be separated again before it can be moved" xmlns="http://www.w3.org/2000/svg">
      <text x="16" y="18" font-size="11" font-weight="700" fill="${c.mute}">SINGLE-WIDE</text>
      ${unit(16, 28, 76, 44, false)}
      <text x="16" y="88" font-size="10" fill="${c.mute}">One unit, one trip</text>

      <text x="16" y="124" font-size="11" font-weight="700" fill="${c.mute}">DOUBLE-WIDE</text>
      ${unit(16, 134, 152, 44, true)}
      <text x="16" y="194" font-size="10" fill="${c.mute}">Two halves joined on site — separated again before it moves</text>

      <line x1="184" y1="134" x2="184" y2="178" stroke="${c.line}"/>
      <text x="196" y="150" font-size="11" font-weight="700" fill="${c.accent}">Roughly</text>
      <text x="196" y="166" font-size="11" font-weight="700" fill="${c.accent}">double the debris</text>
    </svg>`;
  return figure("A double-wide is two units joined on site. That seam is the reason it is not simply twice the work.", "", svg);
}

/**
 * What is left on the ground afterwards. This is the decision people have not
 * made when they call, and it changes the machine, the passes and the loads
 * more than acreage does.
 */
export function clearingFinishDiagram(site) {
  const c = palette(site);
  const col = (x, label, note, draw) => `
      <text x="${x + 50}" y="18" text-anchor="middle" font-size="11" font-weight="700" fill="${c.accent}">${label}</text>
      <rect x="${x}" y="30" width="100" height="62" fill="none" stroke="${c.line}"/>
      ${draw}
      <line x1="${x}" y1="92" x2="${x + 100}" y2="92" stroke="${c.ink}" stroke-width="1.5"/>
      <text x="${x + 50}" y="110" text-anchor="middle" font-size="10" fill="${c.mute}">${note}</text>`;

  const chips = Array.from({ length: 22 }, (_, i) =>
    `<rect x="${18 + (i % 11) * 8}" y="${80 - Math.floor(i / 11) * 6}" width="6" height="3" fill="${c.accent}" opacity=".45"/>`
  ).join("");
  const piles = `<path d="M150 92 l18 -26 l18 26 z" fill="${c.fill}" stroke="${c.line}"/><path d="M188 92 l14 -19 l14 19 z" fill="${c.fill}" stroke="${c.line}"/>`;
  const clean = `<text x="304" y="66" text-anchor="middle" font-size="10" fill="${c.mute}">(nothing)</text>`;

  const svg = `<svg viewBox="0 0 370 120" role="img" aria-label="Three finishes: mulched leaves the material as ground cover, windrowed leaves it in piles, hauled off leaves clean ground" xmlns="http://www.w3.org/2000/svg">
      ${col(12, "Mulched", "Stays as cover", chips)}
      ${col(138, "Windrowed", "Piled on site", piles)}
      ${col(264, "Hauled off", "Clean ground", clean)}
    </svg>`;
  return figure("What you want left behind changes the job as much as the acreage does.", "", svg);
}

/**
 * Access. Named on almost every page because it is the thing most likely to
 * change the plan, and the thing least likely to be described accurately.
 */
export function siteAccessDiagram(site) {
  const c = palette(site);
  const svg = `<svg viewBox="0 0 370 170" role="img" aria-label="The three access measurements that matter: the width of the way in, overhead clearance, and whether there is room to turn" xmlns="http://www.w3.org/2000/svg">
      <line x1="16" y1="140" x2="354" y2="140" stroke="${c.ink}" stroke-width="1.5"/>

      <rect x="60" y="96" width="14" height="44" fill="${c.fill}" stroke="${c.line}"/>
      <rect x="150" y="96" width="14" height="44" fill="${c.fill}" stroke="${c.line}"/>
      <line x1="74" y1="132" x2="150" y2="132" stroke="${c.accent}" stroke-width="1.5"/>
      <path d="M78 128 l-5 4 l5 4" fill="none" stroke="${c.accent}" stroke-width="1.5"/>
      <path d="M146 128 l5 4 l-5 4" fill="none" stroke="${c.accent}" stroke-width="1.5"/>
      <text x="112" y="122" text-anchor="middle" font-size="10" font-weight="700" fill="${c.accent}">width in</text>

      <line x1="196" y1="40" x2="340" y2="40" stroke="${c.line}" stroke-dasharray="4 3"/>
      <text x="268" y="32" text-anchor="middle" font-size="10" fill="${c.mute}">lines / limbs</text>
      <line x1="268" y1="44" x2="268" y2="140" stroke="${c.accent}" stroke-width="1.5"/>
      <path d="M264 48 l4 -5 l4 5" fill="none" stroke="${c.accent}" stroke-width="1.5"/>
      <path d="M264 134 l4 5 l4 -5" fill="none" stroke="${c.accent}" stroke-width="1.5"/>
      <text x="278" y="96" font-size="10" font-weight="700" fill="${c.accent}">clearance</text>

      <path d="M40 76 a34 34 0 1 1 .6 0" fill="none" stroke="${c.line}" stroke-dasharray="4 3"/>
      <text x="40" y="80" text-anchor="middle" font-size="10" fill="${c.mute}">turning</text>
      <text x="40" y="92" text-anchor="middle" font-size="10" fill="${c.mute}">room</text>

      <text x="16" y="162" font-size="10" fill="${c.mute}">Plus what the ground does after rain — the one that cannot be measured from the road.</text>
    </svg>`;
  return figure("Three measurements decide whether equipment reaches the work. A photograph of the approach answers all of them.", "", svg);
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
  "mobile-home-size": mobileHomeSizeDiagram,
  "clearing-finish": clearingFinishDiagram,
  "site-access": siteAccessDiagram,
};
