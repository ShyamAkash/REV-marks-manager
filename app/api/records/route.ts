import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { calcTotal } from "@/lib/calc";

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

    if (!town || !rev_id) {
      return NextResponse.json(
        { error: "Town and REV No. are required." },
        { status: 400 }
      );
    }

    const db = sql();
    const rows = await db(
      `INSERT INTO records
        (town, rev_id, student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [town, rev_id, student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff]
    );
    return NextResponse.json({ record: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
