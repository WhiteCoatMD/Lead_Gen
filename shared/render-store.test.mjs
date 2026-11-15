import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { renderShop } from "./render-shop.mjs";
import { childBundlePrice, renderStore, storeDocuments } from "./render-store.mjs";
import { sitemapXml } from "../scripts/lib/sitemap.mjs";
import {
  addLine,
  cartTotal,
  checkoutHref,
  formatPrice,
  isCheckoutUrl,
  notifyMailto,
  postmarkFeeCents,
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
  assert.equal(bundle.placeholder, false);
  assert.equal(bundle.price, 28.95);
  assert.equal(letter.checkoutUrl, "");
  assert.equal(email.checkoutUrl, "");
  assert.equal(bundle.checkoutUrl, "");
  assert.equal(site.postmarkUpgrade.enabled, false);
  for (const product of [letter, email, bundle]) {
    const adult = product.fields.find((field) => field.name === "buyerEmail");
    assert.equal(adult.required, true, product.slug);
    assert.match(adult.label, /parent or guardian/i);
  }
  const delivery = email.fields.find((field) => field.name === "recipientEmail");
  assert.match(delivery.label, /parent or guardian/i);
  assert.match(delivery.hint, /never a child/i);
  const confirm = email.fields.find((field) => field.name === "adultDeliveryConfirm");
  assert.equal(confirm.type, "checkbox");
  assert.equal(confirm.required, true);
  assert.equal(letter.fields.some((field) => field.name === "adultDeliveryConfirm"), false);
  assert.equal(letter.fields.some((field) => field.name === "recipientEmail"), false);

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
  const bundlePage = docs.pages.find((page) => page.slug === "products/sibling-bundle").html;
  assert.match(letterPage, /name="childName"/);
  assert.match(letterPage, /name="wishlist"/);
  assert.doesNotMatch(letterPage, /name="deliveryDate"/);
  assert.match(emailPage, /name="deliveryDate"/);
  assert.match(emailPage, /type="checkbox"[^>]*name="adultDeliveryConfirm"/);
  assert.match(emailPage, /parent or guardian email, not a child/);
  assert.doesNotMatch(letterPage, /name="adultDeliveryConfirm"/);
  assert.match(emailPage, /Coming soon/);
  assert.match(letterPage, /Coming soon/);
  assert.match(bundlePage, /December 9, 2026/);
  assert.match(letterPage, /December 9, 2026/);
  assert.match(emailPage, /December 24, 2026/);
  assert.equal(letterPage.includes("stripe.com"), false);
  assert.equal(letterPage.includes("shopify.com"), false);
  assert.match(letterPage, /data-checkout=""/);
  assert.equal(bundlePage.includes("Sample price"), false);
  assert.equal(bundlePage.includes(">Sample<"), false);
  assert.match(bundlePage, /\$28\.95/);
  assert.equal(bundlePage.includes("draft"), false);

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
  assert.match(html, /id="site-nav"/);
  assert.equal(html.includes("318-000-0000"), false);
  assert.equal(html.includes('href="tel:'), false);
  assert.equal(html.includes('class="nav-call"'), false);
  assert.equal(html.includes('class="mobile-call"'), false);
  assert.equal(html.includes("Sample price"), false);
  assert.equal(html.includes("draft"), false);
  assert.match(html, /rel="canonical" href="https:\/\/customlettersfromsantaclaus.com\/"/);
  const contact = docs.pages.find((page) => page.slug === "contact").html;
  assert.equal(contact.includes("mailto:"), false);
  assert.match(contact, /We'll be in touch/);
  assert.match(docs.pages.find((page) => page.slug === "privacy").html, /We'll be in touch/);
  assert.equal(docs.pages.find((page) => page.slug === "terms").html.includes("draft"), false);
  assert.equal(docs.pages.find((page) => page.slug === "refunds").html.includes("draft"), false);
  const business = blocks(html)[0];
  assert.equal(business.name, site.name);
  assert.equal(business.telephone, undefined);
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

  const privacy = docs.pages.find((page) => page.slug === "privacy").html;
  const shipping = docs.pages.find((page) => page.slug === "shipping").html;
  const faq = docs.pages.find((page) => page.slug === "faq").html;
  const terms = docs.pages.find((page) => page.slug === "terms").html;
  assert.doesNotMatch(privacy, /added to the link/i);
  assert.match(privacy, /not added to that payment link/);
  assert.match(privacy, /parent or guardian/i);
  assert.match(privacy, /refund window/);
  assert.match(shipping, /December 9, 2026/);
  assert.match(shipping, /5:00 PM CT/);
  assert.match(shipping, /December 24, 2026/);
  assert.match(faq, /December 9, 2026/);
  assert.match(faq, /December 24, 2026/);
  assert.match(terms, /December 9, 2026/);
  assert.match(html, /December 9, 2026/);
  assert.match(html, /December 24, 2026/);
  assert.match(html, /data-omit-checkout-query="true"/);
  assert.equal(html.includes(">USPS<"), false);
  assert.match(html, /class="hero-photo"/);
  assert.match(html, /Santa Claus at his desk/);
  assert.doesNotMatch(html, />SANTA</);
  assert.match(html, /spot-envelope.webp/);
  assert.match(html, /loading="lazy"/);
  assert.match(bundlePage, /One flat price of \$28\.95 for 2 to 5 children in the same household/);
  assert.match(bundlePage, /Families with more than 5 children can add a separate letter/);
  assert.match(bundlePage, /data-child-max="5"/);
  assert.match(bundlePage, /data-extra-child-price="0"/);
  assert.match(bundlePage, /data-base-price="28.95"/);
  assert.match(bundlePage, /data-base-children="2"/);
  assert.match(html, /2 to 5 children in the same household/);
  assert.match(bundlePage, /Add another child/);
  assert.match(bundlePage, /name="child1Name"/);
  assert.match(bundlePage, /name="child2Name"/);
  assert.equal((bundlePage.match(/data-child-slot/g) || []).length >= 3, true);
  assert.doesNotMatch(between(bundlePage, 'data-child-slots', "</form>").slice(0, between(bundlePage, 'data-child-slots', "data-child-template").length), /type="email"/);
  assert.match(bundlePage, /name="buyerEmail"/);
  assert.match(faq, /one flat price of \$28\.95 for 2 to 5 children in the same household/i);
  assert.match(faq, /more than 5 children can add a separate letter/i);
  assert.match(shipping, /one flat price of \$28\.95 for 2 to 5 children in the same household/);
  assert.match(shipping, /more than 5 children can add a separate letter/);
  assert.match(terms, /one flat price of \$28\.95 for 2 to 5 children in the same household/);
  assert.match(terms, /more than 5 children can add a separate letter/);
  const bundleLd = blocks(bundlePage).find((block) => block["@type"] === "Product");
  assert.match(bundleLd.description, /2 to 5 children in the same household/);
  assert.match(bundleLd.description, /separate letter/);
  assert.match(bundleLd.description, /own envelope/);
  assert.doesNotMatch([bundlePage, faq, shipping, terms].join("\n"), /mailed together/i);
  assert.equal(bundleLd.offers.price, "28.95");
  assert.equal(site.products.find((product) => product.slug === "sibling-bundle").bundlePricing.extraChildPrice, 0);
  const rendered = [html, ...docs.pages.map((page) => page.html), ...docs.files.map((file) => file.body)].join("\n");
  assert.doesNotMatch(rendered, /last-order/i);
  assert.doesNotMatch(rendered, /last day to order/i);
  assert.doesNotMatch(rendered, /season cutoff/i);
  assert.doesNotMatch(rendered, /do not publish a number of days/i);
  assert.doesNotMatch(rendered, /postmark/i);
  assert.doesNotMatch(rendered, /North Pole USPS/i);
  assert.doesNotMatch(rendered, /USPS facility/i);
  assert.doesNotMatch(rendered, /November 26/);
  assert.doesNotMatch(rendered, /\$9\.95/);
  assert.doesNotMatch(rendered, /\$14\.95/);
  assert.equal(rendered.includes("aggregateRating"), false);
  assert.equal(rendered.includes("testimonial"), false);
});

test("sibling bundle price stays flat unless an extra-child price is configured", () => {
  assert.equal(childBundlePrice({ basePrice: 28.95, baseChildren: 2, extraChildPrice: 0, count: 2 }), 28.95);
  assert.equal(childBundlePrice({ basePrice: 28.95, baseChildren: 2, extraChildPrice: 0, count: 6 }), 28.95);
  assert.equal(childBundlePrice({ basePrice: 28.95, baseChildren: 2, extraChildPrice: 5, count: 2 }), 28.95);
  assert.equal(childBundlePrice({ basePrice: 28.95, baseChildren: 2, extraChildPrice: 5, count: 4 }), 38.95);
  assert.equal(childBundlePrice({ basePrice: 28.95, baseChildren: 2, extraChildPrice: -1, count: 5 }), 28.95);
});

test("North Pole postmark upgrade is absent until the flag is turned on", async () => {
  const site = await readSite("custom-letters-from-santa-claus");
  const on = structuredClone(site);
  on.postmarkUpgrade.enabled = true;
  const home = renderStore(on, "custom-letters-from-santa-claus");
  const docs = storeDocuments(on, "custom-letters-from-santa-claus");
  const letter = docs.pages.find((page) => page.slug === "products/personalized-letter").html;
  const bundle = docs.pages.find((page) => page.slug === "products/sibling-bundle").html;
  const email = docs.pages.find((page) => page.slug === "products/email-from-santa").html;
  const faq = docs.pages.find((page) => page.slug === "faq").html;
  const shipping = docs.pages.find((page) => page.slug === "shipping").html;
  const terms = docs.pages.find((page) => page.slug === "terms").html;
  const phrase = /real hand-applied North Pole, Alaska postmark through the USPS holiday postmark program/;
  for (const page of [home, letter, bundle, faq, shipping, terms]) {
    assert.match(page, phrase);
    assert.match(page, /\$9\.95/);
    assert.match(page, /\$14\.95/);
    assert.match(page, /November 26, 2026, 5:00 PM CT/);
  }
  assert.match(letter, /name="northPolePostmark"/);
  assert.match(letter, /data-letter-count="1"/);
  assert.match(bundle, /name="northPolePostmark"/);
  assert.match(bundle, /\$14\.95/);
  assert.match(bundle, /data-letter-count="2"/);
  assert.equal(email.includes("northPolePostmark"), false);
  assert.doesNotMatch(email, phrase);
  assert.match(letter, /US mainland/);
  assert.doesNotMatch(letter, /postmarked from the North Pole/i);
  assert.doesNotMatch(home, /Postmarked from the North Pole USPS facility/);
  assert.match(home, /data-postmark-single="995"/);
  assert.match(home, /data-postmark-household="1495"/);
  assert.match(home, /data-postmark-label="North Pole, Alaska postmark"/);
  assert.match(letter, /Coming soon/);
  assert.match(email, /Coming soon/);
  assert.equal(letter.includes('data-checkout=""') || letter.includes("data-checkout=\"\""), true);
});

test("postmark fee is $9.95 for one letter and a flat $14.95 for a household", () => {
  const offer = { singleCents: 995, householdCents: 1495 };
  const address = [
    { name: "northPolePostmark", value: "yes" },
    { name: "shipStreet", value: "1 Main" },
    { name: "shipCity", value: "Grayson" },
    { name: "shipState", value: "LA" },
    { name: "shipZip", value: "71245" },
  ];
  const one = { slug: "personalized-letter", qty: 1, letterCount: 1, fields: address };
  assert.equal(postmarkFeeCents([], offer), 0);
  assert.equal(postmarkFeeCents([one], null), 0);
  assert.equal(postmarkFeeCents([one], offer), 995);
  assert.equal(postmarkFeeCents([{ ...one, qty: 2 }], offer), 1495);
  assert.equal(postmarkFeeCents([{ ...one, slug: "sibling-bundle", qty: 1, letterCount: 2 }], offer), 1495);
  assert.equal(postmarkFeeCents([{ ...one, fields: [{ name: "northPolePostmark", value: "" }] }], offer), 0);
  const elsewhere = {
    ...one,
    fields: address.map((field) => field.name === "shipStreet" ? { ...field, value: "9 Oak" } : { ...field }),
  };
  assert.equal(postmarkFeeCents([one, elsewhere], offer), 1990);
  assert.equal(postmarkFeeCents([one, { ...one, fieldKey: "second" }], offer), 1495);
});

test("Make Your Own Crap catalog is entirely a placeholder", async () => {
  const site = await readSite("make-your-own-crap");
  assert.equal(site.phone, "318-000-0000");
  assert.equal(site.contactEmail, "");
  assert.equal(site.products.length, 6);
  assert.ok(site.products.every((product) => product.placeholder === true && product.checkoutUrl === ""));
  const docs = storeDocuments(site, "make-your-own-crap");
  const shop = docs.pages.find((page) => page.slug === "shop").html;
  assert.equal((shop.match(/Sample price/g) || []).length, 0);
  assert.equal(shop.includes(">Sample<"), false);
  assert.equal(shop.includes("draft"), false);
  assert.equal(shop.includes("318-000-0000"), false);
  assert.match(shop, /rel="canonical" href="https:\/\/makeyourowncrap.com\/shop"/);
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
  assert.match(home, />BUILD</);
  assert.equal(home.includes("data-postmark-single"), false);
  assert.equal(home.includes("data-omit-checkout-query"), false);
  assert.equal(home.includes(">USPS<"), false);
  assert.equal(blocks(home)[0].telephone, undefined);
  assert.match(home, /rel="canonical" href="https:\/\/makeyourowncrap.com\/"/);
  const contact = docs.pages.find((page) => page.slug === "contact").html;
  assert.equal(contact.includes("mailto:"), false);
  assert.match(contact, /We'll be in touch/);
});

test("a store with a real phone still publishes it, and a placeholder stays hidden", async () => {
  const site = await readSite("custom-letters-from-santa-claus");
  const live = structuredClone(site);
  live.phone = "318-555-0142";
  const html = renderStore(live, "custom-letters-from-santa-claus");
  assert.match(html, /class="nav-call"/);
  assert.match(html, /class="mobile-call"/);
  assert.match(html, />318-555-0142</);
  assert.equal(blocks(html)[0].telephone, "318-555-0142");
  const quiet = structuredClone(site);
  quiet.phone = "";
  const hidden = renderStore(quiet, "custom-letters-from-santa-claus");
  assert.equal(hidden.includes('href="tel:'), false);
  assert.equal(blocks(hidden)[0].telephone, undefined);
  const withInbox = structuredClone(site);
  withInbox.contactEmail = "orders@example.com";
  const contact = storeDocuments(withInbox, "custom-letters-from-santa-claus").pages.find((page) => page.slug === "contact").html;
  assert.match(contact, /mailto:orders@example.com/);
});

test("the shop template used by other businesses still renders a menu board", async () => {
  const snowballs = JSON.parse(await fs.readFile(new URL("../sites/hippie-chicks-snowballs/site.json", import.meta.url), "utf8"));
  const html = renderShop(snowballs);
  assert.match(html, /class="shop-hero"/);
  assert.match(html, /id="store"/);
  assert.equal(html.includes("/store.js"), false);
});

test("Santa checkout stays on the coming-soon path until checkout.enabled is true", async () => {
  const site = await readSite("custom-letters-from-santa-claus");
  assert.equal(site.checkout.enabled, false);
  const off = storeDocuments(site, "custom-letters-from-santa-claus").pages.find((page) => page.slug === "products/personalized-letter").html;
  assert.match(off, /Coming soon/);
  assert.equal(off.includes("data-stripe-checkout"), false);
  assert.equal(off.includes("santa-checkout.js"), false);
  const on = structuredClone(site);
  on.checkout = { enabled: true };
  const docs = storeDocuments(on, "custom-letters-from-santa-claus");
  const letter = docs.pages.find((page) => page.slug === "products/personalized-letter").html;
  assert.match(letter, /data-stripe-checkout/);
  assert.match(letter, /\/santa-checkout\.js/);
  assert.equal(letter.includes("Coming soon"), false);
  assert.equal(letter.includes("childName="), false);
  assert.equal(blocks(letter).find((block) => block["@type"] === "Product").offers.availability, "https://schema.org/InStock");
  const home = renderStore(on, "custom-letters-from-santa-claus");
  assert.match(home, /data-checkout-enabled="true"/);
  const quiet = renderStore(site, "custom-letters-from-santa-claus");
  assert.equal(quiet.includes("data-checkout-enabled"), false);
  assert.equal(quiet.includes("santa-checkout.js"), false);
  const other = renderStore(await readSite("make-your-own-crap"), "make-your-own-crap");
  assert.equal(other.includes("data-checkout-enabled"), false);
  assert.equal(other.includes("santa-checkout.js"), false);
});
