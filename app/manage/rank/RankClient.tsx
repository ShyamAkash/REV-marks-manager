"use client";

import { useEffect, useState } from "react";
import { TOWNS } from "@/lib/towns";
import type { RevConfig } from "@/lib/calc";
import { Button, Card, Select } from "@/app/components/ui";

export default function RankClient() {
  const [revs, setRevs] = useState<RevConfig[]>([]);
  const [revId, setRevId] = useState("");
  const [town, setTown] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }, []);

  const ready = Boolean(revId && town);
  const revLabel = revs.find((r) => String(r.id) === revId)?.rev_no ?? "";
  const townLabel = town === "ALL" ? "all towns" : town;

  function download() {
    if (!ready) return;
    setDownloading(true);
    const params = new URLSearchParams({ rev_id: revId, town });
    window.location.href = `/api/rank?${params.toString()}`;
    // The browser handles the download; re-enable shortly after handing off.
    window.setTimeout(() => setDownloading(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-semibold text-paper">Rank Sheet</h1>

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="REV No."
            value={revId}
            onChange={(e) => setRevId(e.target.value)}
            options={revs.map((r) => ({ value: String(r.id), label: r.rev_no }))}
          />
          <Select
            label="Town"
            value={town}
            onChange={(e) => setTown(e.target.value)}
            options={[
              { value: "ALL", label: "All towns" },
              ...TOWNS.map((t) => ({ value: t, label: t })),
            ]}
          />
        </div>

        <p className="text-label text-dim">
          {ready
            ? `Generates a PDF ranking every student in ${townLabel} for ${revLabel}, highest total first.`
            : "Choose a REV No. and a town to generate a ranked PDF."}
        </p>

        <Button size="lg" fullWidth disabled={!ready} loading={downloading} onClick={download}>
          Download rank PDF
        </Button>
      </Card>
    </div>
  );
}
