import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
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
      phone: r.phone_no ? r.phone_no : "No Phone no. Provided",
      name: r.student_name ? r.student_name : "No Name Provided",
      town: r.town,
      mcq: Number(r.mcq_mark),
      structured: Number(r.structured_mark),
      essay: Number(r.essay_mark),
      total: calcTotal(r, rev),
    }));

    withTotals.sort((a, b) => b.total - a.total);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    sheet.columns = [
      { header: "Staff", key: "staff", width: 16 },
      { header: "Phone No.", key: "phone", width: 18 },
      { header: "Student Name", key: "name", width: 24 },
      { header: "Town", key: "town", width: 14 },
      { header: "MCQ mark", key: "mcq", width: 10 },
      { header: "Structured mark", key: "structured", width: 14 },
      { header: "Essay mark", key: "essay", width: 10 },
      { header: "Total", key: "total", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const r of withTotals) {
      sheet.addRow({
        staff: r.staff,
        phone: r.phone,
        name: r.name,
        town: r.town,
        mcq: r.mcq,
        structured: r.structured,
        essay: r.essay,
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
