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

## Required environment

Both of these must be set before the app does anything useful, locally included:

| Variable | Without it |
|---|---|
| `DATABASE_URL` | `sql()` throws `DatabaseOfflineError`; every route answers 503 "Database offline" |
| `APP_PASSWORD` | `getAppPassword()` throws; the gate and every `/api/*` request answer 500 |

There is no in-memory mock and no default password any more. `sql()` in `lib/db.ts` used to return a
seeded `globalThis` store when `DATABASE_URL` was unset, so `npm run dev` "worked" with nothing
behind it — marks appeared to save and vanished on restart, and every new query shape needed a
hand-written branch in `mockQuery` or it silently misbehaved in dev only. `lib/auth.ts` likewise used
to fall back to `1234`. Both are gone; a missing variable is now a loud, specific error.

So local dev needs a `.env` with a real `DATABASE_URL` (point it at Neon) and an `APP_PASSWORD`.
A Neon query that throws propagates untouched — a failing database is never papered over with data
that is not really stored.

`errorStatus(err)` in `lib/db.ts` is what picks 503 over 500 in each route's catch block.

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
that REV**, everywhere. `app/api/revs/route.ts` PUT signals that by moving **`rev_numbers.updated_at`**,
returned by `GET /api/revs`. It must never touch `records.updated_at` again: that column is also the
default sort key for the records list (`modified_desc`), so the old
`UPDATE records SET updated_at = now() WHERE rev_id = $1` flattened every record of a REV to one
instant and destroyed the real order of entry, permanently, for something as small as fixing a typo
in a question count. If you change the formula, change it in `lib/calc.ts` only.

For the same reason `POST /api/revs` **creates only**. It used to be `ON CONFLICT (rev_no) DO UPDATE`,
which turned "Add a REV" into a silent reconfigure of a REV that already had marks against it. It now
answers 409 + `existing`, and changing a live REV goes through PUT and the edit sheet that warns about
the consequence.

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

### Password gate and API auth

One shared password, `APP_PASSWORD`, with **no default** — see Required environment above.

`POST /api/auth/verify` compares the submitted password with `crypto.timingSafeEqual` (over SHA-256
digests, because `timingSafeEqual` throws on unequal buffer lengths) and, on success, sets an
**httpOnly** `revmarks_auth` cookie holding an HMAC of the password. The token is never returned in
the body and page scripts cannot read it. The route is `runtime = "nodejs"` for `crypto`.

`middleware.ts` matches `/api/:path*` and 401s anything without a valid cookie. `/api/auth/verify` is
the one exception — it is how a device gets a cookie and how the gate revalidates one. The middleware
runs on the **Edge** runtime, which has no `node:crypto`, so `lib/auth.ts` derives the token with Web
Crypto (`crypto.subtle`) and compares with its own `constantTimeEqual`; that is why the token
derivation lives there and only the password comparison lives in the route. Keep `lib/auth.ts` free of
`node:crypto` imports or middleware stops building.

A simple in-process attempt counter in the route blocks an address for 15 minutes after 10 failures in
15 minutes. It is deliberately not a table — it turns a fast guessing loop into a slow one, which is
all it is for.

The cookie is `secure` only outside development: `npm run dev` binds 0.0.0.0 so a phone on the LAN can
reach it over plain http, where a secure cookie is silently dropped and every API call would then 401.
Vercel is https, so production is always secure.

`app/components/PasswordGate.tsx` wraps the app in `app/layout.tsx`. Because it can no longer read the
cookie, it keeps a plain `revmarks_auth_unlocked` **flag** in localStorage — a hint, not a credential —
so the app opens straight into Mark mode offline, and revalidates with `GET /api/auth/verify` when
online (changing `APP_PASSWORD` therefore still relocks every device). It migrates the old
`revmarks_auth_token` localStorage entry away on mount; the JS-set cookie it left behind holds the same
value the server issues, so existing devices stay unlocked across this change. "Lock Device" on
`/manage` clears the flag and calls DELETE, which is the only way to clear an httpOnly cookie.

One consequence for the offline queue: `OfflineSyncProvider` still sits outside `PasswordGate` and
drains while locked, but those POSTs now 401. `drainQueue` only drops a record on `res.ok`, so nothing
is lost — the marks stay queued and upload once the device is unlocked.

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

`findDuplicate()` in `lib/duplicates.ts` is the single definition, shared by `MarkForm` and the API:
the same mobile (normalised), or the same name when the mobiles don't contradict it — two same-name
students with different numbers are never merged.

`findExistingRecord()` in `lib/duplicates.server.ts` is how the server asks. It **narrows in SQL** —
same town + REV, and either the last 9 digits of the mobile (after stripping punctuation, since
`records.phone_no` is stored as typed) or an exact case-folded name — then hands the candidates to
`findDuplicate()`, which still makes the decision. The SQL is only ever allowed to be *looser* than
`findDuplicate`; a row the query never returns is a duplicate nobody will ever catch. That is why
`MIN_PHONE_DIGITS`, `MIN_NAME_CHARS` and `phoneKey` are exported from `lib/duplicates.ts` and the two
files share them. This replaced a `SELECT * FROM records WHERE town = $1 AND rev_id = $2` that pulled
every row of a busy REV across the wire on every single save.

Both write paths use it:

- **POST** — save checks this phone's session list first, then the POST checks the database and
  refuses a match with 409 + `existing`. Only the server check catches another marker's save — the
  session list is loaded once and never refreshed.
- **PUT `/api/records/[id]`** — same rule, excluding the record being edited (`excludeId`), so editing
  a record to carry another student's mobile is refused with 409 + `existing` instead of sailing
  through. `RecordsClient` surfaces the server's `.error` and leaves the edit sheet open. `MarkForm`'s
  Replace path also PUTs, and can legitimately 409 when the typed identity now matches a *third*
  record.
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

`neon-sql/04_add_revs_updated_at.sql` is the other outstanding one: it adds `rev_numbers.updated_at`
(backfilled from `created_at`) and **must run before** the `PUT /api/revs` change that writes it is
deployed, or every REV edit fails. `schema.sql` has the column for fresh installs.

### API surface

All routes are `dynamic = "force-dynamic"`. `/api/rank` and `/api/records/export` additionally set
`runtime = "nodejs"` because pdf-lib and exceljs need it; `/api/auth/verify` sets it for `crypto`.

**Every route below except `/api/auth/verify` is behind `middleware.ts`** and 401s without a valid
`revmarks_auth` cookie. The browser attaches it to same-origin fetches and to the top-level
navigations used for the xlsx export and the rank PDF, so no caller does anything special.

| Route | Verbs |
|---|---|
| `/api/revs` | GET (with `record_count`, `updated_at`), POST (**409 + `existing`** if `rev_no` is taken), PUT (by id; 409 on a rename clash), DELETE (`?id=`, takes its records with it) |
| `/api/students/history` | GET (optional `town`) → `students` table |
| `/api/records` | GET (`town` + `rev_id` required, optional `search`, `sort`), POST (409 + `existing` on a duplicate; offline replays get `duplicate_of` instead) |
| `/api/records/[id]` | PUT (409 + `existing` on a duplicate), DELETE |
| `/api/records/export` | GET → xlsx |
| `/api/rank` | GET → PDF (`town=ALL` ranks across all towns) |
| `/api/auth/verify` | GET (is the cookie still valid), POST (password → httpOnly cookie; 401 wrong, 429 rate-limited), DELETE (clear cookie) |

Search and filtering are SQL; **sorting by total is done in JS after the query**, because the total
isn't a column. `sort` is `modified_desc` (default), `modified_asc`, `total_desc` or `total_asc`
(ties broken newest first); legacy `modified` means `modified_desc`.

## Known defects

The following were resolved in the front-end redesign (Tasks 1–15):
- Undefined `surface` token (fixed in Task 1, now properly defined in `tailwind.config.js`)
- v4-only `backdrop-blur-xs` class (replaced with v3-compatible classes, files removed in Task 15)
- PATCH/405 mismatch on record edit (fixed in Task 10, now uses PUT)
- Blocking `confirm()` dialog in record deletion (replaced with `ConfirmSheet` in Task 12)

These were fixed alongside the API-auth work — see the sections above for why each shape is now
load-bearing:
- `PUT /api/revs` stamping `records.updated_at` and destroying the records list's sort order
- `POST /api/revs` silently reconfiguring an existing REV via `ON CONFLICT DO UPDATE`
- `PUT /api/records/[id]` skipping the one-record-per-student rule that POST enforces

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
