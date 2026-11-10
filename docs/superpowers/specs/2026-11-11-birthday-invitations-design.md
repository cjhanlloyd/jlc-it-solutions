# Birthday invitations (first new occasion) — design

Date: 2026-11-11 · Size: project · Status: draft for owner approval

## Intent and why
The overhaul request names many occasions (wedding, birthday, debut, anniversary, baptism, corporate, other). The
owner chose **fully custom invitations per occasion** (each has its own fields, sections and wording) and to ship them
**one occasion at a time**, starting with **Birthday**. Birthday customers are both parents planning kids' parties and
adults celebrating milestones (30th, 50th, 60th…). This project also builds the shared "occasion" base so debut,
baptism etc. later need only their own rules, form and designs.

Success: a customer picks a birthday design on the shop (the occasion chips appear: All · Wedding · Birthday), fills
in the birthday form, pays by QR Ph, and shares a birthday page where guests RSVP with adult and kid counts. Weddings
keep working exactly as today, including every invitation already paid for.

## Goals
1. **Occasion base**
   - An invitation's occasion is its design's `products_designs.product_type` (`wedding_invitation`,
     `birthday_invitation`). No separate column on `invitations`.
   - One module per occasion under `shared/occasions/` exporting the same shape:
     `validateDetails(input)`, `lockedFieldsChanged(before, after)`, `title(details)` (e.g. "Ana & Ben",
     "Mia's 7th Birthday", "Roberto's Birthday" when no age), `slugBase(details)`, `expiredSummary(details)` (the few
     fields kept after the privacy purge so "this celebration has passed" can still name it), `eventDate(details)`,
     `layouts` (layout keys that belong to it).
   - A registry `shared/occasions/index.ts`: `OCCASIONS[productType]`, used everywhere the code today calls the wedding
     functions directly (checkout, manage edit, admin design save, guest page, OG tags, emails, cleanup).
   - `shared/invitation-fields.ts` wedding rules move into `shared/occasions/wedding.ts` unchanged in behaviour; shared
     helpers (`str`, `isoDate`, `time`, venue, schedule, LIMITS, `validateRsvp`, `makeSlug`) stay shared.
2. **Birthday details** (validated server-side and in the form):
   - `celebrant` (required, ≤60, **locked after payment**), `age` (optional integer 1–120),
     `headline` (optional ≤120), `theme` (optional ≤80), `eventDate` (required, not in the past at checkout, same rule
     as weddings), `eventTime` (optional HH:MM), `venue` (required name; address and map link optional, same map-link
     normalisation as weddings), `schedule` (optional, ≤8 items, same as wedding schedule, shown as "Party program" /
     "Program"), `dressCode`, `giftsNote`, `message`, `hostedBy` (optional ≤120), `rsvpDeadline` (optional).
   - Photos: up to 6, same upload rules as weddings.
3. **RSVP with kids**
   - New column `rsvps.kids_count INTEGER NOT NULL DEFAULT 0` (migration `0002_occasions.sql`).
   - Birthday RSVP form asks **Adults** (1–10 when attending) and **Kids** (0–10, starts at 0). Wedding RSVP is unchanged
     (party size only; kids stays 0).
   - Manage page RSVP list and CSV export show a Kids column for birthdays; totals show adults and kids separately.
4. **Two birthday designs (code layouts)**
   - `confetti` — playful kids' party look: big age number, theme pill, bright colours, rounded type.
   - `golden` — elegant milestone look: dark background, gold accents, serif type, big age number when given.
   - Both use the shared parts (countdown, venue + map, program, good-to-know, photos, RSVP slot).
   - Each needs at least one colour scheme in its admin design entry; layouts read colours from the scheme like the
     wedding layouts do.
5. **Admin**
   - Designs tab gets an **Occasion** select (Wedding, Birthday). Saving checks the layout belongs to that occasion and
     the sample details validate with that occasion's rules (409/400 as today). Occasion is fixed after creation, like
     the layout.
   - Orders/Invitations tabs show the invitation's title from `title(details)` instead of assuming partner names.
6. **Wording**
   - Guest page, OG tags (title = `title(details)` + date), receipt/link emails, success page, manage page and the
     expired page use occasion-neutral words ("your invitation", "your celebration", "guests") or the occasion's own.
   - Policy pages say "digital invitations" instead of "digital wedding invitations"; the 60-days-after-the-event
     retention applies to every occasion.

## Non-goals
- Debut, baptism, anniversary, corporate, other — later projects on this base.
- Wedding additions (principal sponsors, entourage) — later.
- Changing payment, PayMongo, hosting, photo storage, Turnstile, or the manage-link security model.
- Customer accounts.

## Anti-goals
- Any change in behaviour for existing wedding invitations, their links, manage links, RSVPs or CSVs.
- A birthday invitation that can be saved with wedding fields or rendered with a wedding layout (or the reverse).
- Showing wedding wording ("couple", "marriage", "partners") anywhere on a birthday flow.

## Constraints
- Cloudflare Pages Functions + D1 + R2; React 19 SPA + the separate `invitation.html` guest entry; node `--test`.
- Validation stays dependency-free in `shared/` and runs on both server and client.
- Production D1 gets the migration via `wrangler d1 execute --remote` — run by the owner (remote DB writes are not
  run by the builder).
- PayMongo stays on test keys during this project.

## Approaches
1. **Chosen — per-occasion rules, form and layouts on the shared base** (registry keyed by `product_type`). New
   occasions add files, not branches in payment/manage code; stored wedding details untouched.
2. One generic form with every field optional — fastest, but every occasion sees irrelevant fields; contradicts the
   owner's "fully custom per occasion" choice.
3. Separate product per occasion with its own checkout/manage — copies payment and manage code per occasion.

## Decided by the owner
- Fully custom per occasion; one occasion at a time; Birthday first.
- Birthday serves kids' parties and adult milestones with one form; the design sets the mood.
- RSVP splits adults and kids.
- Approach 1.

## Builder's calls (owner may correct)
- Kids count always shown on birthday RSVP (starts at 0) rather than a per-invitation toggle.
- Birthday has one venue (no ceremony/reception pair).
- Celebrant name is the locked field (mirrors wedding names).
- Slug base: `<celebrant>-<age>th-birthday` or `<celebrant>-birthday`, plus the random suffix, via the existing
  `makeSlug` folding rules.
- Birthday price is whatever the admin sets on each design; no code default.

- Unknown `product_type` (no module in the registry): the design is left out of the shop's designs list and checkout
  refuses it with 400; guest/manage/cleanup fall back to the wedding module only for `wedding_invitation`, otherwise
  treat the invitation as not found. (Live check 2026-11-11: the only active design is `classic-rose`,
  `wedding_invitation`, layout `classic`, so no data fix is needed.)

## Release (builder's call)
- Cloudflare Pages deploys on every push to `main`. The migration only **adds** `rsvps.kids_count` with a default, so
  today's code keeps working on a migrated database. Order: the owner runs `0002_occasions.sql` on production first,
  then the builder pushes. The plan's last task states the exact command.
- The builder does not write to the production database. The plan ships, for each birthday design, a ready-to-paste
  admin entry (name, suggested slug, colour schemes, sample details that pass validation) and preview images
  captured from the local sample preview, saved under `public/designs/birthday/` (served at `https://jlcitsolutions.com/designs/birthday/<file>.png`, because the admin accepts only https URLs); the entries are in `docs/designs/birthday.md`. The owner creates the two designs in
  the admin Designs tab, sets the price, and uploads the images.

## Left to the builder
- Exact visual styling of `confetti` and `golden` within the described looks; the owner reviews them in the browser
  before release.
- How the customiser picks the occasion's form component (registry on the client side alongside `LAYOUTS`).
