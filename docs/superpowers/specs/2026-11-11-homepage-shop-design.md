# Homepage becomes the invitation shop — design

Date: 2026-11-11 · Size: small change · Status: awaiting approval

## Intent
The overhaul request asked for a SaaS storefront. So far only the invitation product was built; the public site still
looks like the old IT company site. The owner wants visitors landing on jlcitsolutions.com to **start an invitation**;
IT work is "just my other services". Branding (logo, emerald theme, company name) stays as it is.

## Goals
- `/` (no hash) shows the invitation catalog: a short hero, the design grid with price, live Preview and Customise
  (the existing `CatalogPage`), a "how it works" strip (Choose → Add details → Pay by QR Ph & share one link), and an
  "Also from JLC: IT services" band linking to the IT site.
- Occasion filter chips above the grid, built from the designs' existing `product_type`. Chips show only when active
  designs span 2+ types, so today (weddings only) no chips and no empty "coming soon" tiles.
- The current IT homepage and its tabs stay complete and admin-editable, reached as "IT Services".
- Navbar: **Invitations · IT Services** (About, Services, Pricing, Why us under it) **· Contact**, plus the
  "Start an invitation" button.
- `index.html` title/description lead with invitations.

## Non-goals
- New occasions (birthday, debut, baptism, anniversary, corporate) and their fields — next project.
- Customer accounts, sales reports, banners, customer management — later projects.
- Moving the IT site to real paths (`/it-services/...`) — rejected below.

## Anti-goals
- Breaking `/#/admin`, the admin invite/reset links, or any existing `/#/<tab>` link.
- Losing any admin-editable content or the inquiry form.

## Approaches
1. **Chosen — shop at `/`, IT site keeps its hash tabs.** Default tab with no hash becomes the shop; the old `home`
   tab becomes "IT Services". Small diff in `App.tsx`/`Navbar.tsx`; admin and old links untouched. Trade-off: Google
   sees the IT site as one page — acceptable while IT is secondary.
2. Real paths for the IT site — better SEO per IT page, but reworks routing in `App.tsx` that the admin relies on.
3. Full rebuild — throws away working content admin, branding and inquiry form. Rejected.

## Decided
- Direction C (catalog is the homepage), approach 1, occasion chips from `product_type` (owner, 2026-11-11).

## Builder's calls (my calls, owner may correct)
- `/invitations` keeps working and renders the same shop page (receipt emails and shared links point there).
- No admin "occasion" field yet: every design is `wedding_invitation`; the next project adds types and the field.
- "IT Services" hash: keep `#/home` working as the IT home so existing links don't break.
- Mobile menu mirrors the desktop grouping (IT sub-items listed under an "IT Services" heading).
