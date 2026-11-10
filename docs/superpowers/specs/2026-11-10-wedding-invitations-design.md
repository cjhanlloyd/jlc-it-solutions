# Wedding invitation web pages — design (first SaaS product)

## Intent and why
JLC IT Solutions is entering the digital invitation market. The first product is a **wedding invitation web
page**, sold end to end on jlcitsolutions.com. The goal is to prove that couples will pay before the
platform is generalised. Everything here is meant to ship as one sellable product. "Platform" work is done
only where this product needs it, or where it is free to do now and costly to retrofit later.

## Who it serves
- **Couples (customers)**: pick a design, fill in their details, pay with PayMongo, share a link, see RSVPs.
- **Guests**: open the link on a phone (mostly from Messenger or Viber), see the details, and RSVP.
- **JLC admins**: manage designs, prices, orders, payments and invitations from the existing admin panel.

## Goals
1. Browse wedding designs with a live preview of each, on the public site.
2. Customise without help: choose a design and one of its color schemes, then fill in a form. A live preview updates as they type.
3. Pay through PayMongo hosted checkout, QR Ph only (client decision, 2026-11-10): payable from GCash, Maya or any bank app. An order becomes paid **only** when PayMongo's signed webhook confirms it.
4. After payment: a public invitation page at `/i/<slug>`, and an email to the couple with that link and a private **manage link**.
5. Guests RSVP on the page. The couple sees and exports the RSVP list through the manage link and can edit their details.
6. Admin can manage designs (catalog fields, price, color schemes, on/off), orders and payment status, invitations and RSVPs.
7. When the link is shared in Messenger or Viber, the preview card shows the couple's names, date and photo.

## Non-goals (first version)
- Other occasions (birthday, debut, and so on), subscriptions, premium tiers, coupons.
- Customer accounts with passwords. Access is by private manage link (decided with the client).
- A free-form or drag-and-drop editor, downloadable image or PDF invitations, printed cards.
- Admins creating new **layouts** without a developer. Admins manage everything else about a design.
- Refunds through the API. Refunds are done in the PayMongo dashboard, and admin marks the order refunded.
- Sales and revenue reports beyond an order list with totals.
- A full site redesign. New public pages follow the existing brand, and the wider redesign comes later.

## Anti-goals (failures even if it "works")
- An order marked paid from anything except a verified PayMongo webhook. Redirects can be faked.
- PayMongo secret keys or the webhook secret reaching the browser, the repo or logs.
- Guests' RSVP data, or a couple's manage link, readable by anyone who doesn't hold that couple's link.
- A guest page that is slow on a mid-range phone on mobile data.
- An invitation page that breaks or disappears before the wedding because of an admin edit to its design.

## Constraints (existing project)
- Cloudflare Pages + Pages Functions (`functions/api/[[route]].ts`), D1 (`jlc_database`), React 19 + Vite + Tailwind SPA. No other servers.
- Admin panel: one file per tab under `src/components/admin/`. New admin areas are new tab files using `adminApi()` and `AdminTabProps`.
- Existing security patterns stay: signed admin tokens, role checks, Turnstile on public forms, escaped email HTML, SMTP via the existing sender.
- Secrets as Pages secrets: `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`. Test-mode keys locally in `.dev.vars`.
- Money is stored as integer centavos, currency PHP.
- The client has a verified PayMongo account. Development and testing use test mode, and launch switches to live keys.

## Approaches considered (for the designs)
1. **Designs as code, catalog in admin (picked).** Each layout is a React component in the repo, with 3–4 at launch. Admin controls name, price, color schemes, preview images, sample content and on/off. Polished, fast, safe and phone-tested; new layouts need a developer.
2. Admin-uploaded HTML templates with placeholders. No developer is needed for new designs, but it risks broken paid invitations, needs per-template mobile QA, and arbitrary HTML on the domain is a security risk. Rejected for v1.
3. Embedding a third-party invitation builder. Fastest, but it resells someone else's product and brand. Rejected.

## Decided design

### Flow
1. `/invitations` lists active designs, each with preview images, price and a "Preview" (live sample) button.
2. `/invitations/<design>` is the customiser: a form on one side and the live preview (the real layout component) on the other. On phones, form and preview are switchable. The form holds the details listed below, plus a color scheme choice and up to **6 photos** (compressed in the browser with the existing `optimizeImage`). It also asks for the customer's email.
3. "Pay": the server validates the details, checks Turnstile, uploads the photos to R2, creates a **pending** order and invitation, and creates a PayMongo **Checkout Session**. The amount comes from the design's price **in the database, never from the browser**. The server then redirects to PayMongo's hosted page.
4. PayMongo calls `POST /api/payments/paymongo/webhook`. The server verifies the `Paymongo-Signature` header: an HMAC-SHA256 of `"<t>.<raw body>"` with the webhook secret, compared to `te` in test mode or `li` in live mode, in constant time, with a timestamp tolerance. It records the event id (so repeats do nothing), and on `checkout_session.payment.paid` marks the order **paid** and the invitation **live**. It then emails the couple their public link and manage link.
5. The success return page polls the order status until it is paid. It never trusts the redirect alone.
6. The guest page `/i/<slug>` renders the design with the couple's details: countdown, schedule, map link, photos, dress code, message, and an RSVP form (protected by Turnstile).
7. Manage link `/manage#<token>`: edit details and photos (decided with the client: the **two partner names and the design are locked after payment**; date and time, venues, schedule, photos, message and the rest stay editable; the server enforces the lock; the slug never changes, and the page and its link preview follow the current details), view and export RSVPs as CSV, and copy the share link. A "resend my links" form on the site emails the manage link to the order's email.

### Terms, refunds and privacy (decided with the client)
- Checkout requires a checkbox: "I agree to the Terms, Refund Policy and Privacy Notice". The server refuses checkout without it and stores `terms_accepted_at` on the order.
- There are three static public pages, `/terms`, `/refund-policy` and `/privacy`. The builder drafts starting text; the client has it reviewed and approves the final wording before launch. The draft is not legal advice.
- The privacy notice covers guest RSVP data (name, attendance, party size, message): it is shown only to the couple and JLC admins, and deleted with the invitation's photos after expiry.
- The paid email doubles as a receipt: amount paid, date, order number, design. PayMongo's own receipt is also sent.

### Invitation details (form fields)
Partner names (two), wedding date and time, ceremony venue (name, address, Google Maps link), reception venue (optional, same fields), schedule items (time + label, up to 8), dress code / colour motif text, a message to guests, RSVP deadline, an optional gifts note, and photos (up to 6). Every field has a maximum length, enforced on the server.

### Data model (D1)
The tables are generic where the cost is the same, so later products reuse orders and payments:
- `products_designs`: id, product_type ('wedding_invitation'), slug, name, layout_key (which React layout), price_centavos, color_schemes (JSON), preview_images (JSON), sample_details (JSON), active, sort_order.
- `invitations`: id, design_id, slug (unique; from the names plus a random suffix), color_scheme, details (JSON), photos (JSON list of R2 keys), status ('pending' | 'live' | 'expired' | 'refunded'), event_date, manage_token_hash (SHA-256 of a random 32-byte token; the raw token exists only in the email/URL), created_at.
- `orders`: id, product_type, product_id (the invitation id), customer_email, amount_centavos, currency, status ('pending' | 'paid' | 'failed' | 'expired' | 'refunded'), paymongo_checkout_id, paymongo_payment_id, terms_accepted_at, created_at, paid_at.
- `payment_events`: paymongo_event_id (PK), type, order_id, received_at, payload (JSON). This is the transaction history and makes repeated webhooks harmless.
- `rsvps`: id, invitation_id, guest_name, attending (yes/no), party_size, message, created_at.
- A design keeps its layout_key for life. Paid invitations store their own copy of the chosen color scheme, so later admin edits to a design never change live invitations.

### Storage
Photos go in Cloudflare R2 (a new bucket binding) and are served through a Pages Function or the bucket's public URL. They are never stored as base64 in D1, which the audit flagged.

### Routing (my call)
- The new public pages use real paths: `/invitations`, `/invitations/<design>`, `/i/<slug>`. The existing site keeps its hash routes.
- The guest page `/i/<slug>` is a **separate small Vite entry** (`invitation.html`), not the main SPA, so guests never download the marketing/admin bundle.
- Manage links put the token in the URL fragment, `/manage#<token>`. Browsers never send the fragment to the server, so tokens don't reach request logs. The page reads the token in the browser and sends it in a request header to the API.

### Link previews and page states (my call)
`/i/<slug>` is handled by a Pages Function. It returns `invitation.html` with Open Graph tags injected (title "Maria & Juan — June 12, 2027", description, first photo). Each state gets one rule:
- **live**: the invitation page.
- **expired** (more than 60 days after the event): a friendly "this celebration has passed" page with the couple's names only. No details, photos or RSVP.
- **refunded / disabled by admin**: HTTP 404 with a generic "invitation not available" page. Status values gain `'refunded'`, which is distinct from `'expired'`.
- **unknown slug or still pending**: HTTP 404, the same generic page.

### Admin
New tab files, using the existing `adminApi`/`run` pattern:
- **Designs:** catalog fields, price, color schemes, preview images, on/off, order. Layouts are picked from a fixed list of the coded `layout_key`s.
- **Orders:** list with status, amount, email, PayMongo ids, and payment events. Admins can mark an order refunded (which sets the invitation to refunded), resend the links email, and see order totals.
- **Invitations:** list linking to each public page, RSVP count, and an admin view of RSVPs.

Role rules follow the existing pattern. Super Admin and Administrator manage designs and orders; Editors view only. That is my call, and the client can change it.

### Expiry
A live invitation stays up until **60 days after its event date**, then shows a simple "this celebration has passed" page. Photos are kept until then. This is my call; the client can change the number.

## Left to the builder
- The visual design of the 3–4 launch layouts, within the existing brand and Tailwind setup (the client reviews them before launch).
- Splitting the code so the guest page doesn't load the 1.3 MB admin and marketing bundle. It must be fast on phones.
- Exact API routes and file layout under `functions/`, following the existing router style or adding Pages route files.
- Cleaning up pending orders and photos that never got paid (for example, removed when an admin views the orders list or on a later request). Mark this with a `shortcut:` comment if it isn't automated.
- Email wording, following the existing branded email builder.

## Testing expectations
Automated tests in the existing `tests/` style (Node test runner, fake D1, stubbed fetch) for:
- Webhook signature verification: valid, tampered, wrong mode, stale timestamp.
- A repeated webhook doesn't double-process.
- An order is paid only by the webhook, and the amount comes from the database.
- Manage token access: a correct token works; a wrong or missing one gets 404/403.
- After payment, edits that change the partner names or the design are refused; date and other edits are accepted.
- Checkout without terms acceptance is refused.
- RSVP validation and Turnstile.
- Field length limits.

Before launch, the full flow is run in PayMongo test mode with test cards and GCash/Maya test flows.
