# Birthday Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Birthday as the second occasion on a per-occasion base, with kids/adults RSVP, two birthday designs, and occasion-neutral wording, without changing anything for existing weddings.

**Architecture:** `shared/occasions/` holds one module per occasion (rules, title, slug, expiry summary, layouts) and a registry keyed by `products_designs.product_type`. Server routes, cleanup, OG tags and emails look the occasion up from the design instead of calling wedding functions. On the client, `src/invitations/forms/` holds one form per occasion behind a registry; layouts gain `confetti` and `golden`.

**Tech Stack:** React 19 + Vite SPA and `invitation.html` guest entry, Cloudflare Pages Functions + D1 + R2, `node --test` (tests import `.ts` directly and bundle functions with esbuild, as `tests/invitations-api.test.mjs` already does).

**Spec:** `docs/superpowers/specs/2026-11-11-birthday-invitations-design.md`

## Global Constraints

- Existing wedding invitations, links, manage links, RSVPs and CSVs behave exactly as before; every existing test keeps passing (imports may be updated to the moved module).
- `shared/` stays dependency-free and runs in the browser, Pages Functions and node tests.
- Birthday fields and limits: `celebrant` required ≤60 (locked after payment); `age` optional integer 1–120; `headline` ≤120; `theme` ≤80; `eventDate` required; `eventTime` HH:MM optional; `venue` required name, address ≤200, map link normalised like weddings; `schedule` ≤8; `dressCode` ≤200; `giftsNote` ≤300; `message` ≤1000; `hostedBy` ≤120; `rsvpDeadline` optional date; photos ≤6.
- RSVP: `rsvps.kids_count INTEGER NOT NULL DEFAULT 0`. Birthday guests give Adults 1–10 and Kids 0–10 when attending; weddings never ask for kids (stored 0).
- Product types: `wedding_invitation`, `birthday_invitation`. Unknown types: hidden from the shop list, checkout 400, guest/manage treat as not found.
- No wedding words ("couple", "marriage", "partner", "wedding") anywhere in a birthday flow.
- No production database writes by the builder; PayMongo stays on test keys.

## Review Focus

- A paid wedding invitation edited through the manage page after this change must save exactly as before (old stored details have no `_purged`, no `venue`) — pinned in Task 2 test "wedding manage edit unchanged".
- A birthday checkout that posts a wedding-shaped `details` (or a wedding layout design typed `birthday_invitation`) must be refused, not stored — pinned in Task 2 and Task 3 tests.
- Already-purged wedding rows (details = names only, no `_purged`) must still show "this celebration has passed" with the names after cleanup re-runs — pinned in Task 3 cleanup test.
- A birthday RSVP with `attending: false` must store kids 0 and adults 1 regardless of what was posted — pinned in Task 1 test.
- A birthday with no age must title as "Roberto's Birthday" everywhere (OG, emails, manage header, expired page) — pinned in Task 1 title test and Task 3 OG test.

---

### Task 1: Occasion modules and registry

**Files:**
- Create: `shared/occasions/wedding.ts`, `shared/occasions/birthday.ts`, `shared/occasions/index.ts`
- Modify: `shared/invitation-fields.ts` (becomes the shared helpers file), `tests/invitation-fields.test.mjs` (imports)
- Test: `tests/occasions-shared.test.mjs`

**Interfaces:**
- `shared/invitation-fields.ts` exports (shared, behaviour unchanged): `LIMITS` (+ `headline: 120, theme: 80, hostedBy: 120, ageMax: 120, kidsMax: 10`), `Venue`, `Result`, `Bad`, `fail`, `str`, `isoDate`, `time`, `obj`, `venue`, `schedule(input)` (the existing schedule loop extracted), `optionalText(i, spec)` helper is optional, `validateRsvp(input, opts?: { askKids?: boolean })`, `makeSlug(base: string, random: string)` (signature change: was `(p1, p2, random)`).
  - `validateRsvp` returns `{ guestName, attending, partySize, kidsCount, message }`; `kidsCount` is 0 unless `askKids`; with `askKids` and attending it must be an integer 0–`LIMITS.kidsMax`; when not attending `partySize` is 1 and `kidsCount` 0.
- `shared/occasions/wedding.ts` exports the existing `InvitationDetails` (alias `WeddingDetails`), `validateDetails`, `lockedFieldsChanged`, plus `wedding: Occasion<WeddingDetails>`.
- `shared/occasions/birthday.ts` exports `BirthdayDetails`, `birthday: Occasion<BirthdayDetails>`.
- `shared/occasions/index.ts` exports:

```ts
export type Occasion<D = any> = {
  productType: string; label: string; noun: string;      // 'Wedding' / 'wedding'
  layouts: readonly string[]; askKids: boolean;
  validateDetails(input: unknown): Result<'details', D>;
  lockedFieldsChanged(before: D, after: D): boolean; lockedMessage: string;
  title(d: D): string;                                      // "Ana & Ben" · "Mia's 7th Birthday" · "Roberto's Birthday"
  slugBase(d: D): string;                                   // "Ana and Ben" · "Mia 7th birthday" · "Roberto birthday"
  expiredSummary(d: D): Record<string, unknown>;            // fields title() needs + _purged: true
};
export const OCCASIONS: Record<string, Occasion>;           // keyed by productType
export const occasionOf: (productType: string | null | undefined) => Occasion | null;
export const LAYOUT_KEYS: readonly string[];                // every occasion's layouts: classic, garden, modern, confetti, golden
```

- Ordinals: 1st 2nd 3rd 4th… 11th 12th 13th 21st 22nd 23rd 101st 111th.

- [ ] **Step 1: Write the failing tests** `tests/occasions-shared.test.mjs`:
  - `birthday valid minimal`: `{ celebrant: ' Mia ', eventDate: '2027-03-14', venue: { name: 'Party Room' } }` → ok, `celebrant === 'Mia'`, no `age` key, `schedule` `[]`.
  - `birthday rejects`: missing celebrant; `age: 0`, `121`, `7.5`, `'7'`; venue without name; 9 schedule items; `theme` of 81 chars; map link `javascript:x` → each `ok === false`.
  - `birthday keeps optional fields`: age 7, headline, theme, hostedBy, dressCode, giftsNote, message, rsvpDeadline, schedule item → all present and trimmed; unknown key `evil` dropped.
  - `titles`: birthday `{celebrant:'Mia', age:7}` → `"Mia's 7th Birthday"`; `{celebrant:'Roberto'}` → `"Roberto's Birthday"`; age 21/22/23/11/12/13/111 → 21st/22nd/23rd/11th/12th/13th/111th; wedding `{partner1:'Ana',partner2:'Ben'}` → `"Ana & Ben"`.
  - `slug bases`: `makeSlug(birthday.slugBase({celebrant:'Mía',age:7,…}), 'k3x9')` → `'mia-7th-birthday-k3x9'`; no age → `'roberto-birthday-k3x9'`; wedding unchanged → `'maria-and-juan-k3x9'`.
  - `locked`: birthday celebrant change → true, date change → false; `birthday.lockedMessage` contains no "Names".
  - `expired summaries`: wedding → `{ partner1, partner2, _purged: true }`; birthday → `{ celebrant, age, _purged: true }` (age omitted when absent); `title(summary)` equals `title(full)`.
  - `registry`: `occasionOf('birthday_invitation') === birthday`; `occasionOf('debut_invitation') === null`; `occasionOf(undefined) === null`; `birthday.layouts` = `['confetti','golden']`, `wedding.layouts` = `['classic','garden','modern']`; `birthday.askKids === true`, `wedding.askKids === false`.
  - `validateRsvp kids`: `{guestName:'A',attending:true,partySize:2,kidsCount:3}` with `{askKids:true}` → kidsCount 3; kidsCount 11 or -1 or missing-with-askKids-attending → fail; without askKids kidsCount ignored → 0; `attending:false, partySize:5, kidsCount:4` with askKids → partySize 1, kidsCount 0.
- [ ] **Step 2: Run** `node --test tests/occasions-shared.test.mjs` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the three modules and the `invitation-fields.ts` refactor; move wedding `validateDetails`/`lockedFieldsChanged` into `wedding.ts` unchanged; update `tests/invitation-fields.test.mjs` imports (wedding rules from `../shared/occasions/wedding.ts`, `makeSlug('María and Juan', 'k3x9')`, `LAYOUT_KEYS` from the registry with the 5 keys).
- [ ] **Step 4: Run** `npm test` — Expected: all pass (existing suites import paths updated in this task where they import moved names; `functions` still compile in Task 2).
- [ ] **Step 5: Commit** `feat(occasions): per-occasion rules with wedding and birthday`

### Task 2: Public invitation API on the registry + migration

**Files:**
- Create: `migrations/0002_occasions.sql` (`ALTER TABLE rsvps ADD COLUMN kids_count INTEGER NOT NULL DEFAULT 0;`); also add the column to `schema.sql` for fresh local DBs
- Modify: `functions/api/invitations/[[path]].ts`, `server/guest-invitation.ts` (`findGuestInvitation` also selects `d.product_type`), `functions/api/payments/paymongo/webhook.ts` (email wording)
- Test: `tests/invitations-api.test.mjs`

**Interfaces:**
- Consumes: `occasionOf`, `Occasion` from Task 1; `validateRsvp(input, { askKids })`.
- Produces (API JSON, used by Task 4/5):
  - `GET /api/invitations/designs`: only designs whose `product_type` has an occasion.
  - `GET /api/invitations/i/:slug` live: adds `productType`, `askKids`; expired: `{ state: 'expired', title }` (replaces `partner1/partner2`).
  - `GET /api/invitations/manage`: adds `productType`; each RSVP adds `kidsCount`.
  - CSV header: weddings unchanged `Name,Attending,Party size,Message,Submitted`; birthdays `Name,Attending,Adults,Kids,Message,Submitted`.
  - `POST …/rsvp` accepts `kidsCount`.
- Copy: past-date error `The <noun> date cannot be in the past.` (wedding keeps "The wedding date cannot be in the past."; birthday "The party date cannot be in the past."); locked error = `occasion.lockedMessage` (wedding keeps "Names cannot be changed after payment."; birthday "The celebrant's name cannot be changed after payment."); PayMongo item `"<Label> invitation: <design name>"`; emails: subject `Your invitation is live` / `Your invitation links`, body says "your invitation" (no "wedding") for every occasion.

- [ ] **Step 1: Write the failing tests** in `tests/invitations-api.test.mjs` (extend the in-memory D1 to answer the new SELECT shapes and `kids_count`; add a birthday design fixture `{ id: 3, slug: 'confetti-pop', product_type: 'birthday_invitation', layout_key: 'confetti', … }` and an unknown-type design `{ id: 4, product_type: 'debut_invitation', active: 1 }`):
  - `designs list hides unknown occasions` → slugs `['classic-elegance','confetti-pop']`.
  - `birthday checkout stores birthday details and slug` → 200; stored details have `celebrant`; slug starts `mia-7th-birthday-`; PayMongo item name starts `Birthday invitation:`.
  - `birthday checkout with wedding details → 400` (error mentions Celebrant).
  - `checkout of unknown-occasion design → 400`.
  - `wedding manage edit unchanged` → existing wedding manage-edit test still passes with no changes to its body.
  - `birthday manage rename → 400` with the birthday locked message.
  - `birthday rsvp stores kids` → row `kids_count === 3`; manage JSON rsvp has `kidsCount: 3`; CSV header is the birthday header and the row has `"2","3"` for adults/kids.
  - `wedding rsvp ignores kidsCount` → stored 0; wedding CSV header unchanged.
  - `expired guest returns title` → wedding `{ state: 'expired', title: 'Ana & Ben' }`, birthday `title: "Mia's 7th Birthday"`.
- [ ] **Step 2: Run** `npm test` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** — resolve the occasion from the design (`products_designs.product_type`) in checkout, manage (join already there; select `d.product_type`), guest and rsvp (join `products_designs` to get `product_type`); replace direct wedding calls; the 300-RSVP cap statement gains `kids_count`.
- [ ] **Step 4: Run** `npm test && npm run lint` — Expected: all pass, 0 type errors.
- [ ] **Step 5: Commit** `feat(occasions): invitation API, RSVP kids and wording use the occasion`

### Task 3: Link previews, cleanup and admin API

**Files:**
- Modify: `functions/i/[slug].ts`, `server/cleanup.ts`, `functions/api/admin/invitations/[[path]].ts`
- Test: `tests/guest-page.test.mjs`, `tests/admin-invitations.test.mjs` (and the cleanup test wherever `runCleanup` is tested today — `grep -l runCleanup tests`)

**Interfaces:**
- Consumes: Task 1 registry, `findGuestInvitation` with `product_type` (Task 2).
- OG: live title `<title(details)> — <Month D, YYYY>`; description `You're invited to <title>.` (birthday) / unchanged wedding text `You're invited to the wedding of <names>.`; expired title `<title> — celebration has passed`, description `This celebration has already passed.`
- Cleanup: purge writes `details = JSON(occasion.expiredSummary(details))` computed in JS per row (select `i.details, d.product_type`); "already reduced" check becomes `json_extract(details, '$._purged') IS NULL` instead of comparing to `NAMES_ONLY`. A row whose type has no occasion keeps the old names-only SQL behaviour for `wedding_invitation` only; otherwise skip and `console.error`.
- Admin API:
  - `validateDesign` takes `b.product_type` (must have an occasion), checks `layout_key ∈ occasion.layouts` (`Layout <k> is not a <label> layout.`), validates `sample_details` with that occasion; INSERT stores `product_type`; update refuses a changed `product_type` with 409 like `layout_key` today.
  - Overview invitations list adds `title` (from details via the occasion; `''` if unknown); orders list adds `title`.
  - RSVP list adds `kidsCount`. Resend-links email wording same as Task 2.

- [ ] **Step 1: Write the failing tests**:
  - guest-page: `birthday OG title` → `"Mia's 7th Birthday — March 14, 2027"`, description `You're invited to Mia's 7th Birthday.`; `no-age birthday` → `"Roberto's Birthday — …"`; existing wedding OG assertions unchanged.
  - cleanup: purged birthday row → details `{"celebrant":"Mia","age":7,"_purged":true}`, rsvps deleted, photos deleted; re-running selects nothing; a legacy wedding row already `{"partner1":"A","partner2":"B"}` with no rsvps/photos gets `_purged` added once, then is not selected again; the expired guest response still titles "A & B".
  - admin: add birthday design with layout `classic` → 400; with `confetti` and birthday sample → ok and stored `product_type = 'birthday_invitation'`; update changing `product_type` → 409; overview invitation rows carry `title`; RSVP rows carry `kidsCount`.
- [ ] **Step 2: Run** `npm test` — Expected: new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run lint` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(occasions): link previews, privacy purge and admin per occasion`

### Task 4: Occasion forms, guest RSVP with kids, manage page

**Files:**
- Create: `src/invitations/forms/index.ts`, `src/invitations/forms/WeddingForm.tsx` (moves `Draft`, `toDraft`, `checkDraft`, `previewDetails`, `DetailsForm`, `receptionNeedsName` out of `kit.tsx` unchanged), `src/invitations/forms/BirthdayForm.tsx`
- Modify: `src/invitations/kit.tsx`, `CustomiserPage.tsx`, `ManagePage.tsx`, `guest-main.tsx`, `SuccessPage.tsx`, `src/components/admin/InvitationsTab.tsx`, `OrdersTab.tsx`

**Interfaces:**
- Consumes: Task 1 registry; Task 2 API fields (`productType`, `askKids`, `kidsCount`, expired `title`).
- Produces:

```ts
// src/invitations/forms/index.ts
export type OccasionForm<Draft = any> = {
  toDraft(d?: any): Draft;                                  // every field as a string, like the wedding Draft
  check(d: Draft): { ok: true; details: any } | { ok: false; error: string };
  preview(d: Draft, fallback: Draft): any;                  // fills half-typed required fields from the sample/saved details
  Form: React.ComponentType<{ draft: Draft; onChange: (d: Draft) => void; lockNames?: boolean }>;
};
export const FORMS: Record<string, OccasionForm>;          // wedding_invitation, birthday_invitation
```

- Birthday form sections and copy: "The celebrant" (Name *, Age they're turning [number 1–120, optional], Headline, Theme, Hosted by; lock note "Please double-check the spelling: the name can't be changed after payment." / locked "The name can't be changed after payment. Contact us if there's a typo."); "When" (Party date *, Start time); "Venue" (name *, address, Google Maps link with the existing hint); "Party program (optional)" (same schedule editor, button "Add program item"); "Notes for guests (optional)" (Message to guests, Attire / theme costume, Gift note, RSVP deadline). Age is held as a string in the draft and sent as a number when filled.
- Guest RSVP: when `askKids`, the party select is labelled "Adults, including you" and a second select "Kids" (0–10, default 0) appears; message label "Message for the celebrant" (birthday) / unchanged "Message for the couple" (wedding); expired page uses `title`; inactive-link copy "Please check the link with whoever shared it."
- Manage page: header uses the occasion `title`; RSVP summary for birthdays "N attending (A adults, K kids)" and a Kids column; customiser/manage pick `FORMS[productType]` and fall back to an error message for unknown types.
- Customiser copy: "until 60 days after the event". Success page and admin tabs: no "wedding" wording; admin invitation rows show `title`; admin RSVP line shows kids for birthdays ("attending, 2 adults + 3 kids").

- [ ] **Step 1:** Move the wedding form pieces to `forms/WeddingForm.tsx`, register `FORMS`, switch customiser/manage to the registry; run `npm run lint && npm run build` — Expected: pass, wedding pages unchanged.
- [ ] **Step 2: Write the failing test** `tests/birthday-form.test.mjs` for the pure helpers (export `toBirthdayDraft`, `checkBirthdayDraft`, `previewBirthday` from `BirthdayForm.tsx`'s companion `src/invitations/forms/birthday-draft.ts` so node can load it without React): empty draft fails with "Celebrant is required"; age `'7'` becomes number 7, `''` omitted, `'abc'` fails "Age must be a whole number from 1 to 120"; preview falls back to the sample celebrant and venue while blank.
- [ ] **Step 3: Run** `node --test tests/birthday-form.test.mjs` — Expected: FAIL.
- [ ] **Step 4: Implement** `birthday-draft.ts`, `BirthdayForm.tsx`, the guest RSVP kids select, manage/admin kids display and the copy changes.
- [ ] **Step 5: Run** `npm test && npm run lint && npm run build` — Expected: all pass.
- [ ] **Step 6: Commit** `feat(occasions): birthday form, kids RSVP and occasion-neutral pages`

### Task 5: Confetti and Golden layouts

**Files:**
- Create: `src/invitations/layouts/Confetti.tsx`, `src/invitations/layouts/Golden.tsx`
- Modify: `src/invitations/layouts/index.ts` (`LAYOUTS` gains both; `LayoutProps<D = any>`), `src/invitations/parts.tsx` (`photoAlt` takes a title string; `venues` stays wedding-only; add `ordinal(n)` re-export from shared if needed), `src/invitations/invitations.css` (`.cf-*`, `.gd-*` blocks), `src/invitations/InvitationView.tsx` (details typed `any`; unknown key falls back to `classic` as today), `invitation.html` / `kit.tsx` font link only if a new Google font is used (allowed: one playful display font for Confetti, e.g. Fredoka, added to both font links)

**Interfaces:**
- Consumes: `BirthdayDetails`, `birthday.title`, shared `Countdown`, `MapLink`, `Photos`, `longDate`, `time12`, `schemeVars`.
- Both layouts render, in order: header (kicker "You're invited to" + celebrant + big age with ordinal suffix when `age` set + "Birthday Party!"/"Birthday" + headline + theme pill [Confetti]), date/time + countdown, message, "Where" (venue + map), "Party program"/"Program" (schedule), "Good to know" (Attire, Gifts), photos, "Hosted by" (when set), RSVP slot with "Kindly reply by …". Colours come only from the scheme CSS variables. Text only via JSX.
- Confetti: bright gradient header, rounded heavy type, decorative confetti dots (CSS only, `aria-hidden`). Golden: dark background (scheme `background`), gold `accent` rules, serif type, centred.

- [ ] **Step 1:** Implement both layouts and CSS; register them.
- [ ] **Step 2: Run** `npm run lint && npm run build` — Expected: pass.
- [ ] **Step 3:** `npm run dev`; in the browser pane at 1280px and 375px render each layout through the admin Designs tab preview with the Task 6 sample details (both with and without age, with 0 and 3 photos, long celebrant name of 60 chars): no overflow, readable contrast, no console errors. Fix what fails.
- [ ] **Step 4: Commit** `feat(occasions): Confetti and Golden birthday layouts`

### Task 6: Admin Designs tab, policy wording, design entries

**Files:**
- Modify: `src/components/admin/DesignsTab.tsx`, `src/invitations/PolicyPage.tsx`, `src/invitations/CatalogPage.tsx` (badge text only if wedding-specific remains)
- Create: `docs/designs/birthday.md`, `public/designs/birthday/confetti.png`, `public/designs/birthday/golden.png`
- Modify: `docs/superpowers/specs/2026-11-11-birthday-invitations-design.md` (Release: preview images live in `public/designs/birthday/`, because the admin accepts only https URLs)

**Interfaces:**
- Designs tab: "Occasion" select (Wedding, Birthday) on add, read-only on edit; layout select lists `occasionOf(type).layouts`; sample textarea starts from that occasion's sample (`SAMPLES[productType]`) when the occasion changes on a new design; preview validates with the occasion's rules; payload sends `product_type`.
- Policy pages: "digital invitations" instead of "digital wedding invitations"; retention "60 days after the event date"; privacy "From the customer" instead of "From the couple"; RSVPs "shown only to the customer who bought the invitation"; keep the draft banner.
- `docs/designs/birthday.md`: for Confetti and Golden — suggested name, slug (`confetti-party`, `golden-hour`), 2 colour schemes each (name + 4 hex), sample details JSON that passes `birthday.validateDetails` (kids party "Mia 7, Under the Sea"; milestone "Roberto 50"), preview image URL `https://jlcitsolutions.com/designs/birthday/<file>.png`, and "price: set by you".
- Preview PNGs: screenshots (portrait, ~800×1000) of each layout with its sample, captured from the local browser pane.

- [ ] **Step 1:** Implement the Designs tab and policy changes; add a test in `tests/occasions-shared.test.mjs` that every sample in `docs/designs/birthday.md`'s JSON blocks (also exported as `SAMPLES` from `src/components/admin/design-samples.ts`) passes its occasion's `validateDetails`. Run it — Expected: FAIL before `design-samples.ts` exists, PASS after.
- [ ] **Step 2:** Write `docs/designs/birthday.md`, capture the two PNGs into `public/designs/birthday/`.
- [ ] **Step 3: Run** `npm test && npm run lint && npm run build` — Expected: all pass.
- [ ] **Step 4: Commit** `feat(occasions): admin occasion picker, neutral policies, birthday design kits`

### Task 7: End-to-end check and release

- [ ] **Step 1:** `npm run db:migrate:local` equivalent for 0002: `npx wrangler d1 execute jlc_database --local --file=migrations/0002_occasions.sql`; `npm run dev`; in the admin add the Confetti design from `docs/designs/birthday.md`; on the shop the chips show All · Wedding · Birthday; Birthday filter shows only Confetti; customise with no age and with age; checkout reaches the PayMongo redirect (test key) or the local "payment keys not set" error — both prove validation passed; existing wedding design still customises and previews unchanged; no console errors.
- [ ] **Step 2:** `npm test && npm run lint` — Expected: all pass.
- [ ] **Step 3:** Hand the owner the production migration command and wait for confirmation before pushing:
  `npx wrangler d1 execute jlc_database --remote --file=migrations/0002_occasions.sql`
- [ ] **Step 4:** After confirmation, merge to `main` and push; on https://jlcitsolutions.com check `/` (shop unchanged with one wedding design until the owner adds birthday designs), an existing wedding guest page, and `/api/invitations/designs`.
