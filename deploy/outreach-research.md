# Weekly outreach research — instructions for the routine

You find backlink and citation opportunities for Mitch's lead-gen sites and
PROPOSE them to the outreach queue. Mitch approves; a VA does the work. You
never send email, submit forms, create accounts or pay for anything.

## 1. Get the context

The token is provided by the routine prompt as `OUTREACH_PROPOSE_TOKEN`; the
script reads it from that environment variable. Never print, echo, log or
write the token anywhere, including in your report.

    node scripts/outreach-vet.mjs --context > /tmp/context.json

`eligibility` says which sites may get backlinks and which may get citations,
with the exact `nap` block citations must use. `existing` lists every task
already in the queue in any status, with its `site`, `kind`, `target`, `url`
and `status` — never propose those pages again, and never propose an
organisation already listed for that site under any URL (compare the
organisation named in each `target`, not just the address). If the command
fails, stop and report the error; do not guess eligibility.

## 2. Research, per eligible site (at most 5 proposals per site)

Read `sites/<slug>/site.json` for the business name, services, city and
service area. Use only those facts.

Backlinks (sites with `backlinks: true`), in this order of value:
- the local chamber of commerce and local business associations for the site's city;
- state and national trade associations for the site's trade;
- supplier or manufacturer "find an installer / dealer" directories for products the site says it uses;
- local sponsorships (youth sports, community events) in the service area;
- pages that mention the business by name without linking to it (search `"<business name>" -site:<domain>`).

Citations (sites with `citations: true` only): core directories where the
business is missing (Google-adjacent and industry directories a real customer
uses: Bing Places, Apple Business Connect, BBB, Angi, Nextdoor, Thumbtack,
the trade's own directories), or existing listings whose name/phone/address
differs from `nap`. Use `nap` exactly. If `nap` has no street address, the
business is service-area only — the task must say never to add one.

Never propose: paid link schemes, link exchanges, PBNs, guest-post farms,
comment/forum/profile spam, Web 2.0 blogs, directories that exist only to sell
links, or anything for a site not eligible for that kind.

## 3. Check each idea before proposing it

Open the page. Propose it only if it is live (`page_live: true`), relevant to
that trade and area, and does not already link to the site's domain (record
`links_to_us`).

A page counts as live only if a plain HTTP GET, following redirects, returns
200:

    curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 <url>

A WebFetch summary or a search snippet is not proof. Anything other than 200
(a 404, a 403, a timeout) means drop the prospect, or find the organisation's
page that does return 200 and use that instead. Record the cost exactly as the page states it, or
"paid — confirm dues" if it is paid and unstated, or "free".

## 4. Write the task

Each task is a JSON object:

    { "site", "kind": "backlink" | "citation_new" | "citation_fix",
      "target": "<Organisation — what to do>", "url": "<page the VA works on>",
      "why": "<one or two sentences for Mitch>", "cost",
      "steps": ["<numbered instructions a VA can follow without judgement>"],
      "copy_block": "<the exact email or NAP block to paste>",
      "account_note": "<which account to use — never a password>",
      "checked_at": "<ISO date>", "page_live": true, "links_to_us": false }

Money: amounts go only in `cost`. Never put a dollar figure in `target`,
`why`, `steps`, `copy_block` or `account_note` — the vetting drops any task
with one there. Say "the listed dues" or "the fee in `cost`" instead.

Citations (`citation_new` and `citation_fix`): `copy_block` must contain the
site's `nap` block from the context exactly, character for character — same
line breaks, punctuation and spacing. Put it on its own lines; you may add
text before or after it, never inside it. The database rejects any citation
whose copy_block does not contain it.

Emails: first person as the business, short, specific to that organisation,
built only from site.json facts. No placeholders in square brackets — if you
cannot write a true, specific sentence, drop the prospect. No claims about
licences, insurance, warranties, guarantees, years in business, prices,
arrival times, awards or superlatives unless deploy/claim-allowances.json
allows that kind for that site. Paid memberships: the steps must say not to pay
and to mark the task Blocked with the cost for Mitch.

## 5. Propose

Write the array to /tmp/proposals.json, then:

    node scripts/outreach-vet.mjs /tmp/proposals.json --propose

If this command fails or throws — missing or rejected token, network error,
an HTTP error — stop. Report the error text and list which sites' proposals
were not submitted. Do not retry in a loop, and do not report the run as a
success.

Report, per site: proposed, dropped by vetting (with reasons), and skipped by
the database (with reasons). If everything was dropped or skipped, say so
plainly — an empty week is a result, not a failure.
