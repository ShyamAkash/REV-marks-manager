"use client";

import { useEffect, useState } from "react";
import { calcTotal, type RevConfig } from "@/lib/calc";
import { formatTotal, formatMark } from "@/lib/format";
import { triggerHaptic } from "@/lib/haptics";
import { updateOfflineRecord } from "@/lib/offlineQueue";
import {
  Button,
  EmptyState,
  Field,
  Sheet,
  useToast,
} from "@/app/components/ui";
import type { MarkEntry } from "./types";

function toNumber(value: string): number {
  if (value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function SessionEntriesSheet({
  open,
  onClose,
  entries,
  currentRev,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  entries: MarkEntry[];
  currentRev: RevConfig | null;
  onUpdated: (entry: MarkEntry) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<MarkEntry | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mcq, setMcq] = useState("");
  const [structured, setStructured] = useState("");
  const [essay, setEssay] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  function beginEdit(entry: MarkEntry) {
    triggerHaptic("light");
    setEditing(entry);
    setName(entry.student_name ?? "");
    setPhone(entry.phone_no ?? "");
    setMcq(String(entry.mcq_mark ?? ""));
    setStructured(String(entry.structured_mark ?? ""));
    setEssay(String(entry.essay_mark ?? ""));
  }

  async function saveEdit() {
    if (!editing || saving) return;
    setSaving(true);

    const updated = {
      student_name: name.trim() || null,
      phone_no: phone.trim() || null,
      mcq_mark: toNumber(mcq),
      structured_mark: toNumber(structured),
      essay_mark: toNumber(essay),
    };
    const total = calcTotal(updated, currentRev);

    try {
      if (editing.isOffline && editing.tempId) {
        updateOfflineRecord(editing.tempId, updated);
      } else if (editing.id) {
        // PUT, not PATCH - PATCH is not exported by /api/records/[id].
        const res = await fetch(`/api/records/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (!res.ok) throw new Error("Failed to update");
      }
      onUpdated({ ...editing, ...updated, total });
      triggerHaptic("success");
      toast("Updated");
      setEditing(null);
    } catch {
      triggerHaptic("error");
      toast("Could not update", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Sheet
        open={open}
        onClose={() => setEditing(null)}
        title="Edit entry"
        footer={
          <>
            <Button fullWidth loading={saving} onClick={saveEdit}>
              Save changes
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field
            label="Student name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Mobile"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2">
            <Field
              label="MCQ"
              className="num"
              inputMode="decimal"
              value={mcq}
              onChange={(e) => setMcq(e.target.value)}
            />
            <Field
              label="Struct"
              className="num"
              inputMode="decimal"
              value={structured}
              onChange={(e) => setStructured(e.target.value)}
            />
            <Field
              label="Essay"
              className="num"
              inputMode="decimal"
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
            />
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={`This session (${entries.length})`}>
      {entries.length === 0 ? (
        <EmptyState
          title="No entries yet"
          hint="Records you save appear here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <li
              key={entry.id ?? entry.tempId ?? i}
              className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface p-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 truncate text-body text-paper">
                  {entry.student_name || "No name"}
                  {entry.isOffline && (
                    <span className="shrink-0 rounded border border-warn/40 bg-warn/15 px-1.5 text-micro text-warn">
                      Offline
                    </span>
                  )}
                </span>
                <span className="num truncate text-micro text-dim">
                  {entry.phone_no || "No mobile"} - M {formatMark(entry.mcq_mark)} / S{" "}
                  {formatMark(entry.structured_mark)} / E {formatMark(entry.essay_mark)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="num text-body font-semibold text-paper">
                  {formatTotal(entry.total)}
                </span>
                <Button variant="secondary" size="sm" onClick={() => beginEdit(entry)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
