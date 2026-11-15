# Custom Letters from Santa Claus — orders

Order backend for this site only. Checkout stays off on the public site until `checkout.enabled` is set to `true` in `site.json`. Stripe runs in test mode. Nothing is emailed or mailed until a letter is approved, and the send flags below default off.

The database is the existing Supabase project **Lead Gen Admin** (`oyrcjrcgvmzmkaipapjm`). Every table, grant, and comment from this site lives in the Postgres schema `santa`. The migration does not alter or drop anything outside that schema.

## Env vars

Set these on the Vercel project `custom-letters-from-santa-claus` only. Do not put real values in git. Leave `LIVE_CHECKOUT_APPROVED` unset.

| Name | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Checkout | Stripe secret. Use a sandbox `sk_test_...` key. A key that starts with `sk_live_` refuses to run unless `LIVE_CHECKOUT_APPROVED=true`. |
| `STRIPE_WEBHOOK_SECRET` | Webhook | Signing secret for `/api/santa/webhook` (`whsec_...`). |
| `LIVE_CHECKOUT_APPROVED` | No | Leave unset. Only the exact value `true` allows an `sk_live_` key. |
| `SUPABASE_URL` | Yes, for orders | `https://oyrcjrcgvmzmkaipapjm.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes, for orders | Service role key. Server only. Never in the browser. |
| `ADMIN_PASSWORD` | Admin | Password for `/admin`. Use a long random value. |
| `AI_GATEWAY_API_KEY` | Drafts | Vercel AI Gateway key. Drafts are written with the AI SDK (`generateText`) through the gateway. |
| `AI_GATEWAY_MODEL` | No | Defaults to `google/gemini-3.8-flash`. |
| `EMAIL_SENDING_ENABLED` | No | Defaults off. `true` sends approved email letters and the parent confirmation. Otherwise the server logs `would send` and does not call Microsoft Graph. |
| `MS_GRAPH_TENANT_ID` | When email sending is on | Microsoft Entra tenant for the mailbox. |
| `MS_GRAPH_CLIENT_ID` | When email sending is on | App registration client id. Application permission `Mail.Send`. |
| `MS_GRAPH_CLIENT_SECRET` | When email sending is on | App client secret. |
| `LOB_SENDING_ENABLED` | No | Defaults off. `true` creates Lob letters for approved printed orders that are not the postmark add-on. |
| `LOB_API_KEY` | When Lob is on | Must be a Lob **test** key (`test_...`). Live keys are refused. |
| `LOB_FROM_NAME` | When Lob is on | Return name on the envelope. |
| `LOB_FROM_LINE1` | When Lob is on | Real return street. Do not invent a North Pole street. |
| `LOB_FROM_CITY` | When Lob is on | Return city. |
| `LOB_FROM_STATE` | When Lob is on | Return state. |
| `LOB_FROM_ZIP` | When Lob is on | Return ZIP. |
| `CRON_SECRET` | Cron | Vercel sends `Authorization: Bearer <CRON_SECRET>` to `/api/santa/jobs`. |
| `SANTA_ORDERS_ENABLED` | Local only | Set to `true` when running outside the Santa Vercel project. Production uses `VERCEL_PROJECT_ID`. |

The from-address for email letters is `santa@customlettersfromsantaclaus.com`. It is not printed on the marketing pages. Do not change the domain's MX or existing SPF/TXT records to send mail. Graph sends as that mailbox; the mailbox has to exist first.

`checkout.enabled` in `site.json` defaults to `false`. While it is false, product buttons stay "Coming soon — notify me." The postmark add-on stays hidden while `postmarkUpgrade.enabled` is `false`.

## Database

Run `supabase/migrations/20261115231500_santa_orders.sql` in the Lead Gen Admin SQL editor (or `psql` against that project). It is idempotent: `CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and repeated grants. It only touches schema `santa`.

RLS is on for every table. There are no policies for `anon` or `authenticated`, and those roles are revoked. The service role bypasses RLS and is the only role granted access. Serverless functions are the only callers.

The server uses PostgREST (`SUPABASE_URL` + service role) with `Accept-Profile: santa` and `Content-Profile: santa`. **Add `santa` to the project's exposed Data API schemas**, next to the schemas already listed. Do not remove `public` or any schema other apps use. This repo does not change that setting. Exposing the schema does not let the anon key read rows, because RLS is on and there is no policy for that role.

Child rows have no email column. A parent email is required. Child details are deleted 60 days after that letter is sent or mailed. The daily job does the delete. Letters that were never delivered are kept so they can still be fulfilled.

## Routes

| Path | Role |
| --- | --- |
| `POST /api/santa/checkout` | Validates the order, prices it, opens a Stripe Checkout Session. Refuses when checkout is off or the Stripe key is live and unapproved. |
| `POST /api/santa/webhook` | Paid test sessions mark the order paid, store a confirmation template, and draft one letter per child. |
| `/admin` | Password form. Lists orders and drafts. Edit, approve, reject, or draft again. |
| `GET /api/santa/admin?export=csv` | Approved postmark-add-on letters only, as CSV. |
| `GET /api/santa/admin?export=pdf` | Same batch as a PDF packing file. |
| `GET /api/santa/jobs` | Cron. Sends due approved email, mails approved standard print through Lob, purges child details 60 days after delivery, and holds unapproved email whose date has arrived. |

The cron is `0 14,20 * * *` (08:00 and 14:00 CT in winter). Because every Vercel project in this monorepo reads the root `vercel.json`, other projects receive the same schedule. Their handler returns immediately and does not read the database or send mail. Only project `prj_Cooa6zu0wXv87rdhtKX7M4nj5gVG` does the work.

## End-to-end test order (Stripe test mode)

1. Apply the migration to Lead Gen Admin and add `santa` to Exposed schemas without removing the others.
2. On the Santa Vercel project, set `STRIPE_SECRET_KEY` to the sandbox test secret (`sk_test_...`), `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `AI_GATEWAY_API_KEY`, and `CRON_SECRET`. Leave `LIVE_CHECKOUT_APPROVED` unset. Leave `EMAIL_SENDING_ENABLED` and `LOB_SENDING_ENABLED` unset or `false`.
3. Point Stripe at `https://<deployment>/api/santa/webhook`. `*.vercel.app` on this project has Vercel Authentication, so a webhook from Stripe cannot reach it until you use a [protection bypass](https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection) or the custom domain is serving this project. Do not change MX.
4. For a local run, from the repo root:

```bash
SANTA_ORDERS_ENABLED=true \
STRIPE_SECRET_KEY=sk_test_replace_me \
STRIPE_WEBHOOK_SECRET=whsec_replace_me \
SUPABASE_URL=https://oyrcjrcgvmzmkaipapjm.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=replace_me \
ADMIN_PASSWORD=replace_me \
AI_GATEWAY_API_KEY=replace_me \
CRON_SECRET=replace_me \
node sites/custom-letters-from-santa-claus/server/dev-server.mjs
```

In another terminal: `stripe listen --forward-to localhost:8787/api/santa/webhook`.

5. Turn checkout on only for the preview you are testing (`"checkout": { "enabled": true }` in `site.json`). This branch leaves it `false`, so production buttons stay "Coming soon."
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
