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

// A one-line restatement of the inputs, so a printout is self-explanatory
// without the form that produced it.
function summarize(input) {
  const label = input.type === "wood" ? "wood privacy" : "chain-link";
  const corners = Number(input.corners) || 0;
  const parts = [`${input.length} ft of ${input.height} ft ${label}`, `${corners} corner${corners === 1 ? "" : "s"}`];
  if (input.gates.length) parts.push(`gates: ${input.gates.join(", ")} ft`);
  return parts.join(", ");
}

function prefillQuoteForm(type) {
  const select = document.querySelector('.lead-form select[name="service"]');
  if (!select) return;
  const want = type === "wood" ? /wood/i : /chain/i;
  const option = [...select.options].find((o) => want.test(o.textContent));
  if (option) select.value = option.value;
}

function render(input, result) {
  const text = result.lines.map((l) => `${l.item}: ${l.qty} ${l.unit}`).join("\n");
  out.innerHTML = `
    <p class="calc-summary">${esc(summarize(input))}</p>
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
  const input = read();
  const result = fenceMaterials(input);
  if (!result.ok) { note.textContent = result.error; out.hidden = true; document.body.classList.remove("has-result"); return; }
  note.textContent = "";
  render(input, result);
  document.body.classList.add("has-result");
  prefillQuoteForm(result.type);
  out.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Picket fields only make sense for wood.
form?.addEventListener("change", () => {
  const wood = form.querySelector('input[name="type"]:checked')?.value === "wood";
  for (const name of ["picketWidth", "picketGap"]) form.querySelector(`[name="${name}"]`).closest("label").hidden = !wood;
});
