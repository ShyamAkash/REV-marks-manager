import type { sql } from "@/lib/db";
import {
  MIN_NAME_CHARS,
  MIN_PHONE_DIGITS,
  findDuplicate,
  phoneKey,
  type DuplicateMatch,
  type StudentIdentity,
} from "@/lib/duplicates";

/**
 * How many trailing digits of a mobile number the SQL compares.
 *
 * `phoneKey` treats 0771234567, 771234567, 94771234567 and +94771234567 as the
 * same student, and all four share their last nine digits — so the last nine
 * are what the two forms of a number have in common no matter which prefix was
 * typed. Anything the query lets through is still judged by `findDuplicate`, so
 * a loose match here costs nothing; a missed one would be a duplicate the
 * server never catches.
 */
const PHONE_SUFFIX_LEN = 9;

/**
 * A ceiling on how much one save can pull back. Reaching it would mean dozens
 * of records in one town + REV sharing a number or a name, which is already
 * wrong — and `findDuplicate` only ever returns the first match.
 */
const MAX_CANDIDATES = 50;

interface Lookup {
  town: string;
  rev_id: number;
  student_name: string | null;
  phone_no: string | null;
  /** A record never counts as its own duplicate (used when editing). */
  excludeId?: number;
  /** A replay never counts as its own duplicate (used by the offline drain). */
  excludeClientTempId?: string | null;
}

/**
 * The record this student already has in the same town + REV, or null.
 *
 * The one-record-per-student rule is enforced by the app, not the database, so
 * every write path has to ask. This asks with a WHERE clause rather than
 * reading the whole town + REV table and filtering in JS: a REV with several
 * hundred students was pulling every row across the wire on every single save.
 *
 * The SQL only narrows; `findDuplicate` in lib/duplicates.ts still makes the
 * decision, so the server and the entry form can never disagree about what a
 * duplicate is. Phone is matched on trailing digits after stripping
 * punctuation, because `records.phone_no` is stored exactly as it was typed.
 */
export async function findExistingRecord(
  db: ReturnType<typeof sql>,
  {
    town,
    rev_id,
    student_name,
    phone_no,
    excludeId,
    excludeClientTempId,
  }: Lookup
): Promise<DuplicateMatch<any> | null> {
  const key = phoneKey(phone_no);
  const phoneSuffix =
    key.length >= MIN_PHONE_DIGITS ? key.slice(-PHONE_SUFFIX_LEN) : "";

  const trimmedName = (student_name ?? "").trim().toLowerCase();
  const nameKey = trimmedName.length >= MIN_NAME_CHARS ? trimmedName : "";

  // Neither half of the rule can fire, so there is nothing to ask for.
  if (!phoneSuffix && !nameKey) return null;

  const rows = await db(
    `SELECT * FROM records
      WHERE town = $1
        AND rev_id = $2
        AND id <> $3::int
        AND (client_temp_id IS NULL OR client_temp_id <> $4::text)
        AND (
          ($5::text <> '' AND right(regexp_replace(coalesce(phone_no, ''), '[^0-9]', '', 'g'), ${PHONE_SUFFIX_LEN}) = $5)
          OR ($6::text <> '' AND lower(btrim(coalesce(student_name, ''))) = $6)
        )
      ORDER BY id ASC
      LIMIT ${MAX_CANDIDATES}`,
    [
      town,
      rev_id,
      // Serial ids start at 1, so 0 excludes nothing.
      excludeId ?? 0,
      // client_temp_id is NULL or a generated id, never the empty string.
      excludeClientTempId ?? "",
      phoneSuffix,
      nameKey,
    ]
  );

  const candidate: StudentIdentity = { student_name, phone_no };
  return findDuplicate(rows, candidate);
}
