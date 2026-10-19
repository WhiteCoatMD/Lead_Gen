// Flat illustrated stand-ins for products that do not have photography yet.
// They are generated at build time into dist/<site>/assets so nothing is hotlinked.

const xml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[char]));

function snow(palette) {
  if (!palette.snow) return "";
  return `<g fill="${palette.gold}">
    <circle cx="108" cy="72" r="4"/><circle cx="528" cy="88" r="3"/>
    <circle cx="84" cy="390" r="3"/><circle cx="548" cy="400" r="4"/>
    <circle cx="160" cy="120" r="2"/><circle cx="490" cy="340" r="2"/>
  </g>`;
}

function frame(title, body, palette) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" role="img">
  <title>${xml(title)}</title>
  <rect width="640" height="480" fill="${palette.paper}"/>
  <circle cx="320" cy="248" r="168" fill="${palette.disc}"/>
  ${snow(palette)}
  ${body}
</svg>
`;
}

const scenes = {
  letter: (p) => `
    <rect x="178" y="176" width="284" height="188" rx="8" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <path d="M178 184 L320 308 L462 184" fill="none" stroke="${p.ink}" stroke-width="3"/>
    <circle cx="320" cy="292" r="28" fill="${p.accent}"/>
    <circle cx="320" cy="292" r="16" fill="none" stroke="${p.gold}" stroke-width="3"/>`,
  email: (p) => `
    <rect x="168" y="150" width="304" height="210" rx="18" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <path d="M168 168 L320 286 L472 168" fill="none" stroke="${p.accent}" stroke-width="3"/>
    <text x="320" y="250" text-anchor="middle" font-family="Georgia, serif" font-size="84" fill="${p.accent}">@</text>`,
  bundle: (p) => `
    <rect x="150" y="196" width="230" height="156" rx="8" fill="${p.card}" stroke="${p.ink}" stroke-width="3" transform="rotate(-8 265 274)"/>
    <rect x="262" y="168" width="230" height="156" rx="8" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <circle cx="376" cy="246" r="22" fill="${p.accent}"/>
    <circle cx="250" cy="250" r="16" fill="${p.pine}"/>`,
  candle: (p) => `
    <rect x="246" y="214" width="148" height="156" rx="14" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <ellipse cx="320" cy="214" rx="74" ry="18" fill="${p.disc}" stroke="${p.ink}" stroke-width="3"/>
    <rect x="312" y="156" width="16" height="46" rx="2" fill="${p.ink}"/>
    <path d="M320 154 C348 124 292 108 320 78 C334 112 300 120 320 154" fill="${p.accent}"/>`,
  sauce: (p) => `
    <rect x="292" y="118" width="56" height="34" rx="6" fill="${p.ink}"/>
    <path d="M248 196 h144 v130 q0 36 -72 36 q-72 0 -72 -36 z" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <rect x="248" y="168" width="144" height="36" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <rect x="248" y="236" width="144" height="46" fill="${p.accent}"/>`,
  terrarium: (p) => `
    <path d="M230 168 h180 l28 200 q4 28 -118 28 q-122 0 -118 -28 z" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <ellipse cx="320" cy="368" rx="78" ry="16" fill="${p.pine}"/>
    <path d="M320 340 C292 270 236 250 258 196 C286 246 308 250 320 214 C338 258 372 240 360 196 C396 258 350 270 320 340" fill="${p.pine}"/>
    <circle cx="286" cy="352" r="9" fill="${p.gold}"/><circle cx="348" cy="356" r="6" fill="${p.accent}"/>`,
  birdhouse: (p) => `
    <polygon points="320,108 486,236 154,236" fill="${p.accent}" stroke="${p.ink}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="196" y="236" width="248" height="150" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <circle cx="320" cy="304" r="28" fill="${p.ink}"/>
    <rect x="292" y="346" width="56" height="10" rx="2" fill="${p.ink}"/>
    <rect x="308" y="386" width="24" height="36" fill="${p.ink}"/>`,
  soap: (p) => `
    <rect x="176" y="196" width="288" height="150" rx="36" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <rect x="200" y="220" width="240" height="102" rx="28" fill="${p.disc}"/>
    <circle cx="452" cy="168" r="16" fill="none" stroke="${p.accent}" stroke-width="3"/>
    <circle cx="478" cy="146" r="10" fill="none" stroke="${p.accent}" stroke-width="3"/>`,
  bitters: (p) => `
    <rect x="292" y="112" width="56" height="30" rx="4" fill="${p.ink}"/>
    <rect x="268" y="142" width="104" height="214" rx="14" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <rect x="268" y="214" width="104" height="40" fill="${p.accent}"/>
    <rect x="292" y="268" width="56" height="64" fill="${p.disc}"/>`,
  parcel: (p) => `
    <rect x="176" y="168" width="288" height="200" rx="8" fill="${p.card}" stroke="${p.ink}" stroke-width="3"/>
    <path d="M320 168 v200 M176 268 h288" fill="none" stroke="${p.accent}" stroke-width="3"/>`,
};

export function illustrationSvg(icon, title, palette) {
  const draw = scenes[icon] || scenes.parcel;
  return frame(title, draw(palette), palette);
}

export function heroMark(brand) {
  if (brand === "workshop") {
    return `<svg class="hero-mark" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
      <rect x="10" y="10" width="140" height="140" fill="none" stroke="currentColor" stroke-width="4"/>
      <rect x="22" y="22" width="116" height="116" fill="none" stroke="currentColor" stroke-width="1"/>
      <text x="80" y="78" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="currentColor">BUILD</text>
      <text x="80" y="106" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="currentColor">IT</text>
    </svg>`;
  }
  return `<svg class="hero-mark" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
    <circle cx="80" cy="80" r="72" fill="none" stroke="currentColor" stroke-width="3"/>
    <circle cx="80" cy="80" r="62" fill="none" stroke="currentColor" stroke-width="1"/>
    <text x="80" y="70" text-anchor="middle" font-family="Georgia, serif" font-size="13" letter-spacing="1" fill="currentColor">NORTH POLE</text>
    <text x="80" y="92" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="currentColor">USPS</text>
    <path d="M28 112 H132" fill="none" stroke="currentColor" stroke-width="1"/>
  </svg>`;
}
