import { neon } from "@neondatabase/serverless";

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
  created_at: string;
  updated_at: string;
}

const globalStore = globalThis as unknown as {
  __revDbMock?: {
    revs: InMemoryRev[];
    records: InMemoryRecord[];
    nextRevId: number;
    nextRecordId: number;
  };
};

function getMockStore() {
  if (!globalStore.__revDbMock) {
    globalStore.__revDbMock = {
      revs: [
        { id: 1, rev_no: "REV 01", num_mcq: 50, num_structured: 4, num_essay: 4, created_at: new Date().toISOString() },
        { id: 2, rev_no: "REV 02", num_mcq: 50, num_structured: 4, num_essay: 4, created_at: new Date().toISOString() },
        { id: 3, rev_no: "REV 03", num_mcq: 40, num_structured: 4, num_essay: 3, created_at: new Date().toISOString() },
      ],
      records: [
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      nextRevId: 4,
      nextRecordId: 4,
    };
  }
  return globalStore.__revDbMock;
}

async function mockQuery(queryText: string, params: any[] = []): Promise<any[]> {
  const store = getMockStore();
  const text = queryText.replace(/\s+/g, " ").trim();

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

  // 2. SELECT all REVs
  if (text.includes("FROM rev_numbers")) {
    const sorted = [...store.revs].sort((a, b) => a.rev_no.localeCompare(b.rev_no));
    return sorted.map((r) => ({
      id: r.id,
      rev_no: r.rev_no,
      num_mcq: r.num_mcq,
      num_structured: r.num_structured,
      num_essay: r.num_essay,
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
    const [town, rev_id, student_name, phone_no, mcq_mark, structured_mark, essay_mark, staff] = params;
    const now = new Date().toISOString();
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

