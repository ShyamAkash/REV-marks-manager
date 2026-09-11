import type { sql } from "@/lib/db";
import { normalizeStudentPhone } from "@/lib/phone";

/**
 * Remember a student for the entry form's autocomplete.
 *
 * Students live in their own table, keyed on mobile number, rather than being
 * read back out of `records`. Deleting a REV deletes its records, and if the
 * suggestions came from there, every student marked only in that REV would be
 * forgotten along with the marks. See app/api/students/history/route.ts for
 * the read side.
 *
 * Latest wins: saving a number already on file overwrites its name and town,
 * so a corrected spelling sticks from then on. A record with no name, or no
 * usable number, is skipped - the number is the only identity the table has.
 *
 * Never throws. By the time this runs the mark itself is already stored, and
 * failing to remember a suggestion must not turn a successful save into an
 * error the marker sees.
 */
export async function upsertStudent(
  db: ReturnType<typeof sql>,
  {
    student_name,
    phone_no,
    town,
  }: { student_name: string | null; phone_no: string | null; town: string }
): Promise<void> {
  const name = (student_name ?? "").trim();
  const phone = normalizeStudentPhone(phone_no);
  if (!name || !phone || !town) return;

  try {
    await db(
      `INSERT INTO students (phone_no, student_name, town)
       VALUES ($1, $2, $3)
       ON CONFLICT (phone_no) DO UPDATE
       SET student_name = EXCLUDED.student_name,
           town = EXCLUDED.town,
           updated_at = now()`,
      [phone, name, town]
    );
  } catch (err) {
    console.warn("Could not update the students table", err);
  }
}
