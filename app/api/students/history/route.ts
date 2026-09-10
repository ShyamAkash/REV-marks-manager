import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Distinct students already recorded, for the entry form's returning-student
 * autocomplete.
 *
 * `town` scopes the result to one town's students. That filter is deliberate:
 * students attend one town's class, and near-identical names across towns are
 * common, so an unscoped list lets a marker tap a suggestion and silently
 * attach another town's phone number to this town's record. Scoping also cuts
 * what the browser downloads to roughly a fifth.
 *
 * Omitting `town` returns every student, preserving the original unscoped
 * behaviour for any caller that wants it.
 */
export async function GET(req: NextRequest) {
  try {
    const town = (new URL(req.url).searchParams.get("town") || "").trim();
    const db = sql();

    const rows = town
      ? await db(
          `SELECT DISTINCT student_name, phone_no
           FROM records
           WHERE student_name IS NOT NULL AND student_name != ''
             AND town = $1
           ORDER BY student_name ASC`,
          [town]
        )
      : await db(
          `SELECT DISTINCT student_name, phone_no
           FROM records
           WHERE student_name IS NOT NULL AND student_name != ''
           ORDER BY student_name ASC`
        );

    return NextResponse.json({ students: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, students: [] }, { status: 500 });
  }
}
