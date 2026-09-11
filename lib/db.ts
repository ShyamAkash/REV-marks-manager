import { neon } from "@neondatabase/serverless";
import { normalizeStudentPhone } from "@/lib/phone";

interface InMemoryRev {
  id: number;
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
  created_at: string;
}

interface InMemoryRecord {
  id: number;
  town: string;
  rev_id: number;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff: string | null;
  /** Set only on records replayed from a phone's offline queue. */
  client_temp_id: string | null;
  created_at: string;
  updated_at: string;
}

/** One row per normalised mobile number, mirroring the `students` table. */
interface InMemoryStudent {
  phone_no: string;
  student_name: string;
  town: string;
  created_at: string;
  updated_at: string;
}

const globalStore = globalThis as unknown as {
  __revDbMock?: {
    revs: InMemoryRev[];
    records: InMemoryRecord[];
    students: InMemoryStudent[];
    nextRevId: number;
    nextRecordId: number;
  };
};

/**
 * The same backfill the production migration ran: one student per usable
 * number, latest record wins.
 */
function studentsFromRecords(records: InMemoryRecord[]): InMemoryStudent[] {
  const byPhone = new Map<string, InMemoryStudent>();
  const newestFirst = [...records].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  for (const r of newestFirst) {
    const phone = normalizeStudentPhone(r.phone_no);
    const name = (r.student_name ?? "").trim();
    if (!phone || !name || byPhone.has(phone)) continue;
    byPhone.set(phone, {
      phone_no: phone,
      student_name: name,
      town: r.town,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  }
  return [...byPhone.values()];
}

function getMockStore() {
  if (!globalStore.__revDbMock) {
    const records: InMemoryRecord[] = [
      {
        id: 1,
        town: "Gampaha",
        rev_id: 1,
        student_name: "Kasun Perera",
        phone_no: "0771234567",
        mcq_mark: 42,
        structured_mark: 78,
        essay_mark: 85,
        staff: "Mr. Fernando",
        client_temp_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 2,
        town: "Gampaha",
        rev_id: 1,
        student_name: "Nimmi Jayawardena",
        phone_no: "0719876543",
        mcq_mark: 46,
        structured_mark: 84,
        essay_mark: 91,
        staff: "Mr. Fernando",
        client_temp_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 3,
        town: "Kiribathgoda",
        rev_id: 1,
        student_name: "Dinuka Silva",
        phone_no: "0755554321",
        mcq_mark: 38,
        structured_mark: 65,
        essay_mark: 72,
        staff: "Ms. Silva",
        client_temp_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    globalStore.__revDbMock = {
      revs: [
        { id: 1, rev_no: "REV 01", num_mcq: 50, num_structured: 4, num_essay: 4, created_at: new Date().toISOString() },
        { id: 2, rev_no: "REV 02", num_mcq: 50, num_structured: 4, num_essay: 4, created_at: new Date().toISOString() },
        { id: 3, rev_no: "REV 03", num_mcq: 40, num_structured: 4, num_essay: 3, created_at: new Date().toISOString() },
      ],
      records,
      students: studentsFromRecords(records),
      nextRevId: 4,
      nextRecordId: 4,
    };
  }
  // The store lives on globalThis and survives hot reloads, so a dev server
  // started before the students table existed holds a store without one.
  // Backfill it the way the production migration does rather than crash.
  globalStore.__revDbMock.students ??= studentsFromRecords(
    globalStore.__revDbMock.records
  );
  return globalStore.__revDbMock;
}

async function mockQuery(queryText: string, params: any[] = []): Promise<any[]> {
  const store = getMockStore();
  const text = queryText.replace(/\s+/g, " ").trim();

  // 0. DELETE a REV together with its records. Must come before every
  // rev_numbers branch: its text contains both "FROM rev_numbers" and
  // "WHERE id =", which the single-REV select below would otherwise answer.
  if (text.startsWith("WITH gone AS (DELETE FROM records")) {
    const revId = Number(params[0]);
    const rev = store.revs.find((r) => r.id === revId);
    if (!rev) return [];
    const before = store.records.length;
    store.records = store.records.filter((r) => r.rev_id !== revId);
    store.revs = store.revs.filter((r) => r.id !== revId);
    return [{ id: rev.id, rev_no: rev.rev_no, deleted_records: before - store.records.length }];
  }

  // 0b. Upsert a student - latest name and town win for a number.
  if (text.startsWith("INSERT INTO students")) {
    const [phone_no, student_name, town] = params.map((p) => String(p));
    const now = new Date().toISOString();
    const existing = store.students.find((s) => s.phone_no === phone_no);
    if (existing) {
      existing.student_name = student_name;
      existing.town = town;
      existing.updated_at = now;
    } else {
      store.students.push({ phone_no, student_name, town, created_at: now, updated_at: now });
    }
    return [];
  }

  // 0c. Students for the autocomplete, optionally scoped to one town.
  if (text.includes("FROM students")) {
    // Honour the optional "WHERE town = $1" filter. Without this the mock
    // returns every town's students while real Postgres returns one town's, so
    // the autocomplete would look correct locally and behave differently in
    // production.
    const townFilter = text.includes("WHERE town =") ? String(params[0] ?? "") : "";
    return store.students
      .filter((s) => !townFilter || s.town === townFilter)
      .map((s) => ({ student_name: s.student_name, phone_no: s.phone_no }))
      .sort((a, b) => a.student_name.localeCompare(b.student_name));
  }

  // 1. SELECT single REV by id
  if (text.includes("FROM rev_numbers") && text.includes("WHERE id =")) {
    const revId = Number(params[0]);
    const found = store.revs.filter((r) => r.id === revId);
    return found.map((r) => ({
      id: r.id,
      rev_no: r.rev_no,
      num_mcq: r.num_mcq,
      num_structured: r.num_structured,
      num_essay: r.num_essay,
    }));
  }

  // 2. SELECT all REVs, each with how many records it has
  if (text.includes("FROM rev_numbers")) {
    const sorted = [...store.revs].sort((a, b) => a.rev_no.localeCompare(b.rev_no));
    return sorted.map((r) => ({
      id: r.id,
      rev_no: r.rev_no,
      num_mcq: r.num_mcq,
      num_structured: r.num_structured,
      num_essay: r.num_essay,
      record_count: store.records.filter((rec) => rec.rev_id === r.id).length,
    }));
  }

  // 3. INSERT / UPDATE REV
  if (text.startsWith("INSERT INTO rev_numbers")) {
    const [rev_no, num_mcq, num_structured, num_essay] = params;
    const existingIndex = store.revs.findIndex(
      (r) => r.rev_no.toLowerCase() === String(rev_no).trim().toLowerCase()
    );
    if (existingIndex >= 0) {
      store.revs[existingIndex].num_mcq = Number(num_mcq) || 0;
      store.revs[existingIndex].num_structured = Number(num_structured) || 0;
      store.revs[existingIndex].num_essay = Number(num_essay) || 0;
      const r = store.revs[existingIndex];
      return [{ id: r.id, rev_no: r.rev_no, num_mcq: r.num_mcq, num_structured: r.num_structured, num_essay: r.num_essay }];
    } else {
      const newRev: InMemoryRev = {
        id: store.nextRevId++,
        rev_no: String(rev_no).trim(),
        num_mcq: Number(num_mcq) || 0,
        num_structured: Number(num_structured) || 0,
        num_essay: Number(num_essay) || 0,
        created_at: new Date().toISOString(),
      };
      store.revs.push(newRev);
      return [{ id: newRev.id, rev_no: newRev.rev_no, num_mcq: newRev.num_mcq, num_structured: newRev.num_structured, num_essay: newRev.num_essay }];
    }
  }

  // 3b. Explicit UPDATE rev_numbers by ID
  if (text.startsWith("UPDATE rev_numbers")) {
    const [rev_no, num_mcq, num_structured, num_essay, id] = params;
    const revId = Number(id);
    const rev = store.revs.find((r) => r.id === revId);
    if (!rev) return [];
    rev.rev_no = String(rev_no).trim();
    rev.num_mcq = Number(num_mcq) || 0;
    rev.num_structured = Number(num_structured) || 0;
    rev.num_essay = Number(num_essay) || 0;
    return [{ id: rev.id, rev_no: rev.rev_no, num_mcq: rev.num_mcq, num_structured: rev.num_structured, num_essay: rev.num_essay }];
  }

  // 3c. UPDATE records updated_at on REV change
  if (text.startsWith("UPDATE records SET updated_at")) {
    const revId = Number(params[0]);
    const now = new Date().toISOString();
    store.records.forEach((r) => {
      if (r.rev_id === revId) {
        r.updated_at = now;
      }
    });
    return [];
  }

  // 4. INSERT record
  if (text.startsWith("INSERT INTO records")) {
    const [town, rev_id, student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff, client_temp_id] = params;
    const now = new Date().toISOString();

    // Mirror the unique index and ON CONFLICT DO NOTHING in production. Without
    // this the mock happily stores duplicates, so the idempotency would look
    // broken locally and work only once deployed - or worse, look fine locally
    // and be wrong in a way nobody tested.
    if (client_temp_id) {
      const already = store.records.find(
        (r) => r.client_temp_id === String(client_temp_id)
      );
      if (already) return [];
    }
    const newRec: InMemoryRecord = {
      id: store.nextRecordId++,
      town: String(town),
      rev_id: Number(rev_id),
      student_name: student_name ? String(student_name) : null,
      phone_no: phone_no ? String(phone_no) : null,
      mcq_mark: Number(mcq_mark) || 0,
      structured_mark: Number(structured_mark) || 0,
      essay_mark: Number(essay_mark) || 0,
      staff: staff ? String(staff) : null,
      client_temp_id: client_temp_id ? String(client_temp_id) : null,
      created_at: now,
      updated_at: now,
    };
    store.records.push(newRec);
    return [newRec];
  }

  // 5. UPDATE record
  if (text.startsWith("UPDATE records")) {
    const [student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff, id] = params;
    const recordId = Number(id);
    const rec = store.records.find((r) => r.id === recordId);
    if (!rec) return [];
    rec.student_name = student_name ? String(student_name) : null;
    rec.phone_no = phone_no ? String(phone_no) : null;
    rec.mcq_mark = Number(mcq_mark) || 0;
    rec.structured_mark = Number(structured_mark) || 0;
    rec.essay_mark = Number(essay_mark) || 0;
    if (staff !== null && staff !== undefined) {
      rec.staff = String(staff);
    }
    rec.updated_at = new Date().toISOString();
    return [rec];
  }

  // 6. DELETE record
  if (text.startsWith("DELETE FROM records")) {
    const id = Number(params[0]);
    store.records = store.records.filter((r) => r.id !== id);
    return [];
  }

  // 6c. SELECT a record by its client-generated id, used to answer a replay of
  // something already stored. Without an explicit branch this falls through to
  // the catch-all below, which ignores the WHERE and returns every record - so
  // the API would hand back an unrelated student's row and call it a duplicate.
  if (text.includes("FROM records") && text.includes("client_temp_id = $1")) {
    const wanted = String(params[0] ?? "");
    return store.records.filter((r) => r.client_temp_id === wanted);
  }

  // 7. SELECT records
  if (text.includes("FROM records")) {
    let list = [...store.records];
    if (text.includes("WHERE")) {
      if (text.includes("rev_id = $1 AND town = $2")) {
        list = list.filter((r) => r.rev_id === Number(params[0]) && r.town === String(params[1]));
      } else if (text.includes("town = $1 AND rev_id = $2")) {
        list = list.filter((r) => r.town === String(params[0]) && r.rev_id === Number(params[1]));
        if (text.includes("student_name ILIKE $3 OR phone_no ILIKE $3")) {
          const rawLike = String(params[2] || "").replace(/%/g, "").toLowerCase();
          list = list.filter(
            (r) =>
              (r.student_name && r.student_name.toLowerCase().includes(rawLike)) ||
              (r.phone_no && r.phone_no.toLowerCase().includes(rawLike))
          );
        }
      } else if (text.includes("rev_id = $1")) {
        list = list.filter((r) => r.rev_id === Number(params[0]));
      }
    }
    if (text.includes("ORDER BY updated_at DESC")) {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return list;
  }

  return [];
}

let _sql: ReturnType<typeof neon> | null = null;

type QueryFn = (text: string, params?: any[]) => Promise<any[]>;

export function sql(): QueryFn {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return mockQuery;
  }

  if (!_sql) {
    try {
      _sql = neon(url);
    } catch {
      console.warn("[AI Studio] Neon initialization failed — falling back to mock");
      return mockQuery;
    }
  }

  return async (queryText: string, params?: any[]) => {
    try {
      if (!_sql) return await mockQuery(queryText, params);
      return (await _sql(queryText, params)) as any[];
    } catch (err) {
      console.warn("[AI Studio] Database query failed — falling back to mock query", err);
      return await mockQuery(queryText, params);
    }
  };
}

export { TOWNS } from "./towns";
export type { Town } from "./towns";

