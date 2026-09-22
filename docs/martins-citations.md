# Martins — citation plan and phone-change sequence

Written 2026-09-22, after the owner confirmed the business is getting a new
phone number. **Nothing in the "build" section should be started until the
number is final.** Submitting citations with a number that is about to change
means doing the whole job twice, and the second pass is harder than the first
because corrections require claiming each listing.

## The order matters more than the list

Three significant edits are now queued against an established Google Business
Profile: the name (already changed), the primary category (planned, a few days
out), and now the phone number.

**Do not make these in the same week.** Google re-reviews profiles after major
field edits, and stacking name + category + phone on an established listing is
one of the more reliable ways to trigger a re-verification or a temporary
suspension. Service-area businesses get suspended more readily than storefronts,
and the appeal is slow. Spacing them costs a fortnight; a suspension costs
considerably more.

Suggested sequence:

1. **Name** — done.
2. **Wait.** Let it settle and confirm the profile still displays normally.
3. **Primary category → Demolition.** This is the single highest-value change in
   the whole project; it deserves to happen on its own.
4. **Wait again.**
5. **Phone number.** Change on the GBP first, because the GBP is what every
   citation gets matched against.
6. **Website config**, then **citations**, in that order.

## The phone question that has to be answered first

**Is the new number a permanent line the business owns, or a tracking number?**

The two get handled completely differently, and the site is already built for
both. `shared/render-site.mjs` carries the split:

```js
const dialled = (site) => site.trackingPhone || site.phone;   // click-to-call
telephone: site.phone                                          // schema / NAP
```

- `phone` — the real, permanent business line. This is the NAP number. It goes
  on the GBP, on every citation, and into the structured data.
- `trackingPhone` — optional. Drives the click-to-call links and the visible
  number on the website only. Never goes into schema and never goes on a
  citation.

**Why the distinction is worth keeping even though the tracking app is now
in-house:** a NAP number is a permanent identity claim. Every directory,
every scraper and every aggregator that copies the listing will hold that
number for years. If the number is ever reassigned, rotated, or the tracking
setup changes, the citation graph points at a dead line and there is no way to
recall it. The real line is the safer thing to publish; the tracking number
still captures everything that comes from the website, which is where the
attribution actually matters.

If the new number *is* permanent and owned outright, then it can simply be
`phone` and there is nothing further to think about.

## Is this a service-area business?

Worth settling at the same time. `20 Lee Reeves Rd, Deville` reads like a yard
or a home rather than premises customers visit. Google's rule is straightforward:
if customers are not served at the address, the address should be hidden and the
profile run as a service-area business.

Land clearing and demolition are performed on the customer's property by
definition, so this is almost certainly an SAB. If so the correct NAP is **name
+ phone + service area, with no street address** — the same shape Twin City
ended up with, though for a different reason.

That also changes the citation work: the address should not be added anywhere
new, even where a directory asks for one.

## The canonical record

Everything below has to match this once the fields are final. It is the Google
Business Profile, because that is what Google matches citations against.

| Field | Value |
|---|---|
| Name | **Martins Trash Removal and Demolition** — CONFIRM exact spelling and apostrophe |
| Street address | **decide** — hide if SAB, see above |
| City | Deville, LA 71328 |
| Phone | **318-367-0824** (new, confirmed 2026-09-22) |
| Website | **PENDING — no domain purchased** |
| Primary category | Demolition Contractor (planned) |

Four fields are still open. That is precisely why citation work has not started.

## Existing citations — correct these, do not abandon them

These already exist and carry age. Age is the reason to correct rather than
replace: a listing that has been live for years and gets updated keeps whatever
authority it accumulated, while a fresh duplicate starts from nothing and risks
being read as a second business.

| Directory | Current state | Action |
|---|---|---|
| **Google Business Profile** | Name updated; category pending | Phone, then category. The anchor for everything else. |
| **getvibrato** | Lists the business in **Bordelonville** | **Wrong city — highest priority.** Correct to Deville or remove. Bordelonville is a different parish. |
| *(all of the above)* | All still carry **318-308-4577** | Every listed citation now has the wrong phone. This is the bulk of the correction work. |
| **Yelp** | "Martin Trash Service", categorised *Junk Removal & Hauling* | Name, phone, and category. The category actively reinforces the positioning being abandoned. |
| **BBB** | "Martin Trash Service", categorised *Garbage Removal* | Name, phone, category. |
| **Hometown Demolition** | Listed, demolition category already correct | Name and phone only. Already pointing the right way. |
| **Hometown Dumpster Rental** | Listed under old name | Name and phone; consider whether dumpster rental still belongs. |
| **Facebook** | Group, not a business page | A group is not a citation. A proper Page should be created — see below. |

**The name is inconsistent across every single one of these.** "Martin's Trash
Service", "Martin Trash Service", and now the rebrand. One canonical spelling has
to be settled before any of this can be corrected, including whether there is an
apostrophe.

## New citations — build after the number is final

Ordered by value, not by how easy they are to submit. This is deliberately a
short list: the brief's own instruction was not to submit to hundreds of
irrelevant directories, and for a contractor the long tail contributes close to
nothing while multiplying the number of places a future NAP change has to reach.

**Tier 1 — the ones search engines actually consume**
- Apple Business Connect (feeds Apple Maps and Siri)
- Bing Places
- Facebook Page (a real Page, not the existing group)
- Nextdoor — genuinely strong for rural contractors in this region

**Tier 2 — trade-relevant**
- Angi / HomeAdvisor — already surfaced for Alexandria site prep
- Thumbtack
- Houzz — weaker for land clearing than for remodelling, but it indexes
- Porch

**Tier 3 — local and regional**
- Central Louisiana Chamber of Commerce (Alexandria/Pineville)
- Avoyelles Chamber of Commerce
- Rapides Parish business listings
- Louisiana state business directories

**Deliberately excluded:** mass-submission citation services. They re-submit
data rather than correcting what is already published, and with four fields
still open they would simply propagate the wrong values faster.

## Tracking

| Field | Why |
|---|---|
| Directory + URL | So a future NAP change has a list to work from |
| Name / address / phone as published | The thing being checked |
| Claimed? | Unclaimed listings cannot be corrected later |
| Status | live / pending / duplicate / wrong / removed |
| Last checked | Citations drift; this is not a one-time job |

## What has to happen before any of this starts

1. ~~New phone number finalised~~ — **318-367-0824**, done. Still worth
   confirming whether it is a permanent owned line or a tracking number
2. Domain purchased, so there is a website URL to cite
3. Canonical name spelling agreed, apostrophe included
4. SAB decision — publish the address or hide it
5. GBP category change made and settled

Four open items. Correcting the Bordelonville listing is the one piece of this
that can be done immediately, because it is wrong regardless of what the other
four resolve to.
