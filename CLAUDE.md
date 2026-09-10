# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RevMarks — a mobile-first PWA for recording exam revision paper marks, generating rank sheets (PDF)
and exporting data (Excel). Next.js 15 App Router, React 19, TypeScript, Tailwind v3, Neon Postgres.
Deployed on Vercel at https://revmarks.vercel.app/.

## Commands

```bash
npm install        # bun.lock is also committed, but Bun is not required; pick one and stay with it
npm run dev        # next dev on port 3000, bound to 0.0.0.0 (so a phone on the LAN can reach it)
npm run build      # next build (output: "standalone")
npm start          # serve the production build
npm run lint       # eslint, Next core-web-vitals rules only
npm run db:init    # apply schema.sql to $DATABASE_URL — requires the env var, exits 1 without it
```

There is **no test framework, no test script, and no test files** in this repo. Do not go looking for
one; if a task needs verification, run `npm run build` (catches type errors — `strict: true`, and
`next build` typechecks) plus `npm run lint`, then drive the running app in a browser.

`test files/` at the repo root is sample spreadsheet/brand material, not a test suite. It is untracked.

## Running without a database

`sql()` in `lib/db.ts` returns an **in-memory mock** when `DATABASE_URL` is unset, seeded with three
REV rows. So `npm run dev` works with zero setup and the UI looks fully functional.

Two consequences worth internalising:

- Data written in mock mode lives in a `globalThis` singleton and disappears on restart.
- The fallback is also a **catch-all**: if a real Neon query throws, `sql()` logs a warning and
  silently serves mock data instead of failing. A "working" screen is therefore not evidence the
  database is reachable. Check the server console for `Database query failed` before concluding
  anything about persistence.

## Architecture

### Totals are derived, never stored

`calcTotal()` in `lib/calc.ts` is the single source of truth:

```
total% = (mcq + structured + essay) / (num_mcq + num_structured*5 + num_essay*7.5) * 100
```

The `records` table stores only raw marks. Every consumer recomputes the total on read — the GET in
`app/api/records/route.ts`, the PDF in `app/api/rank/route.ts`, the Excel in
`app/api/records/export/route.ts`, and the client for its live preview. The magic `5` and `7.5` are
the per-question weights for structured and essay questions.

The load-bearing implication: **editing a REV's question counts retroactively changes every total for
that REV**, everywhere. `app/api/revs/route.ts` PUT deliberately touches `records.updated_at` after
such an edit so polling clients notice. If you change the formula, change it in `lib/calc.ts` only.

`rev_id` is a foreign key to `rev_numbers.id`, not the display string. `rev_no` (e.g. `"REV 01"`) is
for humans. `migration_rev_id.sql` exists only for installs predating that change — never run it on a
fresh database.

### Offline-first write path

Marks entry must survive a dead connection mid-session, so writes have two paths:

1. Online → `POST /api/records`.
2. Offline, or the POST throws a network error → `addOfflineRecord()` in `lib/offlineQueue.ts`
   appends to `localStorage["revmarks_offline_queue"]` and dispatches a `revmarks-queue-updated`
   window event.

`syncOfflineQueue()` drains the queue by replaying each item as a normal POST, keeping anything that
fails. Queued items carry a client-generated `tempId`; recent-entry lists key off `id ?? tempId` and
flag queued rows as offline.

### Offline sync and service-worker registration run app-wide

`lib/useOfflineSync.ts` owns queue draining — on `online` events, on a 15s interval, and on demand.
`lib/useServiceWorker.ts` registers `public/sw.js` in production and, in development, actively
*unregisters* any live worker: a stale one intercepts RSC payload fetches and breaks local
navigation. That unregister is deliberate; do not "simplify" it into an unconditional register.

Both run from the root layout via `ServiceWorkerHost`, a null-rendering client component in
`app/layout.tsx` (the layout itself is a server component and cannot call a hook). Display is
separate and contextual: `OfflineIndicator` renders inline in Mark mode's session bar and as a
banner on Manage routes.

Each `useOfflineSync()` call installs its own listeners and interval, so mount at most one
`OfflineIndicator` per rendered route.

Before the redesign both engines lived inside banner components rendered only by `app/page.tsx`,
so navigating away from the home screen silently stopped queue syncing.

`public/sw.js` is network-first with cache fallback and deliberately skips `/api/*`, `/_next/*`, and
RSC payloads — caching those breaks navigation. Bump `CACHE_NAME` when changing it.

### Session lock

`app/components/mark/useMarkSession.ts` persists `{town, revId, checkedBy}` to
`sessionStorage["marks_session_v2"]`. The key and shape are unchanged from before the redesign on
purpose, so anyone mid-session survives a deploy. `staff` on every record comes from the locked
`checkedBy`.

`SessionStart` gates entry behind town + REV + name; `MarkForm` chains fields on Enter (name → phone
→ mcq → structured → essay → save) with `inputMode`/`enterKeyHint` set for phone keyboards. Preserve
that chain — it is the core of the marking loop, and `Field` forwards refs specifically to support it.

Blank marks are valid and save as `0`; the save button is never disabled for missing marks. Marks
above their maximum warn but still save. Both are deliberate.

### API surface

All routes are `dynamic = "force-dynamic"`. `/api/rank` and `/api/records/export` additionally set
`runtime = "nodejs"` because pdf-lib and exceljs need it.

| Route | Verbs |
|---|---|
| `/api/revs` | GET, POST (upserts on `rev_no` conflict), PUT (by id) |
| `/api/records` | GET (`town` + `rev_id` required, optional `search`, `sort`), POST |
| `/api/records/[id]` | PUT, DELETE |
| `/api/records/export` | GET → xlsx |
| `/api/rank` | GET → PDF (`town=ALL` ranks across all towns) |

Search and filtering are SQL; **sorting by total is done in JS after the query**, because the total
isn't a column.

## Known defects

The following were resolved in the front-end redesign (Tasks 1–15):
- Undefined `surface` token (fixed in Task 1, now properly defined in `tailwind.config.js`)
- v4-only `backdrop-blur-xs` class (replaced with v3-compatible classes, files removed in Task 15)
- PATCH/405 mismatch on record edit (fixed in Task 10, now uses PUT)
- Blocking `confirm()` dialog in record deletion (replaced with `ConfirmSheet` in Task 12)

Open items:
- `public/manifest.json` is stale and unreferenced. The live manifest is generated by `app/manifest.ts`
  and served at `/manifest.webmanifest`, which is what `app/layout.tsx` links.

## Conventions

- Import via the `@/*` alias (maps to repo root), not relative paths.
- Tailwind theme tokens live in `tailwind.config.js`; shared component classes (`.field`,
  `.btn-primary`, `.btn-outline`, `.num`) live in the `@layer components` block of
  `app/globals.css`. Add to those rather than repeating utility strings.
- Shared UI components live in `app/components/ui/`; screen-specific components in `app/components/mark/`
  and `app/manage/`.
- Number formatting goes through `lib/format.ts`: `formatTotal()` for percentages (0–100%),
  `formatMark()` for raw mark values.
- Brand palette, sampled from the ictfromabc / 2028 Theory material: near-black `#050505`, off-white
  `#f4f4f2`, accent orange `#dd390b`. Contrast is measured, not guessed: off-white on `#dd390b` is
  4.09:1 and fails WCAG AA, and pure white on it is 4.5021:1 — passing by 0.002, too close to rely
  on. So button fills use `brand-deep` `#d93708` with pure white (4.67:1), and small orange text on
  dark uses `brand-hot` `#ff6b3d` (7.2:1).
- `lib/towns.ts` is a hardcoded `as const` list. Adding a town is a code change, not data.
- API handlers wrap everything in try/catch and return `{ error: message }` with a status; clients
  read `.error` off the JSON. Keep that shape.
