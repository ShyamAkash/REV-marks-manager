import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = sql();
    // record_count lets the REV screen say how many marks a delete would take
    // with it. Every other caller simply ignores the extra field.
    const rows = await db(
      `SELECT r.id, r.rev_no, r.num_mcq, r.num_structured, r.num_essay,
              COUNT(rec.id)::int AS record_count
       FROM rev_numbers r
       LEFT JOIN records rec ON rec.rev_id = r.id
       GROUP BY r.id
       ORDER BY r.rev_no ASC`
    );
    return NextResponse.json({ revs: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Deletes a REV and every record marked against it, in every town.
 *
 * One statement, so the records and the REV go together or not at all. It
 * works on the existing schema: the foreign key from records.rev_id is
 * NO ACTION, which Postgres checks at the end of the statement - by which
 * point the CTE has already removed the REV's records.
 *
 * The students table is deliberately left alone. It is what keeps the entry
 * form's autocomplete working after the marks are gone.
 */
export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Valid REV ID is required." },
        { status: 400 }
      );
    }

    const db = sql();
    const rows = await db(
      `WITH gone AS (DELETE FROM records WHERE rev_id = $1 RETURNING 1)
       DELETE FROM rev_numbers WHERE id = $1
       RETURNING id, rev_no, (SELECT count(*) FROM gone)::int AS deleted_records`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "REV not found." }, { status: 404 });
    }

    const { rev_no, deleted_records } = rows[0];
    return NextResponse.json({
      rev: { id, rev_no },
      deleted_records: Number(deleted_records) || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rev_no = String(body.rev_no || "").trim();
    const num_mcq = Number(body.num_mcq) || 0;
    const num_structured = Number(body.num_structured) || 0;
    const num_essay = Number(body.num_essay) || 0;

    if (!rev_no) {
      return NextResponse.json(
        { error: "REV No. is required." },
        { status: 400 }
      );
    }

    const db = sql();
    const rows = await db(
      `INSERT INTO rev_numbers (rev_no, num_mcq, num_structured, num_essay)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (rev_no)
       DO UPDATE SET num_mcq = $2, num_structured = $3, num_essay = $4
       RETURNING id, rev_no, num_mcq, num_structured, num_essay`,
      [rev_no, num_mcq, num_structured, num_essay]
    );
    return NextResponse.json({ rev: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    const rev_no = String(body.rev_no || "").trim();
    const num_mcq = Number(body.num_mcq) || 0;
    const num_structured = Number(body.num_structured) || 0;
    const num_essay = Number(body.num_essay) || 0;

    if (!id || !rev_no) {
      return NextResponse.json(
        { error: "Valid REV ID and REV No. are required." },
        { status: 400 }
      );
    }

    const db = sql();
    const rows = await db(
      `UPDATE rev_numbers
       SET rev_no = $1, num_mcq = $2, num_structured = $3, num_essay = $4
       WHERE id = $5
       RETURNING id, rev_no, num_mcq, num_structured, num_essay`,
      [rev_no, num_mcq, num_structured, num_essay, id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "REV not found." }, { status: 404 });
    }

    // Touch records updated_at so that pollers/clients detect changes
    await db(`UPDATE records SET updated_at = now() WHERE rev_id = $1`, [id]);

    return NextResponse.json({ rev: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
