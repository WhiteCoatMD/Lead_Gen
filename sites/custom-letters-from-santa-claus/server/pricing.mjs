// Prices are cents so a household postmark cannot drift through float math.
// The sibling bundle is a flat charge for 2 to 5 children. One printed letter
// with the postmark add-on is +$9.95. More than one letter to the same
// household is $14.95 total for the add-on, not $9.95 times the letter count.

export function cents(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function catalogFromSite(site) {
  const products = {};
  for (const product of site?.products || []) {
    products[product.slug] = {
      name: product.name,
      price: Number(product.price),
      min: Number(product.repeatChildren?.min) || null,
      max: Number(product.repeatChildren?.max) || null,
    };
  }
  const postmark = site?.postmarkUpgrade || {};
  return {
    products,
    postmark: {
      enabled: postmark.enabled === true,
      single: Number(postmark.singlePrice),
      household: Number(postmark.householdPrice),
    },
  };
}

export function priceOrder(input, catalog) {
  const errors = [];
  const slug = input?.slug;
  const product = catalog?.products?.[slug];
  const qty = Number(input?.qty ?? 1);
  if (!product || cents(product.price) == null) {
    return fail(["Unknown product."]);
  }
  if (!Number.isInteger(qty) || qty !== 1) {
    errors.push("Order one of this product at a time.");
  }

  let letterCount = 0;
  let kind = "printed";
  if (slug === "email-from-santa") {
    kind = "email";
    letterCount = 1;
  } else if (slug === "sibling-bundle") {
    const count = Number(input?.childCount);
    const min = product.min || 2;
    const max = product.max || 5;
    letterCount = count;
    if (!Number.isInteger(count) || count < min || count > max) {
      errors.push(`The sibling bundle is a flat price for ${min} to ${max} children at one address.`);
    }
  } else if (slug === "personalized-letter") {
    letterCount = 1;
  } else {
    errors.push("Unknown product.");
  }

  const productCents = cents(product.price);
  const postmark = pricePostmark({
    kind,
    letterCount: errors.length ? 0 : letterCount,
    requested: input?.postmark === true,
    offer: catalog.postmark,
  });
  errors.push(...postmark.errors);

  if (errors.length) return fail(errors);
  return {
    ok: true,
    errors: [],
    kind,
    slug,
    name: product.name,
    letterCount,
    productCents,
    postmarkCents: postmark.cents,
    totalCents: productCents + postmark.cents,
  };
}

export function pricePostmark({ kind, letterCount, requested, offer }) {
  if (!requested) return { cents: 0, errors: [] };
  if (kind !== "printed") return { cents: 0, errors: ["The postmark add-on is only for a printed letter."] };
  if (offer?.enabled !== true) return { cents: 0, errors: ["The North Pole postmark add-on is not offered."] };
  const single = cents(offer.single);
  const household = cents(offer.household);
  if (single == null || household == null || single <= 0 || household <= 0) {
    return { cents: 0, errors: ["The postmark price is not configured."] };
  }
  if (!Number.isInteger(letterCount) || letterCount < 1) {
    return { cents: 0, errors: ["The postmark add-on needs a printed letter."] };
  }
  return { cents: letterCount > 1 ? household : single, errors: [] };
}

function fail(errors) {
  return { ok: false, errors, kind: null, letterCount: 0, productCents: 0, postmarkCents: 0, totalCents: 0 };
}
