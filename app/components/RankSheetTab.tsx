"use client";

import { useEffect, useState } from "react";
import { TOWNS } from "@/lib/towns";

type RevOption = {
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
};

export default function RankSheetTab() {
  const [revs, setRevs] = useState<RevOption[]>([]);
  const [revNo, setRevNo] = useState("");
  const [town, setTown] = useState("");

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }, []);

  function download() {
    if (!revNo || !town) return;
    const params = new URLSearchParams({ rev_no: revNo, town });
    window.location.href = `/api/rank?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="field-label">REV No.</label>
        <select className="field" value={revNo} onChange={(e) => setRevNo(e.target.value)}>
          <option value="">Select</option>
          {revs.map((r) => (
            <option key={r.rev_no} value={r.rev_no}>
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

      <button className="btn-primary mt-2" disabled={!revNo || !town} onClick={download}>
        Download Rank PDF
      </button>
    </div>
  );
}
