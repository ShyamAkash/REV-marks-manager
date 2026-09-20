import { neon } from "@neondatabase/serverless";

export class DatabaseOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseOfflineError";
  }
}

export function errorStatus(err: unknown): number {
  return err instanceof DatabaseOfflineError ? 503 : 500;
}

let _sql: ReturnType<typeof neon> | null = null;
let _sqlUrl: string | null = null;

type QueryFn = (text: string, params?: any[]) => Promise<any[]>;

interface RevNumber {
  id: number;
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
  created_at: string;
  updated_at: string;
}

interface RecordRow {
  id: number;
  town: string;
  rev_id: number;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff: string | null;
  client_temp_id: string | null;
  created_at: string;
  updated_at: string;
}

interface StudentRow {
  phone_no: string;
  student_name: string;
  town: string;
  created_at: string;
  updated_at: string;
}

interface MockStore {
  revNumbers: RevNumber[];
  records: RecordRow[];
  students: StudentRow[];
  nextRevId: number;
  nextRecordId: number;
}

const GLOBAL_MOCK_KEY = "__revmarks_mock_db";

function getMockStore(): MockStore {
  const g = globalThis as unknown as { [GLOBAL_MOCK_KEY]?: MockStore };
  if (!g[GLOBAL_MOCK_KEY]) {
    const now = new Date().toISOString();
    g[GLOBAL_MOCK_KEY] = {
      revNumbers: [
        {
          id: 1,
          rev_no: "REV 01",
          num_mcq: 20,
          num_structured: 4,
          num_essay: 2,
          created_at: now,
          updated_at: now,
        },
        {
          id: 2,
          rev_no: "REV 02",
          num_mcq: 25,
          num_structured: 4,
          num_essay: 4,
          created_at: now,
          updated_at: now,
        },
      ],
      records: [
        {
          id: 1,
          town: "Kandy",
          rev_id: 1,
          student_name: "Kamal Perera",
          phone_no: "0771234567",
          mcq_mark: 18,
          structured_mark: 16,
          essay_mark: 12,
          staff: "Staff A",
          client_temp_id: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 2,
          town: "Kandy",
          rev_id: 2,
          student_name: "Kamal Perera",
          phone_no: "0771234567",
          mcq_mark: 22,
          structured_mark: 18,
          essay_mark: 24,
          staff: "Staff A",
          client_temp_id: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 3,
          town: "Gampaha",
          rev_id: 1,
          student_name: "Nimal Silva",
          phone_no: "0719876543",
          mcq_mark: 15,
          structured_mark: 14,
          essay_mark: 10,
          staff: "Staff B",
          client_temp_id: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 4,
          town: "Gampaha",
          rev_id: 2,
          student_name: "Nimal Silva",
          phone_no: "0719876543",
          mcq_mark: 20,
          structured_mark: 15,
          essay_mark: 20,
          staff: "Staff B",
          client_temp_id: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 5,
          town: "Kurunegala",
          rev_id: 1,
          student_name: "Dinuka Fernando",
          phone_no: "0783344556",
          mcq_mark: 19,
          structured_mark: 17,
          essay_mark: 13,
          staff: "Staff C",
          client_temp_id: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 6,
          town: "Nugegoda",
          rev_id: 1,
          student_name: "Sanduni Jayasinghe",
          phone_no: "0765544332",
          mcq_mark: 17,
          structured_mark: 16,
          essay_mark: 14,
          staff: "Staff A",
          client_temp_id: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 7,
          town: "Nugegoda",
          rev_id: 2,
          student_name: "Sanduni Jayasinghe",
          phone_no: "0765544332",
          mcq_mark: 24,
          structured_mark: 19,
          essay_mark: 27,
          staff: "Staff A",
          client_temp_id: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 8,
          town: "Kiribathgoda",
          rev_id: 1,
          student_name: "Tharindu Wickramasinghe",
          phone_no: "0701122334",
          mcq_mark: 16,
          structured_mark: 15,
          essay_mark: 11,
          staff: "Staff B",
          client_temp_id: null,
          created_at: now,
          updated_at: now,
        },
      ],
      students: [
        {
          phone_no: "0771234567",
          student_name: "Kamal Perera",
          town: "Kandy",
          created_at: now,
          updated_at: now,
        },
        {
          phone_no: "0719876543",
          student_name: "Nimal Silva",
          town: "Gampaha",
          created_at: now,
          updated_at: now,
        },
        {
          phone_no: "0783344556",
          student_name: "Dinuka Fernando",
          town: "Kurunegala",
          created_at: now,
          updated_at: now,
        },
        {
          phone_no: "0765544332",
          student_name: "Sanduni Jayasinghe",
          town: "Nugegoda",
          created_at: now,
          updated_at: now,
        },
        {
          phone_no: "0701122334",
          student_name: "Tharindu Wickramasinghe",
          town: "Kiribathgoda",
          created_at: now,
          updated_at: now,
        },
        {
          phone_no: "0759988776",
          student_name: "Oshadi Mendis",
          town: "Kandy",
          created_at: now,
          updated_at: now,
        },
        {
          phone_no: "0724455667",
          student_name: "Kasun Bandara",
          town: "Kurunegala",
          created_at: now,
          updated_at: now,
        },
      ],
      nextRevId: 3,
      nextRecordId: 9,
    };
  }
  return g[GLOBAL_MOCK_KEY]!;
}

async function executeMockQuery(queryText: string, params: any[] = []): Promise<any[]> {
  const store = getMockStore();
  const normalized = queryText.replace(/\s+/g, " ").trim();

  // 1. DELETE REV and associated records
  if (normalized.startsWith("WITH gone AS (DELETE FROM records WHERE rev_id = $1 RETURNING 1)")) {
    const revId = Number(params[0]);
    const prevRecordCount = store.records.length;
    store.records = store.records.filter((r) => r.rev_id !== revId);
    const deletedRecords = prevRecordCount - store.records.length;
    const revIndex = store.revNumbers.findIndex((r) => r.id === revId);
    if (revIndex === -1) return [];
    const rev = store.revNumbers[revIndex];
    store.revNumbers.splice(revIndex, 1);
    return [{ id: revId, rev_no: rev.rev_no, deleted_records: deletedRecords }];
  }

  // 2. GET all REVs with record counts
  if (normalized.includes("FROM rev_numbers r") && normalized.includes("LEFT JOIN records rec")) {
    return store.revNumbers.map((r) => {
      const count = store.records.filter((rec) => rec.rev_id === r.id).length;
      return {
        id: r.id,
        rev_no: r.rev_no,
        num_mcq: r.num_mcq,
        num_structured: r.num_structured,
        num_essay: r.num_essay,
        updated_at: r.updated_at,
        record_count: count,
      };
    });
  }

  // 3. INSERT INTO rev_numbers
  if (normalized.startsWith("INSERT INTO rev_numbers")) {
    const rev_no = String(params[0] || "").trim();
    const num_mcq = Number(params[1]) || 0;
    const num_structured = Number(params[2]) || 0;
    const num_essay = Number(params[3]) || 0;

    const exists = store.revNumbers.some((r) => r.rev_no.toLowerCase() === rev_no.toLowerCase());
    if (exists) {
      return [];
    }

    const now = new Date().toISOString();
    const newRev: RevNumber = {
      id: store.nextRevId++,
      rev_no,
      num_mcq,
      num_structured,
      num_essay,
      created_at: now,
      updated_at: now,
    };
    store.revNumbers.push(newRev);
    return [newRev];
  }

  // 4. Check REV name clash for PUT (SELECT id FROM rev_numbers WHERE rev_no = $1 AND id <> $2)
  if (normalized.includes("FROM rev_numbers WHERE rev_no = $1 AND id <> $2")) {
    const rev_no = String(params[0] || "").trim().toLowerCase();
    const id = Number(params[1]);
    const clash = store.revNumbers.filter(
      (r) => r.rev_no.toLowerCase() === rev_no && r.id !== id
    );
    return clash;
  }

  // 5. Select REV by rev_no
  if (normalized.includes("FROM rev_numbers WHERE rev_no = $1")) {
    const rev_no = String(params[0] || "").trim().toLowerCase();
    return store.revNumbers.filter((r) => r.rev_no.toLowerCase() === rev_no);
  }

  // 6. UPDATE rev_numbers
  if (normalized.startsWith("UPDATE rev_numbers")) {
    const rev_no = String(params[0] || "").trim();
    const num_mcq = Number(params[1]) || 0;
    const num_structured = Number(params[2]) || 0;
    const num_essay = Number(params[3]) || 0;
    const id = Number(params[4]);

    const rev = store.revNumbers.find((r) => r.id === id);
    if (!rev) return [];
    rev.rev_no = rev_no;
    rev.num_mcq = num_mcq;
    rev.num_structured = num_structured;
    rev.num_essay = num_essay;
    rev.updated_at = new Date().toISOString();
    return [rev];
  }

  // 7. Select REV by id
  if (normalized.includes("FROM rev_numbers WHERE id = $1")) {
    const id = Number(params[0]);
    return store.revNumbers.filter((r) => r.id === id);
  }

  // 8. Find existing record for duplicate check
  if (normalized.includes("FROM records") && (normalized.includes("idx_records_search") || normalized.includes("WHERE town = $1 AND rev_id = $2 AND id <> $3::int"))) {
    const town = String(params[0] || "");
    const rev_id = Number(params[1]);
    const excludeId = Number(params[2]) || 0;
    const excludeClientTempId = params[3] ? String(params[3]) : null;
    const phoneSuffix = params[4] ? String(params[4]) : "";
    const nameKey = params[5] ? String(params[5]).toLowerCase() : "";

    const rows = store.records.filter((r) => {
      if (r.town !== town || r.rev_id !== rev_id) return false;
      if (excludeId > 0 && r.id === excludeId) return false;
      if (excludeClientTempId && r.client_temp_id === excludeClientTempId) return false;

      const rDigits = (r.phone_no || "").replace(/[^0-9]/g, "");
      const phoneMatch = phoneSuffix && rDigits.endsWith(phoneSuffix);
      const nameMatch = nameKey && (r.student_name || "").trim().toLowerCase() === nameKey;
      return Boolean(phoneMatch || nameMatch);
    });

    return rows.slice(0, 50);
  }

  // 9. INSERT INTO records
  if (normalized.startsWith("INSERT INTO records")) {
    const town = String(params[0] || "");
    const rev_id = Number(params[1]);
    const student_name = params[2] ? String(params[2]) : null;
    const phone_no = params[3] ? String(params[3]) : null;
    const mcq_mark = Number(params[4]) || 0;
    const structured_mark = Number(params[5]) || 0;
    const essay_mark = Number(params[6]) || 0;
    const staff = params[7] ? String(params[7]) : null;
    const client_temp_id = params[8] ? String(params[8]) : null;

    if (client_temp_id && store.records.some((r) => r.client_temp_id === client_temp_id)) {
      return [];
    }

    const now = new Date().toISOString();
    const newRecord: RecordRow = {
      id: store.nextRecordId++,
      town,
      rev_id,
      student_name,
      phone_no,
      mcq_mark,
      structured_mark,
      essay_mark,
      staff,
      client_temp_id,
      created_at: now,
      updated_at: now,
    };
    store.records.push(newRecord);
    return [newRecord];
  }

  // 10. Select record by client_temp_id
  if (normalized.includes("FROM records WHERE client_temp_id = $1")) {
    const client_temp_id = String(params[0] || "");
    return store.records.filter((r) => r.client_temp_id === client_temp_id);
  }

  // 11. Select record by id (id, town, rev_id)
  if (normalized.includes("FROM records WHERE id = $1")) {
    const id = Number(params[0]);
    return store.records.filter((r) => r.id === id);
  }

  // 12. UPDATE records
  if (normalized.startsWith("UPDATE records")) {
    const student_name = params[0] !== undefined ? (params[0] ? String(params[0]) : null) : undefined;
    const phone_no = params[1] !== undefined ? (params[1] ? String(params[1]) : null) : undefined;
    const mcq_mark = Number(params[2]) || 0;
    const structured_mark = Number(params[3]) || 0;
    const essay_mark = Number(params[4]) || 0;
    const staff = params[5] ? String(params[5]) : undefined;
    const id = Number(params[6]);

    const rec = store.records.find((r) => r.id === id);
    if (!rec) return [];
    if (student_name !== undefined) rec.student_name = student_name;
    if (phone_no !== undefined) rec.phone_no = phone_no;
    rec.mcq_mark = mcq_mark;
    rec.structured_mark = structured_mark;
    rec.essay_mark = essay_mark;
    if (staff !== undefined && staff !== null) rec.staff = staff;
    rec.updated_at = new Date().toISOString();
    return [rec];
  }

  // 13. DELETE FROM records WHERE id = $1
  if (normalized.startsWith("DELETE FROM records WHERE id = $1")) {
    const id = Number(params[0]);
    store.records = store.records.filter((r) => r.id !== id);
    return [];
  }

  // 14. GET records for town + rev_id (with optional search)
  if (normalized.includes("FROM records WHERE town = $1 AND rev_id = $2")) {
    const town = String(params[0] || "");
    const rev_id = Number(params[1]);
    const likeParam = params[2] ? String(params[2]).replace(/%/g, "").toLowerCase() : null;

    let rows = store.records.filter((r) => r.town === town && r.rev_id === rev_id);
    if (likeParam) {
      rows = rows.filter(
        (r) =>
          (r.student_name && r.student_name.toLowerCase().includes(likeParam)) ||
          (r.phone_no && r.phone_no.toLowerCase().includes(likeParam))
      );
    }
    return rows;
  }

  // 15. GET records for rev_id and town (rank sheet or export)
  if (normalized.includes("FROM records WHERE rev_id = $1 AND town = $2")) {
    const rev_id = Number(params[0]);
    const town = String(params[1]);
    return store.records.filter((r) => r.rev_id === rev_id && r.town === town);
  }
  if (normalized.includes("FROM records WHERE rev_id = $1")) {
    const rev_id = Number(params[0]);
    return store.records.filter((r) => r.rev_id === rev_id);
  }

  // 16. Student records with REV joined for detailed view
  if (
    normalized.includes("FROM records r") &&
    normalized.includes("JOIN rev_numbers") &&
    normalized.includes("r.phone_no = $1")
  ) {
    const phone = String(params[0] || "");
    const rows = store.records
      .filter((r) => r.phone_no === phone)
      .map((r) => {
        const rev = store.revNumbers.find((rv) => rv.id === r.rev_id);
        return {
          id: r.id,
          town: r.town,
          rev_id: r.rev_id,
          student_name: r.student_name,
          phone_no: r.phone_no,
          mcq_mark: r.mcq_mark,
          structured_mark: r.structured_mark,
          essay_mark: r.essay_mark,
          staff: r.staff,
          created_at: r.created_at,
          updated_at: r.updated_at,
          rev_no: rev ? rev.rev_no : "REV",
          num_mcq: rev ? rev.num_mcq : 0,
          num_structured: rev ? rev.num_structured : 0,
          num_essay: rev ? rev.num_essay : 0,
        };
      })
      .sort((a, b) => a.rev_no.localeCompare(b.rev_no));
    return rows;
  }

  // 17. Single student by phone
  if (normalized.includes("FROM students WHERE phone_no = $1")) {
    const phone = String(params[0] || "");
    return store.students.filter((s) => s.phone_no === phone);
  }

  // 18. Students directory list (with counts, avg score, town/search filter)
  if (
    normalized.includes("FROM students s") ||
    (normalized.includes("FROM students") && normalized.includes("records_count"))
  ) {
    let students = [...store.students];
    const townParam = params[0] ? String(params[0]).trim() : "";
    const rawSearch = params[1] ? String(params[1]).trim() : (params[2] ? String(params[2]).trim() : "");
    const searchParam = rawSearch.replace(/%/g, "").toLowerCase();

    if (townParam && townParam !== "ALL") {
      students = students.filter((s) => s.town.toLowerCase() === townParam.toLowerCase());
    }
    if (searchParam) {
      students = students.filter(
        (s) =>
          s.student_name.toLowerCase().includes(searchParam) ||
          s.phone_no.toLowerCase().includes(searchParam)
      );
    }

    return students
      .map((s) => {
        const studentRecs = store.records.filter((r) => r.phone_no === s.phone_no);
        let totalPctSum = 0;
        let recsWithScore = 0;
        let latestRevNo: string | null = null;
        let latestRecordTime = 0;

        for (const r of studentRecs) {
          const rev = store.revNumbers.find((rv) => rv.id === r.rev_id);
          if (rev) {
            const denom =
              Number(rev.num_mcq || 0) +
              Number(rev.num_structured || 0) * 5 +
              Number(rev.num_essay || 0) * 7.5;
            if (denom > 0) {
              const numer =
                Number(r.mcq_mark || 0) +
                Number(r.structured_mark || 0) +
                Number(r.essay_mark || 0);
              totalPctSum += (numer / denom) * 100;
              recsWithScore++;
            }
          }
          const t = new Date(r.updated_at).getTime();
          if (t >= latestRecordTime) {
            latestRecordTime = t;
            latestRevNo = rev ? rev.rev_no : null;
          }
        }

        return {
          phone_no: s.phone_no,
          student_name: s.student_name,
          town: s.town,
          created_at: s.created_at,
          updated_at: s.updated_at,
          records_count: studentRecs.length,
          avg_score: recsWithScore > 0 ? totalPctSum / recsWithScore : null,
          latest_rev: latestRevNo,
        };
      })
      .sort((a, b) => a.student_name.localeCompare(b.student_name));
  }

  // 19. Students history (autocomplete)
  if (normalized.includes("FROM students WHERE phone_no = $1 AND phone_no <> $2")) {
    const p1 = String(params[0] || "");
    const p2 = String(params[1] || "");
    return store.students.filter((s) => s.phone_no === p1 && s.phone_no !== p2);
  }

  if (normalized.includes("FROM students")) {
    if (normalized.includes("WHERE town = $1")) {
      const town = String(params[0] || "");
      return store.students.filter((s) => s.town === town);
    }
    return store.students;
  }

  // 20. DELETE student
  if (normalized.startsWith("DELETE FROM students WHERE phone_no = $1")) {
    const phone = String(params[0] || "");
    const prev = store.students.length;
    store.students = store.students.filter((s) => s.phone_no !== phone);
    store.records = store.records.filter((r) => r.phone_no !== phone);
    return [{ success: true, count: prev - store.students.length }];
  }

  // 21. UPDATE student
  if (normalized.startsWith("UPDATE students")) {
    if (normalized.includes("phone_no = $1") && normalized.includes("WHERE phone_no = $4")) {
      const newPhone = String(params[0] || "");
      const studentName = String(params[1] || "");
      const town = String(params[2] || "");
      const oldPhone = String(params[3] || "");
      const student = store.students.find((s) => s.phone_no === oldPhone);
      if (student) {
        student.phone_no = newPhone;
        student.student_name = studentName;
        student.town = town;
        student.updated_at = new Date().toISOString();
        for (const r of store.records) {
          if (r.phone_no === oldPhone) {
            r.phone_no = newPhone;
            r.student_name = studentName;
          }
        }
        return [student];
      }
      return [];
    } else {
      const studentName = String(params[0] || "");
      const town = String(params[1] || "");
      const phone = String(params[2] || "");
      const student = store.students.find((s) => s.phone_no === phone);
      if (student) {
        student.student_name = studentName;
        student.town = town;
        student.updated_at = new Date().toISOString();
        for (const r of store.records) {
          if (r.phone_no === phone) {
            r.student_name = studentName;
          }
        }
        return [student];
      }
      return [];
    }
  }

  // 22. Upsert student
  if (normalized.startsWith("INSERT INTO students")) {
    const phone_no = String(params[0] || "");
    const student_name = String(params[1] || "");
    const town = String(params[2] || "");

    const existing = store.students.find((s) => s.phone_no === phone_no);
    const now = new Date().toISOString();
    if (existing) {
      existing.student_name = student_name;
      existing.town = town;
      existing.updated_at = now;
      return [existing];
    } else {
      const newStudent = {
        phone_no,
        student_name,
        town,
        created_at: now,
        updated_at: now,
      };
      store.students.push(newStudent);
      return [newStudent];
    }
  }

  return [];
}

/**
 * Returns Neon query function if DATABASE_URL is configured,
 * otherwise falls back to the in-memory mock store.
 */
export function sql(): QueryFn {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return executeMockQuery;
  }

  // Rebuild if the URL changed under us (a dev server picking up a new .env).
  if (!_sql || _sqlUrl !== url) {
    try {
      _sql = neon(url);
      _sqlUrl = url;
    } catch (err: any) {
      console.warn("[AI Studio] Could not initialize Neon client, falling back to mock:", err?.message || err);
      _sql = null;
      _sqlUrl = null;
      return executeMockQuery;
    }
  }

  const client = _sql;
  return async (queryText: string, params?: any[]) => {
    try {
      return (await client(queryText, params)) as any[];
    } catch (err: any) {
      console.warn("[AI Studio] Neon query failed, falling back to in-memory mock:", err?.message || err);
      return executeMockQuery(queryText, params);
    }
  };
}

export { TOWNS } from "./towns";
export type { Town } from "./towns";
