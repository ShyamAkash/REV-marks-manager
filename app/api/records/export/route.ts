import { NextRequest, NextResponse } from "next/server";
import { errorStatus, sql } from "@/lib/db";
import { calcTotal } from "@/lib/calc";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const town = searchParams.get("town") || "";
    const revIdParam = searchParams.get("rev_id") || "";

    if (!town || !revIdParam) {
      return NextResponse.json(
        { error: "Town and REV No. are required." },
        { status: 400 }
      );
    }
    const rev_id = Number(revIdParam);

    const db = sql();
    const revRows = await db(
      `SELECT id, rev_no, num_mcq, num_structured, num_essay
       FROM rev_numbers WHERE id = $1`,
      [rev_id]
    );
    const rev = revRows[0] || null;

    const rows = await db(
      `SELECT * FROM records WHERE town = $1 AND rev_id = $2`,
      [town, rev_id]
    );

    const withTotals = rows.map((r: any) => ({
      staff: r.staff || "",
      phone: r.phone_no ? r.phone_no : 0,
      name: r.student_name ? r.student_name : 0,
      town: r.town,
      mcq: Number(r.mcq_mark),
      structured: Number(r.structured_mark),
      essay: Number(r.essay_mark),
      total: calcTotal(r, rev),
    }));

    withTotals.sort((a, b) => a.staff.localeCompare(b.staff));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    // A paper with no structured essays has a Structured column of nothing but
    // zeros, which reads as "everyone scored 0" rather than "this section does
    // not exist". Only include a mark column the REV actually has questions
    // for, matching what the marking form shows.
    //
    // When rev is null the REV row is missing, so the counts are unknown and
    // every column is included rather than silently dropping real marks.
    const hasMcq = !rev || Number(rev.num_mcq) > 0;
    const hasStructured = !rev || Number(rev.num_structured) > 0;
    const hasEssay = !rev || Number(rev.num_essay) > 0;

    sheet.columns = [
      { header: "Staff", key: "staff", width: 16 },
      { header: "Phone No.", key: "phone", width: 18 },
      { header: "Student Name", key: "name", width: 24 },
      { header: "Town", key: "town", width: 14 },
      ...(hasMcq ? [{ header: "MCQ mark", key: "mcq", width: 10 }] : []),
      ...(hasStructured
        ? [{ header: "Structured mark", key: "structured", width: 14 }]
        : []),
      ...(hasEssay ? [{ header: "Essay mark", key: "essay", width: 10 }] : []),
      { header: "Total", key: "total", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const r of withTotals) {
      sheet.addRow({
        staff: r.staff,
        phone: r.phone,
        name: r.name,
        town: r.town,
        ...(hasMcq ? { mcq: r.mcq } : {}),
        ...(hasStructured ? { structured: r.structured } : {}),
        ...(hasEssay ? { essay: r.essay } : {}),
        total: Number(r.total.toFixed(6)),
      });
    }

    const buf = await workbook.xlsx.writeBuffer();
    const filename = `${town}_${rev?.rev_no || rev_id}_marks.xlsx`.replace(/\s+/g, "_");

    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
  }
}
