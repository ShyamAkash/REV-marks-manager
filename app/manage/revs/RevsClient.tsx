"use client";

import { useCallback, useEffect, useState } from "react";
import type { RevConfig } from "@/lib/calc";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Sheet,
  useToast,
} from "@/app/components/ui";

function paperTotal(mcq: number, structured: number, essay: number) {
  return mcq + structured * 5 + essay * 7.5;
}

function toNumber(v: string) {
  if (v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function RevsClient() {
  const toast = useToast();
  const [revs, setRevs] = useState<RevConfig[]>([]);
  const [revNo, setRevNo] = useState("");
  const [mcq, setMcq] = useState("");
  const [structured, setStructured] = useState("");
  const [essay, setEssay] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RevConfig | null>(null);

  const load = useCallback(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!revNo.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/revs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rev_no: revNo.trim(),
          num_mcq: toNumber(mcq),
          num_structured: toNumber(structured),
          num_essay: toNumber(essay),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setRevNo("");
      setMcq("");
      setStructured("");
      setEssay("");
      toast("REV saved");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save REV", "danger");
    } finally {
      setSaving(false);
    }
  }

  const newTotal = paperTotal(toNumber(mcq), toNumber(structured), toNumber(essay));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-title font-semibold text-paper">REV Numbers</h1>

      <Card className="flex flex-col gap-3">
        <span className="text-label font-semibold uppercase tracking-wider text-dim">
          Add a REV
        </span>

        <Field
          label="REV No."
          placeholder="e.g. REV 01"
          value={revNo}
          onChange={(e) => setRevNo(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-2">
          <Field
            label="MCQs"
            className="num"
            inputMode="numeric"
            placeholder="0"
            value={mcq}
            onChange={(e) => setMcq(e.target.value)}
          />
          <Field
            label="Structured"
            className="num"
            inputMode="numeric"
            placeholder="0"
            value={structured}
            onChange={(e) => setStructured(e.target.value)}
          />
          <Field
            label="Essays"
            className="num"
            inputMode="numeric"
            placeholder="0"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />
        </div>

        <p className="num text-label text-dim">
          Paper total: {newTotal.toFixed(1)} marks
        </p>

        <Button fullWidth disabled={!revNo.trim()} loading={saving} onClick={save}>
          Save REV
        </Button>
      </Card>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-label font-semibold uppercase tracking-wider text-dim">
            Configured
          </span>
          <span className="text-micro text-dim">{revs.length} total</span>
        </div>

        {revs.length === 0 ? (
          <EmptyState title="No REV numbers yet" hint="Add one above to start marking." />
        ) : (
          revs.map((r) => (
            <Card
              key={r.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-semibold text-paper">{r.rev_no}</span>
                <span className="num text-micro text-dim">
                  MCQ {r.num_mcq} - Structured {r.num_structured} - Essay {r.num_essay}
                </span>
                <span className="num text-micro text-brand-hot">
                  Paper total {paperTotal(r.num_mcq, r.num_structured, r.num_essay).toFixed(1)}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                Edit
              </Button>
            </Card>
          ))
        )}
      </div>

      {editing && (
        <RevEditSheet
          rev={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            toast("REV updated - totals recalculated");
          }}
        />
      )}
    </div>
  );
}

function RevEditSheet({
  rev,
  onClose,
  onSaved,
}: {
  rev: RevConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [revNo, setRevNo] = useState(rev.rev_no);
  const [mcq, setMcq] = useState(String(rev.num_mcq));
  const [structured, setStructured] = useState(String(rev.num_structured));
  const [essay, setEssay] = useState(String(rev.num_essay));
  const [saving, setSaving] = useState(false);

  const total = paperTotal(toNumber(mcq), toNumber(structured), toNumber(essay));

  async function save() {
    if (!revNo.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/revs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rev.id,
          rev_no: revNo.trim(),
          num_mcq: toNumber(mcq),
          num_structured: toNumber(structured),
          num_essay: toNumber(essay),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update REV", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Edit ${rev.rev_no}`}
      footer={
        <>
          <Button fullWidth disabled={!revNo.trim()} loading={saving} onClick={save}>
            Save changes
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="REV No."
          value={revNo}
          onChange={(e) => setRevNo(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="MCQs"
            className="num"
            inputMode="numeric"
            value={mcq}
            onChange={(e) => setMcq(e.target.value)}
          />
          <Field
            label="Structured"
            className="num"
            inputMode="numeric"
            value={structured}
            onChange={(e) => setStructured(e.target.value)}
          />
          <Field
            label="Essays"
            className="num"
            inputMode="numeric"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />
        </div>

        <p className="num text-label text-dim">Paper total: {total.toFixed(1)} marks</p>

        <div className="rounded-control border border-warn/40 bg-warn/10 p-3">
          <p className="text-label text-warn">
            Changing these counts recalculates the total mark of every student
            already recorded against {rev.rev_no}, in the app, the rank sheet and
            the Excel export.
          </p>
        </div>
      </div>
    </Sheet>
  );
}
