# 24 Hour Towing Dallas — audit

Audited 2026-09-21, against the fourteen points in the brief. Read-only; no
development work has started on this property.

## The headline

This property already earns. **579 clicks and 421,505 impressions over sixteen
months**, and the homepage alone carries 285,751 of those impressions at an
average position of **14.3**.

Position 14.3 is the top of page two on real volume. That single number is the
most valuable fact in this audit, and it means the work here is *not* the same
work as Twin City Fences. Twin City may be starting from nothing. Dallas is
already visible and failing to convert that visibility into clicks.

Overall CTR is **0.137%**. That is not a broken site — it is what page two
looks like. Impressions on page two are largely never seen.

## The fourteen points

| # | Item | Finding |
|---|---|---|
| 1 | Domain | `dallastowtrucks.com`, healthy, HTTPS |
| 2 | Website | Live, 11 pages, rebuilt 2026-09-21 |
| 3 | GBP | **EXISTS AND IS VERIFIED** — confirmed by owner 2026-09-21, kgmid `/g/11n0wm6t8m` |
| 4 | Name consistency | **SETTLED 2026-09-21: 24 Hour Towing Dallas.** The site already matches |
| 5 | Phone | `469-457-4462`, consistent site-wide. Returns nothing in Places |
| 6 | Service area | Dallas, Fort Worth, Irving, DFW |
| 7 | Previous rankings | 16 months of data, analysed below |
| 8 | Search Console | Connected, domain property, service account owner |
| 9 | Citations | Yelp, ShowMeLocal, Sensible Driver, Facebook, preferredprofessionals, PRLog — all carry the right phone and name |
| 10 | Reviews | **9 reviews, 3.7 average** — the weakest thing on the profile |
| 11 | Calls / leads | **28 GBP calls, Apr–Sep 2026.** Website calls still untracked |
| 12 | Fulfilment | **Needs the owner** |
| 13 | Genuinely 24 hours | **Needs the owner** — owner has said leave the claim alone |
| 14 | Dallas eligible market | Yes — the profile is verified in Dallas |

## What the search data actually says

### The opportunity is one query

| Query | Impressions | Position | Clicks |
|---|---|---|---|
| tow truck near me | **32,544** | 11.1 | 97 |
| tow truck | 11,542 | 14.7 | 50 |
| towing near me | 9,334 | 8.1 | 17 |
| tow truck dallas | 8,462 | 15.7 | 41 |
| dallas towing | 5,194 | 31.3 | 2 |

**35 queries sit between position 4 and 20 with 300+ impressions each.** That
band is where movement pays, because it is the distance between page two and
page one. Only 12 queries rank in the top three at all, and every one of them
is negligible volume.

`24 hour towing` — the brand's own core term — sits at **position 74.2** on
3,826 impressions.

### Demand by theme

| Theme | Impressions | Note |
|---|---|---|
| tow truck / towing | 165,213 | the core |
| "near me" | 80,628 | proximity intent, which is a GBP problem more than a page problem |
| **heavy / semi / RV / motorcycle** | **30,140** | **see the warning below** |
| 24 hour / emergency | 22,361 | on-brand |
| cheap / price / cost | 14,468 | price-led demand |
| roadside / jump / tire / lockout | 2,326 | small |
| **junk car / scrap / cash** | **5** | **we built a page for this** |

Two findings worth acting on.

**Heavy-duty is 30,140 impressions of demand**, second only to the core terms.
The brief is explicit: do not advertise heavy-duty towing unless the
fulfilment provider actually supplies it. So this is either the largest
untapped opportunity on the property or a line that must stay uncrossed, and
which one depends entirely on point 12.

**Junk car removal is 5 impressions.** Effectively zero demand, and the
rebuild gave it a page. Not harmful, but it tells you where effort should not
go next.

### Geography says: do not build neighbourhood pages

| City named in query | Impressions |
|---|---|
| Dallas | 58,163 |
| Irving | 248 |
| Fort Worth | 193 |
| Garland | 54 |
| everything else | under 10 each |

Dallas is 99% of named-city demand. The brief warns against dozens of thin
neighbourhood pages, and the data agrees emphatically — there is no search
demand to justify them. "Near me" at 80,628 impressions is the proximity
signal, and that is won through the Google Business Profile, not through
building a Duncanville page.

## Three problems that need the owner

### 1. No Google Business Profile found

Searched Places by business name, by phone, and by domain. Nothing. The phone
`469-457-4462` returns no result at all.

**This is not proof it does not exist.** The same sweep missed Twin City
Fence, Chicago EIFS and Deck Builders Monroe, all of which do exist. Unverified
and hidden-address profiles are invisible to the Places API.

But it matters more here than anywhere else in the portfolio, because **80,628
impressions of "near me" demand is won or lost on the profile**, not on the
website. If no profile exists, that is the single highest-value item on this
property — worth more than every page rebuild combined.

**Searched again 2026-09-21** under the confirmed name, the domain, the owner
name and the archived street address. Every result was a different Dallas
towing company — Texas Tows, Tow Dallas LLC, AmeriTow, Tow Dallas TX LLC. The
market is crowded with near-identical names, which is itself worth knowing:
whatever profile exists here is competing against a dozen businesses using the
same words.

One weak signal. The owner-supplied share link resolves to a plain Google
search with no `kgmid` attached, whereas the Twin City Fence link carried
`kgmid=/g/11fpss007l` and identified a specific business entity. That is
suggestive rather than conclusive, and given how wrong the not-found column
has already been on this portfolio it is not a conclusion.

**The definitive check is business.google.com on the owning account.**

### 2. Business name — SETTLED

**24 Hour Towing Dallas**, confirmed by the owner 2026-09-21. The site already
carries it, so unlike Twin City Fence and Deck Builders Monroe there is
nothing to correct here. `towtruckprosdallas@gmail.com` is the Google
account and not a trading name; Millard Bratton is the verified property owner.

This is the first property in the portfolio where the name needed no fixing.

### 3. No lead tracking whatsoever

There is no call tracking, no form, and no analytics on this property. **Point
11 of the brief asks about existing calls and leads, and the honest answer is
that nobody can know.** A towing business converts almost entirely by phone,
so the entire conversion picture is currently invisible.

The form, analytics and lead endpoint built for Twin City drop onto this site
with one entry in the recipients map. That is the cheapest large win available.

## What I would do, in order

1. **Settle the GBP question.** Everything local depends on it, and 80,628
   impressions of proximity demand hang on the answer.
2. ~~Settle the business name~~ — **done**, no correction needed.
3. **Port the form, analytics and lead endpoint** from Twin City. One config
   entry; no new code.
4. **Answer the heavy-duty question.** 30,140 impressions either open up or
   stay permanently off-limits.
5. **The Google Business Profile, not the 4–20 band.** See the correction
   below — this replaces what this section originally said.

## The baseline: 28 calls in six months

Owner-supplied from GBP Insights, April to September 2026. This is the number
everything else on this property should be measured against, and it is the
first hard conversion figure the portfolio has produced.

**It is low.** Roughly 4.7 calls a month, in a metro of 1.3 million people, for
a 24-hour service with a verified profile and the correct primary category.
A towing profile ranking well in Dallas would expect that in a week.

The useful part is what it rules out. The profile is verified, the primary
category is right, the hours are 24/7, the name and phone agree everywhere,
and the citations are consistent. None of the usual foundational faults apply —
so the shortfall is not a configuration problem, and time spent re-checking
configuration is time wasted.

What is left is the set of things that decide local pack position:

1. **Proximity.** The address is in 75232 — south Dallas, Oak Cliff. Local pack
   results are ranked by distance from the *searcher*, not from the city
   centre. Someone in Plano or Frisco searching "tow truck near me" gets
   businesses near them, and this profile cannot appear however good it is.
   This is a constraint to plan around rather than a fault to fix, and it very
   likely explains most of the 28.
2. **Reviews.** The largest controllable factor, and still unmeasured.
3. **Competition.** The Places sweep turned up Texas Tows, Tow Dallas LLC,
   AmeriTow and Tow Dallas TX LLC, all using near-identical names in the same
   market.

**A warning worth writing down before anyone suggests it.** The obvious answer
to a proximity constraint is more listings in more parts of Dallas. Creating
Google Business Profiles at addresses the business does not genuinely operate
from is a direct violation, and the penalty falls on the whole Google account —
which now holds thirteen verified properties. It is not worth considering.

## Reviews are the answer to the 28 calls

**9 reviews, 3.7 average**, owner-supplied 2026-09-21.

Both halves of that are a problem, and they fail in different ways.

**The count suppresses ranking.** Review volume is a direct local pack factor.
Nine is very low for a towing business in a metro this size, and the
competitors the Places sweep surfaced — Texas Tows, Tow Dallas LLC, AmeriTow —
are established operators who will have far more. A profile with nine reviews
does not out-rank one with two hundred on anything except raw proximity.

**The rating suppresses clicks even where the ranking works.** 3.7 sits below
4.0, which is where most people stop considering a result. It is worse than it
looks for towing specifically: this is a category where customers are already
having a bad day, so the baseline sentiment is low and a visible 3.7 reads as
confirmation.

At nine reviews the average is extremely sensitive, which cuts both ways. Nine
reviews averaging 3.7 is about 33 stars in total, so:

| Additional 5-star reviews | Resulting average |
|---|---|
| +5 | 4.06 |
| +9 | 4.35 |
| +15 | 4.50 |
| +25 | 4.65 |

**Nine good reviews takes this from 3.7 to 4.35.** That is a small number of
real customers, and it is by far the cheapest improvement available on this
property — cheaper than any page, any link, and any amount of on-site work.

Two things to do alongside collecting them:

- **Reply to every existing review, including the bad ones.** Owner responses
  are a ranking signal and, more importantly, a reader signal: a measured reply
  to a one-star review does more for the next customer than the review costs.
- **Ask at the moment the job finishes.** For towing that is when the vehicle
  is delivered and the customer is relieved — not a day later by email. This
  is the same SMS capability the lead work still needs, so the two should be
  built together rather than separately.

**What must not happen.** Buying reviews, incentivising them, or posting them
from staff accounts is a direct violation, and the penalty lands on the Google
account — which now holds thirteen verified properties. Nine real reviews are
worth more than ninety bought ones, and infinitely more than the account.

## CORRECTION: organic rank is not the lever here

The first version of this audit recommended working the position 4–20 band,
on the reasoning that page two to page one is where movement pays. The CTR
data in this same property refutes it:

| Position band | Impressions | Clicks | CTR |
|---|---|---|---|
| 1–3 | 49 | 2 | 4.08% |
| 4–7 | 4,928 | 20 | **0.41%** |
| 8–10 | 20,025 | 47 | **0.23%** |
| 11–15 | 55,825 | 177 | **0.32%** |
| 16–20 | 4,118 | 5 | 0.12% |

**CTR is flat across the bands and roughly ten times below what those
positions normally earn.** Position 4–7 should return 3–8%; it returns 0.41%.

That is the signature of a search results page where ads and the three-result
local pack consume the clicks before an organic result is visible at all —
which is exactly what "tow truck near me" looks like on a phone. Organic
position 4 on that query is a long way down the screen.

So moving position 11 to position 4 would take CTR from 0.32% to 0.41%. On
32,544 impressions that is a few dozen extra clicks, for a great deal of work.

**Getting into the three-result local pack is worth more than every organic
improvement available on this property combined**, and that is won on the
Google Business Profile: categories, services, description, photos, reviews
and proximity. Reviews in particular.

The profile is **verified**, confirmed by the owner 2026-09-21, so this is
available rather than hypothetical.

The website still matters — it is what the profile links to, it feeds
relevance, and it serves the non-local queries like "tow truck dallas" where
intent is less proximity-driven. It is simply not where the next win is.

## What I would not do

- No neighbourhood pages. The data is unambiguous.
- No more junk-car content. Five impressions.
- No citation building until the GBP question is settled. The name is not
  the blocker here that it was elsewhere; the profile is.
- No heavy-duty content until fulfilment is confirmed.
