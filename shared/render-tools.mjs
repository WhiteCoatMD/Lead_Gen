import { escapeHtml as esc, phoneHref } from "./render-site.mjs";
import { fenceMaterials, EXAMPLE_INPUT } from "./fence-calc.mjs";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const isDate = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`));
const monthOf = (iso) => (isDate(iso) ? MONTH.format(new Date(`${iso}T00:00:00Z`)) : "");
// Guide data becomes hrefs on a live page: only http(s) links are emitted.
const safeUrl = (u) => (/^https?:\/\//i.test(String(u ?? "")) ? u : "");
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
    <section class="shell intro calc-example">
      <div><p class="eyebrow accent">Worked example</p><h2>100 ft of 6 ft wood privacy, 2 corners, one 4 ft gate.</h2></div>
      ${linesTable(example)}
      <p class="fineprint">${example.notes.map(esc).join(" ")}</p>
    </section>
    ${guides.length ? `<section class="areas"><div class="shell areas-inner"><div><p class="eyebrow">Before you dig</p><h2>Fence permits by city.</h2></div><div class="area-list">${
      guides.map((g) => `<span><a href="/${esc(g.slug)}">${esc(g.navLabel || g.heading)}</a></span>`).join("")}</div></div></section>` : ""}`;
}

export function renderPermitGuide(site, permit, links) {
  const facts = Array.isArray(permit.facts) ? permit.facts : [];
  if (!facts.length) return "";
  const office = permit.office || {};
  const oldest = facts.map((f) => f.checked).filter(isDate).sort()[0];
  return `
    <section class="shell permit">
      <p class="permit-checked">${oldest ? `Last checked: ${esc(monthOf(oldest))}. ` : ""}Rules change — confirm with the office before you build.</p>
      <div class="permit-office">
        <h2>${esc(office.name)}</h2>
        ${office.address ? `<p>${esc(office.address)}</p>` : ""}
        ${office.phone ? `<p><a href="${phoneHref(office.phone)}">${esc(office.phone)}</a></p>` : ""}
        ${safeUrl(office.url) ? `<p><a href="${esc(office.url)}" rel="noopener">Official permit page</a></p>` : ""}
      </div>
      ${facts.map((f) => `
      <article class="permit-fact">
        <h3>${esc(f.question)}</h3>
        <p>${esc(f.answer)}</p>
        <p class="source">Source: ${safeUrl(f.sourceUrl) ? `<a href="${esc(f.sourceUrl)}" rel="noopener">${esc(f.sourceTitle)}</a>` : esc(f.sourceTitle)}${isDate(f.checked) ? ` · checked ${esc(monthOf(f.checked))}` : ""}</p>
      </article>`).join("")}
      <p class="fineprint">If you live in a neighbourhood with an HOA, its rules can be stricter than ${esc(permit.name)}'s. This page is a plain-language summary of public rules, not legal advice.</p>
      <p>${links.calculator ? `<a href="/${esc(links.calculator.slug)}">Work out the materials with our ${esc(links.calculator.label)}</a>` : ""}${
        (links.guides || []).length ? ` · Other areas: ${links.guides.map((g) => `<a href="/${esc(g.slug)}">${esc(g.label)}</a>`).join(", ")}` : ""}</p>
    </section>`;
}

export function renderPermitLinks(site) {
  const pages = [...toolPages(site, "fence-calculator"), ...toolPages(site, "fence-permit")];
  if (!pages.length) return "";
  return `<section class="areas"><div class="shell areas-inner"><div><p class="eyebrow">Planning a fence?</p><h2>Materials and permits.</h2></div><div class="area-list">${
    pages.map((p) => `<span><a href="/${esc(p.slug)}">${esc(p.navLabel || p.heading)}</a></span>`).join("")}</div></div></section>`;
}
