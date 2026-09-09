"use client";

import { useEffect, useState } from "react";
import { TOWNS } from "@/lib/towns";

type RevOption = {
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
};

const SESSION_KEY = "marks_session_v1";

export default function AddRecordTab() {
  const [town, setTown] = useState("");
  const [revNo, setRevNo] = useState("");
  const [checkedBy, setCheckedBy] = useState("");
  const [locked, setLocked] = useState(false);

  const [revs, setRevs] = useState<RevOption[]>([]);

  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [mcq, setMcq] = useState("");
  const [structured, setStructured] = useState("");
  const [essay, setEssay] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});

    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s.town && s.revNo && s.checkedBy) {
          setTown(s.town);
          setRevNo(s.revNo);
          setCheckedBy(s.checkedBy);
          setLocked(true);
        }
      } catch {}
    }
  }, []);

  function startSession() {
    if (!town || !revNo || !checkedBy.trim()) return;
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ town, revNo, checkedBy: checkedBy.trim() })
    );
    setLocked(true);
  }

  function changeSession() {
    sessionStorage.removeItem(SESSION_KEY);
    setLocked(false);
  }

  async function submit() {
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          town,
          rev_no: revNo,
          staff: checkedBy.trim(),
          student_name: studentName.trim() || null,
          phone_no: phone.trim() || null,
          mcq_mark: mcq === "" ? 0 : Number(mcq),
          structured_mark: structured === "" ? 0 : Number(structured),
          essay_mark: essay === "" ? 0 : Number(essay),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setStudentName("");
      setPhone("");
      setMcq("");
      setStructured("");
      setEssay("");
      setMessage("Saved");
      setTimeout(() => setMessage(null), 1800);
    } catch (e: any) {
      setMessage(e.message || "Error saving record");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <section className="flex flex-col gap-3 border border-line p-3 rounded-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Town</label>
            <select
              className="field"
              value={town}
              disabled={locked}
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
              value={revNo}
              disabled={locked}
              onChange={(e) => setRevNo(e.target.value)}
            >
              <option value="">Select</option>
              {revs.map((r) => (
                <option key={r.rev_no} value={r.rev_no}>
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
            disabled={locked}
            onChange={(e) => setCheckedBy(e.target.value)}
            placeholder="Your name"
          />
        </div>

        {!locked ? (
          <button
            className="btn-primary"
            disabled={!town || !revNo || !checkedBy.trim()}
            onClick={startSession}
          >
            Start
          </button>
        ) : (
          <button className="btn-outline text-xs self-start" onClick={changeSession}>
            Change
          </button>
        )}
      </section>

      <section className={`flex flex-col gap-3 ${!locked ? "opacity-40 pointer-events-none" : ""}`}>
        <div>
          <label className="field-label">Student Name</label>
          <input
            className="field"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Mobile No.</label>
          <input
            className="field"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="field-label">MCQ Mark</label>
            <input
              className="field num"
              inputMode="decimal"
              value={mcq}
              onChange={(e) => setMcq(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Structured</label>
            <input
              className="field num"
              inputMode="decimal"
              value={structured}
              onChange={(e) => setStructured(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Essay Mark</label>
            <input
              className="field num"
              inputMode="decimal"
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn-primary mt-2"
          disabled={submitting || !locked}
          onClick={submit}
        >
          {submitting ? "Saving..." : "Submit"}
        </button>

        {message && (
          <div className="text-center text-xs text-dim">{message}</div>
        )}
      </section>
    </div>
  );
}
