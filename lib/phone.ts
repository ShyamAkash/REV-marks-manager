/**
 * Sri Lankan mobile number normalisation.
 *
 * Ported verbatim from the version Shyam Akash wrote in the pre-redesign
 * AddRecordTab, so the behaviour markers are used to is unchanged. It lives in
 * lib/ now rather than inside one screen, so the record editors in Manage can
 * use the same rules the entry form does.
 *
 * Accepts what people actually type — +94771234567, 94771234567, 771234567,
 * 0771234567 — and settles on the local 07XXXXXXXX form.
 *
 * `prevPhone` is the previous field value. It exists so that backspacing down
 * to a lone "0" clears the field instead of being re-expanded by the rules
 * below; without it the user would be unable to delete the last digit.
 */
export function formatSriLankanPhone(val: string, prevPhone: string = ""): string {
  if (!val) return "";
  let digits = val.replace(/\D/g, "");

  // If user backspaced down to "0" from something longer, allow clearing
  if (digits === "0" && val.length < prevPhone.length) {
    return "";
  }

  // Convert international prefix: +947... or 947... to 07...
  if (digits.startsWith("94") && digits.length >= 3) {
    digits = "0" + digits.slice(2);
  }

  // Auto-prefix "07" if user starts typing 7 or 9-digit number starting with 7
  if (digits.startsWith("7")) {
    digits = "0" + digits;
  }

  // Limit to 10 digits without inserting spaces
  return digits.slice(0, 10);
}

/** Digits only, for comparing two numbers written in different formats. */
export function phoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * The key a student is stored under in the `students` table: 10 digits
 * starting with 0, or null when the number cannot be one.
 *
 * Same prefix rules as formatSriLankanPhone, but it never truncates. An
 * 11-digit number is a typo, and cutting it down to 10 could file the student
 * under somebody else's number.
 *
 * The one-off backfill that seeded the table from existing records applied
 * these exact rules in SQL (neon-sql/01_create_students_table.sql, kept out of
 * git). Change the two together.
 */
export function normalizeStudentPhone(value: string | null | undefined): string | null {
  let digits = phoneDigits(value);
  if (digits.startsWith("94") && digits.length >= 3) digits = "0" + digits.slice(2);
  if (digits.startsWith("7")) digits = "0" + digits;
  return /^0\d{9}$/.test(digits) ? digits : null;
}
