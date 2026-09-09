"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RevOption = {
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
};

export default function AddRevPage() {
  const [revNo, setRevNo] = useState("");
  const [numMcq, setNumMcq] = useState("");
  const [numStructured, setNumStructured] = useState("");
  const [numEssay, setNumEssay] = useState("");
  const [revs, setRevs] = useState<RevOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage("Saved");
      load();
      setTimeout(() => setMessage(null), 1500);
    } catch (e: any) {
      setMessage(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-ink flex items-center justify-between px-4 py-3">
        <Link href="/" className="btn-outline text-xs px-3 py-2">
          Back
        </Link>
        <span className="text-sm font-semibold tracking-wide">Add REV</span>
        <span className="w-[58px]" />
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-5 pb-8">
        <section className="flex flex-col gap-3">
          <div>
            <label className="field-label">REV No.</label>
            <input className="field" value={revNo} onChange={(e) => setRevNo(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="field-label">No. of MCQs</label>
              <input
                className="field num"
                inputMode="numeric"
                value={numMcq}
                onChange={(e) => setNumMcq(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">No. of S.Essays</label>
              <input
                className="field num"
                inputMode="numeric"
                value={numStructured}
                onChange={(e) => setNumStructured(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">No. of Essays</label>
              <input
                className="field num"
                inputMode="numeric"
                value={numEssay}
                onChange={(e) => setNumEssay(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-primary" disabled={saving || !revNo.trim()} onClick={save}>
            {saving ? "Saving..." : "Save REV No."}
          </button>
          {message && <div className="text-center text-xs text-dim">{message}</div>}
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-4">
          {revs.map((r) => (
            <div
              key={r.rev_no}
              className="flex items-center justify-between border border-line rounded-sm px-3 py-2 text-xs"
            >
              <span className="text-sm">{r.rev_no}</span>
              <span className="num text-dim">
                MCQ {r.num_mcq} · SE {r.num_structured} · E {r.num_essay}
              </span>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
