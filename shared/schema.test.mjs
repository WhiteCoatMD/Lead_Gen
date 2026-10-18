import test from "node:test";
import assert from "node:assert/strict";
import { areaNames, geoCoordinates, httpUrls, openingHoursSpecification, parseTimes } from "./schema.mjs";

test("24/7 hours parse without inventing a closing time from a bare clock", () => {
  assert.deepEqual(parseTimes("Open 24 hours"), [{ opens: "00:00", closes: "23:59" }]);
  assert.deepEqual(parseTimes("24/7"), [{ opens: "00:00", closes: "23:59" }]);
  const spec = openingHoursSpecification([{ days: "Monday - Sunday", time: "Open 24 hours" }]);
  assert.equal(spec.length, 1);
  assert.equal(spec[0].opens, "00:00");
  assert.equal(spec[0].dayOfWeek.length, 7);
  assert.equal(openingHoursSpecification(undefined), undefined);
});

test("empty geo, sameAs and license placeholders stay out of schema helpers", () => {
  assert.equal(geoCoordinates({ geo: { latitude: "", longitude: "" } }), undefined);
  assert.deepEqual(geoCoordinates({ geo: { latitude: 32.67524, longitude: -96.8416 } }).latitude, 32.67524);
  assert.deepEqual(httpUrls("", "  ", "https://example.com/a", "https://example.com/a"), ["https://example.com/a"]);
  assert.deepEqual(areaNames({ serviceAreas: ["Dallas", { name: "Plano", href: "/towing-plano.html" }, { href: "/x" }] }), ["Dallas", "Plano"]);
});
