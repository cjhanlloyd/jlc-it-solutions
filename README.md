# JLC Solutions

Website and online store for JLC Solutions: digital invitations (debut, wedding, birthday) with GCash checkout,
order tracking and custom designs, plus an IT services site with an inquiry form. An admin portal at `/admin`
manages orders, payments, designs, inquiries, customers, site content, users and reports.

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS 4 (`src/`, with entries `index.html`, `invitation.html`, `admin.html`)
- **API:** Cloudflare Pages Functions (`functions/`), shared server code in `server/` and `shared/`
- **Data:** Cloudflare D1 (SQLite) for records, Cloudflare R2 for uploaded photos, receipts and proofs
- **Email:** SMTP over Cloudflare sockets, configured from the admin portal
- **Tests:** Node's built-in test runner against a real SQLite database (`tests/`)

## Prerequisites

- Node.js 22.18 or newer
- A Cloudflare account with Wrangler (`npx wrangler login`) for deployment

## Local development

```bash
npm install
cp .env.example .env          # set JWT_SECRET; the Turnstile test secret is already filled in
npm run db:reset:local        # create and seed the local D1 database (wipes local data)
npm run db:migrate:local      # apply the migrations on top of the base schema
npm run dev                   # site, admin and API at http://localhost:8788
```

For hot reload while editing the UI, keep `npm run dev` running and also run `npm run dev:ui`
(Vite on http://localhost:5173, forwarding `/api` to port 8788).

The seeded admin account (`admin@example.com`) has no password. Set one locally:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'your-password'
npx wrangler d1 execute jlc_database --local --command "UPDATE admins SET passwordHash = '<hash>' WHERE email = 'admin@example.com'"
```

## Configuration

All secrets are read from environment variables; none are stored in the code. See `.env.example`.

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | Yes | Signs admin session tokens. Without it, admin sign-in is disabled. |
| `TURNSTILE_SECRET_KEY` | Yes | Cloudflare Turnstile check on public forms. |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` | No | Card checkout via PayMongo (not enabled by default). |

SMTP credentials and GCash payment details are entered in the admin portal and stored in the database.
The SMTP password is write-only: it is never sent back to the browser.

Bindings (see `wrangler.toml`): `DB` (D1 database) and `PHOTOS` (R2 bucket).

## Checks

```bash
npm run lint    # type-check the frontend and the Functions
npm test        # API, permission and end-to-end journey tests
npm run build   # production build into dist/
```

GitHub Actions runs all three on every push and pull request (`.github/workflows/ci.yml`).

## Deployment

The site deploys to Cloudflare Pages (build command `npm run build`, output directory `dist`).

1. Set the secrets in the Pages project:
   ```bash
   npx wrangler pages secret put JWT_SECRET --project-name <your-pages-project>
   npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name <your-pages-project>
   ```
2. Apply any new migration to the production database **before** deploying the code that needs it:
   ```bash
   npx wrangler d1 execute <database-name> --remote --file=migrations/<migration>.sql
   ```
   The admin dashboard warns Super Admins when the live database is missing a migration.
3. Never run `seed.sql` against production; it is sample data for local development.

## Project structure

```
functions/   Cloudflare Pages Functions (public API, admin API, guest pages, media)
server/      Server-side modules (auth, orders, payments, email, reports, permissions)
shared/      Code shared by the browser and the server (occasions, packages, order status)
src/         React app: public site (site/, components/), invitations (invitations/), admin portal (admin/)
public/      Static files and security headers (_headers)
migrations/  Numbered, additive D1 migrations
tests/       Node test suite with a real SQLite harness
docs/        Reference notes for adding invitation designs
```

## Security

- Admin roles (Super Admin, Administrator, Designer) are enforced on the server for every admin endpoint;
  a permission-matrix test covers every route and role.
- Customer order pages require a per-order token; uploaded files are private and served only after an auth check.
- Public forms are protected by Cloudflare Turnstile and rate limits; admin sign-in has a brute-force guard.
- Security headers and a Content Security Policy are set in `public/_headers`.

To report a security issue, contact the site owner through the contact form rather than opening a public issue.
