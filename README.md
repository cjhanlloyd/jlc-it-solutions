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
