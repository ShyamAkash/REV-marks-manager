-- Run this once against your Neon database before using the app.

-- updated_at moves whenever a REV's name or question counts are edited
-- (PUT /api/revs), and is the only thing that moves. Totals are derived from
-- the question counts, so an edit changes every student's percentage for that
-- REV - this is how a client detects that. It exists because the old signal was
-- to stamp now() onto every record of the REV, which also flattened
-- records.updated_at, the default sort key for the records list, and lost the
-- real order of entry permanently.
CREATE TABLE IF NOT EXISTS rev_numbers (
  id SERIAL PRIMARY KEY,
  rev_no TEXT UNIQUE NOT NULL,
  num_mcq INTEGER NOT NULL DEFAULT 0,
  num_structured INTEGER NOT NULL DEFAULT 0,
  num_essay INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS records (
  id SERIAL PRIMARY KEY,
  town TEXT NOT NULL,
  rev_id INTEGER NOT NULL REFERENCES rev_numbers (id),
  student_name TEXT,
  phone_no TEXT,
  mcq_mark NUMERIC NOT NULL DEFAULT 0,
  structured_mark NUMERIC NOT NULL DEFAULT 0,
  essay_mark NUMERIC NOT NULL DEFAULT 0,
  staff TEXT,
  client_temp_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_town_rev ON records (town, rev_id);
CREATE INDEX IF NOT EXISTS idx_records_updated_at ON records (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_search ON records (student_name, phone_no);

-- client_temp_id is set only on records uploaded from a phone's offline queue
-- and is NULL otherwise. This index is what makes a replayed upload a no-op
-- (ON CONFLICT DO NOTHING in app/api/records/route.ts), and that insert
-- fails without it. Postgres treats NULLs as distinct, so records entered
-- online never collide. Deliberately a plain index, not a partial one - an
-- ON CONFLICT clause can only use a partial index by repeating its predicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_client_temp_id ON records (client_temp_id);

-- Student identity for the entry form's autocomplete, one row per mobile
-- number, normalised to 07XXXXXXXX. Kept apart from records so that deleting
-- a REV, which deletes its records, does not forget the students.
CREATE TABLE IF NOT EXISTS students (
  phone_no TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  town TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_town ON students (town);
