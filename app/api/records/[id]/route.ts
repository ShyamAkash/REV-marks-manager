import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
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
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
