import { NextRequest, NextResponse } from "next/server";
import { errorStatus, sql } from "@/lib/db";
import { findExistingRecord } from "@/lib/duplicates.server";
import { upsertStudent } from "@/lib/students";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    const body = await req.json();
    const student_name = body.student_name ? String(body.student_name).trim() : null;
    const phone_no = body.phone_no ? String(body.phone_no).trim() : null;
    const mcq_mark = Number(body.mcq_mark) || 0;
    const structured_mark = Number(body.structured_mark) || 0;
    const essay_mark = Number(body.essay_mark) || 0;
    const staff = body.staff !== undefined ? String(body.staff).trim() : undefined;

    const db = sql();

    // Which town and REV this record sits in - needed to apply the duplicate
    // rule, and neither is editable here. Read first so a missing record is a
    // 404 rather than an update that quietly matches nothing.
    const currentRows = await db(
      `SELECT id, town, rev_id FROM records WHERE id = $1`,
      [id]
    );
    const current = currentRows[0];
    if (!current) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    // One record per student per town + REV, the same rule POST enforces.
    // Without this, editing a record to carry another student's mobile number
    // went straight through and left the pair to be found by hand later.
    // The record being edited is excluded, or every save would collide with
    // itself; a match therefore means a genuinely different student's row.
    const clash = await findExistingRecord(db, {
      town: current.town,
      rev_id: Number(current.rev_id),
      student_name,
      phone_no,
      excludeId: id,
    });
    if (clash) {
      return NextResponse.json(
        {
          error:
            "Another record for this student already exists in this town and REV.",
          existing: clash.record,
        },
        { status: 409 }
      );
    }

    const rows = await db(
      `UPDATE records
       SET student_name = $1,
           phone_no = $2,
           mcq_mark = $3,
           structured_mark = $4,
           essay_mark = $5,
           staff = COALESCE($6, staff),
           updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff ?? null, id]
    );

    if (!rows[0]) {
      // Deleted between the read above and this update.
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    // A correction made in Manage or the session sheet should reach the
    // autocomplete too. The town comes from the stored row - this handler
    // never changes it.
    await upsertStudent(db, {
      student_name: rows[0].student_name,
      phone_no: rows[0].phone_no,
      town: rows[0].town,
    });

    return NextResponse.json({ record: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    const db = sql();
    await db(`DELETE FROM records WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
  }
}
