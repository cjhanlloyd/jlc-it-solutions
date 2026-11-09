# Admin panel split — design

## Why
`src/components/AdminPanel.tsx` is 4,016 lines: one component holding every tab's state (36 `useState`),
33 handlers, and 26 copies of the same fetch/auth/error block. The coming SaaS overhaul adds Orders,
Customers, Templates and Payments to the admin. Each area needs its own file so new areas can be added
without touching the others.

## Goals
- One file per admin tab; the Content tab split further into one file per page section.
- One shared `adminApi()` helper replacing the 26 copied fetch blocks.
- `AdminPanel.tsx` becomes a shell (~200 lines): sidebar, data loading, flash/error banner, active tab.
- Behaviour is identical: same screens, same API calls, same messages.

## Non-goals
- No visual or UX changes, no new features, no API changes.
- No redesign of tabs the SaaS overhaul will replace. This only moves code.

## Anti-goals (a failure even if it compiles)
- Any tab saving different data, or to a different endpoint, than before.
- A shared "god context" that every tab reads everything from (the same tangle in a new place).

## Approaches considered
1. **One file per tab (picked).** Each tab owns its form state and handlers; the shell owns only what
   tabs share. Most change up front, and new SaaS sections plug in as new files.
2. Shared API helper only. −600 lines, low risk, but leaves a ~3,400-line file the SaaS work would grow.
3. Move only the JSX, keeping state in the parent. Rejected: it means passing ~60 props per tab and
   keeps the coupling.

## Design
- `src/components/admin/api.ts`: `adminApi(path, token, body?)`. It does the fetch, adds the bearer
  header, parses JSON and throws `data.error`. The current error messages stay as caller fallbacks.
- Shared props each tab gets: `db`, `setDb`, `adminToken`, `adminUser`, `onDataChange`, and a small
  `run(task, successMsg)` that sets the saving flag, clears and sets the error, and shows the flash message.
  This replaces the try/catch/finally repeated in every handler.
- Measured with a script: apart from those shared pieces, every tab's state and handlers are used only
  by that tab.
- Files: `admin/InquiriesTab.tsx`, `BrandingTab.tsx`, `EmailTab.tsx`, `AccountsTab.tsx`, `LogsTab.tsx`,
  and `admin/content/ContentTab.tsx` with `HomeSection`, `AboutSection`, `ServicesSection`, `PricingSection`,
  `WhySection` and `ContactSection`. `optimizeImage` moves to `admin/images.ts`.
- `AdminPanel` keeps its current props and default export, so `App.tsx` doesn't change.

## Verification
There are no automated tests for the admin UI. After the split: `npm run lint`, `npm test` and
`npm run build` must pass. Then run the site locally (`npm run dev`, local D1, a seeded admin with a
password) and, in the browser, open every tab and Content section and do one save or action in each,
checking the toast and that the data persists after a reload.

## Left to the builder
- Exact prop names and which derived values (e.g. filtered inquiry lists) live in which tab.
- Whether a tiny `useFlash` hook or plain props is simpler for the shell; whichever is smaller.
