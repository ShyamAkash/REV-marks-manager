"use client";

import { useEffect, useState } from "react";

type RevOption = {
  id: number;
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
};

export default function RevsClient() {
  const [revNo, setRevNo] = useState("");
  const [numMcq, setNumMcq] = useState("");
  const [numStructured, setNumStructured] = useState("");
  const [numEssay, setNumEssay] = useState("");
  const [revs, setRevs] = useState<RevOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Edit state for existing REV
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRevNo, setEditRevNo] = useState("");
  const [editMcq, setEditMcq] = useState("");
  const [editStructured, setEditStructured] = useState("");
  const [editEssay, setEditEssay] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function load() {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!revNo.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/revs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rev_no: revNo.trim(),
          num_mcq: numMcq === "" ? 0 : Number(numMcq),
          num_structured: numStructured === "" ? 0 : Number(numStructured),
          num_essay: numEssay === "" ? 0 : Number(numEssay),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setRevNo("");
      setNumMcq("");
      setNumStructured("");
      setNumEssay("");
      setMessage("REV saved successfully");
      load();
      setTimeout(() => setMessage(null), 2500);
    } catch (e: any) {
      setMessage(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(r: RevOption) {
    setEditingId(r.id);
    setEditRevNo(r.rev_no);
    setEditMcq(String(r.num_mcq));
    setEditStructured(String(r.num_structured));
    setEditEssay(String(r.num_essay));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(id: number) {
    if (!editRevNo.trim()) {
      setEditError("REV No. is required");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch("/api/revs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          rev_no: editRevNo.trim(),
          num_mcq: editMcq === "" ? 0 : Number(editMcq),
          num_structured: editStructured === "" ? 0 : Number(editStructured),
          num_essay: editEssay === "" ? 0 : Number(editEssay),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update REV");
      setEditingId(null);
      setMessage(`Updated ${editRevNo.trim()} — all student total marks recalculated.`);
      load();
      setTimeout(() => setMessage(null), 3500);
    } catch (e: any) {
      setEditError(e.message || "Error updating REV");
    } finally {
      setEditSaving(false);
    }
  }

  const newDenom =
    (Number(numMcq) || 0) +
    (Number(numStructured) || 0) * 5 +
    (Number(numEssay) || 0) * 7.5;

  const editDenom =
    (Number(editMcq) || 0) +
    (Number(editStructured) || 0) * 5 +
    (Number(editEssay) || 0) * 7.5;

  return (
    <div className="flex flex-col gap-5">
      {message && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-xs text-paper text-center">
          {message}
        </div>
      )}

      <section className="flex flex-col gap-3 border border-line p-4 rounded-2xl">
        <div className="text-xs font-semibold text-paper">Add New REV No.</div>
        <div>
          <label className="field-label">REV No.</label>
          <input
            className="field"
            placeholder="e.g. REV 01"
            value={revNo}
            onChange={(e) => setRevNo(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="field-label">No. of MCQs</label>
            <input
              className="field num"
              inputMode="numeric"
              placeholder="0"
              value={numMcq}
              onChange={(e) => setNumMcq(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">No. of S.Essays</label>
            <input
              className="field num"
              inputMode="numeric"
              placeholder="0"
              value={numStructured}
              onChange={(e) => setNumStructured(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">No. of Essays</label>
            <input
              className="field num"
              inputMode="numeric"
              placeholder="0"
              value={numEssay}
              onChange={(e) => setNumEssay(e.target.value)}
            />
          </div>
        </div>

        <div className="text-[11px] text-dim num">
          Total base score: {newDenom.toFixed(1)} pts
        </div>

        <button className="btn-primary" disabled={saving || !revNo.trim()} onClick={save}>
          {saving ? "Saving..." : "Save REV No."}
        </button>
      </section>

      <section className="flex flex-col gap-2.5 border-t border-line pt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-paper">Added REV Numbers</span>
          <span className="text-[11px] text-dim">{revs.length} configured</span>
        </div>

        {revs.length === 0 && (
          <div className="text-dim text-xs text-center py-6">No REV numbers added yet.</div>
        )}

        {revs.map((r) => {
          const isEditing = editingId === r.id;
          const rDenom = r.num_mcq + r.num_structured * 5 + r.num_essay * 7.5;

          if (isEditing) {
            return (
              <div
                key={r.id}
                className="flex flex-col gap-3 border border-gold/60 bg-panel rounded-2xl p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gold">Edit REV #{r.id}</span>
                  <span className="text-[11px] text-dim">
                    Denominator: {editDenom.toFixed(1)} pts
                  </span>
                </div>

                <div>
                  <label className="field-label">REV No.</label>
                  <input
                    className="field"
                    value={editRevNo}
                    onChange={(e) => setEditRevNo(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="field-label">MCQs</label>
                    <input
                      className="field num"
                      inputMode="numeric"
                      value={editMcq}
                      onChange={(e) => setEditMcq(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">S.Essays</label>
                    <input
                      className="field num"
                      inputMode="numeric"
                      value={editStructured}
                      onChange={(e) => setEditStructured(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">Essays</label>
                    <input
                      className="field num"
                      inputMode="numeric"
                      value={editEssay}
                      onChange={(e) => setEditEssay(e.target.value)}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-dim leading-relaxed">
                  Changing question counts recalculates all student total marks for this REV No. across View Data, Rank Sheets, and Excel exports.
                </p>

                {editError && (
                  <div className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg">
                    {editError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    className="btn-primary flex-1 !py-2.5 text-xs"
                    disabled={editSaving || !editRevNo.trim()}
                    onClick={() => saveEdit(r.id)}
                  >
                    {editSaving ? "Updating..." : "Save Changes"}
                  </button>
                  <button
                    className="btn-outline flex-1 !py-2.5 text-xs"
                    disabled={editSaving}
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={r.id}
              className="flex items-center justify-between border border-line rounded-2xl px-4 py-3 text-xs bg-panel/40 hover:bg-panel transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-paper">{r.rev_no}</span>
                <span className="num text-dim text-[11px]">
                  MCQ: {r.num_mcq} · SE: {r.num_structured} · Essay: {r.num_essay}
                </span>
                <span className="num text-gold/90 text-[10px]">
                  Base: {rDenom.toFixed(1)} pts
                </span>
              </div>
              <button
                type="button"
                className="btn-outline px-3 py-1.5 text-xs self-center hover:border-paper"
                onClick={() => beginEdit(r)}
              >
                Edit
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
