// Structured-data helpers shared by the renderers.
//
// The governing rule is the same one the rebuilds ran under: never emit a fact
// the site does not actually state. Every function here returns undefined when
// it cannot produce something true, and the schema object drops undefined keys
// on JSON.stringify. A missing property costs a little rich-result eligibility;
// a wrong one is a lie told to Google in a machine-readable format, and opening
// hours are the field customers act on by driving to a closed shop.

const DAYS = {
  monday: "Monday", mon: "Monday",
  tuesday: "Tuesday", tue: "Tuesday", tues: "Tuesday",
  wednesday: "Wednesday", wed: "Wednesday",
  thursday: "Thursday", thu: "Thursday", thur: "Thursday", thurs: "Thursday",
  friday: "Friday", fri: "Friday",
  saturday: "Saturday", sat: "Saturday",
  sunday: "Sunday", sun: "Sunday",
};
const ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// "Mon - Fri" / "Monday – Sunday" / "Saturday" -> list of day names.
// Anything that is not a day expression -- "Last wash", "Holidays" -- returns
// undefined so the caller skips that row rather than guessing at it.
export function parseDays(text = "") {
  const cleaned = String(text).toLowerCase().replace(/[–—]/g, "-").trim();
  const range = cleaned.split("-").map((part) => part.trim()).filter(Boolean);

  if (range.length === 2) {
    const from = DAYS[range[0]];
    const to = DAYS[range[1]];
    if (!from || !to) return undefined;
    const start = ORDER.indexOf(from);
    const end = ORDER.indexOf(to);
    // A wrapping range like "Sat - Mon" is legitimate, so walk forward with a
    // modulo rather than slicing, and stop after a full week.
    const out = [];
    for (let i = 0; i < 7; i++) {
      const day = ORDER[(start + i) % 7];
      out.push(day);
      if (day === to) break;
    }
    return out.length ? out : undefined;
  }

  const single = DAYS[cleaned];
  return single ? [single] : undefined;
}

// "5:00 pm" -> "17:00". Needs an explicit meridiem: a bare "7:00" is ambiguous
// between morning and evening and is not worth a guess.
function to24Hour(value, inheritedMeridiem) {
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return undefined;
  const meridiem = (match[3] || inheritedMeridiem || "").toLowerCase();
  if (!meridiem) return undefined;
  let hour = Number(match[1]);
  const minute = match[2] || "00";
  if (hour < 1 || hour > 12) return undefined;
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

// "11:00 am - 7:00 pm" -> [{opens, closes}]
// "7:00 - 8:30 am, 11:00 am - 7:00 pm" -> two intervals, with the leading
// "7:00" taking its meridiem from the "8:30 am" it is paired with.
// "Closed" -> [] , which is a known answer, not a failure.
export function parseTimes(text = "") {
  const cleaned = String(text).replace(/[–—]/g, "-").trim();
  if (/^closed$/i.test(cleaned)) return [];

  const intervals = [];
  for (const chunk of cleaned.split(",")) {
    const parts = chunk.split("-").map((part) => part.trim()).filter(Boolean);
    if (parts.length !== 2) return undefined;
    const trailing = parts[1].match(/(am|pm)/i);
    const opens = to24Hour(parts[0], trailing ? trailing[1] : undefined);
    const closes = to24Hour(parts[1]);
    if (!opens || !closes) return undefined;
    intervals.push({ opens, closes });
  }
  return intervals.length ? intervals : undefined;
}

// site.hours -> schema.org openingHoursSpecification, skipping any row that
// cannot be read with confidence. Returns undefined rather than an empty array
// so the key disappears entirely when nothing parsed.
export function openingHoursSpecification(hours) {
  if (!Array.isArray(hours)) return undefined;
  const specs = [];
  for (const row of hours) {
    const dayOfWeek = parseDays(row?.days);
    if (!dayOfWeek) continue;
    const intervals = parseTimes(row?.time);
    if (!intervals) continue;
    for (const { opens, closes } of intervals) {
      specs.push({ "@type": "OpeningHoursSpecification", dayOfWeek, opens, closes });
    }
  }
  return specs.length ? specs : undefined;
}

// The services a site actually lists, as a catalog of Offers. This is the one
// piece of structured data most of these sites were missing outright: the
// services are the whole point of a contractor site and nothing machine-
// readable said what they were.
export function serviceCatalog(site, services) {
  if (!Array.isArray(services) || !services.length) return undefined;
  const itemListElement = services
    .map((service) => {
      const name = service?.title || service?.name;
      if (!name) return null;
      return {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name,
          description: service.description || undefined,
          provider: { "@id": businessId(site) },
          areaServed: (site.serviceAreas || [site.city]).map((area) => ({ "@type": "Place", name: area })),
        },
      };
    })
    .filter(Boolean);
  if (!itemListElement.length) return undefined;
  return { "@type": "OfferCatalog", name: `Services from ${site.name}`, itemListElement };
}

// Products with a real published price. Sites whose source listed no prices
// stay out of this entirely -- several of the rebuilds deliberately have none,
// and inventing one would be inventing a commercial claim.
export function productCatalog(site, products) {
  if (!Array.isArray(products) || !products.length) return undefined;
  const itemListElement = products
    .map((product) => {
      if (!product?.name) return null;
      const price = String(product.price ?? "").replace(/[^0-9.]/g, "");
      const offer = { "@type": "Offer", itemOffered: { "@type": "Product", name: product.name } };
      if (price) {
        offer.price = price;
        offer.priceCurrency = "USD";
      }
      return offer;
    })
    .filter(Boolean);
  if (!itemListElement.length) return undefined;
  return { "@type": "OfferCatalog", name: `Products from ${site.name}`, itemListElement };
}

// A stable identity for the business, so the Service entities above can point
// back at their provider instead of describing an anonymous one.
export const businessId = (site) => `https://${site.domain}/#business`;

export function postalAddress(site, stateCode) {
  return {
    "@type": "PostalAddress",
    streetAddress: site.streetAddress || undefined,
    addressLocality: site.city,
    addressRegion: stateCode(site.state),
    postalCode: site.postalCode || undefined,
    addressCountry: "US",
  };
}
