-- Run this once against your Neon database before using the app.

CREATE TABLE IF NOT EXISTS rev_numbers (
  id SERIAL PRIMARY KEY,
  rev_no TEXT UNIQUE NOT NULL,
  num_mcq INTEGER NOT NULL DEFAULT 0,
  num_structured INTEGER NOT NULL DEFAULT 0,
  num_essay INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_town_rev ON records (town, rev_id);
CREATE INDEX IF NOT EXISTS idx_records_updated_at ON records (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_search ON records (student_name, phone_no);

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
