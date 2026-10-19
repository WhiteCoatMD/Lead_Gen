import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { renderShop } from "./render-shop.mjs";
import { renderStore, storeDocuments } from "./render-store.mjs";
import { sitemapXml } from "../scripts/lib/sitemap.mjs";
import {
  addLine,
  cartTotal,
  checkoutHref,
  formatPrice,
  isCheckoutUrl,
  notifyMailto,
  toCents,
} from "./store-cart.mjs";

const readSite = async (slug) => JSON.parse(await fs.readFile(new URL(`../sites/${slug}/site.json`, import.meta.url), "utf8"));

const blocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
const between = (text, open, close) => {
  const start = text.indexOf(open);
  if (start === -1) return "";
  const rest = text.slice(start + open.length);
  const end = rest.indexOf(close);
  return end === -1 ? "" : rest.slice(0, end);
};

test("checkout links are only real http(s) URLs, with order details appended", () => {
  assert.equal(isCheckoutUrl(""), false);
  assert.equal(isCheckoutUrl("coming soon"), false);
  assert.equal(isCheckoutUrl("/shop"), false);
  assert.equal(isCheckoutUrl("javascript:alert(1)"), false);
  assert.equal(checkoutHref("", { childName: "Ada" }), "");
  assert.equal(checkoutHref("javascript:alert(1)", { childName: "Ada" }), "");
  const href = checkoutHref("https://buy.stripe.com/test_abc?utm=1", { childName: "Ada", age: "6", wishlist: "" });
  const url = new URL(href);
  assert.equal(url.searchParams.get("utm"), "1");
  assert.equal(url.searchParams.get("childName"), "Ada");
  assert.equal(url.searchParams.get("age"), "6");
  assert.equal(url.searchParams.get("wishlist"), null);
  assert.equal(toCents(15.95), 1595);
  assert.equal(formatPrice(6.95), "$6.95");
  assert.equal(formatPrice(34), "$34.00");
});

test("cart lines merge only when the personalization matches", () => {
  const base = { slug: "personalized-letter", name: "Letter", price: 15.95, qty: 1, checkoutUrl: "" };
  const ada = { ...base, fields: [{ name: "childName", label: "Child's name", value: "Ada" }], fieldKey: "childName=Ada" };
  const bo = { ...base, fields: [{ name: "childName", label: "Child's name", value: "Bo" }], fieldKey: "childName=Bo" };
  const once = addLine([], ada);
  const twice = addLine(once, { ...ada, qty: 1 });
  assert.equal(twice.length, 1);
  assert.equal(twice[0].qty, 2);
  const both = addLine(twice, bo);
  assert.equal(both.length, 2);
  assert.equal(cartTotal(both), toCents(15.95) * 3);
  assert.equal(notifyMailto("", { product: "Letter", email: "a@b.co" }), "");
  assert.match(notifyMailto("orders@example.com", { product: "Letter", email: "a@b.co", fields: ada.fields }), /^mailto:orders@example.com\?/);
});

test("Santa storefront keeps the real offers and does not invent a payment link", async () => {
  const site = await readSite("custom-letters-from-santa-claus");
  assert.equal(site.phone, "318-000-0000");
  assert.equal(site.contactEmail, "");
  assert.equal(site.template, "store");
  const letter = site.products.find((product) => product.slug === "personalized-letter");
  const email = site.products.find((product) => product.slug === "email-from-santa");
  const bundle = site.products.find((product) => product.slug === "sibling-bundle");
  assert.equal(letter.placeholder, false);
  assert.equal(letter.price, 15.95);
  assert.equal(email.placeholder, false);
  assert.equal(email.price, 6.95);
  assert.equal(bundle.placeholder, true);
  assert.equal(letter.checkoutUrl, "");
  assert.equal(email.checkoutUrl, "");
  assert.equal(bundle.checkoutUrl, "");

  const labels = letter.fields.map((field) => field.label);
  for (const label of ["Child's name", "Age", "Town", "A friend or a pet", "An accomplishment", "Something to work on", "Wish list"]) {
    assert.ok(labels.includes(label), label);
  }
  assert.equal(letter.fields.some((field) => field.name === "deliveryDate"), false);
  assert.ok(email.fields.some((field) => field.name === "deliveryDate" && field.required));
  assert.ok(letter.fields.some((field) => field.name === "shipStreet"));
  assert.equal(email.fields.some((field) => field.name === "shipStreet"), false);

  const html = renderStore(site, "custom-letters-from-santa-claus");
  const docs = storeDocuments(site, "custom-letters-from-santa-claus");
  const letterPage = docs.pages.find((page) => page.slug === "products/personalized-letter").html;
  const emailPage = docs.pages.find((page) => page.slug === "products/email-from-santa").html;
  assert.match(letterPage, /name="childName"/);
  assert.match(letterPage, /name="wishlist"/);
  assert.doesNotMatch(letterPage, /name="deliveryDate"/);
  assert.match(emailPage, /name="deliveryDate"/);
  assert.match(emailPage, /Coming soon/);
  assert.equal(letterPage.includes("stripe.com"), false);
  assert.equal(letterPage.includes("shopify.com"), false);
  assert.match(letterPage, /data-checkout=""/);
  assert.match(docs.pages.find((page) => page.slug === "products/sibling-bundle").html, /Sample price/);

  const productLd = blocks(letterPage).find((block) => block["@type"] === "Product");
  assert.equal(productLd.name, letter.name);
  assert.equal(productLd.offers.price, "15.95");
  assert.equal(productLd.offers.priceCurrency, "USD");
  assert.equal(productLd.offers.availability, "https://schema.org/PreOrder");
  assert.equal(productLd.aggregateRating, undefined);
  assert.equal(productLd.review, undefined);
  assert.equal(JSON.stringify(productLd).includes("aggregateRating"), false);

  const withLink = structuredClone(site);
  withLink.products[0].checkoutUrl = "https://buy.stripe.com/test_example";
  const linked = storeDocuments(withLink, "custom-letters-from-santa-claus").pages.find((page) => page.slug === "products/personalized-letter").html;
  assert.match(linked, /href="https:\/\/buy\.stripe\.com\/test_example"/);
  assert.equal(blocks(linked).find((block) => block["@type"] === "Product").offers.availability, "https://schema.org/InStock");

  assert.ok((html.match(/class="product"/g) || []).length >= 3);
  assert.match(html, /id="store"/);
  assert.match(html, /id="areas"/);
  assert.match(html, /class="nav-call"/);
  assert.match(html, /class="mobile-call"/);
  assert.match(html, /id="site-nav"/);
  assert.ok((html.match(/href="tel:/g) || []).length >= 4);
  assert.match(html, />318-000-0000</);
  const business = blocks(html)[0];
  assert.equal(business.name, site.name);
  assert.equal(business.address.addressLocality, "Grayson");
  assert.ok(Array.isArray(business.areaServed) && business.areaServed.length > 0);
  assert.equal(business.url, "https://customlettersfromsantaclaus.com");
  const titles = [between(html, "<title>", "</title>"), ...docs.pages.map((page) => between(page.html, "<title>", "</title>"))];
  assert.equal(new Set(titles).size, titles.length);
  const xml = sitemapXml(site.domain, docs.pages.map((page) => ({ slug: page.slug })), site.updated);
  assert.match(xml, /https:\/\/customlettersfromsantaclaus.com\/products\/personalized-letter/);
  assert.match(xml, /https:\/\/customlettersfromsantaclaus.com\/refunds/);
  assert.equal(html.includes("testimonial"), false);
  assert.equal(letterPage.includes("aggregateRating"), false);
});

test("Make Your Own Crap catalog is entirely a placeholder", async () => {
  const site = await readSite("make-your-own-crap");
  assert.equal(site.phone, "318-000-0000");
  assert.equal(site.contactEmail, "");
  assert.equal(site.products.length, 6);
  assert.ok(site.products.every((product) => product.placeholder === true && product.checkoutUrl === ""));
  const docs = storeDocuments(site, "make-your-own-crap");
  const shop = docs.pages.find((page) => page.slug === "shop").html;
  assert.equal((shop.match(/Sample price/g) || []).length, 6);
  assert.match(shop, /Candle Kit/);
  assert.match(shop, /Hot Sauce Kit/);
  assert.match(shop, /Terrarium Kit/);
  assert.match(shop, /Birdhouse Kit/);
  assert.match(shop, /Soap Kit/);
  assert.match(shop, /Cocktail Bitters Kit/);
  const bitters = docs.pages.find((page) => page.slug === "products/cocktail-bitters-kit").html;
  assert.match(bitters, /No alcohol/);
  assert.equal(bitters.includes("stripe.com"), false);
  const home = renderStore(site, "make-your-own-crap");
  assert.ok((home.match(/class="product"/g) || []).length >= 3);
  assert.match(home, /But only a little/);
});

test("the shop template used by other businesses still renders a menu board", async () => {
  const snowballs = JSON.parse(await fs.readFile(new URL("../sites/hippie-chicks-snowballs/site.json", import.meta.url), "utf8"));
  const html = renderShop(snowballs);
  assert.match(html, /class="shop-hero"/);
  assert.match(html, /id="store"/);
  assert.equal(html.includes("/store.js"), false);
});
