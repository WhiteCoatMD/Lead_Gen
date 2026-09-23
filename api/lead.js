// Receives a lead from a site's contact form and emails it to the business.
//
// These are static sites with no server, so this is a Vercel serverless
// function living beside them. Vercel picks up /api at the deployment root
// regardless of the static outputDirectory, which is what makes a same-origin
// form possible without standing up a backend per site.
//
// Same-origin matters more than it sounds: no CORS preflight, no third-party
// domain in the form action, and nothing for a visitor's network to block.
//
// The site that posts identifies itself, and the destination is resolved HERE
// from that identity. A form that could name its own recipient would be an
// open relay for anyone who found the endpoint.
//
// Delivery is Resend. SMS is planned and deliberately not stubbed -- an
// unfinished notification path that silently does nothing is worse than one
// that was never claimed to exist.

export const RECIPIENTS = {
  // slug -> where its leads go. Adding a site means adding a line here, which
  // is the point: the destination is not something a request can choose.
  "twin-city-fences": {
    to: "twincityfences@gmail.com",
    business: "Twin City Fence",
    domain: "twincityfences.com",
  },
  "towing-dallas": {
    // NEEDS CONFIRMING. This is the Google account that owns the Search
    // Console property, which makes it the best available guess and still a
    // guess. A lead delivered to the wrong inbox is a lost job, so the first
    // test send goes here deliberately — if it lands somewhere unexpected,
    // that is the answer.
    to: "towtruckprosdallas@gmail.com",
    business: "24 Hour Towing Dallas",
    domain: "dallastowtrucks.com",
  },
  "martins-trash-removal-demolition": {
    // INTERIM DESTINATION. Leads go to Mitch until the contractor's own
    // address is supplied, because a lead landing in the portfolio owner's
    // inbox is recoverable and a lead landing nowhere is not. Swap the `to`
    // line for the contractor address when it is known.
    to: "mitch@whitecoat-md.com",
    business: "Martins Trash Removal and Demolition",
    domain: "martins-trash-removal-demolition.invalid",
  },
  "deck-builder-monroe": {
    // INTERIM. Leads go to Mitch until the contractor address is supplied.
    // A lead reaching the portfolio owner is recoverable; one reaching
    // nowhere is not.
    to: "mitch@whitecoat-md.com",
    business: "Deck Builders Monroe",
    domain: "deckbuildermonroe.com",
  },
};

const FIELDS = ["name", "phone", "email", "message", "service", "city"];
const MAX = { name: 120, phone: 40, email: 160, message: 4000, service: 120, city: 120 };

// Crude per-instance rate limit. Serverless instances are recycled so this is
// not a real limiter, but it costs nothing and stops the trivial case of one
// script hammering a single warm instance.
const recent = new Map();
const TOO_MANY = 5;
const WINDOW_MS = 60_000;

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Resend refuses to send from any domain not verified in the account, so this
// must be one of those (bed-sync.com, findamattressstore.com,
// metaldealerpro.com), never the site's own domain unless that has been
// verified too.
const senderDomain = () => (process.env.LEAD_FROM_DOMAIN || "bed-sync.com").trim().toLowerCase();

export default async function handler(req, res) {
  if (req.method === "GET") return healthCheck(req, res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};

  const site = RECIPIENTS[String(body.site || "")];
  if (!site) return res.status(400).json({ error: "Unknown site" });

  // Honeypot. A field hidden from people and irresistible to bots; anything
  // that fills it gets a 200 so the bot has nothing to learn from the reply.
  if (clean(body.company, 200)) return res.status(200).json({ ok: true });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= TOO_MANY) return res.status(429).json({ error: "Too many submissions. Please call instead." });
  recent.set(ip, [...hits, now]);

  const lead = {};
  for (const f of FIELDS) lead[f] = clean(body[f], MAX[f]);

  const problems = [];
  if (!lead.name) problems.push("name");
  if (!lead.phone && !lead.email) problems.push("phone or email");
  if (lead.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) problems.push("a valid email");
  if (problems.length) return res.status(400).json({ error: `Please provide ${problems.join(" and ")}.` });

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Say so rather than returning a cheerful 200. A form that reports success
    // while dropping the lead is the worst failure this endpoint can have.
    console.error("RESEND_API_KEY is not set — lead NOT delivered:", JSON.stringify(lead));
    return res.status(500).json({ error: "We could not send that just now. Please call us." });
  }

  const lines = [
    `Name:    ${lead.name}`,
    `Phone:   ${lead.phone || "(not given)"}`,
    `Email:   ${lead.email || "(not given)"}`,
    lead.service ? `Service: ${lead.service}` : null,
    lead.city ? `City:    ${lead.city}` : null,
    "",
    lead.message || "(no message)",
    "",
    `— sent from ${site.domain} at ${new Date().toISOString()}`,
  ].filter((l) => l !== null);

  try {
    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Resend only sends from a domain verified in the account, and
        // twincityfences.com is not one of them -- the verified list is
        // bed-sync.com, findamattressstore.com and metaldealerpro.com. So
        // the envelope sender is a verified domain and the site it came
        // from is carried in the display name and the body.
        //
        // This is a notification to the business's own inbox, so the From
        // domain matters for spam filtering rather than for branding, and a
        // verified domain with working DKIM is the better of the two on that
        // count. Verifying twincityfences.com in Resend later makes this one
        // environment variable, not a code change.
        from: `${site.business} website <leads@${senderDomain()}>`,
        to: [site.to],
        // Replying to the notification reaches the customer, not us.
        reply_to: lead.email || undefined,
        subject: `New ${site.business} lead (${site.domain}): ${lead.name}`,
        text: lines.join("\n"),
      }),
    });
    if (!send.ok) {
      const detail = await send.text().catch(() => "");
      console.error("Resend rejected the lead:", send.status, detail.slice(0, 300), JSON.stringify(lead));
      return res.status(502).json({ error: "We could not send that just now. Please call us." });
    }
  } catch (error) {
    console.error("Resend request failed:", error.message, JSON.stringify(lead));
    return res.status(502).json({ error: "We could not send that just now. Please call us." });
  }

  return res.status(200).json({ ok: true });
}

// GET /api/lead?check=<slug> — can this site's form actually deliver?
//
// Exists because of 2026-09-23. Deck Builders' form was live for a day with no
// RESEND_API_KEY, then with a sender domain Resend had never verified, and
// every submission was dropped while the audit passed the site on every check.
// A page loading and a lead arriving are different facts; the weekly audit
// calls this to ask the second one.
//
// Sends nothing and reveals nothing secret: whether a key is set, and which
// sender domain is configured, which every lead email already shows.
async function healthCheck(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const slug = new URL(req.url, "http://localhost").searchParams.get("check");
  if (slug === null) {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }
  const from = senderDomain();
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  return res.status(200).json({
    site: slug,
    known: Object.hasOwn(RECIPIENTS, slug),
    key: hasKey,
    from,
    // true / false, or null when the key cannot list domains (a send-only
    // key) — unknown is reported as unknown, not guessed either way.
    fromVerified: hasKey ? await isVerified(from) : null,
  });
}

// Cached per instance, so the check cannot be used to hammer Resend.
let verifiedCache = { at: 0, domains: null };
async function isVerified(domain) {
  if (Date.now() - verifiedCache.at > 10 * 60_000) {
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(8000),
      });
      const body = res.ok ? await res.json() : null;
      verifiedCache = {
        at: Date.now(),
        domains: body ? Object.fromEntries((body.data || []).map((d) => [d.name.toLowerCase(), d.status])) : null,
      };
    } catch {
      return null; // not cached: a network blip should not stick for ten minutes
    }
  }
  if (!verifiedCache.domains) return null;
  return verifiedCache.domains[domain] === "verified";
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return {}; }
}
