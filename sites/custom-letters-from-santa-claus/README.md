# Custom Letters from Santa Claus — orders

Order backend for this site only. Checkout stays off on the public site until `checkout.enabled` is set to `true` in `site.json`. Stripe runs in test mode. Nothing is emailed or mailed until a letter is approved, and the send flags below default off.

The database is the existing Supabase project **Lead Gen Admin** (`oyrcjrcgvmzmkaipapjm`). Every table, grant, and comment from this site lives in the Postgres schema `santa`. The migration does not alter or drop anything outside that schema.

## Env vars

Set these on the Vercel project `custom-letters-from-santa-claus` only. Do not put real values in git. Leave `LIVE_CHECKOUT_APPROVED` unset.

| Name | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Checkout | Stripe secret. Use a sandbox `sk_test_` or `rk_test_` key. A key that starts with `sk_live_` or `rk_live_` refuses to run unless `LIVE_CHECKOUT_APPROVED=true`. |
| `STRIPE_WEBHOOK_SECRET` | Webhook | Signing secret for `/api/santa/webhook` (`whsec_...`). |
| `LIVE_CHECKOUT_APPROVED` | No | Leave unset. Only the exact value `true` allows an `sk_live_` or `rk_live_` key. |
| `CHECKOUT_ENABLED` | No | `true` opens the checkout API on preview and local runs. Ignored when `VERCEL_ENV` is `production`, which still requires `checkout.enabled` in `site.json`. |
| `POSTGRES_URL` | Yes, for orders | Supabase pooler URL (`postgres://...:6543/postgres`). The Vercel Supabase integration sets this. Server only. |
| `ADMIN_PASSWORD` | Admin | Password for `/admin`. Use a long random value. |
| `AI_GATEWAY_API_KEY` | No | Off unless this is set. Paid orders then get the template draft (`source` `template`) for an outside assistant to replace. When this key is set, the AI SDK may write the letter instead. |
| `DRAFTER_API_TOKEN` | Drafter API | Bearer token for `GET /api/santa/drafter/pending` and `POST /api/santa/drafter/letters/:id`. Compared in constant time. Missing or wrong is 401. |
| `AI_GATEWAY_MODEL` | No | Defaults to `google/gemini-3.8-flash`. |
| `EMAIL_SENDING_ENABLED` | No | Defaults off. `true` sends approved email letters and the parent confirmation. Otherwise the server logs `would send` and does not call Microsoft Graph. |
| `MS_GRAPH_TENANT_ID` | When email sending is on | Microsoft Entra tenant for the mailbox. |
| `MS_GRAPH_CLIENT_ID` | When email sending is on | App registration client id. Application permission `Mail.Send`. |
| `MS_GRAPH_CLIENT_SECRET` | When email sending is on | App client secret. |
| `LOB_SENDING_ENABLED` | No | Defaults off. `true` creates Lob letters for approved printed orders that are not the postmark add-on. |
| `LOB_API_KEY` | When Lob is on | A `test_` key, or a `live_` key only when `LOB_SENDING_ENABLED=true` and `LOB_LIVE_APPROVED=true`. |
| `LOB_LIVE_APPROVED` | No | Leave unset. A live Lob key is refused without this exact value `true` and mailing turned on. |
| `LOB_FROM_NAME` | When Lob is on | Return name on the envelope. |
| `LOB_FROM_LINE1` | When Lob is on | Real return street. Do not invent a North Pole street. |
| `LOB_FROM_CITY` | When Lob is on | Return city. |
| `LOB_FROM_STATE` | When Lob is on | Return state. |
| `LOB_FROM_ZIP` | When Lob is on | Return ZIP. |
| `CRON_SECRET` | Cron | Vercel sends `Authorization: Bearer <CRON_SECRET>` to `/api/santa/jobs`. |
| `SANTA_ORDERS_ENABLED` | Local only | Set to `true` when running outside the Santa Vercel project. Production uses `VERCEL_PROJECT_ID`. |

The from-address for email letters is `santa@customlettersfromsantaclaus.com`. It is not printed on the marketing pages. Do not change the domain's MX or existing SPF/TXT records to send mail. Graph sends as that mailbox; the mailbox has to exist first.

## Outside assistant

Paid orders start with a template letter (`source` `template`). An assistant polls:

- `GET /api/santa/drafter/pending` with `Authorization: Bearer $DRAFTER_API_TOKEN`. Each item has the order id, letter id, letter type (`printed` or `email`), tone, the child's first name and age, and the writing details (town, friend or pet, accomplishment, something to work on, wish list). It does not include the parent email or mailing address.
- `POST /api/santa/drafter/letters/:id` with `{ "body": "..." }` replaces the text and sets `source` to `assistant`, but only while the letter is still waiting for review. It does not approve or send the letter.

A missing or wrong token is 401. The compare is constant time.

`checkout.enabled` in `site.json` defaults to `false`. While it is false, and `seasonNotice` is set, the public pages say the workshop is closed instead of offering a cart or a "Coming soon" button. Other stores without `seasonNotice` still show "Coming soon — notify me." Set `CHECKOUT_ENABLED=true` on a preview or local run to open the API without editing `site.json`. That override does nothing when `VERCEL_ENV` is `production`. The postmark add-on stays hidden while `postmarkUpgrade.enabled` is `false`.

## Database

Run `supabase/migrations/20261115231500_santa_orders.sql` in the Lead Gen Admin SQL editor (or `psql` against that project). It is idempotent: `CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and repeated grants. It only touches schema `santa`.

RLS is on for every table. There are no policies for `anon` or `authenticated`, and those roles are revoked. Do not add `santa` to the project's exposed Data API schemas. The server does not use PostgREST or the service role key.

Serverless functions connect with the `postgres` package to `POSTGRES_URL`. Prepared statements are off so the transaction pooler (port 6543) accepts the session, SSL is required, and the pool is one connection. Every statement is schema-qualified to `santa` and every value is a parameter.

Child rows have no email column. A parent email is required. The privacy page states the retention rules the job enforces:

- Child details are deleted 60 days after that letter is sent or mailed.
- A rejected letter's child details are deleted 60 days after the rejection.
- An unpaid, canceled, or abandoned order's child details are deleted after 7 days.
- The parent name, email, and mailing address are deleted 60 days after the last letter in the order is delivered. The remaining row keeps the product and the amount.
- `/admin` can mark a postmark letter shipped, which starts that clock, and can delete a family's data immediately when a parent asks. That removes the child details and the parent name, email, and address from this database. If the order has a Stripe Customer, that Customer is deleted too. Stripe keeps the payment transaction records under its own legal obligations.

Run the migration again if the `santa` schema already exists. The added statements include `stripe_customer_id` on `santa.orders` and an index so the daily login-attempt purge can delete old rows.

## Routes

| Path | Role |
| --- | --- |
| `POST /api/santa/checkout` | Validates the order, prices it, opens a Stripe Checkout Session. Refuses when checkout is off or the Stripe key is live and unapproved. |
| `POST /api/santa/webhook` | Paid test sessions mark the order paid, store a confirmation template, and draft one letter per child. |
| `/admin` | Password form. Lists orders and drafts. Edit, approve, reject, or draft again. |
| `GET /api/santa/admin?export=csv` | Approved postmark-add-on letters only, as CSV. |
| `GET /api/santa/admin?export=pdf` | Same batch as a PDF packing file. |
| `GET /api/santa/jobs` | Cron. Sends due approved email, mails approved standard print through Lob, purges child details 60 days after delivery, deletes login-attempt rows older than a day, and holds unapproved email whose date has arrived. |

The cron is in the repo-root `vercel.json` (`0 14,20 * * *`, 08:00 and 14:00 CT in winter). Every Git-connected project uses the repo root as its Root Directory, so Vercel registers that job on each of them. A cron in `sites/custom-letters-from-santa-claus/vercel.json` is not read. `/api/santa/jobs` returns 200 and does no database work unless `VERCEL_PROJECT_ID` is `prj_Cooa6zu0wXv87rdhtKX7M4nj5gVG` or `SANTA_ORDERS_ENABLED=true`. Every other project gets `{ "ok": true, "skipped": true }`. A site build rewrites the root file from the redirect rules and puts this cron back, so the job is not dropped.

## End-to-end test order (Stripe test mode)

1. Apply the migration to Lead Gen Admin. Leave `santa` off the exposed Data API schemas.
2. On Vercel project `custom-letters-from-santa-claus`, the Supabase integration supplies `POSTGRES_URL`. The server reads that name. Also set `STRIPE_SECRET_KEY` (`sk_test_...` from the sandbox), `STRIPE_WEBHOOK_SECRET`, `ADMIN_PASSWORD`, `DRAFTER_API_TOKEN`, and `CRON_SECRET`. Leave `LIVE_CHECKOUT_APPROVED` unset. Leave `AI_GATEWAY_API_KEY` unset unless you want the gateway to write letters. Leave both sending flags unset. For a preview only, `CHECKOUT_ENABLED=true` opens the API without editing `site.json`. `SUPABASE_SERVICE_ROLE_KEY` is not used.
3. Point Stripe at `https://<deployment>/api/santa/webhook`. `*.vercel.app` on this project has Vercel Authentication, so a webhook from Stripe cannot reach it until you use a [protection bypass](https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection) or the custom domain is serving this project. Do not change MX.
4. For a local run, from the repo root:

```bash
SANTA_ORDERS_ENABLED=true \
STRIPE_SECRET_KEY=sk_test_replace_me \
STRIPE_WEBHOOK_SECRET=whsec_replace_me \
POSTGRES_URL=postgres://replace_me \
ADMIN_PASSWORD=replace_me \
DRAFTER_API_TOKEN=replace_me \
CRON_SECRET=replace_me \
node sites/custom-letters-from-santa-claus/server/dev-server.mjs
```

In another terminal: `stripe listen --forward-to localhost:8787/api/santa/webhook`.

5. Turn checkout on only for the preview you are testing (`"checkout": { "enabled": true }` in `site.json`). This branch leaves it `false`, so the public site keeps the closed-for-2026 notice.
6. Open a printed letter or the email, fill the parent email and the child fields, and choose Checkout. Pay with card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
7. The webhook stores the order and a draft. Open `http://localhost:8787/admin` (or `/admin` on the deployment), sign in, and approve one letter.
8. Call the job:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:8787/api/santa/jobs
```

The log says `would send` or `would mail`. The letter stays approved. Nothing is handed to Microsoft Graph or Lob while those flags are false.

9. Optional: set `EMAIL_SENDING_ENABLED=true` or `LOB_SENDING_ENABLED=true` with the matching credentials (Lob test key only) and run the job again. An unapproved letter is still not sent. Postmark-add-on orders are never sent to Lob; download the CSV or PDF from the admin page after approval. The add-on cannot be bought while `postmarkUpgrade.enabled` is false.

## Tests

```bash
npm test
```

Pricing (including the 2–5 bundle cap and the household postmark price), the order-by clock, and the live-key guard are covered there.
