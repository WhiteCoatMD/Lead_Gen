// Per-page rows for the weekly lead report: which pages produced call taps and
// delivered form leads. Built from event_counts_by_path() (lead-gen-admin
// migration 0006), which already aggregates to one row per site, page and type.
//
// The same page reaches us under slightly different paths — a visit records
// location.pathname ("/fence-calculator/"), a lead may carry the build-time
// path ("/fence-calculator") — so paths are normalised before merging.
//
// Only pages with at least one call tap or form lead are listed, so the table
// stays short. Pilot pages (the fence calculator and permit guides) are always
// listed, zeros included: "no leads yet" is the answer the pilot needs to see.

export function normalizePath(path) {
  let p = String(path ?? "").split(/[?#]/)[0].trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

// rows: [{ site, path, type, n }]; pilot: { [site]: string[] of paths }
export function pageRows(rows, pilot = {}) {
  const pages = new Map();
  const get = (site, path) => {
    const key = `${site} ${path}`;
    if (!pages.has(key)) pages.set(key, { site, path, views: 0, calls: 0, leads: 0, pilot: false });
    return pages.get(key);
  };
  for (const r of rows) {
    const page = get(r.site, normalizePath(r.path));
    const n = Number(r.n) || 0;
    if (r.type === "page_view") page.views += n;
    if (r.type === "call_click") page.calls += n;
    if (r.type === "lead_delivered") page.leads += n;
  }
  for (const [site, paths] of Object.entries(pilot)) {
    for (const path of paths) get(site, normalizePath(path)).pilot = true;
  }
  return [...pages.values()]
    .filter((p) => p.pilot || p.calls || p.leads)
    .sort((a, b) => b.leads - a.leads || b.calls - a.calls || b.views - a.views || a.site.localeCompare(b.site) || a.path.localeCompare(b.path));
}
