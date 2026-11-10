# Homepage Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/` shows the invitation shop; the old IT homepage and tabs live under "IT Services".

**Architecture:** The SPA's hash-tab router (`src/App.tsx`) gains a `shop` tab that is the default when the hash is
empty; it renders the existing `CatalogPage`, which gets a how-it-works strip, an IT band and occasion chips built from
the designs' `product_type`. The navbar regroups the IT tabs under one "IT Services" menu.

**Tech Stack:** React 19, Vite, Tailwind, Cloudflare Pages Functions + D1, `node --test` on `.ts` files.

**Spec:** `docs/superpowers/specs/2026-11-11-homepage-shop-design.md`

## Global Constraints

- Branding unchanged: logo, `branding.themeColor` classes (`btn` / `getButtonBgClass()`), company name.
- `/#/admin`, `?inviteToken=`/`?resetToken=` links, the 5-click logo admin entry, and every old `/#/<tab>` link keep working.
- `/invitations` renders the same shop page as `/`.
- No database migration; occasion comes from existing `products_designs.product_type` (today always `wedding_invitation`).
- No new dependencies.

## Review Focus

- `/#/home` (old bookmarks, admin "view site" habits) must open the IT home, not the shop — pinned in Task 1 test.
- Unknown hash like `/#/nonsense` must land on the shop, not a blank page — pinned in Task 1 test.
- `/#/login` and `/#/login/forgot-password` must still open the login modal over the shop — pinned in Task 1 test (`tabFromHash` returns `null` for them).
- A design row with an unknown future `product_type` must still get a readable chip label — pinned in Task 2 test.
- Navigating shop → IT Services → back button must land on the shop again — checked in Task 4 browser pass.

---

### Task 1: `shop` tab and routing helper

**Files:**
- Create: `src/site-tabs.ts`
- Modify: `src/App.tsx` (tab init ~48-57, `setActiveTab` ~62-69, `handleHashChange` ~122-141, tab views ~579, title effect ~218-231)
- Test: `tests/site-tabs.test.mjs`

**Interfaces:**
- Produces: `export const SITE_TABS: readonly string[]` = `['shop','home','about','services','pricing','why','contact','inquiry','admin']`;
  `export function tabFromHash(hash: string): string | null` — `null` for `login` routes (caller opens the modal), else a member of `SITE_TABS`, defaulting to `'shop'`.
- Produces: `setActiveTab('shop')` navigates to bare `/` (no hash) via `history.pushState(null,'','/')` + dispatching `popstate`.

- [ ] **Step 1: Write the failing test** `tests/site-tabs.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { tabFromHash } from '../src/site-tabs.ts';

test('empty hash and unknown routes open the shop', () => {
  for (const h of ['', '#', '#/', '#/nonsense']) assert.equal(tabFromHash(h), 'shop');
});
test('old IT tab links keep working', () => {
  for (const t of ['home', 'about', 'services', 'pricing', 'why', 'contact', 'inquiry', 'admin']) assert.equal(tabFromHash(`#/${t}`), t);
  assert.equal(tabFromHash('#/services?x=1'), 'services');
});
test('login routes are left to the modal', () => {
  assert.equal(tabFromHash('#/login'), null);
  assert.equal(tabFromHash('#/login/forgot-password'), null);
});
```

- [ ] **Step 2: Run** `node --test tests/site-tabs.test.mjs` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/site-tabs.ts`** (no React imports, so node can load it).
- [ ] **Step 4: Run** `node --test tests/site-tabs.test.mjs` — Expected: PASS.
- [ ] **Step 5: Wire `App.tsx`**
  - `useState` initialiser uses `tabFromHash(window.location.hash) ?? 'shop'`; `handleHashChange` uses `tabFromHash(window.location.hash)`; `handleHashChange` keeps its login-modal branches (when `tabFromHash` returns `null`) and drops the `|| '#/home'` default.
  - `setActiveTab('shop')` → bare `/` as in Interfaces; other tabs unchanged.
  - Add `{activeTab === 'shop' && <CatalogPage btn={btn} />}` beside the other tab views (inside the `!page` block).
  - Title effect: `${coName} | Digital Invitations & IT Services` (both places).
- [ ] **Step 6: Run** `npm test && npm run lint && npm run build` — Expected: all pass, 0 type errors.
- [ ] **Step 7: Commit** `feat(site): the invitation shop is the homepage`

### Task 2: Shop page — occasion chips, how-it-works, IT band

**Files:**
- Create: `src/invitations/occasions.ts`
- Modify: `functions/api/invitations/[[path]].ts:28-35` (designs SELECT + response), `src/invitations/CustomiserPage.tsx:8-12` (`Design` type), `src/invitations/CatalogPage.tsx`
- Test: `tests/occasions.test.mjs`, `tests/invitations-api.test.mjs` (designs test)

**Interfaces:**
- Produces: `Design.productType: string` (API field `productType` from `product_type`).
- Produces: `export function occasionLabel(type: string): string` — `wedding_invitation`→`Wedding`, `birthday_invitation`→`Birthday`, `debut_invitation`→`Debut`, `baptism_invitation`→`Baptism`, `anniversary_invitation`→`Anniversary`, `corporate_invitation`→`Corporate`; anything else: strip `_invitation`, underscores→spaces, capitalise first letter.
- Produces: `export function occasionChips(types: string[]): string[]` — distinct types in first-seen order; `[]` when fewer than 2 distinct.

- [ ] **Step 1: Write the failing tests**

```js
// tests/occasions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { occasionLabel, occasionChips } from '../src/invitations/occasions.ts';

test('labels', () => {
  assert.equal(occasionLabel('wedding_invitation'), 'Wedding');
  assert.equal(occasionLabel('debut_invitation'), 'Debut');
  assert.equal(occasionLabel('graduation_party_invitation'), 'Graduation party');
});
test('chips only when 2+ occasions', () => {
  assert.deepEqual(occasionChips(['wedding_invitation', 'wedding_invitation']), []);
  assert.deepEqual(occasionChips(['wedding_invitation', 'debut_invitation', 'wedding_invitation']), ['wedding_invitation', 'debut_invitation']);
});
```

In `tests/invitations-api.test.mjs`, give the fixture `design` a `product_type: 'wedding_invitation'` and assert the designs response's first item has `productType === 'wedding_invitation'`.

- [ ] **Step 2: Run** `npm test` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `occasions.ts`; add `product_type` to the designs SELECT and `productType` to the response; add `productType: string` to `Design`.
- [ ] **Step 4: Update `CatalogPage.tsx`**
  - Hero copy: badge `Digital invitations`; h1 `Find your invitation design`; paragraph `Tap Preview to see a design exactly as your guests will. Add your details, pay by QR Ph, and share one link — guests RSVP right on the page.`
  - Chips: `occasionChips(designs.map(d => d.productType))`; when non-empty render an "All" chip plus one per type (buttons with `aria-pressed`, active chip uses `btn`), filtering the grid. Hidden when empty.
  - Below the grid, a 3-step strip: `Choose a design` / `Add your details and photos` / `Pay by QR Ph and share one link`.
  - Then a dark band: `Also from JLC: IT consulting, custom software and office networks` with a `Link` to `/#/home` labelled `IT Services`.
- [ ] **Step 5: Run** `npm test && npm run lint && npm run build` — Expected: all pass.
- [ ] **Step 6: Commit** `feat(invitations): occasion filter, how-it-works and IT band on the shop`

### Task 3: Navbar regroup and page metadata

**Files:**
- Modify: `src/components/Navbar.tsx`, `index.html`

**Interfaces:**
- Consumes: `setActiveTab('shop')` from Task 1.

- [ ] **Step 1: Desktop nav** = `Invitations` (active when `activeTab === 'shop'` or path starts with `/invitations`; goes to shop) · `IT Services` menu button (`aria-expanded`, `aria-haspopup="menu"`; items: `IT Services overview`→`home`, `About Us`→`about`, `Services`→`services`, `Pricing`→`pricing`, `Why Choose Us`→`why`; closes on item click, Escape, outside click; button shows active style when any IT tab is active) · `Contact Us`→`contact`.
- [ ] **Step 2: CTA** `Get a Quote` becomes `Start an invitation` → shop. Logo click goes to shop (`handleNavClick('shop')`); the 5-click admin counter stays.
- [ ] **Step 3: Mobile drawer** mirrors it: Invitations, an `IT Services` heading with the five items indented, Contact Us, then the CTA.
- [ ] **Step 4: `index.html`**: `<title>JLC Solutions | Digital Invitations & IT Services</title>` and `<meta name="description" content="Beautiful digital invitations you can personalise, pay for by QR Ph and share with one link — plus IT consulting, custom software and networks from JLC Solutions.">`.
- [ ] **Step 5: Run** `npm run lint && npm run build` — Expected: pass.
- [ ] **Step 6: Commit** `feat(site): group IT pages under one IT Services menu`

### Task 4: Browser check and deploy

- [ ] **Step 1:** `npm run dev` (wrangler on :8788, local D1 needs ≥1 active design — `npm run db:migrate:local` if empty) and check in the browser pane at desktop and 375px width:
  `/` shows the shop with designs and no chips; Preview opens; `/invitations` same page; IT Services menu opens each IT tab;
  `/#/home` shows the old IT home; `/#/admin` and the 5-click logo still reach admin login; shop → IT Services → back returns to shop; no console errors.
- [ ] **Step 2:** `npm test && npm run lint` — Expected: all pass.
- [ ] **Step 3:** `git push origin main`, then on https://jlcitsolutions.com repeat the `/`, `/#/home` and `/#/admin` checks.
