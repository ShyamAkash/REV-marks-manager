"use client";

import { useEffect, useState } from "react";
import { TOWNS } from "@/lib/towns";

type RevOption = {
  id: number;
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
};

export default function RankSheetTab() {
  const [revs, setRevs] = useState<RevOption[]>([]);
  const [revId, setRevId] = useState("");
  const [town, setTown] = useState("");

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }, []);

  function download() {
    if (!revId || !town) return;
    const params = new URLSearchParams({ rev_id: revId, town });
    window.location.href = `/api/rank?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div>
          <label className="field-label">Town</label>
          <select className="field" value={town} onChange={(e) => setTown(e.target.value)}>
            <option value="">Select</option>
            <option value="ALL">All Towns</option>
            {TOWNS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn-primary mt-2" disabled={!revId || !town} onClick={download}>
        Download Rank PDF
      </button>
    </div>
  );
}
