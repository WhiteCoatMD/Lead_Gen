# Lead Gen Site Portfolio

Recreated and maintained lead-generation websites migrated from Snapps.ai.

## Build

```bash
npm install
npm run build          # builds every site into dist/<site-slug>
npm run build:site -- <site-slug>
npm run audit          # checks every built site against the launch checklist
```

The repository has no runtime dependencies; `npm install` only sets up the
workspace.

## Layout

| Path | Purpose |
| --- | --- |
| `sites/<slug>/site.json` | Content and branding for one site |
| `sites/<slug>/assets/` | That site's images, served from `/assets/` |
| `sites/<slug>/site.css` | Optional per-site stylesheet, overrides `shared/site.css` |
| `shared/render-site.mjs` | Shared contractor template |
| `shared/render-birds-nest.mjs` | Bespoke storefront template |
| `shared/site.css`, `shared/site.js` | Shared styles and behaviour |
| `scripts/build-site.mjs`, `scripts/build-all.mjs` | Build |
| `scripts/audit.mjs` | Launch-checklist verification |
| `scripts/deploy-all.mjs` | Deploys each site to its Vercel project |
| `deploy/projects.json` | Slug to Vercel project mapping |
| `.github/workflows/godaddy-dns.yml` | GoDaddy DNS automation |

All images are stored in the repository. Nothing is hotlinked from the old
host, so the sites do not break when Snapps goes away.

## Hosting

Each site is its own Vercel project, all connected to this repository. A push
to `main` rebuilds and redeploys every site; each project is configured with
build command `npm run build` and output directory `dist/<slug>`.

`node scripts/deploy-all.mjs [slug ...]` deploys from the CLI instead, and
`node scripts/deploy-all.mjs --verify-only` checks that every public URL
serves the right business.

## Launch checklist

`npm run audit` enforces, for every site: SEO title and description,
canonical URL on the apex domain, local-business structured data, Open Graph
tags, responsive navigation, a header phone CTA, a mobile sticky call button,
consistent `tel:` links, service and service-area sections, local assets,
`favicon.svg`, `robots.txt` and `sitemap.xml`.

## Planned sites

- Twin City Fences
- Lake Charles Fences and Decks
- Chicago EIFS and Stucco
- Stucco Repair Chicago
- Flooring Monroe
- DunRite Tow Truck Arlington
- 24 Hour Towing Dallas
- Scaffolding Los Angeles
- DunRite Towing Jonesboro
- Cactus Removal Tucson
- Twin City Handyman
- The Bird's Nest Flower Shop

## Excluded sold sites

These are not rebuilt, redeployed, or reconnected:

- Stucco Repair Los Angeles
- Stucco Repair Orlando
- DunRite Towing Metairie

## Domain status

Ten of the thirteen domains are live on Vercel. The other three are not:

- **DunRite Towing Jonesboro** (`towingcompanyjonesboro.com`) — **shelved.**
  The domain lapsed and is fully deleted per RDAP. Not being re-registered.
  The site is left built and deployed in case that changes.
- **DunRite Tow Truck Arlington** (`towing-arlington.com`) — **on hold.**
  Also lapsed and fully deleted (NXDOMAIN; GoDaddy returns 409). Undecided
  whether to re-register.
- **Deck Builder Monroe** (`deckbuildermonroe.com`) — **phone received
  2026-09-21** (318-726-2853) and now in `site.json`; the site builds, passes
  `npm run audit`, and is ready for its DNS cutover.

All three are built, deployed, and have both hostnames attached to their
Vercel projects, so each goes live with no code change: the two towing sites
as soon as their domains are re-registered and pointed at GoDaddy, and Deck
Builder Monroe as soon as its phone number is set.
