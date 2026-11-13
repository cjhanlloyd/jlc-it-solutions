# JLC Solutions invitation platform: architecture and phases

Date: 2026-11-13 · Size: programme (several projects) · Status: for owner approval

## Intent and why
The owner wants JLC Solutions to run as a digital-invitation SaaS: a premium marketplace, a simple order flow,
**manual GCash payments verified by an admin** (PayMongo live keys are on hold until company registration), order
tracking with status emails, and a dedicated Admin Portal that replaces the current CMS. IT services stay as a
secondary "Other services" offering. Success: a customer can find a design, order, pay by GCash QR, upload a receipt,
follow the order, and receive a live invitation; an admin can verify payments, produce and deliver invitations, and
run the business from one portal, without touching code.

## Audit summary (phase 1, done)
- **Stack (keep):** Cloudflare Pages + Functions, D1 (`jlc_database`), R2 (`PHOTOS`), React 19 + Vite + Tailwind,
  node `--test`. No reason to replace it.
- **Reusable as is:** occasion registry (wedding, birthday, debut: rules, forms, layouts), customiser with live preview,
  guest page + RSVP (Turnstile), manage link (hashed token), photo upload/serving, 60-day cleanup, admin login (JWT,
  roles `Super Admin`/`Administrator`/`Editor`), `audit_logs`, SMTP email (`sendSmtpEmail`, `buildHtmlEmail`).
- **Payment today:** PayMongo Checkout (QR Ph, test keys) wired directly into `POST /api/invitations/checkout` and the
  webhook. `orders` has PayMongo-specific columns. Must become one provider behind an interface.
- **The CMS:** one `AdminPanel` (≈300 lines) with tabs Content (Home/About/Services/Pricing/Why/Contact), Branding,
  Email, Inquiries, Accounts, Logs, Designs, Invitations, Orders, reached at `#/admin` inside the public SPA. Content
  lives in `content`, `services`, `faqs`, `process_steps`, `roadmap_steps`, `project_gallery`, `branding` tables,
  which the IT pages read via `/api/public-data`.
- **Routing:** public site mixes hash tabs (`#/home`, `#/services`, …) with path routes (`/invitations/<slug>`,
  `/i/<slug>`). Hash routes are invisible to search engines.

## Goals
1. **Manual GCash ordering** (replaces PayMongo in the customer flow; PayMongo code kept as a dormant provider).
2. **Order lifecycle** with the owner's statuses, history, assignment, notes, and status emails.
3. **Order tracking** for customers by reference number plus a secure check.
4. **Admin Portal** at `/admin`, separate UI from the public site, same backend and DB, role-based on the server.
5. **Public redesign**: premium SaaS look, marketplace with search/filter, design detail pages with packages,
   path-based routes, homepage sections managed from the portal.
6. **Remove the old CMS UI** once the portal covers it. Existing content data is kept and edited from the portal.
7. **Reports** (sales, payments, popular designs, inquiries, monthly revenue) with date filters and CSV export.

## Non-goals
- Live PayMongo (phase 7, separate milestone). Test keys are not used as a substitute.
- Customer login accounts (customers are identified by email + secure links; no passwords).
- Native apps, multi-currency, multi-language.

## Anti-goals
- An order marked paid because a receipt was uploaded. Only an admin action confirms payment.
- Payment receipts or customer details readable without admin auth (or the customer's own secure link).
- Losing any existing order, invitation, RSVP, inquiry, admin account or content row.
- Breaking existing guest links (`/i/<slug>`) and manage links.

## Key decisions (builder's calls, owner delegated: "I trust you")
- **Production model: C, both.** Each design offers **packages**. A *template* package is generated from the details
  the customer enters in the customiser (today's flow); after payment is confirmed it lands in **For Review** so an
  admin checks it, then **Deliver** publishes it. A *custom* package is made by hand: the order carries the details
  and notes, a designer uploads a link or file, the customer reviews the proof and approves or requests a revision.
- **Payments are records, providers are plugins.** New `payments` table (order, provider, amount, status, reference,
  receipt key, verified_by/at, notes). `server/payments/` exposes one interface:
  `createPayment(order) → { kind: 'instructions' | 'redirect', ... }`, plus `onWebhook` for providers that have one.
  `manual_gcash` is the only enabled provider (config in DB, editable in the portal). `paymongo` moves behind the
  same interface, disabled. No other code branches on the provider name.
- **Receipts** go to R2 under a private `receipts/` prefix, never served by `/photos/*`; images only (JPEG/PNG/WebP,
  ≤ 5 MB, re-checked by magic bytes); read only through an admin endpoint. Purged with the order's other data under
  the existing retention policy (kept for accounting as long as the order record is).
- **Order reference:** `JLC-` + 6 unambiguous characters (e.g. `JLC-7KQ4MX`), unique, shown everywhere.
- **Tracking security:** `/track` asks for reference **and** the order email (both must match; Turnstile; same
  "not found" for any mismatch). Every status email also carries a direct tracking link with a random token (hashed in
  DB, like manage links).
- **Payment deadline:** 48 hours from order creation (shown on the payment page). Unpaid orders past the deadline
  become **Cancelled** lazily on read and in the cleanup job; a late payer contacts support.
- **Statuses** (single source in `shared/order-status.ts` with allowed transitions):
  Pending Payment → Payment Verification → Payment Confirmed → In Production → For Review ⇄ Revision Requested →
  Completed → Delivered; plus Cancelled and Refunded from any non-final state. Receipt rejected → back to Pending
  Payment with the reason shown to the customer. Template orders skip In Production. Every change writes an
  `order_events` row (who, from, to, note) and, for customer-visible changes, emails the customer.
- **Customers:** `customers` table keyed by email (name, phone, notes, created_at); orders and inquiries link to it.
  Backfilled from existing orders/inquiries by email.
- **Admin Portal:** separate Vite entry `admin.html` served at `/admin` (same pattern as `invitation.html`), its own
  sidebar layout. Modules: Dashboard, Orders, Payments, Invitations (designs, categories, packages, featured,
  publish), Inquiries, Customers, Content & Settings, Reports, Users, Activity log.
- **Roles** (enforced in Functions by a permission map, UI only hides): **Super Admin** everything incl. users and
  payment settings; **Administrator** everything except users; **Designer** (renamed `Editor`) sees orders assigned to
  them plus unassigned production work, uploads deliverables, adds notes; no payments, reports, settings, or
  customer contact export.
- **Public routing:** move to path routes (`/`, `/designs`, `/designs/<slug>`, `/order/<ref>`, `/track`,
  `/services`, `/contact`). Old hash links (`#/home`, `#/services`, …) redirect client-side. `/i/<slug>` unchanged.
- **Design system:** one token set (colour, type scale, spacing, radius, shadow) and a small component kit (Button,
  Card, Badge, Input, Select, Textarea, Modal, Tabs, EmptyState, StatusPill) in Tailwind, used by both the public
  site and the portal. Existing JLC logo and colours carried over.

## Data migration
All additive (`ALTER TABLE ADD COLUMN`, new tables); nothing dropped in this programme.
- `orders`: add `reference`, `status` values migrated (`pending`→`pending_payment`, `paid`→`delivered` when its
  invitation is live, `refunded`→`refunded`, `failed`/expired→`cancelled`), `package_key`, `customer_id`,
  `assigned_to`, `payment_deadline`, `tracking_token_hash`, `deliverable_url`.
- New: `payments`, `order_events`, `order_notes`, `customers`, `payment_settings` (GCash QR image key, account
  name, number mask, instructions, deadline hours), `categories`, `testimonials`, `banners`.
- `products_designs`: add `packages` (JSON: key, name, price_centavos, inclusions[], kind `template|custom`),
  `featured`, `description`, `category_id`. Existing `price_centavos` becomes the default template package.
- Owner runs each migration on production before the matching push (as before).

## Phases (order changed by the builder, with reason)
The owner listed redesign before payments. Builder's order puts **payments first**: today no customer can actually pay
(PayMongo live is on hold), so GCash ordering unlocks revenue soonest; its new pages are built in the new design
system from day one, so the redesign does not redo them.

1. **Audit:** this document.
2. **Ordering + GCash + portal core.** Design tokens/components; payments module and `manual_gcash` provider;
   order references, statuses, events, deadline; payment page with QR, amount, reference, deadline, receipt upload,
   status; tracking page; status emails; Admin Portal shell at `/admin` with Orders (list/filter/detail, receipt
   review, approve/reject, status changes, notes, assignment, deliver) and Payment settings (QR upload, account info).
   Template packages only. PayMongo removed from the customer flow.
3. **Public redesign.** Home (hero, categories, featured designs, how it works, packages, testimonials when present,
   FAQ, footer), Marketplace (search, occasion filter, price), Design details (large preview, mobile preview,
   description, packages and inclusions, Order Now), Other Services, Contact/Inquiry, path routing.
4. **Portal completion.** Dashboard, Invitations (packages, categories, featured, publish), custom packages
   (deliverable upload, proof review, revision requests), Inquiries (status, notes, convert to order), Customers,
   Content & Settings (banners, homepage sections, FAQs, contact, social, branding), Users & roles, Activity log.
   Delete the old `AdminPanel` and `#/admin`.
5. **Reports.** Sales, confirmed/pending payments, order performance, popular designs, inquiries, monthly revenue;
   date filters; CSV export.
6. **Hardening.** End-to-end tests of customer and admin flows, role checks on every admin endpoint, mobile and
   performance pass, accessibility pass (incl. form labels).
7. **PayMongo live** (later): enable the `paymongo` provider with live keys and a live webhook; no ordering changes.

Each phase gets its own short spec and plan, is tested and released before the next starts.

## Left to the builder
Visual styling within "modern, premium, minimal SaaS"; exact component APIs; email copy; dashboard chart choices.
