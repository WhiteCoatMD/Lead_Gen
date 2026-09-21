# Photo shot list — the lead-gen SEO targets

> The SEO target list is `deploy/seo-targets.json`. It grew to twelve on
> 2026-09-21: Crack Rx (Mitch's own startup) and SeaCoast Hurricane Shutters
> (converted to lead-gen after the operator left). Neither appears below —
> Crack Rx already has a hero and three gallery images, SeaCoast has a hero and
> six, so both are already covered.


Written 2026-09-21, after Google's Rich Results Test flagged a missing `image`
on every page it tested.

The schema gap is the small half of this. The real problem is that a contractor
site with no photographs of finished work asks a stranger to phone someone
about a five-figure job on the strength of paragraph text. Photos are the
single biggest conversion lever on these pages, and they feed the structured
data for free.

**None of the ten has a gallery.** Six have one hero image and nothing else;
four have no photography at all. The builder already supports a `gallery` array
with per-image `alt` and optional `caption` — it is wired and unused.

A note on sourcing: these must be real work. Stock photos of someone else's
deck would be inventing a portfolio, which is the one thing the whole rebuild
refused to do. If a site has no real photos available, it is better to ship it
text-only and say so.

---

## Priority 1 — no photography at all

These four have nothing. Each needs a hero at minimum; everything else is upside.

### deck-builder-monroe · Monroe, LA
*Custom Wood Decks · Composite Decking · Deck Repair and Restoration · Covered Porches and Pergolas*

- **Hero:** a finished multi-level deck shot wide, late afternoon, house visible for scale. Landscape, at least 1600px wide.
- One completed composite deck, close enough to read the board texture — this is what separates it from the pressure-treated shots.
- One covered porch or pergola with the roof structure clearly in frame.
- One before/after pair on a repair: rotted boards and joists, then the finished replacement from the same angle. Before/after pairs are the most persuasive thing a repair business can publish.
- One railing and stair detail, showing the code-compliant work the copy claims.

### scaffolding-los-angeles · Los Angeles, CA
*Frame Scaffolding · Tube & Clamp · Rolling Scaffolding · Delivery & Pickup*

- **Hero:** erected frame scaffolding on a real job site, full height, ideally against a recognisable LA building type.
- One tube-and-clamp assembly close enough to show the couplers — the visual difference from frame is the whole reason a customer chooses it.
- One rolling tower indoors or on flat ground, showing the casters and guardrail.
- One delivery truck loading or unloading. This sells the "we deliver and pick up" service better than a sentence.
- One shot showing guardrails, base plates and planking — safety-competence signalling for a commercial buyer.

### towing-dallas · Dallas, TX
*24-Hour Towing · Roadside Assistance · Vehicle Recovery · Junk Car Removal*

- **Hero:** the truck at night with its light bar on, vehicle loaded. Night shots are on-message for a 24-hour service in a way a daylight photo is not.
- One flatbed with a car winched on, straps visible.
- One roadside-assistance moment: jump start or tyre change, hands in frame.
- One recovery job — off-road, ditch or accident scene, keeping plates and faces out of frame.
- Exterior of the truck with signage and phone number legible.

### cactus-removal-tucson · Tucson, AZ
*Cactus Removal · Cactus Trimming · Cactus Assessment · Site Cleanup*

- **Hero:** a large saguaro or prickly pear mid-removal, crew and equipment in frame for scale.
- One before/after pair on a cleared yard from a fixed camera position.
- One trimming shot showing protective equipment — handling a cactus safely is the service being sold.
- One loaded truck or trailer at the haul-away stage, which is the part customers forget they need.

---

## Priority 2 — one hero, no gallery

These six already have a hero, so they are not failing anything. A gallery is
the upgrade: proof of work, more indexable image surface, and a populated
`gallery` array that the schema picks up automatically.

Four to six images each, shot the same way:

| Site | What to show |
|---|---|
| `chicago-eifs-stucco` | EIFS vs. traditional stucco side by side; a moisture-damage repair in progress; a finished installation with visible texture match |
| `stucco-repair-chicago` | Crack repair before/after from a fixed position; moisture damage opened up; finished patch blended into existing wall |
| `flooring-monroe` | One finished room per surface — hardwood, luxury vinyl, tile, carpet — so each service card has a matching photo |
| `lake-charles-fences` | One completed run per fence type: wood privacy, chain-link, decorative; plus a gate detail |
| `twin-city-fences` | Same per-type coverage; a repaired gate; a long wood privacy run showing line and level |
| `twin-city-handyman` | One finished kitchen, one bathroom, one outdoor repair, one general or home-office job — matching the four service cards |

---

## How to add them

Drop the files in `sites/<slug>/assets/`, then add to that site's `site.json`:

```json
"hero": "hero.jpg",
"gallery": [
  { "image": "deck-composite-01.jpg", "alt": "Completed composite deck with stair railing", "caption": "Composite deck, Sterlington" }
]
```

`alt` is required on every gallery entry — the renderer enforces it, and a
gallery of unlabelled images helps neither a screen reader nor a search engine.
`caption` is optional. Set `hero` and the hero panel switches from the plain
accent colour to the photograph; `primaryImage()` in `shared/schema.mjs` then
picks the first available image for the schema automatically, so nothing else
needs changing.

Shoot landscape, at least 1600px wide. Large files are fine going in — the
portfolio has been optimised with PowerShell/.NET `System.Drawing` before
(Crack Rx went 14MB to 1.7MB) rather than adding a dependency.
