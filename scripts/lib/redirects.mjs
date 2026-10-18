// Turns site.redirects into Vercel redirect rules.
//
// A per-site dist/vercel.json can list them plainly, because that deployment
// only serves one host. The repo-root vercel.json is read by every project in
// the monorepo, so those rules are repeated once per host and guarded with a
// host condition. A fence URL must not redirect on the towing project, and
// the reverse.

export function expandRedirect(rule) {
  if (!rule?.source || !rule?.destination || rule.source === rule.destination) return [];
  const base = { source: rule.source, destination: rule.destination, permanent: rule.permanent !== false };
  if (rule.source.endsWith(".html") || rule.source.endsWith("/")) return [base];
  return [base, { ...base, source: `${rule.source}/` }];
}

export function siteRedirects(site) {
  return (site.redirects || []).flatMap(expandRedirect);
}

export function hostedRedirects(site) {
  const hosts = Array.isArray(site.redirectHosts) && site.redirectHosts.length
    ? site.redirectHosts
    : [site.domain, `www.${site.domain}`].filter(Boolean);
  const rules = siteRedirects(site);
  const out = [];
  for (const host of hosts) {
    for (const rule of rules) {
      out.push({ ...rule, has: [{ type: "host", value: host }] });
    }
  }
  return out;
}

export function distVercelConfig(site) {
  const redirects = siteRedirects(site);
  const config = { buildCommand: null, outputDirectory: "." };
  if (redirects.length) config.redirects = redirects;
  return config;
}

export function rootVercelConfig(sites) {
  const redirects = sites.flatMap(hostedRedirects);
  return redirects.length ? { redirects } : {};
}
