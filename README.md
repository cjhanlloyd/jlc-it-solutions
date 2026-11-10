# JLC IT Solutions

Company website with a contact/inquiry form and an admin panel for editing site content and answering inquiries.

- **Frontend:** React + Vite + Tailwind (`src/`)
- **API:** Cloudflare Pages Functions (`functions/api/[[route]].ts`)
- **Database:** Cloudflare D1 `jlc_database` (`schema.sql`, `seed.sql`)
- **Email:** SMTP over Cloudflare sockets, configured in the admin panel

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars      # then set JWT_SECRET (Turnstile test key already set)
npm run db:reset:local              # create + seed the local D1 database (wipes local data)
npm run dev                         # full site with API at http://localhost:8788
```

For hot reload while editing the UI, keep `npm run dev` running and also run `npm run dev:ui`
(Vite on http://localhost:5173, forwarding `/api` to port 8788).

The seeded admin (`admin@jlcitsolutions.com`) has no password; see the comment in `seed.sql` to set one.

## Checks

```bash
npm test        # API security tests (tokens, roles, login limit, email injection)
npm run lint    # type-check frontend and functions
```

## Deploy

Cloudflare Pages project `jlc-it-solutions`, build command `npm run build`, output `dist`.
Required secrets:

```bash
npx wrangler pages secret put JWT_SECRET --project-name jlc-it-solutions            # without it, admin login is disabled
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name jlc-it-solutions  # without it, the contact form rejects everything
```

The contact form uses Cloudflare Turnstile. The public site key is in `src/components/InquiryForm.tsx`;
on localhost it switches to Cloudflare's always-pass test key.

Optional: `GEMINI_API_KEY` for AI tagline and reply drafts.
Security headers for static pages live in `public/_headers`.

## Invitations launch checklist

1. **R2 bucket.** Create `jlc-invitation-photos` (dashboard, or `npx wrangler r2 bucket create jlc-invitation-photos`) and make sure the Pages project has the `PHOTOS` binding (see `wrangler.toml`).
2. **Database.** Run the migration once against the live DB. It only creates tables/indexes if missing (no DROP):
   `npx wrangler d1 execute jlc_database --remote --file=migrations/0001_invitations.sql`
   Then add at least one design in the admin panel's Invitation Designs tab. Do not run `seed.sql` remotely (it overwrites live data; its sample design is for local dev only).
3. **Secrets.** `TURNSTILE_SECRET_KEY` and `JWT_SECRET` are already set. Add the PayMongo ones (test keys, `sk_test_…`, first):
   ```bash
   npx wrangler pages secret put PAYMONGO_SECRET_KEY --project-name jlc-it-solutions
   npx wrangler pages secret put PAYMONGO_WEBHOOK_SECRET --project-name jlc-it-solutions
   ```
4. **PayMongo webhook.** Dashboard, Developers, Webhooks: add endpoint `https://jlcitsolutions.com/api/payments/paymongo/webhook` with event `checkout_session.payment.paid`, and copy its secret into `PAYMONGO_WEBHOOK_SECRET`. Test and live modes have separate webhooks and secrets.
5. **API version.** PayMongo's docs disagree on v1 vs v2 for checkout. The code uses `PAYMONGO_CHECKOUT_URL` in `server/paymongo.ts` (v1); the first test-mode payment confirms it.
6. **Policy pages.** `/terms`, `/refund-policy` and `/privacy` are drafts. Get them reviewed and approved before launch.
7. **Email.** Enable SMTP in the admin panel's email settings, or couples won't get their manage-link email (the success-page link still works).
8. **Cleanup.** Unpaid orders (pending for more than 72 h) and old invitations are cleaned up when an admin opens the Orders or Invitations tab (Pages has no cron).
   An admin should open the Orders or Invitations tab at least weekly so cleanup runs, including the 60-day deletion promised in the privacy notice. If that's impractical, move cleanup to a Worker cron trigger.
9. **Go live.** Switch to the live secret key and live webhook secret, make one small real purchase, and refund it.

Local test mode: put the test keys in `.dev.vars`. For the webhook to reach your machine, expose it with a tunnel
(`npx cloudflared tunnel --url http://localhost:8788`) and register that URL as a test-mode webhook.
