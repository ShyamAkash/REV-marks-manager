import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = sql();
    const rows = await db(
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
