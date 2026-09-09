"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TOWNS } from "@/lib/towns";
import { calcTotal, RevConfig } from "@/lib/calc";
import { triggerHaptic } from "@/lib/haptics";
import {
  addOfflineRecord,
  getOfflineQueue,
  updateOfflineRecord,
  OfflineRecord,
} from "@/lib/offlineQueue";

type RevOption = RevConfig;

type RecentEntry = {
  id?: number;
  tempId?: string;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  total: number;
  staff?: string | null;
  isOffline?: boolean;
};

const SESSION_KEY = "marks_session_v2";

export default function AddRecordTab() {
  const [town, setTown] = useState("");
  const [revId, setRevId] = useState("");
  const [checkedBy, setCheckedBy] = useState("");
  const [locked, setLocked] = useState(false);

  const [revs, setRevs] = useState<RevOption[]>([]);

  // Form fields
  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [mcq, setMcq] = useState("");
  const [structured, setStructured] = useState("");
  const [essay, setEssay] = useState("");

  const studentNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const mcqRef = useRef<HTMLInputElement>(null);
  const structuredRef = useRef<HTMLInputElement>(null);
  const essayRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Recent entries (last 3-5 students entered)
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);

  // Inline edit state for recent entry
  const [editingEntry, setEditingEntry] = useState<RecentEntry | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editMcq, setEditMcq] = useState("");
  const [editStructured, setEditStructured] = useState("");
  const [editEssay, setEditEssay] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Find currently selected revision configuration
  const currentRev = useMemo(() => {
    return revs.find((r) => String(r.id) === String(revId)) || null;
  }, [revs, revId]);

  // Max marks calculations
  const maxMcq = useMemo(() => {
    return currentRev && Number(currentRev.num_mcq) > 0
      ? Number(currentRev.num_mcq)
      : null;
  }, [currentRev]);

  const maxStructured = useMemo(() => {
    return currentRev && Number(currentRev.num_structured) > 0
      ? Number(currentRev.num_structured) * 5
      : null;
  }, [currentRev]);

  const maxEssay = useMemo(() => {
    return currentRev && Number(currentRev.num_essay) > 0
      ? Number(currentRev.num_essay) * 7.5
      : null;
  }, [currentRev]);

  // Soft validation flags
  const isMcqExceeded = maxMcq !== null && mcq !== "" && Number(mcq) > maxMcq;
  const isStructuredExceeded =
    maxStructured !== null && structured !== "" && Number(structured) > maxStructured;
  const isEssayExceeded = maxEssay !== null && essay !== "" && Number(essay) > maxEssay;

  // Live Total Mark preview calculation using existing formula
  const liveTotal = useMemo(() => {
    if (!currentRev) return null;
    const hasAnyInput = mcq !== "" || structured !== "" || essay !== "";
    if (!hasAnyInput) return 0;
    return calcTotal(
      {
        mcq_mark: Number(mcq) || 0,
        structured_mark: Number(structured) || 0,
        essay_mark: Number(essay) || 0,
      },
      currentRev
    );
  }, [mcq, structured, essay, currentRev]);

  // Load revisions and initial session
  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});

    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s.town && s.revId && s.checkedBy) {
          setTown(s.town);
          setRevId(String(s.revId));
          setCheckedBy(s.checkedBy);
          setLocked(true);
          loadRecentEntries(String(s.revId));
          setTimeout(() => {
            studentNameRef.current?.focus();
            studentNameRef.current?.select();
          }, 100);
        }
      } catch {}
    }
  }, []);

  // Fetch recent entries when revision changes or unlocks
  function loadRecentEntries(activeRevId: string) {
    if (!activeRevId) return;

    // First load offline queue items for this rev
    const offlineItems = getOfflineQueue()
      .filter((q) => String(q.rev_id) === activeRevId)
      .map((q) => ({
        tempId: q.tempId,
        student_name: q.student_name,
        phone_no: q.phone_no,
        mcq_mark: q.mcq_mark,
        structured_mark: q.structured_mark,
        essay_mark: q.essay_mark,
        staff: q.staff,
        total: calcTotal(q, currentRev),
        isOffline: true,
      }));

    fetch(`/api/records?rev_id=${activeRevId}&limit=5`)
      .then((r) => r.json())
      .then((d) => {
        const serverRecords: RecentEntry[] = (d.records || []).slice(0, 5).map((r: any) => ({
          id: r.id,
          student_name: r.student_name,
          phone_no: r.phone_no,
          mcq_mark: r.mcq_mark,
          structured_mark: r.structured_mark,
          essay_mark: r.essay_mark,
          staff: r.staff,
          total: calcTotal(r, currentRev),
          isOffline: false,
        }));

        // Combine offline first, then server
        const combined = [...offlineItems, ...serverRecords].slice(0, 5);
        setRecentEntries(combined);
      })
      .catch(() => {
        if (offlineItems.length > 0) {
          setRecentEntries(offlineItems.slice(0, 5));
        }
      });
  }

  function startSession() {
    if (!town || !revId || !checkedBy.trim()) return;
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ town, revId, checkedBy: checkedBy.trim() })
    );
    setLocked(true);
    triggerHaptic("light");
    loadRecentEntries(revId);
    setTimeout(() => {
      studentNameRef.current?.focus();
      studentNameRef.current?.select();
    }, 50);
  }

  function changeSession() {
    sessionStorage.removeItem(SESSION_KEY);
    setLocked(false);
  }

  // Submit record with Offline Safe Mode
  async function submit() {
    if (submitting || !locked) return;
    setMessage(null);
    setSubmitting(true);

    const recordPayload = {
      town,
      rev_id: Number(revId),
      staff: checkedBy.trim(),
      student_name: studentName.trim() || null,
      phone_no: phone.trim() || null,
      mcq_mark: mcq === "" ? 0 : Number(mcq),
      structured_mark: structured === "" ? 0 : Number(structured),
      essay_mark: essay === "" ? 0 : Number(essay),
    };

    const calculatedTotal = calcTotal(recordPayload, currentRev);

    // If offline or network fetch fails
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    if (!isOnline) {
      const offlineItem = addOfflineRecord(recordPayload);
      const newRecent: RecentEntry = {
        tempId: offlineItem.tempId,
        ...recordPayload,
        total: calculatedTotal,
        isOffline: true,
      };
      setRecentEntries((prev) => [newRecent, ...prev.slice(0, 4)]);
      triggerHaptic("success");
      setStudentName("");
      setPhone("");
      setMcq("");
      setStructured("");
      setEssay("");
      setMessage("Saved offline (will sync when online)");
      setSubmitting(false);
      setTimeout(() => setMessage(null), 2500);
      setTimeout(() => {
        studentNameRef.current?.focus();
        studentNameRef.current?.select();
      }, 50);
      return;
    }

    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recordPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }

      const data = await res.json();
      const newRecent: RecentEntry = {
        id: data.record?.id,
        ...recordPayload,
        total: calculatedTotal,
        isOffline: false,
      };

      setRecentEntries((prev) => [newRecent, ...prev.slice(0, 4)]);
      triggerHaptic("success");
      setStudentName("");
      setPhone("");
      setMcq("");
      setStructured("");
      setEssay("");
      setMessage("Saved");
      setTimeout(() => setMessage(null), 1800);
      setTimeout(() => {
        studentNameRef.current?.focus();
        studentNameRef.current?.select();
      }, 50);
    } catch (e: any) {
      // Network drop fallback
      if (
        !navigator.onLine ||
        e.message?.includes("Failed to fetch") ||
        e.message?.includes("NetworkError")
      ) {
        const offlineItem = addOfflineRecord(recordPayload);
        const newRecent: RecentEntry = {
          tempId: offlineItem.tempId,
          ...recordPayload,
          total: calculatedTotal,
          isOffline: true,
        };
        setRecentEntries((prev) => [newRecent, ...prev.slice(0, 4)]);
        triggerHaptic("warning");
        setStudentName("");
        setPhone("");
        setMcq("");
        setStructured("");
        setEssay("");
        setMessage("Connection dropped: Saved locally (auto-syncing)");
        setTimeout(() => setMessage(null), 2500);
        setTimeout(() => {
          studentNameRef.current?.focus();
          studentNameRef.current?.select();
        }, 50);
      } else {
        triggerHaptic("error");
        setMessage(e.message || "Error saving record");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Quick edit recent entry
  function openEdit(entry: RecentEntry) {
    triggerHaptic("light");
    setEditingEntry(entry);
    setEditName(entry.student_name || "");
    setEditPhone(entry.phone_no || "");
    setEditMcq(String(entry.mcq_mark ?? ""));
    setEditStructured(String(entry.structured_mark ?? ""));
    setEditEssay(String(entry.essay_mark ?? ""));
  }

  async function saveRecentEdit() {
    if (!editingEntry) return;
    setEditSaving(true);
    triggerHaptic("light");

    const updated = {
      student_name: editName.trim() || null,
      phone_no: editPhone.trim() || null,
      mcq_mark: editMcq === "" ? 0 : Number(editMcq),
      structured_mark: editStructured === "" ? 0 : Number(editStructured),
      essay_mark: editEssay === "" ? 0 : Number(editEssay),
    };

    const newTotal = calcTotal(updated, currentRev);

    try {
      if (editingEntry.isOffline && editingEntry.tempId) {
        updateOfflineRecord(editingEntry.tempId, updated);
        setRecentEntries((prev) =>
          prev.map((item) =>
            item.tempId === editingEntry.tempId
              ? { ...item, ...updated, total: newTotal }
              : item
          )
        );
        triggerHaptic("success");
        setEditingEntry(null);
      } else if (editingEntry.id) {
        const res = await fetch(`/api/records/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (!res.ok) throw new Error("Failed to update");
        setRecentEntries((prev) =>
          prev.map((item) =>
            item.id === editingEntry.id
              ? { ...item, ...updated, total: newTotal }
              : item
          )
        );
        triggerHaptic("success");
        setEditingEntry(null);
      }
    } catch {
      triggerHaptic("error");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Session Header */}
      {locked ? (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-line bg-surface/50 text-xs">
          <span className="text-xs text-dim truncate min-w-0">
            Lock active: <strong className="text-paper">{town}</strong> ·{" "}
            <strong className="text-paper">{currentRev?.rev_no || `REV ${revId}`}</strong>
            {checkedBy ? (
              <>
                {" "}· <strong className="text-paper">{checkedBy}</strong>
              </>
            ) : null}
          </span>
          <button
            type="button"
            className="btn-outline text-xs !py-1 !px-2.5 shrink-0"
            onClick={changeSession}
          >
            Change
          </button>
        </div>
      ) : (
        <section className="flex flex-col gap-3 border border-line p-4 rounded-2xl bg-surface/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-dim">
              Marking Session
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Town</label>
              <select
                className="field"
                value={town}
                onChange={(e) => setTown(e.target.value)}
              >
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
              <select
                className="field"
                value={revId}
                onChange={(e) => {
                  setRevId(e.target.value);
                  loadRecentEntries(e.target.value);
                }}
              >
                <option value="">Select</option>
                {revs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rev_no}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Checked by</label>
            <input
              className="field"
              value={checkedBy}
              enterKeyHint="go"
              onChange={(e) => setCheckedBy(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  startSession();
                }
              }}
              placeholder="Your name"
            />
          </div>

          <button
            className="btn-primary"
            disabled={!town || !revId || !checkedBy.trim()}
            onClick={startSession}
          >
            Start Marking
          </button>
        </section>
      )}

      {/* Main Student Data Entry Form */}
      <section
        className={`flex flex-col gap-3.5 ${
          !locked ? "opacity-35 pointer-events-none select-none" : ""
        }`}
      >
        <div>
          <label className="field-label">Student Name</label>
          <input
            ref={studentNameRef}
            className="field"
            value={studentName}
            enterKeyHint="next"
            onChange={(e) => setStudentName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                triggerHaptic("light");
                phoneRef.current?.focus();
                phoneRef.current?.select();
              }
            }}
            placeholder="e.g. K. Nimal Perera"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Mobile No.</label>
            <input
              ref={phoneRef}
              className="field"
              inputMode="tel"
              enterKeyHint="next"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  triggerHaptic("light");
                  mcqRef.current?.focus();
                  mcqRef.current?.select();
                }
              }}
              placeholder="e.g. 0771234567"
            />
          </div>

          <div>
            <label className="field-label">Total</label>
            <div className="field flex items-center justify-between bg-surface/50 border border-line">
              <span className="text-xs text-dim">Total:</span>
              <span className="text-base font-normal text-paper num tracking-tight">
                {liveTotal !== null ? `${liveTotal.toFixed(2)}%` : "0.00%"}
              </span>
            </div>
          </div>
        </div>

        {/* Marks row with soft validation and hints */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="field-label">MCQ Mark</label>
              {maxMcq !== null && (
                <span className="text-[11px] text-dim font-mono">/{maxMcq}</span>
              )}
            </div>
            <input
              ref={mcqRef}
              className={`field num ${
                isMcqExceeded ? "!border-amber-500 bg-amber-500/10 text-amber-200" : ""
              }`}
              inputMode="decimal"
              enterKeyHint="next"
              value={mcq}
              onChange={(e) => {
                setMcq(e.target.value);
                if (maxMcq !== null && Number(e.target.value) > maxMcq) {
                  triggerHaptic("warning");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  triggerHaptic("light");
                  structuredRef.current?.focus();
                  structuredRef.current?.select();
                }
              }}
            />
            {isMcqExceeded && (
              <span className="text-[10px] text-amber-400 font-medium mt-1 block">
                ⚠ Exceeds max of {maxMcq}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="field-label">Structured</label>
              {maxStructured !== null && (
                <span className="text-[11px] text-dim font-mono">/{maxStructured}</span>
              )}
            </div>
            <input
              ref={structuredRef}
              className={`field num ${
                isStructuredExceeded ? "!border-amber-500 bg-amber-500/10 text-amber-200" : ""
              }`}
              inputMode="decimal"
              enterKeyHint="next"
              value={structured}
              onChange={(e) => {
                setStructured(e.target.value);
                if (maxStructured !== null && Number(e.target.value) > maxStructured) {
                  triggerHaptic("warning");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  triggerHaptic("light");
                  essayRef.current?.focus();
                  essayRef.current?.select();
                }
              }}
            />
            {isStructuredExceeded && (
              <span className="text-[10px] text-amber-400 font-medium mt-1 block">
                ⚠ Exceeds max of {maxStructured}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="field-label">Essay Mark</label>
              {maxEssay !== null && (
                <span className="text-[11px] text-dim font-mono">/{maxEssay}</span>
              )}
            </div>
            <input
              ref={essayRef}
              className={`field num ${
                isEssayExceeded ? "!border-amber-500 bg-amber-500/10 text-amber-200" : ""
              }`}
              inputMode="decimal"
              enterKeyHint="done"
              value={essay}
              onChange={(e) => {
                setEssay(e.target.value);
                if (maxEssay !== null && Number(e.target.value) > maxEssay) {
                  triggerHaptic("warning");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {isEssayExceeded && (
              <span className="text-[10px] text-amber-400 font-medium mt-1 block">
                ⚠ Exceeds max of {maxEssay}
              </span>
            )}
          </div>
        </div>

        <button
          className="btn-primary mt-1"
          disabled={submitting || !locked}
          onClick={submit}
        >
          {submitting ? "Saving..." : "Submit Record (Enter)"}
        </button>

        {message && (
          <div className="text-center text-xs text-paper bg-gold/15 border border-gold/30 rounded-lg py-2">
            {message}
          </div>
        )}
      </section>

      {/* "Recent Entries" Mini-Strip Below Submit Button */}
      {locked && (
        <section className="flex flex-col gap-2.5 pt-2 border-t border-line/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-dim">
              Recent Entries ({recentEntries.length})
            </span>
          </div>

          {recentEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-dim">
              No entries submitted yet in this session
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentEntries.map((entry, idx) => (
                <div
                  key={entry.id || entry.tempId || idx}
                  className="rounded-xl border border-line bg-surface/50 p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-paper truncate">
                        {entry.student_name || "No Name Provided"}
                      </span>
                      {entry.isOffline && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40 shrink-0">
                          Offline
                        </span>
                      )}
                    </div>
                    <div className="text-dim text-[11px] flex items-center gap-2 mt-0.5">
                      <span>{entry.phone_no || "No phone"}</span>
                      <span>·</span>
                      <span className="num">
                        M:{entry.mcq_mark} S:{entry.structured_mark} E:{entry.essay_mark}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-paper num bg-ink/70 px-2 py-1 rounded-md border border-line">
                      {entry.total.toFixed(1)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(entry)}
                      className="btn-outline text-xs !py-1 !px-2.5"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Quick Edit Modal for Recent Entries */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-line p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-paper">
                Quick Edit Student Record
              </h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="text-dim hover:text-paper p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="field-label">Student Name</label>
                <input
                  className="field"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label">Mobile No.</label>
                <input
                  className="field"
                  inputMode="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="field-label">MCQ Mark</label>
                  <input
                    className="field num"
                    inputMode="decimal"
                    value={editMcq}
                    onChange={(e) => setEditMcq(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">Structured</label>
                  <input
                    className="field num"
                    inputMode="decimal"
                    value={editStructured}
                    onChange={(e) => setEditStructured(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">Essay Mark</label>
                  <input
                    className="field num"
                    inputMode="decimal"
                    value={editEssay}
                    onChange={(e) => setEditEssay(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                className="btn-primary flex-1 text-xs py-2"
                disabled={editSaving}
                onClick={saveRecentEdit}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                className="btn-outline flex-1 text-xs py-2"
                onClick={() => setEditingEntry(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
