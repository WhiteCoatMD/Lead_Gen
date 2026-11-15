import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DECISIONS, loadSite } from "./config.mjs";
import { catalogFromSite, priceOrder } from "./pricing.mjs";

const catalog = {
  products: {
    "personalized-letter": { name: "Personalized Letter from Santa", price: 15.95 },
    "email-from-santa": { name: "Email from Santa", price: 6.95 },
    "sibling-bundle": { name: "Sibling letter bundle", price: 28.95, min: 2, max: 5 },
  },
  postmark: { enabled: true, single: 9.95, household: 14.95 },
};

test("printed, email, and the 2 to 5 sibling bundle use the flat prices", () => {
  assert.equal(priceOrder({ slug: "personalized-letter", childCount: 1 }, catalog).totalCents, 1595);
  assert.equal(priceOrder({ slug: "email-from-santa", childCount: 1 }, catalog).totalCents, 695);
  for (const count of [2, 3, 4, 5]) {
    const priced = priceOrder({ slug: "sibling-bundle", childCount: count }, catalog);
    assert.equal(priced.ok, true, String(count));
    assert.equal(priced.totalCents, 2895, String(count));
    assert.equal(priced.letterCount, count);
  }
  assert.equal(priceOrder({ slug: "sibling-bundle", childCount: 1 }, catalog).ok, false);
  assert.equal(priceOrder({ slug: "sibling-bundle", childCount: 6 }, catalog).ok, false);
  assert.match(priceOrder({ slug: "sibling-bundle", childCount: 6 }, catalog).errors.join(" "), /2 to 5/);
});

test("postmark is $9.95 for one letter and $14.95 flat for a household", () => {
  const hidden = { ...catalog, postmark: { ...catalog.postmark, enabled: false } };
  assert.equal(priceOrder({ slug: "personalized-letter", childCount: 1, postmark: true }, hidden).ok, false);
  const one = priceOrder({ slug: "personalized-letter", childCount: 1, postmark: true }, catalog);
  assert.equal(one.postmarkCents, 995);
  assert.equal(one.totalCents, 1595 + 995);
  const bundle = priceOrder({ slug: "sibling-bundle", childCount: 4, postmark: true }, catalog);
  assert.equal(bundle.postmarkCents, 1495);
  assert.equal(bundle.totalCents, 2895 + 1495);
  assert.notEqual(bundle.postmarkCents, 995 * 4);
  const five = priceOrder({ slug: "sibling-bundle", childCount: 5, postmark: true }, catalog);
  assert.equal(five.postmarkCents, 1495);
  assert.equal(priceOrder({ slug: "email-from-santa", childCount: 1, postmark: true }, catalog).ok, false);
});

test("site.json matches the owner's prices and keeps checkout and postmark off", () => {
  const site = loadSite();
  assert.equal(site.checkout.enabled, false);
  assert.equal(site.postmarkUpgrade.enabled, false);
  const live = catalogFromSite(site);
  for (const [slug, price] of Object.entries(DECISIONS.prices)) {
    assert.equal(live.products[slug].price, price);
  }
  assert.equal(live.products["sibling-bundle"].min, DECISIONS.bundle.min);
  assert.equal(live.products["sibling-bundle"].max, DECISIONS.bundle.max);
  assert.equal(site.postmarkUpgrade.singlePrice, DECISIONS.postmark.single);
  assert.equal(site.postmarkUpgrade.householdPrice, DECISIONS.postmark.household);
  const priced = priceOrder({ slug: "sibling-bundle", childCount: 5, postmark: true }, live);
  assert.equal(priced.ok, false);
});
