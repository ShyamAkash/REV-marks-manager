import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { calcTotal } from "@/lib/calc";
import { upsertStudent } from "@/lib/students";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const town = searchParams.get("town") || "";
    const revIdParam = searchParams.get("rev_id") || "";
    const search = (searchParams.get("search") || "").trim();
    const sort = searchParams.get("sort") || "modified"; // "modified" | "total_asc" | "total_desc"

    if (!town || !revIdParam) {
      return NextResponse.json({ records: [], rev: null });
    }
    const rev_id = Number(revIdParam);

    const db = sql();

    const revRows = await db(
      `SELECT id, rev_no, num_mcq, num_structured, num_essay
       FROM rev_numbers WHERE id = $1`,
      [rev_id]
    );
    const rev = revRows[0] || null;

    let rows;
    if (search) {
      const like = `%${search}%`;
      rows = await db(
        `SELECT * FROM records
         WHERE town = $1 AND rev_id = $2
           AND (student_name ILIKE $3 OR phone_no ILIKE $3)
         ORDER BY updated_at DESC`,
        [town, rev_id, like]
      );
    } else {
      rows = await db(
        `SELECT * FROM records
         WHERE town = $1 AND rev_id = $2
         ORDER BY updated_at DESC`,
        [town, rev_id]
      );
    }

    let records = rows.map((r: any) => ({
      ...r,
      mcq_mark: Number(r.mcq_mark),
      structured_mark: Number(r.structured_mark),
      essay_mark: Number(r.essay_mark),
      total: calcTotal(r, rev),
    }));

    if (sort === "total_desc") {
      records.sort((a: any, b: any) => b.total - a.total);
    } else if (sort === "total_asc") {
      records.sort((a: any, b: any) => a.total - b.total);
    }

    return NextResponse.json({ records, rev });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const town = String(body.town || "").trim();
    const rev_id = Number(body.rev_id);
    const staff = String(body.staff || "").trim();
    const student_name = body.student_name ? String(body.student_name).trim() : null;
    const phone_no = body.phone_no ? String(body.phone_no).trim() : null;
    const mcq_mark = Number(body.mcq_mark) || 0;
    const structured_mark = Number(body.structured_mark) || 0;
    const essay_mark = Number(body.essay_mark) || 0;
    // Set only by replays from the offline queue; a record entered while online
    // has no client id and stays NULL. See idx_records_client_temp_id in schema.sql.
    const client_temp_id = body.client_temp_id
      ? String(body.client_temp_id).trim()
      : null;

    if (!town || !rev_id) {
      return NextResponse.json(
        { error: "Town and REV No. are required." },
        { status: 400 }
      );
    }

    const db = sql();
    // DO NOTHING on a repeated client_temp_id: the phone is replaying a record
    // the server already stored but never got to acknowledge, because the tab
    // died between the write landing and the queue being trimmed. NULL ids
    // never collide - Postgres treats NULLs as distinct - so records entered
    // online are unaffected.
    const rows = await db(
      `INSERT INTO records
        (town, rev_id, student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff, client_temp_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (client_temp_id) DO NOTHING
       RETURNING *`,
      [town, rev_id, student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff, client_temp_id]
    );

    if (rows.length === 0 && client_temp_id) {
      // Already stored. Hand back the existing row so the phone drops it from
      // the queue exactly as if this insert had created it - reporting an error
      // here would leave it queued and retrying forever.
      const existing = await db(
        `SELECT * FROM records WHERE client_temp_id = $1`,
        [client_temp_id]
      );
      return NextResponse.json({ record: existing[0] ?? null, duplicate: true });
    }

    // Only on a fresh insert: a replayed record already remembered its student
    // the first time it arrived.
    await upsertStudent(db, { student_name, phone_no, town });

    return NextResponse.json({ record: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
