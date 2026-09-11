-- Makes offline uploads idempotent, so a record can never be stored twice.
--
-- WHY
-- Marks entered without a connection are held on the phone and uploaded when
-- signal returns. If the browser tab dies during that upload, the record it was
-- sending may already have reached the database while still sitting in the
-- phone's queue, and the next upload attempt sends it again - a duplicate row
-- for one student, which also pushes everyone below them down a place in the
-- rank sheet.
--
-- The app already narrows this to the single record in flight. This migration
-- closes it completely: each queued record carries an id generated on the
-- phone, and a second arrival of that same id is ignored by the database.
--
-- SAFE TO RUN AT ANY TIME. The column is nullable and the index only covers
-- rows that have a value, so existing rows and the currently deployed app are
-- unaffected - the running app simply never sets the column.
--
--   psql "$DATABASE_URL" -f migration_client_temp_id.sql
--
-- Run this BEFORE deploying the app version that writes the column. See
-- ORDER OF OPERATIONS at the bottom - deploying first fails in a way that is
-- easy to miss.

ALTER TABLE records
  ADD COLUMN IF NOT EXISTS client_temp_id TEXT;

-- Only rows uploaded from an offline queue carry an id; every record created
-- while online stays NULL. Postgres treats NULLs as distinct, so any number of
-- online records coexist happily under a plain unique index.
--
-- Deliberately NOT a partial index (... WHERE client_temp_id IS NOT NULL).
-- A partial index can only arbitrate an ON CONFLICT clause that repeats its
-- predicate exactly, and getting that wrong makes every insert throw - which
-- lib/db.ts would swallow into a silent mock fallback. The plain index costs a
-- little space and removes that whole class of mistake.
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_client_temp_id
  ON records (client_temp_id);

-- Verify. Expect one column row and one index row.
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'records' AND column_name = 'client_temp_id';
--
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'records' AND indexname = 'idx_records_client_temp_id';


-- ORDER OF OPERATIONS
--
-- 1. Run this migration against the production database.
-- 2. Verify with the two queries above.
-- 3. Only then merge and deploy the app change that sends client_temp_id.
--
-- Doing it the other way round is worse than it sounds. lib/db.ts catches a
-- failing query and quietly falls back to in-memory mock data, so an INSERT
-- naming a column that does not exist would not surface as an error: the app
-- would report "Saved" to the marker while the marks went nowhere. That is the
-- exact silent-loss failure this whole area was fixed to prevent.
--
-- To roll back, drop the index and the column - no data created by the current
-- app depends on either:
--
--   DROP INDEX IF EXISTS idx_records_client_temp_id;
--   ALTER TABLE records DROP COLUMN IF EXISTS client_temp_id;
