# Phase 2: GCash ordering + Admin Portal core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers order a template invitation, pay by GCash QR, upload a receipt and track the order; admins verify the payment, review and deliver the invitation in a new portal at `/admin`.

**Architecture:** Orders get a reference, a status lifecycle (`shared/order-status.ts`) and an event history; every status change goes through one server function (`server/orders.ts#transition`). Payments are records (`payments` table) produced by a provider module (`server/payments/`); `manual_gcash` is the only enabled provider and PayMongo moves behind the same interface. New public API `functions/api/orders/[[path]].ts`, new admin API `functions/api/admin/orders/[[path]].ts`, new Vite entry `admin.html` for the portal.

**Tech Stack:** Cloudflare Pages Functions, D1, R2, React 19, Tailwind 4, node `--test` with `node:sqlite` (Node 24) for a real-SQL D1 fake.

**Spec:** `docs/superpowers/specs/2026-11-13-saas-platform-architecture.md` (phase 2 and "Key decisions").

## Global Constraints

- No PayMongo call anywhere in the customer flow. PayMongo test keys are not a substitute for GCash.
- An order becomes paid **only** by an admin approving a payment (`confirmPayment`), never by a receipt upload.
- Receipts live in R2 under `receipts/<orderId>/`; only `GET /api/admin/orders/:id/receipts/:paymentId` (auth + permission) serves them. `functions/photos/[[key]].ts` must refuse any key not starting with `inv/`.
- Receipt image: JPEG, PNG or WebP, decoded size ≤ 5 MB (`LIMITS.receiptBytes = 5_000_000`), type confirmed by magic bytes.
- Reference format: `JLC-` + 6 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (`/^JLC-[A-HJ-NP-Z2-9]{6}$/`), unique.
- Payment deadline: `payment_settings.deadline_hours` (default 48) after order creation.
- Status codes (exact): `pending_payment`, `payment_verification`, `payment_confirmed`, `in_production`, `for_review`, `revision_requested`, `completed`, `delivered`, `cancelled`, `refunded`.
- Tracking: `reference` + order `email` (both must match, Turnstile) or the emailed tracking token; any mismatch → the same 404 `{ error: 'Order not found.' }`.
- Roles: `Super Admin`, `Administrator`, `Editor` (= Designer; renamed in phase 4). Permissions enforced server-side from `server/permissions.ts`.
- Migrations are additive; the owner runs `migrations/0003_orders_gcash.sql` on production before the push. No data is deleted.
- Existing `/i/<slug>` guest links and `/manage#<token>` links keep working.
- Customer-facing copy says "GCash", never "PayMongo".

## Review Focus

1. Two admins approve the same payment at once → exactly one `payment_confirmed` event, one email (conditional UPDATE on from-status).
2. Receipt uploaded after the deadline, or while already in `payment_verification` → 409, nothing stored.
3. A file named `.png` that is really SVG/HTML → 400 (magic bytes), never served with an image type.
4. An `Editor` calling receipt, approve, reject, refund, assign or payment-settings endpoints → 403.
5. Guessing references: wrong email or token returns the same 404 as a missing reference, and `/photos/receipts/...` returns 404.

---

### Task 1: Real-SQL test harness

**Files:**
- Create: `tests/helpers/d1.mjs`, `tests/helpers/bundle.mjs`
- Test: `tests/harness.test.mjs`

**Interfaces:**
- Produces: `makeD1(): D1Database-like` (`prepare(sql).bind(...a).first/all/run`, `batch([...])` in one transaction, `run()` → `{ meta: { changes, last_row_id } }`, `all()` → `{ results }`), built on `node:sqlite` `DatabaseSync(':memory:')` loaded with `schema.sql` then every `migrations/*.sql` file **after 0002** (0001/0002 are already in `schema.sql`); `makeR2()` (Map-backed `put/get/delete(key|keys)/head`, `get` returns `{ body, httpMetadata, arrayBuffer() }`); `bundle(entry)` → imported module (esbuild, same options as `tests/invitations-api.test.mjs`, `cloudflare:sockets` aliased to `tests/smtp-stub.mjs`).

- [ ] **Step 1: Write the failing test** `tests/harness.test.mjs`: `makeD1()` → `INSERT INTO admins (...)` then `first()` returns the row; `batch` of two UPDATEs where the second throws rolls back the first; `run()` on INSERT gives `last_row_id`.
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Implement. `batch`: `BEGIN` / run each / `COMMIT`, `ROLLBACK` on throw. Bind `undefined` as `null`.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit `test: real SQLite D1 harness`.

### Task 2: Migration 0003 and schema

**Files:**
- Create: `migrations/0003_orders_gcash.sql`
- Modify: `schema.sql` (only add `-- see migrations/0003` comment; the harness applies the migration), `package.json` (`db:migrate:local` runs 0003)
- Test: `tests/migration-0003.test.mjs`

**Interfaces:**
- Produces tables/columns used by every later task:
  - `orders` + `reference TEXT`, `customer_id INTEGER`, `provider TEXT NOT NULL DEFAULT 'manual_gcash'`, `payment_deadline TEXT`, `tracking_token_hash TEXT`, `assigned_to TEXT`, `delivered_at TEXT`, `updated_at TEXT`; `CREATE UNIQUE INDEX idx_orders_reference ON orders(reference)`; `CREATE UNIQUE INDEX idx_orders_tracking ON orders(tracking_token_hash)`.
  - `customers(id INTEGER PK, email TEXT NOT NULL UNIQUE, name TEXT, phone TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`.
  - `payments(id INTEGER PK, order_id INTEGER NOT NULL, provider TEXT NOT NULL, amount_centavos INTEGER NOT NULL, status TEXT NOT NULL /* submitted|confirmed|rejected */, customer_reference TEXT, receipt_key TEXT, submitted_at TEXT NOT NULL, verified_by TEXT, verified_at TEXT, admin_reference TEXT, note TEXT)`; index on `order_id`.
  - `order_events(id INTEGER PK, order_id INTEGER NOT NULL, at TEXT NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL /* status|note|assign|payment */, from_status TEXT, to_status TEXT, note TEXT, visible INTEGER NOT NULL DEFAULT 0)`; index on `order_id`.
  - `payment_settings(id TEXT PK DEFAULT 'default', provider TEXT NOT NULL DEFAULT 'manual_gcash', gcash_account_name TEXT, gcash_number TEXT, instructions TEXT, qr_key TEXT, deadline_hours INTEGER NOT NULL DEFAULT 48, updated_at TEXT)` + `INSERT OR IGNORE INTO payment_settings (id) VALUES ('default')`.
- Data mapping (in the same file, in this order): `paid`→`delivered` (and `delivered_at = paid_at`), `pending`/`expired`/`failed`→`cancelled`, `refunded` stays; legacy rows get `provider = 'paymongo'`, `reference = 'JLC-' || upper(substr(hex(randomblob(4)), 1, 6))`; `customers` backfilled with `INSERT OR IGNORE ... SELECT DISTINCT lower(customer_email)` and `orders.customer_id` set from it.

- [ ] **Step 1: Failing test:** load harness with a pre-0003 DB (schema.sql only), insert one `paid`, one `pending`, one `refunded` order, apply 0003, assert statuses `delivered`/`cancelled`/`refunded`, every order has a `JLC-` reference and a `customer_id`, `payment_settings` has one row with `deadline_hours = 48`. (Expose `makeD1({ migrations: false })` and `applyMigration(db, file)` from the harness for this.)
- [ ] **Step 2:** run → FAIL. **Step 3:** write SQL. **Step 4:** run → PASS (and the whole suite still passes).
- [ ] **Step 5:** Commit `feat(orders): migration 0003 (references, payments, events, customers, GCash settings)`.

### Task 3: Order status rules

**Files:**
- Create: `shared/order-status.ts`
- Test: `tests/order-status.test.mjs`

**Interfaces:**
- Produces: `type OrderStatus` (the 10 codes); `STATUSES: readonly OrderStatus[]`; `STATUS_LABEL: Record<OrderStatus, string>` ("Pending Payment", "Payment Verification", "Payment Confirmed", "In Production", "For Review", "Revision Requested", "Completed", "Delivered", "Cancelled", "Refunded"); `CUSTOMER_MESSAGE: Record<OrderStatus, string>` (one plain sentence each); `canTransition(from: string, to: string): boolean`; `isFinal(s): boolean` (`cancelled`, `refunded`); `PAID_STATUSES` (everything from `payment_confirmed` to `delivered`, used for revenue).
- Transition map (exact):
  - `pending_payment` → `payment_verification`, `cancelled`
  - `payment_verification` → `payment_confirmed`, `pending_payment`, `cancelled`
  - `payment_confirmed` → `in_production`, `for_review`, `refunded`
  - `in_production` → `for_review`, `refunded`
  - `for_review` → `revision_requested`, `in_production`, `completed`, `delivered`, `refunded`
  - `revision_requested` → `in_production`, `for_review`, `refunded`
  - `completed` → `delivered`, `refunded`
  - `delivered` → `refunded`
  - `cancelled`, `refunded` → nothing

- [ ] **Step 1: Failing test:** `canTransition('pending_payment','payment_verification') === true`; `canTransition('pending_payment','payment_confirmed') === false` (no skipping verification); `canTransition('payment_confirmed','cancelled') === false` (paid orders are refunded, not cancelled); `canTransition('delivered','refunded') === true`; nothing leaves `cancelled`/`refunded`; unknown codes → false; every status has a label and message.
- [ ] **Steps 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(orders): status lifecycle rules`.

### Task 4: Orders core and customer emails

**Files:**
- Create: `server/orders.ts`, `server/order-emails.ts`
- Test: `tests/orders-core.test.mjs`

**Interfaces:**
- Consumes: Task 1 harness, Task 2 tables, Task 3 `canTransition`, `CUSTOMER_MESSAGE`; existing `sendSmtpEmail`, `emailAndRotateToken`, `randomToken`, `sha256`.
- Produces (all take `db: D1Database` first):
  - `newReference(): string` (format in Global Constraints).
  - `transition(db, orderId: number, to: OrderStatus, opts: { actor: string; note?: string; visible?: boolean }): Promise<{ ok: true; from: OrderStatus } | { ok: false; error: string }>` — reads the current status, refuses if `!canTransition`, then `db.batch([UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = <read status>, INSERT INTO order_events ... WHERE changes()])`; if the UPDATE changed 0 rows returns `{ ok: false, error: 'The order changed meanwhile. Reload and try again.' }` and writes no event. Customer-visible events (`visible` default true for status kind) only.
  - `addEvent(db, orderId, { actor, kind: 'note'|'assign'|'payment', note, visible?: boolean })`.
  - `confirmPayment(db, paymentId: number, { actor, adminReference?: string }): Promise<Result>` — payment must be `submitted` and order `payment_verification`; marks payment `confirmed` (`verified_by/at`, `admin_reference`), transitions order → `payment_confirmed`, then (template orders, all of phase 2) → `for_review` with actor `system`. One payment confirmed even when called twice concurrently (conditional `UPDATE payments ... WHERE id = ? AND status = 'submitted'` first; abort if 0 changes).
  - `rejectPayment(db, paymentId, { actor, reason: string /* required, ≤ 300 */ })` — payment `rejected` with `note = reason`, order → `pending_payment`, visible event carries the reason.
  - `deliver(db, orderId, { actor }): Promise<Result>` — order must be `for_review` or `completed`; batch: invitation `pending`→`live`, order → `delivered`, `delivered_at`.
  - `refund(db, photos, orderId, { actor, note })` — order → `refunded`; invitation → `refunded` (offline), same as today's admin refund.
  - `expireIfOverdue(db, photos, order: { id; status; payment_deadline; invitation_id }, now: Date): Promise<boolean>` — `pending_payment` past `payment_deadline` → `cancelled` (actor `system`, note "Payment deadline passed"), then deletes the pending invitation's photos and row (reuse cleanup's photos-first rule).
  - `notify(db, request, orderId, kind: 'placed'|'receipt'|'confirmed'|'rejected'|'delivered'|'cancelled'|'refunded'): Promise<void>` in `server/order-emails.ts` — no-op when SMTP is disabled; never throws (logs). Bodies use "Key: value" lines (see the webhook's email). `placed` includes reference, amount, deadline (Asia/Manila), and the order link `${origin}/order/${reference}#${trackingToken}` — so `placed` takes the raw tracking token as an extra argument. `delivered` uses `emailAndRotateToken` for the manage link and includes the guest link and the order link. `rejected` includes the reason.

- [ ] **Step 1: Failing tests** (harness; seed one design, one pending invitation, one order in `pending_payment` with a `submitted` payment):
  - `transition` refuses `pending_payment → payment_confirmed`; allows `→ payment_verification` and writes one visible event with from/to.
  - `confirmPayment` called twice with `Promise.all` → exactly one `confirmed` payment, order ends `for_review`, events `payment_confirmed` then `for_review`.
  - `rejectPayment` without a reason → error; with reason → order `pending_payment`, payment `rejected`, visible event note = reason.
  - `deliver` from `for_review` → invitation `live`, order `delivered`, `delivered_at` set; from `pending_payment` → error, invitation still `pending`.
  - `expireIfOverdue` with deadline in the past → `cancelled`, invitation row and its R2 photos gone; in `payment_verification` → untouched.
  - `newReference()` matches the format regex 1,000 times.
- [ ] **Steps 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(orders): transitions, payment confirm/reject, deliver, refund, expiry, emails`.

### Task 5: Payments module and settings

**Files:**
- Create: `server/payments/index.ts`, `server/payments/manual-gcash.ts`, `server/payments/paymongo.ts` (moved adapter: re-export `createCheckoutSession`, `verifyPaymongoSignature` from `server/paymongo.ts`; keep that file so its tests stay valid)
- Modify: `functions/api/payments/paymongo/webhook.ts` (paid event → find order by `paymongo_checkout_id`, insert a `payments` row `provider 'paymongo'`, status `submitted`, then `confirmPayment(..., { actor: 'paymongo' })`; delete its own status SQL), `tests/invitations-api.test.mjs` (drop only the webhook tests that assert the old `paid` flow; this task's test covers the webhook)
- Test: `tests/payments.test.mjs`

**Interfaces:**
- Produces:
  - `type PaymentSettings = { provider: string; gcashAccountName: string; gcashNumber: string; instructions: string; qrKey: string | null; deadlineHours: number }`; `loadPaymentSettings(db): Promise<PaymentSettings>`.
  - `type PaymentStart = { kind: 'instructions'; provider: 'manual_gcash' } | { kind: 'redirect'; provider: 'paymongo'; url: string; providerRef: string }`.
  - `interface PaymentProvider { key: string; ready(s: PaymentSettings): string | null /* null = ready, else reason */; start(order: { id: number; reference: string; amountCentavos: number; email: string; itemName: string }, ctx: { env: any; origin: string }): Promise<PaymentStart> }`.
  - `activeProvider(s: PaymentSettings): PaymentProvider` — `manual_gcash` unless `s.provider === 'paymongo'`; nothing else in the codebase branches on the provider name.
  - `manualGcash.ready` → `'GCash payment details are not set up yet.'` unless account name, number and `qrKey` are all set.
  - `paymentInstructions(s, order): { method: 'GCash'; accountName; accountNumber; instructions; qrUrl: '/api/orders/gcash-qr'; amountCentavos; reference; deadline }`.

- [ ] **Step 1: Failing tests:** `activeProvider` returns manual GCash for `provider 'manual_gcash'` and for unknown values; `ready` reports the missing-setup message until all three fields are set; webhook (bundled, harness DB, valid test signature like `tests/invitations-api.test.mjs` builds) on a `paymongo` order in `payment_verification` with a `submitted` payment → order `for_review`; same event twice → still one confirmed payment.
- [ ] **Steps 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(payments): provider interface, manual GCash, PayMongo behind it`.

### Task 6: Public orders API

**Files:**
- Create: `functions/api/orders/[[path]].ts`, `server/order-view.ts`
- Modify: `functions/api/invitations/[[path]].ts` (`checkout` → creates the order through `activeProvider`; remove `order-status` route; remove `PAYMONGO_SECRET_KEY` requirement), `tests/invitations-api.test.mjs` (remove the checkout/order-status tests this task replaces; any manage, RSVP, guest or resend test that builds its data through the old checkout is ported to the harness with seeded rows, keeping its assertions), `functions/photos/[[key]].ts` (refuse keys not starting with `inv/`), `shared/invitation-fields.ts` (`LIMITS.receiptBytes`, `customerName: 80`, `phone: 30`, `paymentRef: 40`, `rejectReason: 300`, `deliverableUrl` not yet)
- Test: `tests/orders-api.test.mjs`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `POST /api/invitations/checkout` body adds `name` (required, ≤ 80) and `phone` (optional, ≤ 30). Upserts `customers` by email (updates name/phone). Creates invitation (`pending`) + order (`pending_payment`, `reference`, `payment_deadline`, `tracking_token_hash`, `customer_id`, `provider`), visible event "Order placed", `notify('placed')` via `waitUntil`. If `activeProvider(...).ready()` returns a reason → 503 `{ error: 'Online ordering is paused while we update payment details. Please contact us.' }` and nothing is created. Response `{ reference, trackingToken }`.
  - `server/order-view.ts`: `signOrderView(orderId, secret, now)` → `"<orderId>.<exp>.<hmac>"` valid 2 h (reuse `hmacKey` from `server/crypto.ts`); `verifyOrderView(token, secret, now): number | null`.
  - Order auth for the endpoints below: header `X-Order-Token` = tracking token (hash lookup) or a view token for that order; plus path reference must match. Mismatch → 404 `{ error: 'Order not found.' }`.
  - `GET /api/orders/:reference` → `{ reference, status, statusLabel, message, title, designName, amountCentavos, deadline, createdAt, events: [{ at, label, note }] (visible only), payment: paymentInstructions | null (only in pending_payment), lastRejection: string | null, guestUrl (only delivered) }`. Calls `expireIfOverdue` first.
  - `POST /api/orders/:reference/receipt` body `{ image: dataURL, customerReference?: string }` → only in `pending_payment` and before the deadline (else 409 with a message); checks type + magic bytes + size; stores `receipts/<orderId>/<Date.now()>.<ext>`; inserts `payments` (`submitted`, amount = order amount, provider = order provider); transition → `payment_verification`; `notify('receipt')`. 
  - `POST /api/orders/lookup` body `{ reference, email, turnstileToken }` → Turnstile check (reuse `turnstileError` pattern: move it to `server/turnstile.ts` and import from both files), case-insensitive email match → `{ reference, viewToken }`; else 404.
  - `GET /api/orders/gcash-qr` → streams `payment_settings.qr_key` from R2 (`Cache-Control: public, max-age=300`), 404 when unset.

- [ ] **Step 1: Failing tests** (bundle both functions; harness DB + R2; Turnstile fetch stubbed like the existing tests):
  - checkout with GCash not set up → 503 and no rows; set up → 200 `{ reference, trackingToken }`, order `pending_payment`, deadline = created + 48 h, customer row, one visible event.
  - `GET /api/orders/:ref` with the tracking token → payment block with `qrUrl`; with a wrong token, another order's token, or a valid view token for a different order → 404 identical body.
  - receipt: PNG bytes → 200, order `payment_verification`, payment `submitted`, R2 key under `receipts/`; SVG text with `data:image/png` prefix → 400; 6 MB → 400; second upload → 409; upload after deadline → 409 and order becomes `cancelled` on read.
  - lookup: right ref + email (any case) → viewToken that opens `GET`; wrong email → 404.
  - `GET /photos/receipts/1/x.png` → 404.
- [ ] **Steps 2–4:** FAIL → implement → PASS (`npm test` whole suite green).
- [ ] **Step 5:** Commit `feat(orders): GCash checkout, order page API, receipt upload, lookup`.

### Task 7: Admin orders API and permissions

**Files:**
- Create: `server/permissions.ts`, `functions/api/admin/orders/[[path]].ts`, `functions/api/admin/payment-settings.ts`
- Modify: `functions/api/admin/invitations/[[path]].ts` (remove `/orders/refund`, `/orders/resend`; `overview` totals use `PAID_STATUSES`)
- Test: `tests/admin-orders.test.mjs`

**Interfaces:**
- Produces:
  - `can(role: string, action: Action): boolean` with `Action = 'orders.view' | 'orders.contact' | 'orders.work' | 'orders.assign' | 'payments.review' | 'orders.refund' | 'settings.payment'`. Super Admin: all. Administrator: all except `settings.payment`. Editor: `orders.view`, `orders.work`. Unknown role: none.
  - `GET /api/admin/orders?status=&q=&assigned=me|none|<email>&page=` → `{ orders: [{ id, reference, status, statusLabel, title, designName, customerName, email?, amountCentavos, createdAt, assignedTo, awaitingReceipt: boolean }], counts: Record<OrderStatus, number>, page, pages }` (25 per page; `email` only with `orders.contact`; `q` matches reference, email, customer name, invitation title).
  - `GET /api/admin/orders/:id` → order, customer (contact fields only with `orders.contact`), invitation `{ slug, status, layoutKey, colorScheme, details, photos }` for the preview, payments (receipt URLs only with `payments.review`), events (all), and `allowedNext: OrderStatus[]` filtered by the caller's permissions.
  - `GET /api/admin/orders/:id/receipts/:paymentId` → image bytes, `Cache-Control: private, no-store` (`payments.review`).
  - `POST /api/admin/orders/:id` with `{ action }`: `approve { paymentId, adminReference? }`, `reject { paymentId, reason }` (`payments.review`); `status { to, note? }` (`orders.work` for `in_production`, `for_review`, `revision_requested`, `completed`; `orders.refund` for `cancelled`); `deliver` (`orders.work`) → `{ ok, emailed }`; `refund { note }` (`orders.refund`); `assign { email | null }` (`orders.assign`, must be an Active admin); `note { body ≤ 1000 }` (`orders.work`); `resend` (`orders.contact`) re-sends the delivered email. Every action writes `audit_logs` (`log_type 'order'`) with admin email, reference and action.
  - `GET/POST /api/admin/payment-settings` (`settings.payment`): fields above plus `qrImage` data URL (PNG/JPEG/WebP ≤ 2 MB, magic bytes) stored at `settings/gcash-qr-<ts>.<ext>`, old key deleted after the row update.
- [ ] **Step 1: Failing tests** (harness; sign tokens with `signAdminToken`): list counts by status; Editor → 403 on receipt, approve, reject, refund, assign, payment-settings, and gets no `email` in list/detail; Administrator approve → `for_review` + audit row; reject without reason → 400; `status` to a non-allowed next → 400; deliver → invitation live; payment-settings save with SVG-as-PNG → 400; with PNG → `qr_key` set and the old object deleted.
- [ ] **Steps 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(admin): orders API with role permissions, payment settings`.

### Task 8: UI foundation

**Files:**
- Create: `src/ui/tokens.css` (Tailwind 4 `@theme` tokens: brand colours from the current logo green `#0b8a4f`-family and slate neutrals, radius, shadow, font stack already used), `src/ui/index.tsx`
- Modify: `src/index.css` (import tokens)

**Interfaces:**
- Produces from `src/ui/index.tsx`: `Button` (`variant: 'primary'|'secondary'|'ghost'|'danger'`, `size: 'sm'|'md'`, `loading`), `Card`, `StatusPill({ status })` (colour per status group: waiting amber, working blue, done green, stopped slate/red, label from `STATUS_LABEL`), `TextField`/`TextArea`/`Select` (label + hint + error wired with `id`/`aria-describedby` so screen readers announce them), `EmptyState`, `Spinner`. No new dependencies.
- [ ] **Step 1:** Implement; `npx tsc --noEmit` and `npm run build` pass. (Visual-only task; covered by Task 9/10 browser checks.)
- [ ] **Step 2:** Commit `feat(ui): shared tokens and components`.

### Task 9: Customer pages

**Files:**
- Create: `src/invitations/OrderPage.tsx` (`/order/<REF>`), `src/invitations/TrackPage.tsx` (`/track`)
- Modify: `src/invitations/CustomiserPage.tsx` (name + phone fields next to email; button "Place order"; on success `go('/order/' + reference)` after `sessionStorage.setItem('jlc_order_' + reference, trackingToken)`), `src/App.tsx` (routes; remove SuccessPage), `src/components/Navbar.tsx` + `Footer.tsx` ("Track order" link), `src/invitations/PolicyPage.tsx` (GCash manual payment + admin verification; refund by GCash transfer; receipts listed in collected data and kept with order records; service providers: Cloudflare and email provider only)
- Delete: `src/invitations/SuccessPage.tsx`

**Interfaces:**
- Consumes: Task 6 endpoints, Task 8 components.
- OrderPage: reads `#<token>` once (drops it from the URL like ManagePage) and keeps it in `sessionStorage['jlc_order_' + REF]`; falls back to a view token stored by TrackPage; with no token shows the TrackPage form. Shows `StatusPill`, `message`, reference (copy button), amount, design + title, event timeline. In `pending_payment`: QR image, account name and number, instructions, amount, live deadline countdown, last rejection reason, receipt picker (client resize with `optimizeImage(file, 1600, 2400, 0.85)`), optional GCash reference no., "Submit payment confirmation". In `delivered`: guest link button and "Your private manage link was emailed to you".
- TrackPage: reference + email + Turnstile → `POST /api/orders/lookup` → store view token → `go('/order/' + REF)`.
- [ ] **Step 1:** Implement. `npx tsc --noEmit`, `npm test`, `npm run build` pass.
- [ ] **Step 2: Browser check** (`preview_start` "site", local D1 with migration 0003 applied via `npx wrangler d1 execute jlc_database --local --file migrations/0003_orders_gcash.sql`, payment settings filled locally): place an order on a design → order page shows QR + deadline; upload a PNG → "Payment Verification"; `/track` with ref + email reaches the same page; 375 px wide has no horizontal scroll.
- [ ] **Step 3:** Commit `feat(orders): order, payment and tracking pages`.

### Task 10: Admin Portal core

**Files:**
- Create: `admin.html`, `src/admin/main.tsx`, `src/admin/App.tsx` (login + shell + hash routes `#/orders`, `#/orders/<id>`, `#/settings/payment`), `src/admin/OrdersPage.tsx`, `src/admin/OrderDetail.tsx`, `src/admin/PaymentSettingsPage.tsx`, `src/admin/api.ts` (re-export `adminApi` from `src/components/admin/api.ts`)
- Modify: `vite.config.ts` (`input.admin`), `src/App.tsx` (old `#/admin` keeps working; add a banner "Orders moved to the new portal" linking `/admin`), `src/components/AdminPanel.tsx` (remove the Orders tab)
- Delete: `src/components/admin/OrdersTab.tsx`

**Interfaces:**
- Login posts to `/api/admin/login`, stores `jlc_admin_token` / `jlc_admin_user` in `localStorage` (same keys as the old admin, so one login serves both); 401 from any call → back to login.
- Shell: left sidebar (Orders, Payment settings for Super Admin only, "Designs & content (old admin)" → `/#/admin`), top bar with name, role, sign out; mobile: sidebar becomes a top menu.
- OrdersPage: status tabs with counts (default "Needs action" = `payment_verification` + `for_review` + `revision_requested`), search, assigned filter, table → detail.
- OrderDetail: header (reference, `StatusPill`, amount, created, deadline); receipt viewer (fetch with bearer → object URL) with Approve (optional admin reference) / Reject (required reason); invitation preview via `InvitationView` (lazy import, same as the customiser); actions from `allowedNext`, Deliver, Refund (confirm dialog), Assign; notes box; full timeline. Buttons hidden when the role lacks permission (server still enforces).
- PaymentSettingsPage: account name, number, instructions, deadline hours, QR upload with preview.
- [ ] **Step 1:** Implement; `npx tsc --noEmit`, `npm test`, `npm run build` pass; `dist/admin.html` exists.
- [ ] **Step 2: Browser check** on `npm run dev` (local admin account; owner may need to sign in themselves if no local password exists): save GCash settings with a QR; approve the Task 9 order → For Review with preview; Deliver → order page shows the guest link; Editor-role check by API test only.
- [ ] **Step 3:** Commit `feat(admin): portal core at /admin (orders, payment settings)`.

### Task 11: Cleanup job and leftovers

**Files:**
- Modify: `server/cleanup.ts` (replace the 72 h `pending` rule with `expireIfOverdue` for every `pending_payment` order past its deadline; keep the 60-day purge; also delete `receipts/<orderId>/` objects for orders that are `cancelled` and older than 60 days — receipts of paid orders are kept), tests in `tests/` that assert the old cleanup rule
- Test: extend `tests/orders-core.test.mjs` or the existing cleanup test file
- [ ] **Step 1: Failing test:** cleanup cancels a `pending_payment` order 1 minute past its deadline and leaves a `payment_verification` order alone; a cancelled order's receipt objects older than 60 days are deleted, a delivered order's are not.
- [ ] **Steps 2–4:** FAIL → implement → PASS; `npm run lint` passes.
- [ ] **Step 5:** Commit `feat(orders): cleanup uses payment deadlines`.

### Task 12: Release

- [ ] **Step 1:** Final whole-branch review (per the execution skill), fixes, `npm test`, `npm run lint`, `npm run build`.
- [ ] **Step 2:** Ask the owner to run on production, then wait for "done":
  `npx wrangler d1 execute jlc_database --remote --file migrations/0003_orders_gcash.sql`
- [ ] **Step 3:** Merge to `main` and push (owner approval required), wait for the deploy, then on live: `/admin` loads the login; `GET /api/orders/gcash-qr` → 404 until set; checkout → 503 until set; owner sets GCash details + QR in the portal; owner places one order, uploads a receipt, approves, delivers; the guest link opens.
- [ ] **Step 4:** Tell the owner the PayMongo secrets can stay set (unused) and the old test webhook can be disabled in PayMongo.
