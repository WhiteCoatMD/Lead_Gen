// First-party event collection.
//
// No GA4, no GTM, no third-party script. That is a deliberate choice carried
// over from the mattress directory: nothing to block, no cookie banner to
// argue about, no analytics script in the critical path of a page whose whole
// job is to get someone to ring a fencing company.
//
// What it records is what the business actually needs to know: did someone
// arrive, did they try to call, did they send the form. Not a session graph.
//
// Storage is deliberately the Vercel log stream for now. It is honest about
// what it is -- a durable store is a database decision, and standing one up
// before there is a single event to put in it would be building the wrong
// thing first. The events are structured JSON on one line so they can be
// queried from the log drain or piped somewhere later without changing the
// client.
//
// NOTHING PERSONAL IS COLLECTED. No IP, no user agent, no identifier, no
// cookie. A call click and a page view do not need one, and the moment this
// stores something identifying it becomes a privacy obligation that the sites
// have no notice for.

const ALLOWED = new Set(["page_view", "call_click", "form_view", "form_submit", "form_error"]);
const MAX_LEN = 120;

const clean = (v) => String(v ?? "").replace(/[^\w\s./:-]/g, "").trim().slice(0, MAX_LEN);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const type = clean(body.type);
  if (!ALLOWED.has(type)) return res.status(400).json({ error: "Unknown event" });

  // One structured line per event. Queryable from the log drain, and trivially
  // redirected into a table later without the client changing.
  console.log(
    JSON.stringify({
      evt: type,
      site: clean(body.site),
      path: clean(body.path),
      // Where they came from, at hostname granularity only. Enough to tell
      // Google from Facebook from a direct visit; not enough to follow anyone.
      ref: refHost(body.ref),
      at: new Date().toISOString(),
    })
  );

  // 204: the browser has nothing to do with the response, and sending a body
  // for a fire-and-forget beacon is wasted bytes on a mobile connection.
  return res.status(204).end();
}

function refHost(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  try { return new URL(v).hostname.slice(0, MAX_LEN); } catch { return ""; }
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return {}; }
}
