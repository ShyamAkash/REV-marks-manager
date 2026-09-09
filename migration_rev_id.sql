-- Run this ONCE if you already deployed the app with the old schema
-- (records.rev_no as text) and have existing data to preserve.
-- Skip this file entirely on a fresh install — schema.sql already
-- creates the correct rev_id column.

ALTER TABLE records ADD COLUMN IF NOT EXISTS rev_id INTEGER;

UPDATE records r
SET rev_id = rn.id
FROM rev_numbers rn
WHERE r.rev_no = rn.rev_no
  AND r.rev_id IS NULL;

-- Everything should now have a rev_id. If this returns rows, those
-- records reference a REV No. that no longer exists in rev_numbers;
-- resolve them manually before continuing.
-- SELECT * FROM records WHERE rev_id IS NULL;

ALTER TABLE records ALTER COLUMN rev_id SET NOT NULL;
ALTER TABLE records ADD CONSTRAINT records_rev_id_fkey
  FOREIGN KEY (rev_id) REFERENCES rev_numbers (id);

DROP INDEX IF EXISTS idx_records_town_rev;
CREATE INDEX IF NOT EXISTS idx_records_town_rev ON records (town, rev_id);

ALTER TABLE records DROP COLUMN rev_no;
