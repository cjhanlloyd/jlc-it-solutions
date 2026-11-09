# Admin Panel Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/components/AdminPanel.tsx` (4,016 lines) into one file per tab, with a shared API helper, without changing behaviour.

**Architecture:** The shell (`AdminPanel.tsx`) loads `/api/admin/data`, owns `db`, the saving flag and the error/flash banners, and renders every tab, hiding the inactive ones. Each tab file owns its own form state and handlers, and talks to the API through `adminApi()`. The Content tab owns the shared `contentForm` and renders six section files.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, lucide-react; Node's built-in test runner with native TS type stripping (Node 24).

**Spec:** `docs/superpowers/specs/2026-11-10-admin-panel-split-design.md`

## Global Constraints

- No visual, copy, endpoint or payload changes. Move JSX verbatim; only replace the fetch boilerplate.
- `AdminPanel` keeps its props (`adminToken, adminUser, onLogout, branding, onDataChange`) and default export; `src/App.tsx` is not edited.
- No new dependencies.
- New files live under `src/components/admin/`.
- Every task ends green: `npm run lint`, `npm test`, `npm run build`.

## Review Focus

1. **Unsaved edits survive switching tabs.** Today the forms live in the parent. The shell must keep every tab mounted (`hidden` when inactive), not unmount it. Checked in Task 7.
2. **The Content tab's sections share one form.** Edits in Home must still be there after visiting About, and one save sends everything. `contentForm` lives in `ContentTab`, not in the sections. Checked in Task 7.
3. **Server errors show the server's message.** An Editor saving Branding gets the API's 403 text in the red banner. Checked in Task 7.
4. **Role gating in the UI.** Non-Super Admins still see "Access Denied" in Accounts. Checked in Task 7.
5. **Service reorder.** Drag-and-drop and the up/down buttons still persist the order after a reload. Checked in Task 7.

---

### Task 1: Shared API helper, tab props, image helper

**Files:**
- Create: `src/components/admin/api.ts`
- Create: `src/components/admin/types.ts`
- Create: `src/components/admin/images.ts` (move `optimizeImage` from `AdminPanel.tsx:26-75` verbatim, exported)
- Modify: `src/components/AdminPanel.tsx` (import `optimizeImage` from `./admin/images.js`; delete the local copy)
- Test: `tests/admin-api.test.mjs`

**Interfaces:**
- Produces:
  - `adminApi<T = any>(path: string, token: string, body?: unknown, fallbackError = 'Request failed.'): Promise<T>`. GET when `body === undefined`, otherwise POST with a JSON body. Always sends `Authorization: Bearer <token>`. Returns the parsed JSON. When `!response.ok`, throws `new Error(data.error || fallbackError)`.
  - `interface AdminTabProps { db: WebsiteData; setDb: React.Dispatch<React.SetStateAction<WebsiteData | null>>; adminToken: string; adminUser: { email: string; role: AdminRole; fullName: string }; isSaving: boolean; run: (task: () => Promise<void>, successMsg?: string) => Promise<void>; onDataChange?: () => void; }`
  - The shell renders tabs only once `db` is loaded (after the existing loader), so `AdminTabProps.db` is never null.
  - `run` semantics, implemented in the shell (Task 7, but write it now in `AdminPanel`): set `isSaving` true and clear `apiError`; await the task; on success show `successMsg` through the existing `showFlashMsg`; on error set `apiError` to `err.message`; finally set `isSaving` false.

- [ ] **Step 1: Write the failing test** `tests/admin-api.test.mjs`. Import `../src/components/admin/api.ts` (Node 24 strips the types natively) and stub `globalThis.fetch`. Cover:
  - `adminApi('/api/admin/data', 't')` sends a GET with `Authorization: Bearer t` and returns the parsed body.
  - `adminApi('/api/x', 't', { a: 1 })` sends a POST with `Content-Type: application/json` and body `{"a":1}`.
  - With a `403 {"error":"Access Denied"}` response, it rejects with message `Access Denied`.
  - With a `500 {}` response and fallback `'Failed to update inquiry.'`, it rejects with message `Failed to update inquiry.`.
- [ ] **Step 2:** Run `npm test`. Expected: the new file FAILS (module not found); the 8 API tests pass.
- [ ] **Step 3:** Implement `api.ts`, `types.ts` and `images.ts` as specified, and add `run` to `AdminPanel`.
- [ ] **Step 4:** Run `npm test` (expected: the 4 new `adminApi` tests and the 8 API tests pass), then `npm run lint` and `npm run build`.
- [ ] **Step 5:** Commit: `refactor(admin): add adminApi helper, tab props and image helper`.

### Task 2: Inquiries and Logs tabs

**Files:**
- Create: `src/components/admin/InquiriesTab.tsx` (JSX from `AdminPanel.tsx:1237-1509`; state at lines 140-146; handlers `handleUpdateInquiryStatus`, `handleDeleteInquiry`, `handleGenerateReplyDraft`, `handleSendManualReply`, lines 187-304)
- Create: `src/components/admin/LogsTab.tsx` (JSX from lines 3883-end of that tab; `getServiceTrendData`, `getStatusBreakdown`; reads `systemLogs`)
- Modify: `src/components/AdminPanel.tsx` (remove the moved code; render both tabs)

**Interfaces:**
- Consumes: `AdminTabProps`, `adminApi` (Task 1)
- Produces: `export default function InquiriesTab(props: AdminTabProps)`; `export default function LogsTab(props: AdminTabProps & { systemLogs: { timestamp: string; type: string; message: string }[] })`

- [ ] **Step 1:** Move the code. Derive `activeInquiries`, `activeServices` and `activeSentEmails` from `props.db` inside each tab. Rewrite each handler as `run(async () => { const data = await adminApi(...); setDb(...); }, '<same success message>')`, passing the handler's current error text as `fallbackError`. `handleGenerateReplyDraft` keeps its own `isDraftingReply` flag and doesn't use `run`.
- [ ] **Step 2:** In the shell, render `<div hidden={activeSubTab !== 'inquiries'}><InquiriesTab .../></div>`, and the same for `logs`.
- [ ] **Step 3:** Run `npm run lint && npm test && npm run build`. Expected: all pass.
- [ ] **Step 4:** Commit: `refactor(admin): move Inquiries and Logs tabs to their own files`.

### Task 3: Branding tab

**Files:**
- Create: `src/components/admin/BrandingTab.tsx` (JSX from lines 1510-1708; state `brandingForm`, `logoFileBase64`, `taglineAIPrompt`, `generatedAITaglines`, `isGeneratingTagline`; handlers `handleSaveBranding`, `handleLogoUpload`, `handleAITaglineGenerate`)
- Modify: `src/components/AdminPanel.tsx`

**Interfaces:**
- Consumes: `AdminTabProps`, `adminApi`, `optimizeImage`
- Produces: `export default function BrandingTab(props: AdminTabProps)`

- [ ] **Step 1:** Move the code. Initialize from the loaded data, as `fetchAdminData` did: `useState(() => db.branding)` and `useState(() => db.branding.logoImageBase64 || '')`. Remove those two setters from the shell's `fetchAdminData`.
- [ ] **Step 2:** Render it hidden-when-inactive in the shell. Run `npm run lint && npm test && npm run build`. Expected: all pass.
- [ ] **Step 3:** Commit: `refactor(admin): move Branding tab to its own file`.

### Task 4: Email tab

**Files:**
- Create: `src/components/admin/EmailTab.tsx` (JSX from lines 3482-3668; state `emailTemplateForm`, `smtpForm`; handlers `handleSaveEmailTemplate`, `handleSaveSmtpSettings`)
- Modify: `src/components/AdminPanel.tsx`

**Interfaces:**
- Consumes: `AdminTabProps`, `adminApi`
- Produces: `export default function EmailTab(props: AdminTabProps)`

- [ ] **Step 1:** Move the code. Initialize with `useState(() => db.emailTemplate)` and `useState(() => db.smtpSettings ?? {})`, and drop those setters from `fetchAdminData`.
- [ ] **Step 2:** Render it in the shell. Run `npm run lint && npm test && npm run build`. Expected: all pass.
- [ ] **Step 3:** Commit: `refactor(admin): move Email tab to its own file`.

### Task 5: Accounts tab

**Files:**
- Create: `src/components/admin/AccountsTab.tsx` (JSX from lines 3669-3882; state `accountForm`, `editingOperatorEmail`; handlers `handleAddAdminAccount`, `handleDeleteAdminAccount`, `handleToggleAdminStatus`, `handleResetPassword`)
- Modify: `src/components/AdminPanel.tsx`

**Interfaces:**
- Consumes: `AdminTabProps`, `adminApi`
- Produces: `export default function AccountsTab(props: AdminTabProps & { reload: () => Promise<void> })`. `reload` is the shell's `fetchAdminData`; `handleAddAdminAccount` calls it after inviting, as it does today (line 1017).

- [ ] **Step 1:** Move the code; derive `activeAdminsList` from `db.admins`.
- [ ] **Step 2:** Render it in the shell with `reload={fetchAdminData}`. Run `npm run lint && npm test && npm run build`. Expected: all pass.
- [ ] **Step 3:** Commit: `refactor(admin): move Accounts tab to its own file`.

### Task 6: Content tab and its six sections

**Files:**
- Create: `src/components/admin/content/ContentTab.tsx` (section nav, lines 1709-1774; owns `contentForm`, `activeContentSection`, `handleSaveContent`)
- Create: `src/components/admin/content/HomeSection.tsx` (lines 1775-2317, plus FAQ, process-step and gallery state and handlers, `handleHeroBannerUpload`, `handleRemoveHeroBanner`, `handleGalleryImageUpload`)
- Create: `src/components/admin/content/AboutSection.tsx` (lines 2318-2634, plus roadmap state and handlers, `handleAboutImageUpload`, `handleRemoveAboutImage`)
- Create: `src/components/admin/content/ServicesSection.tsx` (lines 2635-2909, plus `serviceForm`, `editingServiceId`, `draggedServiceIndex`, and all `handle*Service*` handlers)
- Create: `src/components/admin/content/WhySection.tsx` (lines 2910-3109)
- Create: `src/components/admin/content/ContactSection.tsx` (lines 3110-3244)
- Create: `src/components/admin/content/PricingSection.tsx` (lines 3245-3481)
- Modify: `src/components/AdminPanel.tsx`

**Interfaces:**
- Consumes: `AdminTabProps`, `adminApi`, `optimizeImage`
- Produces:
  - `export default function ContentTab(props: AdminTabProps)`
  - `interface ContentSectionProps extends AdminTabProps { contentForm: Partial<ContentSettings>; setContentForm: React.Dispatch<React.SetStateAction<Partial<ContentSettings>>>; onSave: (e: React.FormEvent) => Promise<void>; }`, exported from `ContentTab.tsx`. Every section takes `ContentSectionProps`.

- [ ] **Step 1:** Move the code. `ContentTab` initializes `contentForm` with `useState(() => db.content)` (drop the setter from `fetchAdminData`) and renders only the active section, exactly as today. Sections keep their own CRUD form state, since the mapping script showed nothing is shared between sections.
- [ ] **Step 2:** Render it in the shell. Run `npm run lint && npm test && npm run build`. Expected: all pass.
- [ ] **Step 3:** Commit: `refactor(admin): move Content tab and sections to their own files`.

### Task 7: Shell cleanup and full manual check

**Files:**
- Modify: `src/components/AdminPanel.tsx` (expected about 200-300 lines: props, `db`, `systemLogs`, `isLoading`, `isSaving`, `apiError`, `successMsg`, `activeSubTab`, `fetchAdminData`, `showFlashMsg`, `run`, header, sidebar, banners, hidden-when-inactive tab containers). Delete unused imports.

- [ ] **Step 1:** Remove everything that moved. Confirm with `grep -c "React.useState" src/components/AdminPanel.tsx` (expected ≤ 8) and `grep -c "await fetch(" src/components/AdminPanel.tsx` (expected 1, in `fetchAdminData`, or 0 if it uses `adminApi`).
- [ ] **Step 2:** Run `npm run lint && npm test && npm run build`. Expected: all pass.
- [ ] **Step 3:** Run it locally: `npm run db:reset:local`, then set a password for the seeded admin per the `seed.sql` comment (local DB only), and add an Editor account. Then `npm run dev` and, in the browser, check:
  - Every tab and every Content section opens with no console errors.
  - One save per tab and section shows its success toast, and the value is still there after a page reload.
  - Edit a Home field, switch to About and then to Branding, and come back: the edit is still there. Save, and both Home and About changes persist (Review Focus 1, 2).
  - Logged in as the Editor, saving Branding shows the API's 403 message in the red banner, and Accounts shows "Access Denied" (Review Focus 3, 4).
  - Drag one service and press one up/down arrow, reload, and the order holds (Review Focus 5).
  - Inquiries: change a status, save notes, and draft a reply.
- [ ] **Step 4:** Commit: `refactor(admin): reduce AdminPanel to a shell`.
