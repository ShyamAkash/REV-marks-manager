import { NextRequest, NextResponse } from "next/server";
import { errorStatus, sql } from "@/lib/db";
import { calcTotal } from "@/lib/calc";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone: rawPhone } = await params;
    const phone = decodeURIComponent(rawPhone || "").trim();

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const db = sql();

    // 1. Fetch student info
    const studentRows = await db(
      `SELECT phone_no, student_name, town, created_at, updated_at
       FROM students
       WHERE phone_no = $1`,
      [phone]
    );

    let student = studentRows[0] || null;

    // 2. Fetch REV records
    const rawRecords = await db(
      `SELECT 
         r.id,
         r.town,
         r.rev_id,
         r.student_name,
         r.phone_no,
         r.mcq_mark,
         r.structured_mark,
         r.essay_mark,
         r.staff,
         r.created_at,
         r.updated_at,
         rev.rev_no,
         rev.num_mcq,
         rev.num_structured,
         rev.num_essay
       FROM records r
       JOIN rev_numbers rev ON rev.id = r.rev_id
       WHERE r.phone_no = $1
       ORDER BY rev.rev_no ASC, r.created_at DESC`,
      [phone]
    );

    // Fallback if student not in students table but has records
    if (!student && rawRecords.length > 0) {
      student = {
        phone_no: phone,
        student_name: rawRecords[0].student_name || "Unknown Student",
        town: rawRecords[0].town || "",
        created_at: rawRecords[0].created_at,
        updated_at: rawRecords[0].updated_at,
      };
    }

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const records = rawRecords.map((r: any) => {
      const mcq_mark = Number(r.mcq_mark || 0);
      const structured_mark = Number(r.structured_mark || 0);
      const essay_mark = Number(r.essay_mark || 0);
      const num_mcq = Number(r.num_mcq || 0);
      const num_structured = Number(r.num_structured || 0);
      const num_essay = Number(r.num_essay || 0);

      const total = calcTotal(
        { mcq_mark, structured_mark, essay_mark },
        { num_mcq, num_structured, num_essay }
      );

      return {
        id: Number(r.id),
        town: String(r.town),
        rev_id: Number(r.rev_id),
        student_name: r.student_name ? String(r.student_name) : null,
        phone_no: r.phone_no ? String(r.phone_no) : null,
        mcq_mark,
        structured_mark,
        essay_mark,
        staff: r.staff ? String(r.staff) : null,
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
        rev_no: String(r.rev_no),
        num_mcq,
        num_structured,
        num_essay,
        total,
      };
    });

    const totals = records.map((r: any) => r.total);
    const stats = {
      totalExams: records.length,
      avgScore: totals.length ? totals.reduce((a: number, b: number) => a + b, 0) / totals.length : 0,
      highestScore: totals.length ? Math.max(...totals) : 0,
      lowestScore: totals.length ? Math.min(...totals) : 0,
      latestRev: records.length ? records[records.length - 1].rev_no : null,
    };

    return NextResponse.json({
      student,
      records,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: errorStatus(err) }
    );
  }
}
