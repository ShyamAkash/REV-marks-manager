# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RevMarks — a mobile-first PWA for recording exam revision paper marks, generating rank sheets (PDF)
and exporting data (Excel). Next.js 15 App Router, React 19, TypeScript, Tailwind v3, Neon Postgres,
`lucide-react` for icons. Deployed on Vercel at https://revmarks.vercel.app/.
github repo - https://github.com/ShyamAkash/REV-marks-manager 

## Commands

```bash
npm install        # bun.lock is also committed, but Bun is not required; pick one and stay with it
npm run dev        # next dev on port 3000, bound to 0.0.0.0 (so a phone on the LAN can reach it)
npm run build      # next build
npm start          # serve the production build
npm run lint       # eslint, Next core-web-vitals rules only
npm run db:init    # apply schema.sql to $DATABASE_URL — requires the env var, exits 1 without it
```

There is **no test framework, no test script, and no test files** in this repo. Do not go looking for
one; if a task needs verification, run `npm run build` (catches type errors — `strict: true`, and
`next build` typechecks) plus `npm run lint`, then drive the running app in a browser.

`test files/` at the repo root is sample spreadsheet/brand material, not a test suite. It is untracked.

When adding a dependency, update `package.json`, `package-lock.json` **and** `bun.lock` together.
`lucide-react` arrived via `bun.lock` only, so `package-lock.json` went stale; `npm install` repairs it.

Vercel deploy status per commit (run through the Bash tool — PowerShell mangles the `--jq` quoting):
`gh api repos/ShyamAkash/REV-marks-manager/commits/<sha>/status --jq '.statuses[] | "\(.context): \(.state)"'`

### Pulling from GitHub

The repo owner often commits through GitHub's web "Add files via upload". Those uploads can be built
from an older local copy and quietly revert recent edits (one restored a comment pointing at a
removed migration). After pulling, read `git diff <old>..origin/main` for regressions, not just the
new feature.

## Running without a database

`sql()` in `lib/db.ts` returns an **in-memory mock** when `DATABASE_URL` is unset (or the Neon client
fails to initialise), seeded with three REV rows. So `npm run dev` works with zero setup; there is no
local `.env`, so local dev is always mock mode. Mock data lives in a `globalThis` singleton and
disappears on restart.

A real Neon query that throws is **no longer** swallowed into the mock — it propagates, and the route
returns `{ error }` with a 500. (Older code fell back to mock data on any query error, so a "working"
screen proved nothing; that is gone.) `mockQuery` pattern-matches SQL text, so a new query shape,
such as a new `ORDER BY`, needs a matching branch there or it silently misbehaves in dev.

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
for humans. (Installs predating that change were upgraded by `migration_rev_id.sql`, since removed
from the repo; it is in git history if an ancient database ever turns up.)

### Offline-first write path

Marks entry must survive a dead connection mid-session, so writes have two paths:

1. `MarkForm` always attempts `POST /api/records` — it does not pre-check `navigator.onLine`, which
   lies on flaky connections.
2. If the POST throws a network error (`Failed to fetch` / `NetworkError` / Safari's `Load failed`),
   `addOfflineRecord()` in `lib/offlineQueue.ts` appends to `localStorage["revmarks_offline_queue"]`
   and dispatches a `revmarks-queue-updated` window event.

`syncOfflineQueue()` drains the queue by replaying each item as a normal POST, keeping anything that
fails. Queued items carry a client-generated `tempId`; recent-entry lists key off `id ?? tempId` and
flag queued rows as offline.

It removes each record **as the server confirms it**, never in one batch at the end. That shape is
load-bearing twice. Because each removal re-reads the queue, a mark saved by a marker still working
during the drain survives — writing a stale snapshot back would erase it with no error shown. And it
bounds what a mid-drain crash can duplicate to the single record in flight: trimming at the end meant
a tab dying after fifteen of twenty uploads left all twenty queued, so the next drain re-sent fifteen
rows that were already in the database. Keep the per-record removal.

The drain runs under a **cross-tab lock** (`withSyncLock`), because the queue lives in localStorage
which every tab shares while each tab runs its own sync engine — two open tabs would otherwise upload
the same records and write duplicate rows. Web Locks does the real work and releases automatically if
a tab dies; the timestamped localStorage claim is only a fallback for browsers without that API
(Safari before 15.4), and is best-effort by nature. `ifAvailable` means a blocked tab skips rather
than queues — the next 15s interval retries anyway.

A tab can still die in the gap between the server storing a record and the queue dropping it, so each
replayed record carries the `tempId` it was queued under as `client_temp_id`. The unique index on that
column plus `ON CONFLICT DO NOTHING` makes a second arrival a no-op, and the API answers it with the
row that already exists (plus `duplicate: true`) rather than an error — an error would leave the record
queued and retrying forever. Records entered online send no id and stay NULL, which Postgres treats as
distinct, so they never collide with each other.

**The column and its unique index must exist in the database before this code is deployed.**
`schema.sql` creates both for fresh installs; an existing database gets them from
`neon-sql/00_add_client_temp_id.sql` (gitignored, handed to the database owner). Without them every
record INSERT fails.

### Offline sync and service-worker registration run app-wide

`lib/useOfflineSync.ts` owns queue draining — on mount if the queue is non-empty, on `online` events,
on a 15s interval (not gated on `navigator.onLine`), and on demand.
It is called **exactly once**, by `OfflineSyncProvider` in the root layout, and its state reaches
consumers through context (`useOfflineSyncState()`). Draining therefore runs on every route,
including Mark mode's town/REV picker — where someone reopening the app with queued records
actually lands. `OfflineSyncProvider` sits outside `PasswordGate`, so it drains even while locked.
`lib/useServiceWorker.ts` registers `public/sw.js` in production and, in development, actively
*unregisters* any live worker: a stale one intercepts RSC payload fetches and breaks local
navigation. That unregister is deliberate; do not "simplify" it into an unconditional register.

Both run from the root layout via `ServiceWorkerHost`, a null-rendering client component in
`app/layout.tsx` (the layout itself is a server component and cannot call a hook). Display is
separate and contextual: `OfflineIndicator` renders inline in Mark mode's session bar and as a
banner on Manage routes.

`OfflineIndicator` is display only — it reads the shared state, so mounting it on several routes
costs nothing and never duplicates a drain. Do not call `useOfflineSync()` anywhere else: a second
call would install a second set of listeners and a second interval, and two drains racing on the
same queue upload the same records twice.

Before the redesign both engines lived inside banner components rendered only by `app/page.tsx`,
so navigating away from the home screen silently stopped queue syncing.

`public/sw.js` is network-first with cache fallback and deliberately skips `/api/*`, `/_next/*`, and
RSC payloads — caching those breaks navigation. Bump `CACHE_NAME` when changing it.

### Password gate

`app/components/PasswordGate.tsx` wraps the whole app in `app/layout.tsx`. One shared password,
`APP_PASSWORD` (set on Vercel; falls back to `1234` in `lib/auth.ts`, so locally unlock with `1234`).
`POST /api/auth/verify` returns an HMAC token, stored in localStorage and a `revmarks_auth` cookie for a
year; when online, the gate re-checks it, so changing `APP_PASSWORD` relocks every device. "Lock
Device" on `/manage` clears it. The gate renders a spinner until mount, so pages are client-rendered.

It is **deliberately light**: it only hides the UI, and API routes do not check the token. The site is
not sensitive — do not harden it (route checks, middleware, secret rotation) unless asked.

### Session lock

`app/components/mark/useMarkSession.ts` persists `{town, revId, checkedBy}` to
`sessionStorage["marks_session_v2"]`. The key and shape are unchanged from before the redesign on
purpose, so anyone mid-session survives a deploy. `staff` on every record comes from the locked
`checkedBy`.

`SessionStart` gates entry behind town + REV + name; `MarkForm` chains fields on Enter (phone → name
→ mcq → structured → essay → save; fields a REV has no questions for are skipped) with
`inputMode`/`enterKeyHint` set for phone keyboards, and refocuses phone after each save. Preserve
that chain — it is the core of the marking loop, and `Field` forwards refs specifically to support it.

Blank marks are valid and save as `0`; the save button is never disabled for missing marks. Marks
above their maximum warn but still save. Both are deliberate.

### Duplicate records

One record per student per town + REV, enforced by the app, not the database. There is deliberately
no unique key: phone is optional, `records.phone_no` is stored as typed, and an offline upload that
hit one could only overwrite or drop marks with nobody asked.

`findDuplicate()` in `lib/duplicates.ts` is the single definition, shared by `MarkForm` and
`POST /api/records`: the same mobile (normalised), or the same name when the mobiles don't
contradict it — two same-name students with different numbers are never merged.

- Save checks this phone's session list first, then the POST checks the database and refuses a match
  with 409 + `existing`. Only the server check catches another marker's save — the session list is
  loaded once and never refreshed.
- Either way `DuplicateSheet` asks: **Replace** (PUT, or edit the queued copy if it has not synced)
  or **Keep** (discard what was typed). Dismissing it returns to the form with the input intact.
- Offline replays (`client_temp_id` set) are **never refused** — the drain has nobody to ask, and a
  refusal would retry forever. They are stored and flagged `duplicate_of`, and the sync message says
  "N duplicate(s), check Manage → Records". Not to be confused with `duplicate: true`, which means
  the *same* record arrived twice.
- Two markers pressing Save in the same instant can still both get through. Accepted.

### Students table and REV deletion

The entry form's returning-student autocomplete reads the `students` table, **not** `records`.
One row per mobile number, normalised by `normalizeStudentPhone()` in `lib/phone.ts` to
`07XXXXXXXX` (exactly 10 digits, never truncated). It is the key because names are typed
differently week to week; two students never share a number.

`upsertStudent()` in `lib/students.ts` writes it after a fresh record insert (not a `duplicate`
replay) and after every record edit. Latest wins: name and town are overwritten. Rows with no name
or no usable number are skipped, so phone-less students are never suggested. It never throws — the
mark is already stored when it runs.

The table exists so that REVs can be deleted. `DELETE /api/revs?id=N` removes the REV and all its
records in every town in **one** CTE statement; that works on the plain `NO ACTION` foreign key
because the check runs at end of statement. Nothing ever deletes from `students`. If you ever
derive the autocomplete from `records` again, deleting a REV will silently forget its students.

The Neon migration for it (with a backfill that applies the same phone rules in SQL) lives in
`neon-sql/`, which is **gitignored** — SQL is handed to the database owner rather than committed.
`schema.sql` carries the table for fresh installs.

### API surface

All routes are `dynamic = "force-dynamic"`. `/api/rank` and `/api/records/export` additionally set
`runtime = "nodejs"` because pdf-lib and exceljs need it.

| Route | Verbs |
|---|---|
| `/api/revs` | GET (with `record_count`), POST (upserts on `rev_no` conflict), PUT (by id), DELETE (`?id=`, takes its records with it) |
| `/api/students/history` | GET (optional `town`) → `students` table |
| `/api/records` | GET (`town` + `rev_id` required, optional `search`, `sort`), POST (409 + `existing` on a duplicate; offline replays get `duplicate_of` instead) |
| `/api/records/[id]` | PUT, DELETE |
| `/api/records/export` | GET → xlsx |
| `/api/rank` | GET → PDF (`town=ALL` ranks across all towns) |
| `/api/auth/verify` | GET (is token valid), POST (password → token + cookie), DELETE (clear cookie) |

Search and filtering are SQL; **sorting by total is done in JS after the query**, because the total
isn't a column. `sort` is `modified_desc` (default), `modified_asc`, `total_desc` or `total_asc`
(ties broken newest first); legacy `modified` means `modified_desc`.

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
