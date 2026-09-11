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

/** GET /api/revs also reports how many records each REV has. */
type RevRow = RevConfig & { record_count?: number };

function paperTotal(mcq: number, structured: number, essay: number) {
  return mcq + structured * 5 + essay * 7.5;
}

function toNumber(v: string) {
  if (v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function recordsLabel(n: number) {
  return `${n} record${n === 1 ? "" : "s"}`;
}

export default function RevsClient() {
  const toast = useToast();
  const [revs, setRevs] = useState<RevRow[]>([]);
  const [revNo, setRevNo] = useState("");
  const [mcq, setMcq] = useState("");
  const [structured, setStructured] = useState("");
  const [essay, setEssay] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RevRow | null>(null);
  const [deleting, setDeleting] = useState<RevRow | null>(null);

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
                <span className="num text-micro text-dim">
                  {recordsLabel(r.record_count ?? 0)}
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDeleting(null);
                    setEditing(r);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setDeleting(r);
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {editing && (
        <RevEditSheet
          // Keyed by id so switching to a different REV remounts the sheet and
          // reseeds its form state. RevEditSheet seeds from props with
          // useState, which runs only on mount, and Sheet focuses its panel
          // without trapping Tab — so a keyboard user can reach an Edit button
          // behind the open sheet. Without this key that would leave REV A's
          // counts in a form now bound to REV B, and saving would rewrite
          // every student's total for REV B using REV A's question counts.
          key={editing.id}
          rev={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            toast("REV updated - totals recalculated");
          }}
        />
      )}

      {deleting && (
        <RevDeleteSheet
          // Keyed by id for the same reason as RevEditSheet: a name typed to
          // confirm one REV must never carry over to a different one.
          key={deleting.id}
          rev={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(count) => {
            const name = deleting.rev_no;
            setDeleting(null);
            load();
            toast(`${name} deleted - ${recordsLabel(count)} removed`);
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

/**
 * Deleting a REV takes every mark recorded against it, in every town, and
 * cannot be undone - so the button stays disabled until the REV's name is
 * typed exactly. A single confirm tap is too easy to hit on a phone.
 */
function RevDeleteSheet({
  rev,
  onClose,
  onDeleted,
}: {
  rev: RevRow;
  onClose: () => void;
  onDeleted: (deletedRecords: number) => void;
}) {
  const toast = useToast();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  // Exact match, case included: "rev 3" is not "REV 03".
  const confirmed = typed.trim() === rev.rev_no.trim();
  const count = rev.record_count ?? 0;

  async function remove() {
    if (!confirmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/revs?id=${rev.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      // The server's count, not the list's - marks may have landed since the
      // list was loaded.
      onDeleted(Number(data.deleted_records) || 0);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete REV", "danger");
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Delete ${rev.rev_no}`}
      footer={
        <>
          <Button
            variant="danger"
            fullWidth
            disabled={!confirmed}
            loading={busy}
            onClick={remove}
          >
            Delete REV
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-control border border-danger/40 bg-danger/10 p-3">
          <p className="text-label text-danger">
            {count > 0
              ? `This permanently deletes ${rev.rev_no} and the ${recordsLabel(count)} marked against it, in every town. It cannot be undone.`
              : `This permanently deletes ${rev.rev_no}. No marks have been recorded against it.`}
          </p>
        </div>

        <p className="text-label text-dim">
          Student names and mobile numbers are kept, so they still come up as
          suggestions when marking.
        </p>

        <Field
          label={`Type ${rev.rev_no} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void remove();
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
        />
      </div>
    </Sheet>
  );
}
