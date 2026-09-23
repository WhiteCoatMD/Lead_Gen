# Fence linkable assets (pilot) — design

Date: 2026-09-23. Status: design approved in conversation; awaiting spec review.

## Purpose

Give the two fence sites pages that other websites genuinely want to link to —
a fence materials calculator and per-city fence permit guides — so they earn
links without link-building and bring in visitors who then call or send the
form.

Success: each asset is accurate enough to cite and useful on its own even to
someone who never hires the business; within 6–8 weeks the pages show
impressions in Search Console, visits in the lead report, and at least some
approved outreach pointing at them. The pilot's components are then reused
for other trades.

## Decisions (from the conversation)

| Question | Answer |
|---|---|
| Prices? | **None.** No dollar figures, labour times or promises anywhere. |
| Scope | **Pilot on the fence sites:** `twin-city-fences`, `lake-charles-fences`. |
| Approach | New page types in the shared site builder (not a separate site). An embeddable widget is a possible later add-on, not part of this pilot. |
| Freshness enforcement | Launch checklist fails **that site** when a permit fact is unsourced or over 12 months old; the Monday audit lists guides due within a month. Not a build failure (it would block all 28 sites). |

## Hard rules

- No prices, labour times, arrival times, credentials, warranties or other
  claims — the claims check (`npm run claims`) scans the new pages like any
  other, per site allowances.
- Every permit fact has an official source URL, a source title and a
  checked date. A fact with no official source is not guessed: the page says
  it is not published online and gives the permit office's contact.
- Contact details for permit offices come from the official page only.
- Calculator output is labelled as standard rules of thumb to confirm with a
  supplier. It is a materials estimate, not advice.
- Martins and SeaCoast are untouched.

## Component 1 — Fence materials calculator

**Page:** `/fence-calculator` on both fence sites, in each site's own chrome
(header, footer, call CTAs, lead form).

**Inputs:** fence type (wood privacy | chain-link); total run in feet;
height (4 | 5 | 6 | 8 ft); number of corners; gates (count and width each).
Advanced, prefilled with defaults: post spacing (8 ft wood, 10 ft
chain-link), picket width and gap (wood), concrete bag size.

**Outputs:**
- Wood privacy — end/corner/gate posts, line posts, rails (2 per section up to
  5 ft, 3 above), pickets, concrete bags, recommended post length (height plus
  a hole of about one third of it, with a minimum depth).
- Chain-link — terminal and line posts, top-rail lengths, fabric rolls,
  tension bars, tension/brace bands, caps, concrete bags.
- The arithmetic behind each line is shown (e.g. "140 ft ÷ 8 ft = 18 sections
  → 17 line posts").
- A print / copy button for the list.

**Around it:** a short explainer of the formulas, a few sourced FAQs (e.g.
post depth in Louisiana), links to the site's permit guides, and the normal
lead form with the service prefilled from the fence type.

**Build:** formulas in a pure, dependency-free module shared by both sites and
unit-tested against hand-worked examples; a small browser script wires the
form to it. With JavaScript off the page still shows the formulas and a worked
example.

**Edge cases the calculator must handle sensibly:** zero or negative length,
gates wider than the run, runs shorter than one section, non-numeric input —
each gives a plain message, never NaN or a negative count.

## Component 2 — Fence permit guides (7 pages)

| Site | Jurisdictions |
|---|---|
| twin-city-fences | Monroe, West Monroe, unincorporated Ouachita Parish |
| lake-charles-fences | Lake Charles, Sulphur, Westlake, unincorporated Calcasieu Parish |

**Page:** `/fence-permit-<jurisdiction>` on the owning site.

**Each page answers, for that jurisdiction only:** whether a residential
fence needs a permit, where and how to apply, and the office's phone and
address; maximum height by front / side / rear yard; setbacks and corner-lot
sight-line rules; pool barrier requirements if the code has them; prohibited
materials if any; call Louisiana 811 before digging (with the state source).
A one-line HOA note, and "last checked" shown on the page. Plain-language
not-legal-advice note.

**Data:** one file per jurisdiction under `deploy/permits/<jurisdiction>.json`:
the office contact, and a list of facts, each `{question, answer, sourceUrl,
sourceTitle, checked}`. Pages render from these files; editing a fact changes
nothing else.

**Freshness and sourcing checks:**
- `npm run audit` (offline launch checklist) fails the owning site if any fact
  lacks `sourceUrl`/`sourceTitle`/`checked`, or `checked` is older than 12 months.
- The Monday portfolio audit prints guides whose oldest fact reaches 11 months.

**Research:** Claude researches the first round from the official city and
parish codes (Municode or the jurisdiction's own site). Anything the official
text leaves ambiguous is flagged to Mitch rather than decided.

## Linking

- Each guide links to the calculator and to the site's other guides.
- The calculator links to all of that site's guides.
- Each fence site's homepage gets a short "Fence permits by city" section.
- The outreach research routine (`deploy/outreach-research.md`) gains a line:
  for the fence sites, look for resource-page prospects (HOAs, realtors'
  moving guides, home-improvement blogs, library resource lists) that fit the
  calculator or a permit guide, and point the task's pitch at that page. These
  arrive as normal Proposed tasks.

## Measurement

- Visits, call taps and form leads per page: the existing lead report (events
  record the path).
- Rankings/impressions: the weekly Search Console sync.
- Links: outreach tasks marked Done with live URLs.
- Decision point after 6–8 weeks: roll the components out to other trades or not.

## Testing

- Unit tests (`node --test`): calculator formulas against hand-worked cases,
  including the edge cases above.
- Tests that the checklist rejects a permit fact with no source and one checked
  more than 12 months ago.
- Build both sites; both pages render in the site's chrome; the calculator
  works in a real browser with no console errors.
- `npm run audit` and `npm run claims` pass for both sites.

## Out of scope

Prices; the embeddable widget; other trades; split-rail and farm fencing in
the calculator; any site other than the two fence sites.
