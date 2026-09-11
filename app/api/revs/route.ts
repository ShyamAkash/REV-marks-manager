import { NextRequest, NextResponse } from "next/server";
import { errorStatus, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = sql();
    // record_count lets the REV screen say how many marks a delete would take
    // with it. Every other caller simply ignores the extra field.
    //
    // updated_at is the REV's own change stamp - see PUT below. A client that
    // wants to know whether question counts moved under it watches this, not
    // the records.
    const rows = await db(
      `SELECT r.id, r.rev_no, r.num_mcq, r.num_structured, r.num_essay, r.updated_at,
              COUNT(rec.id)::int AS record_count
       FROM rev_numbers r
       LEFT JOIN records rec ON rec.rev_id = r.id
       GROUP BY r.id
       ORDER BY r.rev_no ASC`
    );
    return NextResponse.json({ revs: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
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
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
  }
}

/**
 * Creates a REV. Refuses one that already exists.
 *
 * This used to be ON CONFLICT (rev_no) DO UPDATE, which turned the "Add a REV"
 * form into a silent reconfigure: retyping a REV that already had marks
 * against it rewrote its question counts, and because totals are derived from
 * those counts (lib/calc.ts), every student's percentage for that REV changed
 * with no warning and no way to tell it had happened. Changing a live REV is a
 * deliberate act, so it belongs to PUT and the edit sheet that warns about it.
 */
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
       ON CONFLICT (rev_no) DO NOTHING
       RETURNING id, rev_no, num_mcq, num_structured, num_essay, updated_at`,
      [rev_no, num_mcq, num_structured, num_essay]
    );

    if (!rows.length) {
      const existing = await db(
        `SELECT id, rev_no, num_mcq, num_structured, num_essay, updated_at
         FROM rev_numbers WHERE rev_no = $1`,
        [rev_no]
      );
      return NextResponse.json(
        {
          error: `${rev_no} already exists. Edit it from the list below to change its question counts.`,
          existing: existing[0] ?? null,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ rev: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
  }
}

/**
 * Edits a REV's name and question counts.
 *
 * Only rev_numbers.updated_at moves. This used to finish with
 * `UPDATE records SET updated_at = now() WHERE rev_id = $1` so that polling
 * clients would notice the change - but records.updated_at is also the default
 * sort key for the records list (modified_desc), so fixing a typo in a question
 * count flattened every record for that REV to the same instant and destroyed
 * the real order of entry for good. Change detection now has a column of its
 * own, returned by GET above, and the marks keep their own history.
 */
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

    // rev_no is UNIQUE, so renaming onto another REV would surface as a raw
    // Postgres constraint message. Say what happened instead.
    const clash = await db(
      `SELECT id FROM rev_numbers WHERE rev_no = $1 AND id <> $2`,
      [rev_no, id]
    );
    if (clash.length) {
      return NextResponse.json(
        { error: `Another REV is already called ${rev_no}.` },
        { status: 409 }
      );
    }

    const rows = await db(
      `UPDATE rev_numbers
       SET rev_no = $1, num_mcq = $2, num_structured = $3, num_essay = $4,
           updated_at = now()
       WHERE id = $5
       RETURNING id, rev_no, num_mcq, num_structured, num_essay, updated_at`,
      [rev_no, num_mcq, num_structured, num_essay, id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "REV not found." }, { status: 404 });
    }

    return NextResponse.json({ rev: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
  }
}
