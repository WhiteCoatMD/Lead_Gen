# Snapps → monorepo migration tracker

Source: the owner's authenticated Snapps dashboard. Snapps holds **no domains**
(`My Domains` is empty), so every domain below was resolved from the GoDaddy
account via the repo's own read-only `domain-inventory.yml` workflow, run
2026-09-21. `100.24.208.97` / `35.172.94.1` are the Snapps/multiscreensite
hosting IPs — a domain pointing there is a live Snapps site.

Outlaw Swagger was removed from the list on 2026-09-21: already handled on
another project. 17 sites remain.

| # | Site | Snapps preview | Domain | Domain state | Build | Deploy | DNS | Missing / blocker |
|---|------|---------------|--------|--------------|-------|--------|-----|-------------------|
| 1 | Hippie Chicks Snowballs | 89aa4812 | — | **none found** | not started | — | frozen | **No domain in GoDaddy.** Content extracted (see below). |
| 2 | Hometown Soap N Sudz | 439dc70e | hometownsoapnsudz.com | ACTIVE, on Snapps | not started | — | frozen | — |
| 3 | SeaCoast Hurricane Shutters | 2308be60 | seacoasthurricaneshutters.com | ACTIVE, on Snapps, **has MX** | not started | — | frozen | — |
| 4 | Crack Rx | d3ae5dd3 | getcrackrx.com | ACTIVE, on Snapps, **has MX** | not started | — | frozen | — |
| 5 | Rev Laundry Soap | ff592723 | revlaundrysoap.com | ACTIVE, on Snapps, **has MX** | not started | — | frozen | — |
| 6 | The Velvet Chandelier | 8d43dcbd | — | **none found** | not started | — | frozen | **No domain in GoDaddy.** |
| 7 | CustomLettersfromSantaClaus.com | 7c49fbad | customlettersfromsantaclaus.com | ACTIVE, on Snapps, **has MX** | not started | — | frozen | — |
| 8 | Make Your Own Crap.com | d7417d8e | makeyourowncrap.com | **CANCELLED** exp 2025-09-24 | not started | — | frozen | Domain lapsed. |
| 9 | Miro's Tree Service Monroe | 58dd2d08 | treeservicemonroe.com | ACTIVE, on Snapps, **has MX** | not started | — | frozen | — |
| 10 | MB's Pressure Washing New Orleans | d4aaf3f8 | pressurewashing-neworleans.com | ACTIVE, on Snapps | not started | — | frozen | `nolapressurewash.com` also exists but points elsewhere (199.34.228.76) — not this site. |
| 11 | Cutting Edge Tree Service | ca8eaba7 | — | **none found** | not started | — | frozen | **No domain in GoDaddy.** City unknown. |
| 12 | Roofing Company Warren | 4dcadec0 | roofingcompanywarren.com | **CANCELLED** exp 2025-09-29 | not started | — | frozen | Domain lapsed. |
| 13 | Roofing Company of Houma, LLC | b19a02c5 | roofing-houma.com | **CANCELLED** exp 2023-09-27 | not started | — | frozen | Domain lapsed (3 years). |
| 14 | Millard's Stucco Repair Baton Rouge | a5c1500c | stuccorepairbatonrouge.com | ACTIVE, on Snapps | not started | — | frozen | — |
| 15 | Drywall & Paint Pros of Chicago | d66af26f | — | **none found** | not started | — | frozen | **No domain in GoDaddy.** |
| 16 | Spray Foam Insulation Los Angeles | d1a95eff | — | **none found** | not started | — | frozen | **No domain in GoDaddy.** |
| 17 | Leyland's Los Angeles Tree Service | e5a4ace7 | — | **none found** | not started | — | frozen | **No domain in GoDaddy.** |

DNS is **frozen for every row** until its replacement is verified on a Vercel
hostname. No row is cleared for cutover yet.

## Verified content — Hippie Chicks Snowballs (site 1)

Read from the site's own menu images, not inferred. The Snapps page carries
only ~337 characters of text and its headings are unmodified template
placeholders ("Play", "Walk", "Eat", "Sleep", "Fashion Magazine") from a pet
template called *ohmydog*; all real content is pictures of a printed menu.

- Address: 106 Chase Street, Columbia, LA 71418
- Phone: 318-594-2384
- Hours: Mon/Tue/Thu/Sat 11:00am–7:00pm · Wed closed ·
  Fri 7:00–8:30am and 11:00am–7:00pm · Sun 12:00–7:00pm
- Snowball pricing: **Small $4 · Medium $5 · Large $6**
- Alani / Red Bull energy drinks: **$7.00**, 32 oz cup with shaved or nugget
  ice; Red Bull in Regular and Sugar Free; "customize with your favorite
  snowball flavor"
- Add-ins **$1**: cream, cold foam, caramel, chocolate, pineapple juice,
  strawberry puree
- 48 snowball flavours listed on the menu board
- Alani flavours (18): Strawberry Sunrise, Cotton Candy, Sherbert Swirl, Juicy
  Peach, Cherry Slush, Cherry Twist, Hawaiian Shaved Ice, Kimade, Pumpkin
  Creme, Witches Brew, Pink Slush, Orange Kiss, Blue Slush, Breeze Berry,
  Cosmic Stardust, Dream Float, Watermelon Wave, Purple Cotton Candy
- Specialty combos: Armadillo (Butterbeer & Ice Cream), Double Bubble (Blue
  BBG & Pink BBG), Frog in a Blender (Sour Apple & Cherry)
- Brands shown on the homepage: Blue Bell Ice Cream, Alani Nu, Hunt Brothers
  Pizza
