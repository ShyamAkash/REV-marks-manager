import { NextRequest, NextResponse } from "next/server";
import { errorStatus, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const town = (searchParams.get("town") || "").trim();
    const search = (searchParams.get("search") || "").trim();

    const db = sql();
    const searchPattern = search ? `%${search}%` : null;

    const rows = await db(
      `SELECT 
         s.phone_no,
         s.student_name,
         s.town,
         s.created_at,
         s.updated_at,
         COUNT(r.id)::int AS records_count,
         AVG(
           CASE 
             WHEN (rev.num_mcq + rev.num_structured * 5 + rev.num_essay * 7.5) > 0 THEN
               ((r.mcq_mark + r.structured_mark + r.essay_mark) / 
                (rev.num_mcq + rev.num_structured * 5 + rev.num_essay * 7.5)) * 100
             ELSE 0 
           END
         )::float AS avg_score,
         (
           SELECT rev2.rev_no 
           FROM records r2 
           JOIN rev_numbers rev2 ON rev2.id = r2.rev_id 
           WHERE r2.phone_no = s.phone_no 
           ORDER BY r2.updated_at DESC, r2.id DESC 
           LIMIT 1
         ) AS latest_rev
       FROM students s
       LEFT JOIN records r ON r.phone_no = s.phone_no
       LEFT JOIN rev_numbers rev ON rev.id = r.rev_id
       WHERE ($1::text IS NULL OR $1::text = '' OR s.town = $1)
         AND ($2::text IS NULL OR $2::text = '' OR s.student_name ILIKE $2 OR s.phone_no ILIKE $2)
       GROUP BY s.phone_no, s.student_name, s.town, s.created_at, s.updated_at
       ORDER BY s.student_name ASC`,
      [town || null, searchPattern]
    );

    return NextResponse.json({ students: rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, students: [] },
      { status: errorStatus(err) }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const student_name = String(body.student_name || "").trim();
    const phone_no = String(body.phone_no || "").trim();
    const town = String(body.town || "").trim();

    if (!student_name) {
      return NextResponse.json(
        { error: "Student name is required" },
        { status: 400 }
      );
    }
    if (!phone_no) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }
    if (!town) {
      return NextResponse.json(
        { error: "Assigned town is required" },
        { status: 400 }
      );
    }

    const db = sql();

    // Check if phone number already exists
    const existing = await db(
      `SELECT phone_no FROM students WHERE phone_no = $1`,
      [phone_no]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `A student with phone number "${phone_no}" already exists.` },
        { status: 409 }
      );
    }

    const inserted = await db(
      `INSERT INTO students (phone_no, student_name, town, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING phone_no, student_name, town, created_at, updated_at`,
      [phone_no, student_name, town]
    );

    const student = inserted[0] || {
      phone_no,
      student_name,
      town,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, student }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: errorStatus(err) }
    );
  }
}

