# RevMarks front-end redesign — design

**Date:** 2026-09-10
**Status:** approved, ready for implementation planning
**Scope:** front end only

## Context

RevMarks records exam revision paper marks, generates rank sheets and exports data.
It is live at https://revmarks.vercel.app/ and is used by marking staff for the
ictfromabc / 2028 Theory classes across five towns.

The owner reported four problems, all four of which apply: marking is slow, finding
and fixing records is clumsy, the app looks flat and unfinished, and the screens feel
disconnected.

Investigation found a shared root cause. There is no shared visual vocabulary, so each
screen improvised its own buttons, inputs, spacing and type sizes. Two of the
resulting defects are severe enough to explain the "unfinished" impression on their own:

- `tailwind.config.js` never defined a `surface` colour, yet `bg-surface` is used in
  eight places. Every one of those panel backgrounds rendered as nothing, collapsing
  the whole interface onto a single flat black plane. The quick-edit modal had no
  panel background at all.
- `backdrop-blur-xs` is a Tailwind v4 class used in a Tailwind v3 project. Silently dead.

## Goals

1. Make the marking loop faster and calmer on a phone.
2. Make records reviewable on a desktop.
3. Make the app look like one intentional product.
4. Reduce the number of places a user has to navigate between.

## Non-goals

No change to the database schema, the API routes, or the marks formula. The deployed
site must keep working exactly as it does now for anyone mid-session.

## Constraints

- **Brand.** Sampled from the supplied ictfromabc artwork: near-black, off-white, and an
  accent orange averaging `#d73b10` (peak `#f33000`). The app's existing `#dd390b` is
  that colour and is retained.
- **Devices.** Phone during marking; desktop for review. Both first-class.
- **Accessibility.** `#dd390b` as a button fill under white text measures 4.09:1, below
  WCAG AA. A brighter tint is required for small orange text.
- **Data entry reality.** All four fields (name, mobile, three marks) are filled for
  essentially every student, so no field may be hidden or made conditional.
- **Blank marks.** Students sometimes omit their details. Blanks must remain permitted
  and are stored as `0`. Saving is never blocked on a missing value.

## Section 1 — Foundation

### Colour tokens (`tailwind.config.js`)

| Token | Value | Purpose |
|---|---|---|
| `ink` | `#050505` | page background (unchanged) |
| `surface` | `#111111` | cards and panels — the missing token |
| `surface-2` | `#1a1a1a` | modals, sheets, hover |
| `line` | `#262626` | borders |
| `paper` | `#f4f4f2` | primary text (unchanged) |
| `dim` | `#9a9a9a` | secondary text (raised from `#8c8c8c`) |
| `faint` | `#6b6b6b` | placeholders |
| `brand` | `#dd390b` | fills, active states, focus ring |
| `brand-hot` | `#ff6b3d` | small orange text and icons (7.2:1) |
| `ok` | `#35c17f` | synced / success |
| `warn` | `#f5a524` | over-max, offline |
| `danger` | `#e5484d` | destructive |

`gold` is retained as an alias of `brand` so migration can proceed file by file
without breaking unconverted screens.

### Type scale

Five sizes replace the current ad-hoc mix of `10px`, `11px`, `13px`, `xs`, `sm`, `base`:
display 32px, title 17px, body 15px, label 12px, micro 11px. All numeric output uses
tabular figures so digits do not shift while typing.

### Shape and touch

Radius gains three steps instead of a uniform 16px: controls 12px, cards 18px,
sheets 24px. Minimum touch target 48px; mark inputs on the marking screen 56px.

### Shared components (`app/components/ui/`)

- `Button` — variants primary / secondary / ghost / danger, sizes sm / md / lg, real
  loading state. Replaces `{saving ? "Saving..." : "Save"}` repeated in four files.
- `Field` — label, input, hint, error in one unit; owns the `/50` max hint and the
  amber over-max treatment currently copy-pasted three times per screen. Forwards refs
  so the existing Enter-key focus chain keeps working.
- `Select` — styled native `<select>`; the OS picker stays, it is the best mobile control here.
- `Sheet` — bottom sheet under 640px, centred dialog above. Focus trap, Escape to close.
  Replaces both hand-rolled modals and the blocking `confirm()`.
- `Toast` — one notification system replacing three separate inline message strips.
- `Card`, `EmptyState`, `Skeleton`.

## Section 2 — Mark mode

### Starting a session

Today the full entry form renders at 35% opacity with `pointer-events: none` before a
session starts, which reads as broken rather than locked. It is replaced by a dedicated
start screen containing only: Town, REV No., Checked by, and a Start button.

- **Town becomes five tappable chips**, not a dropdown. The list is a fixed
  five-entry `as const` in `lib/towns.ts`; a dropdown costs tap → scroll → tap for
  something one tap can do.
- **REV No. stays a `<select>`** because that list grows over time.
- **"Checked by" is prefilled from the last value used**, persisted in localStorage.
  The same marker typically runs several sessions in a row.

### The marking screen

Top to bottom: slim sticky session bar (`Gampaha · REV 01 · Tharuk`, with offline
status merged in as a coloured dot and queued count), student name, mobile, three mark
inputs in a row, the live total, the save button, then a single-line last-entry strip.

- **The total becomes the hero.** It currently sits in a small box beside Mobile
  showing `0.00%` before anything is typed. It moves to its own card at display size,
  stays neutral until all three marks are present, then turns brand orange.
- **Mark inputs are labelled by their maximum** — `MCQ /50`, `STRUCT /20`, `ESSAY /30`.
  The current labels (`MCQ Mark`, `Structured`, `Essay Mark`) wrap badly in three
  narrow columns, and the maximum is the information the marker actually needs.
- **The Enter chain is preserved exactly**: name → phone → MCQ → structured → essay →
  save, with per-field `inputMode` and `enterKeyHint`. This is the core of the loop.
- **Over-max stays permitted**, with clearer signalling: amber field plus a note on the
  total card, rather than tiny text under one input.
- **Blank marks stay permitted and save as 0.** The save button is never disabled.
- **Recent entries collapse from five rows to one.** Five rows push the save button
  off-screen. The last entry shows as a single line; tapping it opens the full session
  list in a Sheet. That Sheet is editable — it is where a marker fixes a typo they
  noticed two students later — and it lists both synced and queued-offline entries,
  matching the current combined behaviour.

### Bug closed here

`AddRecordTab.tsx:359` sends `PATCH` to `/api/records/[id]`, which exports only `PUT`
and `DELETE`, returning 405. Editing an already-synced entry fails silently today.
The rebuilt edit path uses `PUT`.

## Section 3 — Manage

### Hub

On phone, three cards: Records, Rank Sheet, REV Numbers, each with a description and a
live count. On desktop the hub collapses and the three become a persistent sub-nav.

### Records

- Compact sticky filter bar: Town, REV, search, export.
- **Search stops hiding behind an icon.** The current expand-on-tap,
  collapse-on-empty-blur behaviour costs a tap for no benefit. Always visible.
- **Desktop gets a real sortable table** (Name, Mobile, MCQ, Struct, Essay, Total,
  Staff, Updated). Mobile keeps cards.
- **One total format everywhere.** The same total currently renders three ways:
  `ViewDataTab` shows `72.3333`, the live entry preview shows `72.33%`, and the
  recent-entries strip shows `72.3%`. Standardise on one decimal and a `%`.
- **The duplicate Download button goes.** It renders twice today — above the list, and
  again below it when there are more than three records.
- **Delete uses the shared Sheet**, not a blocking `confirm()`. Blocking dialogs also
  freeze browser automation.
- **Polling pauses** when the tab is hidden and while a record is open for editing.
  It currently refetches every 3 seconds indefinitely.
- **Stat line**: `24 records · avg 68.4% · high 91.2%`, computed from data already
  fetched. No API change.

### Rank Sheet

The two filters restyled, an explicit statement of what will be generated, and a
download button with a loading state — PDF generation is not instant and currently
gives no feedback at all.

### REV Numbers

Moves from `/add-rev` to `/manage/revs`. `/add-rev` is kept as a redirect so existing
bookmarks and installed PWA shortcuts continue to work. Editing moves into the shared
Sheet. The existing notice that changing question counts recalculates every total for
that REV is restyled as a proper warning — it is the most consequential action in the app.

### Routing

```
app/page.tsx                  Mark mode
app/manage/page.tsx           hub
app/manage/records/page.tsx
app/manage/rank/page.tsx
app/manage/revs/page.tsx
app/add-rev/page.tsx          redirect → /manage/revs
```

Navigation lives in `app/layout.tsx`: a two-item bottom bar (Mark | Manage) on phone
with safe-area inset, a top bar on desktop. The bar persists on every route including
Manage sub-pages, where `Manage` stays the active item; sub-pages get a back affordance
to the hub on phone and rely on the desktop sub-nav above 768px.

### Latent bug this restructure forces us to fix

`OfflineStatusBanner` owns offline queue syncing and `PWAInstallBanner` is the only
thing that registers the service worker. Both are currently rendered **only** by
`app/page.tsx`. Once Manage is a separate route, a marker sitting on a Manage screen
would stop syncing queued records entirely.

The fix separates the engine from its display, because the two now belong in different
places:

- **Sync engine and service-worker registration move to `app/layout.tsx`** and run on
  every route. Extracted as `useOfflineSync()` and `useServiceWorker()` so they own no
  markup.
- **Display is contextual.** Mark mode shows offline state inline in its session bar (a
  coloured dot plus queued count, opening a sync Sheet on tap), as described in Section
  2. Manage routes show a slim banner only when there is something to report.

This resolves what would otherwise be a contradiction between Sections 2 and 3: the
banner component is not moved wholesale, it is split.

## Out of scope — parked for a later pass

Deferred at the owner's direction, to keep this change set to a single layer:

1. **Excel export placeholders.** `app/api/records/export/route.ts:37-39` writes the
   literal strings `"No Name Provided"` and `"No Phone no. Provided"`. The owner wants
   these to be `0`. Whether the rank sheet PDF and the in-app lists should match is
   still undecided.
2. **Rank sheet preview.** Showing the top 10 before download would require an API
   change to support the "All Towns" case.
3. **`.gitignore`.** `.next/` is not ignored and the file has never been committed.

## Verification

No test framework exists in this repository, and none is being added as part of a
presentation-layer change.

- `npm run build` must pass — it typechecks under `strict: true`.
- `npm run lint` must pass.
- The running app is driven in a browser at 390px and 1280px: start a session, enter
  records, go offline and back online, edit, delete, export. Each screen is
  screenshotted for review.
- Do not run `npm run build` while `npm run dev` is live; they share `.next/` and the
  dev server will start returning 500s.

## Risks

- **Migration window.** While screens are converted one at a time, converted and
  unconverted screens coexist. The `gold` → `brand` alias keeps the unconverted ones
  rendering correctly.
- **Session continuity.** `sessionStorage["marks_session_v2"]` must keep its key and
  shape, or anyone mid-session when the deploy lands loses their locked session.
- **Service worker cache.** `public/sw.js` caches `/` for offline navigation. Adding
  routes under `/manage` means `CACHE_NAME` must be bumped, or returning users may get
  a stale shell.
