import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { calcTotal } from "@/lib/calc";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const town = searchParams.get("town") || ""; // "ALL" or a specific town
    const rev_no = searchParams.get("rev_no") || "";

    if (!town || !rev_no) {
      return NextResponse.json(
        { error: "Town and REV No. are required." },
        { status: 400 }
      );
    }

    const db = sql();
    const revRows = await db(
      `SELECT rev_no, num_mcq, num_structured, num_essay
       FROM rev_numbers WHERE rev_no = $1`,
      [rev_no]
    );
    const rev = revRows[0] || null;

    const rows =
      town === "ALL"
        ? await db(`SELECT * FROM records WHERE rev_no = $1`, [rev_no])
        : await db(`SELECT * FROM records WHERE rev_no = $1 AND town = $2`, [
            rev_no,
            town,
          ]);

    const ranked = rows
      .map((r: any) => ({
        name: r.student_name ? r.student_name : "No Name Provided",
        total: calcTotal(r, rev),
      }))
      .sort((a: any, b: any) => b.total - a.total)
      .map((r: any, i: number) => ({ rank: i + 1, ...r }));

    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#000000")
        .text(`Rank Sheet - REV No. ${rev_no}`, { align: "left" });
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#333333")
        .text(`Town: ${town === "ALL" ? "All Towns" : town}`, {
          align: "left",
        });
      doc.moveDown(1);

      const colRank = 40;
      const colName = 110;
      const colTotal = 430;
      const rowHeight = 22;
      let y = doc.y;

      doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000");
      doc.text("Rank", colRank, y);
      doc.text("Student Name", colName, y);
      doc.text("Total Mark", colTotal, y);
      y += rowHeight;
      doc
        .moveTo(40, y - 6)
        .lineTo(555, y - 6)
        .strokeColor("#000000")
        .lineWidth(0.5)
        .stroke();

      doc.font("Helvetica").fontSize(10.5);
      for (const r of ranked) {
        if (y > 780) {
          doc.addPage();
          y = 40;
        }
        doc.fillColor("#000000");
        doc.text(String(r.rank), colRank, y);
        doc.text(r.name, colName, y, { width: 300 });
        doc.text(r.total.toFixed(6), colTotal, y);
        y += rowHeight;
      }

      doc.end();
    });

    const filename = `rank_${rev_no}_${town}.pdf`.replace(/\s+/g, "_");

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
