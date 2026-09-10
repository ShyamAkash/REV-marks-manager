"use client";

import { useEffect, useState } from "react";
import { TOWNS } from "@/lib/towns";
import type { RevConfig } from "@/lib/calc";
import { triggerHaptic } from "@/lib/haptics";
import { Button, Card, Field, Select } from "@/app/components/ui";
import { getLastStaff, type MarkSession } from "./useMarkSession";

export function SessionStart({
  revs,
  onStart,
}: {
  revs: RevConfig[];
  onStart: (session: MarkSession) => void;
}) {
  const [town, setTown] = useState("");
  const [revId, setRevId] = useState("");
  const [checkedBy, setCheckedBy] = useState("");

  useEffect(() => {
    setCheckedBy(getLastStaff());
  }, []);

  const canStart = Boolean(town && revId && checkedBy.trim());

  function start() {
    if (!canStart) return;
    triggerHaptic("light");
    onStart({ town, revId, checkedBy: checkedBy.trim() });
  }

  return (
    <Card className="flex flex-col gap-5">
      <h1 className="text-title font-semibold text-paper">Start marking</h1>

      <div className="flex flex-col">
        <span className="field-label">Town</span>
        <div className="grid grid-cols-2 gap-2">
          {TOWNS.map((t) => {
            const active = town === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  triggerHaptic("light");
                  setTown(t);
                }}
                className={[
                  "min-h-[48px] rounded-control border px-3 text-body transition-colors",
                  active
                    ? "border-brand bg-brand/15 font-semibold text-paper"
                    : "border-line bg-surface text-dim hover:text-paper",
                ].join(" ")}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <Select
        label="REV No."
        value={revId}
        onChange={(e) => setRevId(e.target.value)}
        options={revs.map((r) => ({ value: String(r.id), label: r.rev_no }))}
      />

      <Field
        label="Checked by"
        placeholder="Your name"
        value={checkedBy}
        enterKeyHint="go"
        onChange={(e) => setCheckedBy(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            start();
          }
        }}
      />

      <Button size="lg" fullWidth disabled={!canStart} onClick={start}>
        Start marking
      </Button>
    </Card>
  );
}
