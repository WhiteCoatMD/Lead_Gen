import test from "node:test";
import assert from "node:assert/strict";
import { SANTA_JOBS_CRON, distVercelConfig, expandRedirect, hostedRedirects, rootVercelConfig, siteRedirects } from "./redirects.mjs";

test("extensionless redirects also cover the trailing slash", () => {
  assert.deepEqual(expandRedirect({ source: "/services1", destination: "/services" }).map((r) => r.source), ["/services1", "/services1/"]);
  assert.deepEqual(expandRedirect({ source: "/about.html", destination: "/about-us" }).map((r) => r.source), ["/about.html"]);
  assert.equal(expandRedirect({ source: "/index.html", destination: "/" })[0].permanent, true);
});

test("the root config carries the Santa job, and redirects stay on their own hosts", () => {
  const santa = distVercelConfig({
    domain: "customlettersfromsantaclaus.com",
    crons: [{ path: "/api/santa/jobs", schedule: "0 14,20 * * *" }],
  });
  const other = distVercelConfig({ domain: "example.com", redirects: [{ source: "/old", destination: "/new" }] });
  assert.deepEqual(santa.crons, [SANTA_JOBS_CRON]);
  assert.equal(other.crons, undefined);
  const root = rootVercelConfig([
    { domain: "customlettersfromsantaclaus.com" },
    { domain: "example.com", redirects: [{ source: "/old", destination: "/new" }] },
  ]);
  assert.deepEqual(root.crons, [SANTA_JOBS_CRON]);
  assert.equal(root.redirects.every((rule) => rule.has[0].value.endsWith("example.com")), true);
});

test("hosted redirects are repeated per host and do not leak across sites", () => {
  const rules = hostedRedirects({
    domain: "dallastowtrucks.com",
    redirectHosts: ["dallastowtrucks.com", "www.dallastowtrucks.com"],
    redirects: [{ source: "/index.html", destination: "/" }],
  });
  assert.equal(rules.length, 2);
  assert.deepEqual(rules.map((r) => r.has[0].value), ["dallastowtrucks.com", "www.dallastowtrucks.com"]);
  assert.equal(siteRedirects({ redirects: [] }).length, 0);
});
