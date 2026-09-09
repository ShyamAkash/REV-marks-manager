"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TOWNS } from "@/lib/towns";

type RevOption = {
  id: number;
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
};

type Rec = {
  id: number;
  town: string;
  rev_id: number;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff: string | null;
  updated_at: string;
  total: number;
};

const POLL_MS = 3000;

export default function ViewDataTab() {
  const [town, setTown] = useState("");
  const [revId, setRevId] = useState("");
  const [revs, setRevs] = useState<RevOption[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"modified" | "total_desc" | "total_asc">(
    "modified"
  );
  const [records, setRecords] = useState<Rec[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<Rec>>({});
  const [loading, setLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!town || !revId) {
      setRecords([]);
      return;
    }
    const params = new URLSearchParams({ town, rev_id: revId, sort });
    if (search.trim()) params.set("search", search.trim());
    try {
      const res = await fetch(`/api/records?${params.toString()}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch {}
  }, [town, revId, search, sort]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (town && revId) {
      pollRef.current = setInterval(load, POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [town, revId, load]);

  function beginEdit(r: Rec) {
    setEditingId(r.id);
    setEdit({
      student_name: r.student_name || "",
      phone_no: r.phone_no || "",
      mcq_mark: r.mcq_mark,
      structured_mark: r.structured_mark,
      essay_mark: r.essay_mark,
    });
  }

  async function saveEdit(id: number) {
    await fetch(`/api/records/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    setEditingId(null);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this record?")) return;
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    load();
  }

  function downloadSheet() {
    if (!town || !revId) return;
    const params = new URLSearchParams({ town, rev_id: revId });
    window.location.href = `/api/records/export?${params.toString()}`;
  }

  const ready = Boolean(town && revId);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Town</label>
          <select className="field" value={town} onChange={(e) => setTown(e.target.value)}>
            <option value="">Select</option>
            {TOWNS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">REV No.</label>
          <select className="field" value={revId} onChange={(e) => setRevId(e.target.value)}>
            <option value="">Select</option>
            {revs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.rev_no}
              </option>
            ))}
          </select>
        </div>
      </div>

      {ready && (
        <>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              placeholder="Search name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="field w-[128px]"
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
            >
              <option value="modified">Modified</option>
              <option value="total_desc">Total ↓</option>
              <option value="total_asc">Total ↑</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            {loading && records.length === 0 && (
              <div className="text-dim text-xs text-center py-6">Loading</div>
            )}
            {!loading && records.length === 0 && (
              <div className="text-dim text-xs text-center py-6">No records</div>
            )}
            {records.map((r) => (
              <div key={r.id} className="border border-line rounded-2xl p-4">
                {editingId === r.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      className="field"
                      placeholder="Student Name"
                      value={edit.student_name as string}
                      onChange={(e) =>
                        setEdit((s) => ({ ...s, student_name: e.target.value }))
                      }
                    />
                    <input
                      className="field"
                      placeholder="Mobile No."
                      value={edit.phone_no as string}
                      onChange={(e) => setEdit((s) => ({ ...s, phone_no: e.target.value }))}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        className="field num"
                        inputMode="decimal"
                        value={edit.mcq_mark as any}
                        onChange={(e) =>
                          setEdit((s) => ({ ...s, mcq_mark: Number(e.target.value) }))
                        }
                      />
                      <input
                        className="field num"
                        inputMode="decimal"
                        value={edit.structured_mark as any}
                        onChange={(e) =>
                          setEdit((s) => ({
                            ...s,
                            structured_mark: Number(e.target.value),
                          }))
                        }
                      />
                      <input
                        className="field num"
                        inputMode="decimal"
                        value={edit.essay_mark as any}
                        onChange={(e) =>
                          setEdit((s) => ({ ...s, essay_mark: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-primary flex-1" onClick={() => saveEdit(r.id)}>
                        Save
                      </button>
                      <button
                        className="btn-outline flex-1"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm">
                        {r.student_name || "No Name Provided"}
                      </span>
                      <span className="text-xs text-dim num">
                        {r.phone_no || "No Phone no. Provided"}
                      </span>
                      <span className="text-xs text-dim">Staff: {r.staff || "-"}</span>
                      <span className="text-xs num text-dim">
                        MCQ {r.mcq_mark} · Struct {r.structured_mark} · Essay {r.essay_mark}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="num text-gold text-sm">
                        {r.total.toFixed(4)}
                      </span>
                      <div className="flex gap-1">
                        <button
                          className="btn-outline px-2 py-1 text-[11px]"
                          onClick={() => beginEdit(r)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-outline btn-danger px-2 py-1 text-[11px]"
                          onClick={() => remove(r.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={downloadSheet}>
            Download Sheet
          </button>
        </>
      )}
    </div>
  );
}
