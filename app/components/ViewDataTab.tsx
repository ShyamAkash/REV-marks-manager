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
  const [searchOpen, setSearchOpen] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  function openSearch() {
    setSearchOpen(true);
  }

  function closeSearch() {
    setSearch("");
    setSearchOpen(false);
  }

  function handleSearchBlur() {
    if (!search.trim()) setSearchOpen(false);
  }

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

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
            {searchOpen ? (
              <div className="relative flex-1 min-w-0">
                <svg
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dim"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  className="field pl-10 pr-10"
                  placeholder="Search name or phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onBlur={handleSearchBlur}
                />
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={closeSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dim p-1"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Search"
                onClick={openSearch}
                className="btn-outline shrink-0 w-11 h-11 !p-0 flex items-center justify-center"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            )}
            <select
              className={`field w-[128px] shrink-0 ${searchOpen ? "hidden sm:block" : ""}`}
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
