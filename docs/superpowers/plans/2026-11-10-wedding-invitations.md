# Wedding Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sell wedding invitation web pages end to end: catalog, customiser with live preview, PayMongo checkout confirmed by webhook, public guest page with RSVP, private manage link, admin management.

**Architecture:** New server code lives in plain modules under `server/` (not routed), imported by new Pages Function files: `functions/api/invitations/[[path]].ts`, `functions/api/paymongo/webhook.ts`, `functions/api/admin/invitations/[[path]].ts`, `functions/i/[slug].ts`, `functions/photos/[[key]].ts`. These are more specific than the existing `functions/api/[[route]].ts` catch-all, so they take precedence. Shared field rules live in `shared/invitation-fields.ts`, used by both server and React. Layouts are React components in `src/invitations/layouts/`. The guest page is a separate Vite entry (`invitation.html`). Photos go to R2, data to D1.

**Tech Stack:** Cloudflare Pages Functions, D1, R2, PayMongo Checkout Sessions + webhooks, React 19 + Vite multi-page + Tailwind, Node test runner with esbuild bundling (existing `tests/api.test.mjs` pattern).

**Spec:** `docs/superpowers/specs/2026-11-10-wedding-invitations-design.md`

## Global Constraints

- Money in integer **centavos**, currency `"PHP"`. The amount always comes from `products_designs.price_centavos` in D1, never from the request.
- An order becomes `paid`, and its invitation `live`, **only** inside the verified webhook handler.
- Secrets only via env: `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `JWT_SECRET`. Never returned to the browser or logged. Local test-mode values go in `.dev.vars`; add the two PayMongo names to `.dev.vars.example`.
- PayMongo: `POST https://api.paymongo.com/v1/checkout_sessions`, HTTP Basic with `secretKey + ':'`. Keep the URL in one constant `PAYMONGO_CHECKOUT_URL` (the docs disagree on v1 vs v2; the first test-mode payment confirms which). `payment_method_types: ['qrph']` (QR Ph only, client decision 2026-11-10; originally card, GCash, Maya, GrabPay). The response gives `data.id` (`cs_…`) and `data.attributes.checkout_url`.
- Webhook: header `Paymongo-Signature: t=<ts>,te=<test sig>,li=<live sig>`. Signature = hex HMAC-SHA256 of `` `${t}.${rawBody}` `` with `PAYMONGO_WEBHOOK_SECRET`. Compare against `te` when the event's `data.attributes.livemode` is false, or `li` when true. Constant-time comparison. Reject if `|now − t| > 300 s`. Event type `checkout_session.payment.paid`. Paths in the payload: event id `data.id`; session id `data.attributes.data.id`; payments `data.attributes.data.attributes.payments[].id`; metadata `data.attributes.data.attributes.metadata`.
- PayMongo sends **no** expiry event. Pending orders older than 72 h are treated as expired by cleanup (Task 11).
- Partner names and design are locked after payment (server-enforced). The slug never changes.
- Manage token: 32 random bytes, base64url, sent only in the URL fragment (`/manage#<token>`) and the `X-Manage-Token` request header. Only `sha256(token)` is stored.
- Invitation status values: `'pending' | 'live' | 'expired' | 'refunded'`. Order status values: `'pending' | 'paid' | 'failed' | 'expired' | 'refunded'`.
- Field limits are in `shared/invitation-fields.ts` and enforced on the server. Photos: at most 6, each a JPEG/PNG/WebP data URL of at most 1,400,000 chars.
- Roles: Super Admin and Administrator write designs and orders; Editor gets read-only (403 on writes).
- Existing behaviour and the 12 existing tests stay green after every task.

## Review Focus

1. **Duplicate or out-of-order webhooks.** The same event twice, or a paid event for an already-refunded order, must not re-send emails or revive the invitation. The test goes in Task 4.
2. **A visitor reaching the success page before the webhook arrives.** The page must say "confirming payment" and poll, never show "paid". The test (status endpoint returns pending) goes in Task 4.
3. **Hostile text in invitation fields** (`<script>`, very long strings, emoji, line breaks). It is stored and rendered as text, rejected beyond the limits, and escaped in OG tags and emails. Tests in Tasks 2 and 6.
4. **Lost or wrong manage tokens.** A wrong token reveals nothing (same 404 for "no such invitation" and "bad token"), and resend-links never reveals whether an email has an order. Tests in Task 5.
5. **A guest page for a refunded, expired, pending or unknown slug.** Each gets the documented response, and OG tags never leak details of non-live invitations. Tests in Task 6.

---

### Task 1: Move shared server helpers out of the catch-all router

**Files:**
- Create: `server/crypto.ts` (`sha256`, `hmacKey`, `signAdminToken`, `verifyAdminToken` moved verbatim from `functions/api/[[route]].ts`)
- Create: `server/email.ts` (`EMAIL_RE`, `oneLine`, `escapeHtml`, `parseTextToHtml`, `buildHtmlEmail`, `getThemeColorHex`, `sendSmtpEmail` moved verbatim; keeps `import { connect } from 'cloudflare:sockets'`)
- Modify: `functions/api/[[route]].ts` (import them instead)
- Modify: `functions/tsconfig.json` (include `../server`, `../shared`)

**Interfaces:**
- Produces: the same exported names and signatures as today, e.g. `verifyAdminToken(request: Request, db: D1Database, secret?: string): Promise<{email,fullName,role}|null>`, `sendSmtpEmail(db, smtp, mail: {to, subject, body}, request?): Promise<void>`.

- [ ] **Step 1:** Move the code (pure move, no edits). Run `npm test`. Expected: 12 pass; `tests/api.test.mjs` already exercises these paths.
- [ ] **Step 2:** Run `npm run lint && npm run build`. Expected: pass.
- [ ] **Step 3:** Commit: `refactor(api): move auth and email helpers to server/`.

### Task 2: Schema, migration, and shared field rules

**Files:**
- Create: `migrations/0001_invitations.sql`. `CREATE TABLE IF NOT EXISTS` for `products_designs`, `invitations`, `orders`, `payment_events`, `rsvps`, with the columns in the spec's Data model plus `orders.terms_accepted_at`. Add unique indexes on `invitations.slug`, `invitations.manage_token_hash` and `orders.paymongo_checkout_id`, and an index on `rsvps.invitation_id`. **No DROP statements**: this file runs against the live DB.
- Modify: `schema.sql` (append the same tables so fresh installs get them), `seed.sql` (one sample design: `layout_key 'classic'`, `price_centavos 99900`, two color schemes, sample details)
- Modify: `package.json` (add a `db:migrate:local` script running the migration with `--local`)
- Create: `shared/invitation-fields.ts`
- Test: `tests/invitation-fields.test.mjs`

**Interfaces:**
- Produces:
  - `LIMITS` (name 60, venueName 120, address 200, mapUrl 500, dressCode 200, message 1000, giftsNote 300, scheduleItems 8, scheduleLabel 80, photos 6, photoChars 1_400_000, rsvpName 80, rsvpMessage 500, partySizeMax 10)
  - `type InvitationDetails = { partner1, partner2, eventDate (ISO date), eventTime (HH:MM), ceremony: {name, address, mapUrl}, reception?: {...same}, schedule: {time,label}[], dressCode?, message?, rsvpDeadline? (ISO date), giftsNote? }`
  - `validateDetails(input: unknown): { ok: true, details: InvitationDetails } | { ok: false, error: string }`. It trims strings, enforces types and limits, requires `partner1`, `partner2`, `eventDate` and `ceremony.name`, and requires `mapUrl` to be `https://` or empty.
  - `validateRsvp(input): { ok, rsvp: {guestName, attending: boolean, partySize, message} } | { ok: false, error }`
  - `lockedFieldsChanged(before: InvitationDetails, after: InvitationDetails): boolean` (true if `partner1` or `partner2` differ)
  - `makeSlug(p1: string, p2: string, random: string): string` → for example `maria-and-juan-k3x9`: lowercase, ASCII-folded, non-alphanumerics become `-`, max 60 chars before the suffix.
  - `LAYOUT_KEYS = ['classic', 'garden', 'modern'] as const` (the server validates designs against it; Task 7's registry keys must match it).

- [ ] **Step 1: Write failing tests** `tests/invitation-fields.test.mjs`. Import `../shared/invitation-fields.ts` directly (Node strips types). Cover:
  - valid details pass and are trimmed;
  - a missing `partner2` fails;
  - a 61-character name fails;
  - `mapUrl: 'javascript:alert(1)'` fails;
  - 9 schedule items fail;
  - `<script>` in `message` passes unchanged (escaping is the renderer's job);
  - `validateRsvp` rejects `partySize` 0 or 11 and a missing name;
  - `lockedFieldsChanged` is true for a renamed partner and false for a date change;
  - `makeSlug('María', 'Juan', 'k3x9') === 'maria-and-juan-k3x9'`.
- [ ] **Step 2:** Run `npm test`. Expected: the new file FAILS (module not found).
- [ ] **Step 3:** Implement `shared/invitation-fields.ts`, the migration, the schema and seed additions, and the script.
- [ ] **Step 4:** Run `npm test` (expected: all pass), then `npm run db:migrate:local` (expected: the commands execute successfully).
- [ ] **Step 5:** Commit: `feat(invitations): schema, migration and field validation`.

### Task 3: PayMongo client and webhook signature check

**Files:**
- Create: `server/paymongo.ts`
- Test: `tests/paymongo.test.mjs`

**Interfaces:**
- Produces:
  - `PAYMONGO_CHECKOUT_URL = 'https://api.paymongo.com/v1/checkout_sessions'`
  - `createCheckoutSession(secretKey: string, o: { amountCentavos: number, itemName: string, referenceNumber: string, successUrl: string, cancelUrl: string, customerEmail: string, metadata: Record<string,string> }): Promise<{ id: string, checkoutUrl: string }>`. It sends `line_items: [{ name, amount, currency: 'PHP', quantity: 1 }]`, the four payment method types, `send_email_receipt: true`, and `billing.email`. It throws `Error('PayMongo: <message>')` on a non-2xx response, using `errors[0].detail` when present.
  - `verifyPaymongoSignature(header: string|null, rawBody: string, secret: string, livemode: boolean, nowSec: number): boolean`

- [ ] **Step 1: Write failing tests.** Compute expected signatures in the test with `node:crypto` `createHmac`. Cover:
  - a valid `te` with livemode false → true;
  - a valid `li` with livemode true → true;
  - a valid `te` sent as livemode true → false;
  - a body changed by one character → false;
  - `t` 301 s old → false;
  - a missing or malformed header → false;
  - `createCheckoutSession` sends Basic auth `base64('sk_test_x:')` and amount `99900` (stub `fetch`), returns `{ id, checkoutUrl }` from `data.id` and `data.attributes.checkout_url`, and throws `PayMongo: …` on a 400.
- [ ] **Step 2:** Run `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement. Use `crypto.subtle` HMAC; constant-time compare via `crypto.subtle.verify` or an equal-length XOR loop.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(payments): PayMongo checkout client and webhook signature check`.

### Task 4: Catalog, checkout, order status, and webhook endpoints

**Files:**
- Create: `functions/api/invitations/[[path]].ts`. Routes: `GET /api/invitations/designs` (active designs, public fields only); `POST /api/invitations/checkout`; `GET /api/invitations/order-status?order=<id>` → `{ status }` only.
- Create: `functions/api/paymongo/webhook.ts` (POST only)
- Modify: `wrangler.toml` (add `[[r2_buckets]] binding = "PHOTOS"`, `bucket_name = "jlc-invitation-photos"`)
- Test: `tests/invitations-api.test.mjs` (bundles both files with esbuild, as `tests/api.test.mjs` does; fake D1 and a fake R2 `{ put, get, delete }`; stubbed `fetch` for PayMongo and Turnstile)

**Interfaces:**
- Consumes: `validateDetails`, `makeSlug`, `LIMITS` (Task 2); `createCheckoutSession`, `verifyPaymongoSignature` (Task 3); `sendSmtpEmail`, `EMAIL_RE` (Task 1).
- Checkout request: `{ designSlug, colorScheme, details, photos: string[] (data URLs), email, termsAccepted: true, turnstileToken }`. Validation order:
  1. email;
  2. Turnstile (same siteverify as `/api/inquiry`);
  3. `termsAccepted === true`;
  4. design exists and is active;
  5. `colorScheme` is one of the design's schemes;
  6. `validateDetails`;
  7. photos: count, size and MIME prefix.

  Then:
  1. Upload photos to R2 as `inv/<invitationId>/<n>.<ext>`.
  2. Insert the invitation (`pending`, generated slug, `manage_token_hash = sha256(token)`) and the order (`pending`, amount from the DB, `terms_accepted_at = now`).
  3. Call `createCheckoutSession` with `referenceNumber = orderId`, `metadata: { order_id }`, `successUrl = <origin>/invitations/success#<orderId>.<token>` and `cancelUrl = <origin>/invitations/<designSlug>`.
  4. Store `paymongo_checkout_id` and respond `{ checkoutUrl }`.

  If PayMongo fails, delete the photos and rows and respond 502 with a friendly message. Ruling: the raw manage token rides in the success URL fragment so the success page can show the manage link; it is never sent to the server.
- Webhook, in this order:
  1. Read the raw body as text.
  2. Parse `livemode` from it.
  3. Verify the signature, otherwise 401.
  4. `INSERT OR IGNORE` into `payment_events` by `data.id`; if the row already existed, return 200 and do nothing.
  5. For `checkout_session.payment.paid`, find the order by `paymongo_checkout_id`. Only if the order is `pending`: set it `paid` (with `paid_at` and the first payment id), set the invitation `live`, and send the paid email (public link, manage link, receipt lines).

  Other event types and other order statuses are stored and return 200. Respond 200 quickly; the email goes through `context.waitUntil`.
- Ruling: the paid email cannot contain the raw manage token, because the server only stores its hash. So the webhook **issues a fresh token**: it generates a new token, updates `manage_token_hash`, and emails `/manage#<newToken>`. The old token (from the success URL) stops working; the success page tells the customer to use the emailed link. Cost if wrong: a customer who copies the success-page link before the email arrives finds it stale.

- [ ] **Step 1: Write failing tests:**
  - checkout without `termsAccepted` → 400;
  - checkout with a bad Turnstile → 400;
  - checkout with `amount` in the body is ignored, and PayMongo receives the DB price `99900`;
  - checkout with 7 photos → 400;
  - a successful checkout creates pending rows and returns `checkoutUrl`;
  - PayMongo 400 → 502, and the rows and R2 objects are gone;
  - order-status for a pending order → `{ status: 'pending' }` (Review Focus 2);
  - webhook with a bad signature → 401, nothing changes;
  - a valid paid webhook → order `paid`, invitation `live`, one email queued;
  - the same event again → 200, still one email (Review Focus 1);
  - a paid event for a `refunded` order → stays refunded, no email (Review Focus 1).
- [ ] **Step 2:** Run `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement both route files and the `wrangler.toml` binding.
- [ ] **Step 4:** Run `npm test && npm run lint`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(invitations): checkout, order status and PayMongo webhook`.

### Task 5: Manage, RSVP, and resend-links endpoints

**Files:**
- Modify: `functions/api/invitations/[[path]].ts`. Routes:
  - `GET /api/invitations/manage` (header `X-Manage-Token`) → `{ slug, status, design, colorScheme, details, photos, rsvps }`;
  - `POST /api/invitations/manage` (same header) → body `{ details, photos }`;
  - `GET /api/invitations/manage/rsvps.csv`;
  - `POST /api/invitations/i/<slug>/rsvp` (Turnstile);
  - `POST /api/invitations/resend` (body `{ email }`, Turnstile).
- Test: extend `tests/invitations-api.test.mjs`

**Interfaces:**
- Manage lookup is by `sha256(header token)`. Any miss (wrong token, or an invitation that isn't live) → the **same** 404 `{ error: 'Invitation not found.' }` (Review Focus 4).
- `POST manage`: `validateDetails`; if `lockedFieldsChanged` → 400 `'Names cannot be changed after payment.'`. Photos follow the same rules as checkout; removed photos are deleted from R2.
- CSV: columns `Name,Attending,Party size,Message,Submitted`. Escape quotes, and prefix cells starting with `= + - @` with `'` to prevent formula injection.
- RSVP: only for `live` invitations whose RSVP deadline (if any) hasn't passed. `validateRsvp` applies, max 300 RSVPs per invitation, and responses are stored as text.
- Resend: always 200 `{ ok: true }`. For each live invitation of a paid order with that email, it issues a fresh token and emails the links. Rate limit: 3 per email per hour, counted in `audit_logs`, using the same pattern as login.

- [ ] **Step 1: Write failing tests:**
  - manage with a wrong token and with an unknown token → identical 404 body;
  - a correct token returns details and RSVPs;
  - renaming partner2 → 400;
  - a date change → 200 and stored;
  - an RSVP on a refunded invitation → 404;
  - an RSVP with party size 11 → 400;
  - CSV escapes `=SUM(A1)` as `'=SUM(A1)`;
  - resend for an unknown email → 200 and no email;
  - resend for a known email → 200, one email, and the old token stops working.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(invitations): manage link, RSVP and resend endpoints`.

### Task 6: Guest page function, public invitation data, photo serving

**Files:**
- Create: `functions/i/[slug].ts`
- Create: `functions/photos/[[key]].ts`
- Modify: `functions/api/invitations/[[path]].ts` (add `GET /api/invitations/i/<slug>`)
- Test: `tests/guest-page.test.mjs`

**Interfaces:**
- `GET /api/invitations/i/<slug>` →
  - `live`: `{ state: 'live', layoutKey, colorScheme, details, photos: string[] (URLs /photos/...), rsvpOpen }`;
  - `expired` (computed as `event_date + 60 days < today`, and the status is updated lazily): `{ state: 'expired', partner1, partner2 }`;
  - anything else: 404.
- `functions/i/[slug].ts`: fetch `/invitation.html` via `env.ASSETS` and inject `<title>` and `og:title`, `og:description` and `og:image` (first photo, absolute URL) with `HTMLRewriter`. All values go through `escapeHtml` (Review Focus 3). For non-live slugs, tags are generic (`"Invitation not available"` or `"<names> — celebration has passed"`, no photo). Status: 200 for live and expired, 404 for others (Review Focus 5).
- `functions/photos/[[key]].ts`: serves the R2 object only if its invitation is `live`. Otherwise 404. Sets `Cache-Control: public, max-age=86400`.

- [ ] **Step 1: Write failing tests:**
  - a live slug: HTML contains the escaped names in `og:title` (an input name `A<b>` appears as `A&lt;b&gt;`);
  - a refunded slug → 404, and no partner name in the HTML;
  - an expired slug → 200 with "celebration has passed" and no `og:image`;
  - an unknown slug → 404;
  - a photo for a refunded invitation → 404.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(invitations): guest page link previews and photo serving`.

### Task 7: Invitation layouts and the guest page entry

**Files:**
- Create: `src/invitations/layouts/index.ts` (registry `LAYOUTS: Record<(typeof LAYOUT_KEYS)[number], React.ComponentType<LayoutProps>>`, keyed by `LAYOUT_KEYS` from `shared/invitation-fields.ts`)
- Create: `src/invitations/layouts/Classic.tsx`, `Garden.tsx`, `Modern.tsx`
- Create: `src/invitations/InvitationView.tsx` (picks the layout, adds the countdown, map links, and an RSVP slot)
- Create: `invitation.html`, `src/invitations/guest-main.tsx` (fetches `/api/invitations/i/<slug>`, renders `InvitationView` or the expired page, plus the RSVP form with Turnstile)
- Modify: `vite.config.ts` (`build.rollupOptions.input: { main: 'index.html', invitation: 'invitation.html' }`)

**Interfaces:**
- `type LayoutProps = { details: InvitationDetails; scheme: { primary: string; accent: string; background: string; text: string }; photos: string[]; rsvpSlot?: React.ReactNode }`. Layouts render text only through JSX, never `dangerouslySetInnerHTML`.
- `guest-main.tsx` must not import anything from `src/components/` (keeps the bundle small).

- [ ] **Step 1:** Implement the layouts, the view and the guest entry.
- [ ] **Step 2:** Run `npm run build`. Expected: `dist/invitation.html` exists, and the invitation entry's JS is under 150 kB gzipped (check the build output size line). Run `npm run lint`. Expected: pass.
- [ ] **Step 3:** Commit: `feat(invitations): wedding layouts and lightweight guest page`.

### Task 8: Public catalog, customiser, success, manage and policy pages

**Files:**
- Create: `src/invitations/CatalogPage.tsx`, `CustomiserPage.tsx`, `SuccessPage.tsx`, `ManagePage.tsx`, `PolicyPage.tsx` (content for `/terms`, `/refund-policy`, `/privacy` as starting drafts, marked in code as needing the client's review)
- Modify: `src/App.tsx` (when `location.pathname` starts with `/invitations`, `/manage`, `/terms`, `/refund-policy` or `/privacy`, render the matching page; hash routes are unchanged), `src/components/Navbar.tsx` (an "Invitations" link to `/invitations`)
- Modify: `public/_headers` (no change expected; verify the CSP allows R2-served `/photos` (same origin) and Turnstile)

**Interfaces:**
- The customiser reuses `optimizeImage` from `src/components/admin/images.ts`, `validateDetails` and `LIMITS` for client-side hints, and `InvitationView` for the live preview. Turnstile reuses the loader pattern from `InquiryForm.tsx`. Pay → `POST /api/invitations/checkout` → `location.href = checkoutUrl`.
- The success page reads `#<orderId>.<token>` and polls `order-status` every 3 s for up to 2 minutes. It shows "Confirming your payment…" until the order is `paid`, then "You're live!" with a link to the public page. It notes that the manage link has been emailed (per the Task 4 ruling). On timeout it shows "we'll email you as soon as PayMongo confirms".
- The manage page reads the token from `location.hash`, then immediately clears the hash with `history.replaceState`, and keeps the token in memory. It edits through `POST /api/invitations/manage`, with name fields shown read-only. It has the RSVP table and CSV download, a copy-link button, and a "resend my links" form on a 404.

- [ ] **Step 1:** Implement the pages and routing.
- [ ] **Step 2:** Run `npm run lint && npm run build`. Expected: pass.
- [ ] **Step 3:** Commit: `feat(invitations): catalog, customiser, success, manage and policy pages`.

### Task 9: Admin API for designs, orders and invitations

**Files:**
- Create: `functions/api/admin/invitations/[[path]].ts` (auth via `verifyAdminToken`; Editors are read-only). Routes:
  - `GET /api/admin/invitations/overview` → `{ designs, orders, invitations (with rsvpCount), totals: { paidCount, paidCentavos } }`;
  - `POST .../designs` with action `add | update | toggle | reorder`;
  - `POST .../orders/refund` (order → `refunded`, invitation → `refunded`);
  - `POST .../orders/resend` (issues a fresh token and emails the links);
  - `GET .../invitations/<id>/rsvps`.
- Test: `tests/admin-invitations.test.mjs`

**Interfaces:**
- Design validation: `layout_key` must be in `LAYOUT_KEYS` (Task 2), `price_centavos` an integer from 1000 to 10,000,000, `slug` unique and URL-safe, and color schemes a non-empty array of `{name, primary, accent, background, text}` with `#rrggbb` values.

- [ ] **Step 1: Write failing tests:**
  - no token → 401;
  - Editor POST to designs → 403;
  - Editor GET overview → 200;
  - an unknown `layout_key` → 400;
  - a price of 0 → 400;
  - refund flips both statuses, and the guest API then returns 404;
  - the overview totals sum only paid orders.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(admin): invitation designs, orders and refunds API`.

### Task 10: Admin tabs

**Files:**
- Create: `src/components/admin/DesignsTab.tsx`, `OrdersTab.tsx`, `InvitationsTab.tsx` (using `adminApi`, `AdminTabProps`, the `run` pattern)
- Modify: `src/components/AdminPanel.tsx` (three sidebar buttons and hidden-when-inactive containers. These tabs load their own data from `/api/admin/invitations/overview` when first shown, not from `/api/admin/data`.)

- [ ] **Step 1:** Implement. Orders shows status, amount (₱ from centavos), email, created and paid times, PayMongo ids, payment events, and Refund/Resend buttons (confirm dialogs). Designs is a catalog form with a color scheme editor and a preview using `InvitationView` with the design's sample details.
- [ ] **Step 2:** Run `npm run lint && npm test && npm run build`. Expected: pass.
- [ ] **Step 3:** Commit: `feat(admin): designs, orders and invitations tabs`.

### Task 11: Expiry and cleanup

**Files:**
- Create: `server/cleanup.ts`
- Modify: `functions/api/admin/invitations/[[path]].ts` (the overview runs cleanup first)
- Test: extend `tests/admin-invitations.test.mjs`

**Interfaces:**
- `runCleanup(db: D1Database, photos: R2Bucket, now: Date): Promise<{ expiredOrders: number, purgedInvitations: number }>`:
  - pending orders older than 72 h → order `expired`, invitation rows and R2 photos deleted;
  - live invitations with `event_date + 60 days < now` → `expired`, photos deleted from R2, RSVPs deleted (per the privacy notice).
- A one-line `shortcut:` comment: cleanup runs when an admin opens the overview, because Pages has no cron; upgrade to a Worker cron trigger if orders grow.

- [ ] **Step 1: Write failing tests:**
  - a pending order 73 h old → expired, and its photos are deleted;
  - one 71 h old → untouched;
  - a live invitation 61 days after the event → expired, RSVPs deleted;
  - one 59 days after → untouched.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(invitations): expiry and pending-order cleanup`.

### Task 12: End-to-end check in PayMongo test mode and launch notes

**Files:**
- Modify: `README.md` (an "Invitations launch checklist" section)
- Modify: `.dev.vars.example` (`PAYMONGO_SECRET_KEY="sk_test_…"`, `PAYMONGO_WEBHOOK_SECRET="whsk_…"`)

- [ ] **Step 1:** Write the checklist:
  1. create the R2 bucket `jlc-invitation-photos`;
  2. run `migrations/0001_invitations.sql` with `--remote`;
  3. set the PayMongo secrets with `wrangler pages secret put`;
  4. register a PayMongo webhook to `https://jlcitsolutions.com/api/paymongo/webhook` for `checkout_session.payment.paid` (test mode first, then live);
  5. get the policy pages reviewed;
  6. switch to live keys.
- [ ] **Step 2:** Run locally with the client's **test** keys (from `.dev.vars`, entered by the client) and a tunnel URL for the webhook. In the browser: buy an invitation with a PayMongo test card, confirm the webhook marks it paid, open the guest page, RSVP, open the manage link, change the date, try renaming (refused), and export the CSV. In admin: refund, then confirm the guest page shows 404. Record the results in the commit message.
- [ ] **Step 3:** Run `npm run lint && npm test && npm run build`. Expected: pass.
- [ ] **Step 4:** Commit: `docs(invitations): launch checklist and test-mode run`.
