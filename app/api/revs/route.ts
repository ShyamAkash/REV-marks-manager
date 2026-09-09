import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = sql();
    const rows = await db(
      `SELECT id, rev_no, num_mcq, num_structured, num_essay
       FROM rev_numbers
       ORDER BY rev_no ASC`
    );
    return NextResponse.json({ revs: rows });
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
