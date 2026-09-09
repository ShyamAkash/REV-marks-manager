import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { calcTotal } from "@/lib/calc";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const ROW_HEIGHT = 20;
const COL_RANK = MARGIN;
const COL_NAME = MARGIN + 70;
const COL_TOTAL = PAGE_WIDTH - MARGIN - 90;

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

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.2, 0.2, 0.2);

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    function drawHeader() {
      page.drawText(`Rank Sheet - REV No. ${rev_no}`, {
        x: MARGIN,
        y,
        size: 16,
        font: fontBold,
        color: black,
      });
      y -= 20;
      page.drawText(`Town: ${town === "ALL" ? "All Towns" : town}`, {
        x: MARGIN,
        y,
        size: 11,
        font,
        color: gray,
      });
      y -= 26;

      page.drawText("Rank", { x: COL_RANK, y, size: 11, font: fontBold, color: black });
      page.drawText("Student Name", { x: COL_NAME, y, size: 11, font: fontBold, color: black });
      page.drawText("Total Mark", { x: COL_TOTAL, y, size: 11, font: fontBold, color: black });
      y -= 6;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: black,
      });
      y -= ROW_HEIGHT;
    }

    drawHeader();

    for (const r of ranked) {
      if (y < MARGIN + ROW_HEIGHT) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
        drawHeader();
      }
      page.drawText(String(r.rank), { x: COL_RANK, y, size: 10.5, font, color: black });
      page.drawText(truncate(r.name, 48), {
        x: COL_NAME,
        y,
        size: 10.5,
        font,
        color: black,
      });
      page.drawText(r.total.toFixed(6), {
        x: COL_TOTAL,
        y,
        size: 10.5,
        font,
        color: black,
      });
      y -= ROW_HEIGHT;
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `rank_${rev_no}_${town}.pdf`.replace(/\s+/g, "_");

    return new NextResponse(new Uint8Array(pdfBytes), {
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

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
