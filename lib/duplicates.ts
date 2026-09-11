import { normalizeStudentPhone, phoneDigits } from "@/lib/phone";

/** Enough digits to be a whole number, not one still being typed. */
export const MIN_PHONE_DIGITS = 9;
/** Shorter names match too many different students to mean anything. */
export const MIN_NAME_CHARS = 3;

export interface StudentIdentity {
  student_name: string | null | undefined;
  phone_no: string | null | undefined;
}

export interface DuplicateMatch<T> {
  by: "mobile" | "name";
  record: T;
}

/**
 * The same number however it was typed: 0771234567, +94771234567, 771234567.
 *
 * Exported because the SQL that narrows the candidate set before this runs
 * (lib/duplicates.server.ts) has to agree with it exactly - a row the query
 * never returns is a duplicate this function will never see.
 */
export function phoneKey(value: string | null | undefined): string {
  return normalizeStudentPhone(value) ?? phoneDigits(value);
}

/**
 * The record in `records` that belongs to the same student as `candidate`, or
 * null. The one definition of a duplicate: the entry form uses it for its
 * warning and its Replace / Keep sheet, and POST /api/records uses it to catch
 * records this phone has never seen, so the two can never disagree.
 *
 * Mobile is checked first - two students never share a number. A name match
 * counts only when the numbers do not contradict it: two students with the same
 * name and different numbers are two students, and Replace must never
 * overwrite one with the other.
 */
export function findDuplicate<T extends StudentIdentity>(
  records: T[],
  candidate: StudentIdentity
): DuplicateMatch<T> | null {
  const phone = phoneKey(candidate.phone_no);
  if (phone.length >= MIN_PHONE_DIGITS) {
    const byPhone = records.find((r) => phoneKey(r.phone_no) === phone);
    if (byPhone) return { by: "mobile", record: byPhone };
  }

  const name = (candidate.student_name ?? "").trim().toLowerCase();
  if (name.length >= MIN_NAME_CHARS) {
    const byName = records.find((r) => {
      if ((r.student_name ?? "").trim().toLowerCase() !== name) return false;
      const theirs = phoneKey(r.phone_no);
      return !phone || !theirs || phone === theirs;
    });
    if (byName) return { by: "name", record: byName };
  }

  return null;
}
