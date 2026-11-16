import { cutoffErrors, deliveryDateError } from "./cutoffs.mjs";
import { orderingOf } from "./config.mjs";
import { catalogFromSite, priceOrder } from "./pricing.mjs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHILD_KEYS = ["Name", "Age", "Town", "FriendOrPet", "Accomplishment", "WorkOn", "Wishlist"];

// Parents only. A child never has an email. The form's recipient address is
// the parent's, and the checkbox has to say so.

export function normalizeOrder(body) {
  if (Array.isArray(body?.fields)) return fromFields(body);
  const children = Array.isArray(body?.children) ? body.children.map(cleanChild) : [];
  return {
    slug: String(body?.slug || ""),
    qty: Number(body?.qty ?? 1),
    postmark: body?.postmark === true,
    parentEmail: cleanEmail(body?.parentEmail),
    recipientEmail: cleanEmail(body?.recipientEmail),
    recipientConfirmed: body?.recipientConfirmed === true,
    deliveryDate: String(body?.deliveryDate || "").trim(),
    address: {
      name: clip(body?.address?.name, 120),
      street: clip(body?.address?.street, 160),
      city: clip(body?.address?.city, 80),
      state: clip(body?.address?.state, 40),
      zip: clip(body?.address?.zip, 10),
    },
    children,
  };
}

export function validateOrder(body, { now = new Date(), site } = {}) {
  const order = normalizeOrder(body);
  const catalog = catalogFromSite(site);
  const ordering = orderingOf(site);
  const errors = [];
  if (!order.parentEmail || !EMAIL.test(order.parentEmail)) errors.push("A parent or guardian email is required.");
  if (order.children.some((child) => child && child.rejected)) errors.push("A child's email is not collected.");
  const usable = order.children.filter((child) => child && !child.rejected);
  for (const child of usable) {
    if (!child.firstName) errors.push("Each child needs a name.");
    if (!child.age) errors.push("Each child needs an age.");
    if (!child.town) errors.push("Each child needs a town.");
    if (!child.accomplishment) errors.push("Each child needs an accomplishment.");
    if (child.firstName.includes("@") || child.age.includes("@")) errors.push("A child's email is not collected.");
  }
  const priced = priceOrder({
    slug: order.slug,
    qty: order.qty,
    childCount: usable.length,
    postmark: order.postmark,
  }, catalog);
  errors.push(...priced.errors);
  if (priced.ok) errors.push(...cutoffErrors({ kind: priced.kind, postmark: order.postmark && priced.postmarkCents > 0, now, ordering }));
  if (priced.kind === "email") {
    if (!order.recipientEmail || !EMAIL.test(order.recipientEmail)) errors.push("The delivery address has to be a parent or guardian email.");
    if (!order.recipientConfirmed) errors.push("Confirm that the delivery address is a parent or guardian email, not a child's.");
    const dateError = deliveryDateError(order.deliveryDate, now, ordering);
    if (dateError) errors.push(dateError);
  }
  if (priced.kind === "printed") {
    const address = order.address;
    if (!address.name || !address.street || !address.city || !address.state || !address.zip) {
      errors.push("A mailing address in the United States is required.");
    }
  }
  const unique = [...new Set(errors)];
  if (unique.length || !priced.ok) {
    return { ok: false, errors: unique.length ? unique : priced.errors, order };
  }
  return {
    ok: true,
    errors: [],
    order: {
      ...order,
      children: usable,
      kind: priced.kind,
      productName: priced.name,
      letterCount: priced.letterCount,
      productCents: priced.productCents,
      postmarkCents: priced.postmarkCents,
      totalCents: priced.totalCents,
      postmark: priced.postmarkCents > 0,
    },
  };
}

function fromFields(body) {
  const map = {};
  for (const field of body.fields) {
    if (!field?.name) continue;
    map[field.name] = clip(field.value, field.name.includes("Wishlist") || field.name.includes("accomplishment") || field.name.includes("Accomplishment") || field.name.includes("workOn") || field.name.includes("WorkOn") ? 800 : 160);
  }
  if (Object.keys(map).some((name) => /email/i.test(name) && !["buyerEmail", "recipientEmail", "notifyEmail"].includes(name))) {
    return { slug: String(body.slug || ""), qty: Number(body.qty ?? 1), children: [{ rejected: true }], parentEmail: "", address: {}, postmark: false };
  }
  const children = map.child1Name || map.child1Age ? bundleChildren(map) : [childFrom(map.childName, map.age, map.town, map.friendOrPet, map.accomplishment, map.workOn, map.wishlist)];
  return {
    slug: String(body.slug || ""),
    qty: Number(body.qty ?? map.qty ?? 1),
    postmark: /^(yes|true|on|1)$/i.test(map.northPolePostmark || ""),
    parentEmail: cleanEmail(map.buyerEmail),
    recipientEmail: cleanEmail(map.recipientEmail),
    recipientConfirmed: /^(yes|true|on|1)$/i.test(map.adultDeliveryConfirm || ""),
    deliveryDate: String(map.deliveryDate || "").trim(),
    address: {
      name: clip(map.shipName, 120),
      street: clip(map.shipStreet, 160),
      city: clip(map.shipCity, 80),
      state: clip(map.shipState, 40),
      zip: clip(map.shipZip, 10),
    },
    children: children.filter((child) => child && (child.firstName || child.age || child.town || child.rejected)),
  };
}

function bundleChildren(map) {
  const children = [];
  for (let n = 1; n <= 8; n += 1) {
    if (!CHILD_KEYS.some((key) => String(map[`child${n}${key}`] || "").trim())) continue;
    children.push(childFrom(
      map[`child${n}Name`],
      map[`child${n}Age`],
      map[`child${n}Town`],
      map[`child${n}FriendOrPet`],
      map[`child${n}Accomplishment`],
      map[`child${n}WorkOn`],
      map[`child${n}Wishlist`],
    ));
  }
  return children;
}

function childFrom(name, age, town, friend, accomplishment, workOn, wishlist) {
  return {
    firstName: clip(name, 80),
    age: clip(age, 20),
    town: clip(town, 80),
    friendOrPet: clip(friend, 120),
    accomplishment: clip(accomplishment, 800),
    workOn: clip(workOn, 800),
    wishlist: clip(wishlist, 800),
  };
}

function cleanChild(child) {
  if (!child || typeof child !== "object") return { rejected: true };
  if (Object.keys(child).some((key) => /email/i.test(key))) return { rejected: true };
  return childFrom(child.firstName, child.age, child.town, child.friendOrPet, child.accomplishment, child.workOn, child.wishlist);
}

function cleanEmail(value) {
  return clip(String(value || "").trim().toLowerCase(), 160);
}

function clip(value, max) {
  return String(value ?? "").trim().slice(0, max);
}
