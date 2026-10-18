import test from "node:test";
import assert from "node:assert/strict";
import { expandRedirect, hostedRedirects, siteRedirects } from "./redirects.mjs";

test("extensionless redirects also cover the trailing slash", () => {
  assert.deepEqual(expandRedirect({ source: "/services1", destination: "/services" }).map((r) => r.source), ["/services1", "/services1/"]);
  assert.deepEqual(expandRedirect({ source: "/about.html", destination: "/about-us" }).map((r) => r.source), ["/about.html"]);
  assert.equal(expandRedirect({ source: "/index.html", destination: "/" })[0].permanent, true);
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
