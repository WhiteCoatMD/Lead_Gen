// Records a site event in the portfolio database (Supabase, the admin
// dashboard's project). Shared by event.js and lead.js; the leading underscore
// keeps Vercel from serving this file as a route.
//
// The URL and publishable key are public by design. What gates writes is
// EVENTS_INGEST_TOKEN, a sensitive team-shared env var: record_event() refuses
// any call without it, so the public key alone cannot pad the counts.
//
// Never throws and never delays the visitor for long. The Vercel log line
// written by the caller stays the fallback record if this fails.

const URL = "https://oyrcjrcgvmzmkaipapjm.supabase.co/rest/v1/rpc/record_event";
const KEY = "sb_publishable_vRcp_g2WW01D8SxjLVDTzA_HSoAdjBG";

export async function recordEvent({ type, site, path = "", ref = "" }) {
  const token = process.env.EVENTS_INGEST_TOKEN;
  if (!token) return console.error("EVENTS_INGEST_TOKEN not set — event not stored:", type, site);
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token, p_type: type, p_site: site, p_path: path, p_ref: ref }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error("event store rejected:", res.status, (await res.text()).slice(0, 200));
  } catch (error) {
    console.error("event store unreachable:", error.message);
  }
}
