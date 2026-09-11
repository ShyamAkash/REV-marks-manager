import { NextRequest, NextResponse } from "next/server";
import { errorStatus, sql } from "@/lib/db";
import { calcTotal } from "@/lib/calc";
import { findExistingRecord } from "@/lib/duplicates.server";
import { upsertStudent } from "@/lib/students";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const town = searchParams.get("town") || "";
    const revIdParam = searchParams.get("rev_id") || "";
    const search = (searchParams.get("search") || "").trim();
    const sort = searchParams.get("sort") || "modified_desc"; // "modified_desc" | "modified_asc" | "total_desc" | "total_asc" | "modified"
    const orderDirection = sort === "modified_asc" ? "ASC" : "DESC";

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
         ORDER BY updated_at ${orderDirection}`,
        [town, rev_id, like]
      );
    } else {
      rows = await db(
        `SELECT * FROM records
         WHERE town = $1 AND rev_id = $2
         ORDER BY updated_at ${orderDirection}`,
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
      records.sort(
        (a: any, b: any) =>
          b.total - a.total ||
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else if (sort === "total_asc") {
      records.sort(
        (a: any, b: any) =>
          a.total - b.total ||
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else if (sort === "modified_asc") {
      records.sort(
        (a: any, b: any) =>
          new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
    } else {
      // modified_desc or "modified" (newest first)
      records.sort(
        (a: any, b: any) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }

    return NextResponse.json({ records, rev });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
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
    // Set only by replays from the offline queue; a record entered while online
    // has no client id and stays NULL. See idx_records_client_temp_id in schema.sql.
    const client_temp_id = body.client_temp_id
      ? String(body.client_temp_id).trim()
      : null;

    if (!town || !rev_id) {
      return NextResponse.json(
        { error: "Town and REV No. are required." },
        { status: 400 }
      );
    }

    const db = sql();

    // Does this student already have a record in this town + REV? Checked here
    // and not only in the form, because the form's list is loaded once per
    // session and never sees what another marker saved since.
    //
    // A marker saving online is refused with the existing row, and the form
    // asks them to Replace or Keep. Offline replays (client_temp_id set) are
    // never refused: the queue drains in the background with nobody to ask,
    // and a refusal would leave the record retrying forever. They are stored
    // and flagged `duplicate_of`, which the sync message turns into a notice.
    // A replay is excluded from its own comparison, or a record already stored
    // by an earlier attempt would match itself.
    //
    // The question goes to the database as a WHERE clause. This used to read
    // every row in the town + REV and filter them in JS, so a busy REV sent
    // several hundred records across the wire on every single save.
    // findExistingRecord still hands the verdict to findDuplicate, so the rule
    // itself is unchanged.
    const match = await findExistingRecord(db, {
      town,
      rev_id,
      student_name,
      phone_no,
      excludeClientTempId: client_temp_id,
    });
    if (match && !client_temp_id) {
      return NextResponse.json(
        { error: "This student already has a record for this REV.", existing: match.record },
        { status: 409 }
      );
    }
    const flagged = match ? { duplicate_of: match.record.id } : {};

    // DO NOTHING on a repeated client_temp_id: the phone is replaying a record
    // the server already stored but never got to acknowledge, because the tab
    // died between the write landing and the queue being trimmed. NULL ids
    // never collide - Postgres treats NULLs as distinct - so records entered
    // online are unaffected.
    const rows = await db(
      `INSERT INTO records
        (town, rev_id, student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff, client_temp_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (client_temp_id) DO NOTHING
       RETURNING *`,
      [town, rev_id, student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff, client_temp_id]
    );

    if (rows.length === 0 && client_temp_id) {
      // Already stored. Hand back the existing row so the phone drops it from
      // the queue exactly as if this insert had created it - reporting an error
      // here would leave it queued and retrying forever.
      const existing = await db(
        `SELECT * FROM records WHERE client_temp_id = $1`,
        [client_temp_id]
      );
      // `duplicate` means this very record arrived twice; `duplicate_of` means
      // the student already had a different record. Both can be true.
      return NextResponse.json({ record: existing[0] ?? null, duplicate: true, ...flagged });
    }

    // Only on a fresh insert: a replayed record already remembered its student
    // the first time it arrived.
    await upsertStudent(db, { student_name, phone_no, town });

    return NextResponse.json({ record: rows[0], ...flagged });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
  }
}
