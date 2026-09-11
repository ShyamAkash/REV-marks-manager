"use client";

import { calcTotal, type RevConfig } from "@/lib/calc";
import { formatMark, formatTotal } from "@/lib/format";
import { Button, Sheet } from "@/app/components/ui";
import type { MarkEntry } from "./types";

type Marks = Pick<MarkEntry, "mcq_mark" | "structured_mark" | "essay_mark">;

const ROWS = [
  { mark: "mcq_mark", count: "num_mcq", label: "MCQ" },
  { mark: "structured_mark", count: "num_structured", label: "Struct" },
  { mark: "essay_mark", count: "num_essay", label: "Essay" },
] as const;

/**
 * Opened by Save when this student already has a record in the session's
 * town + REV. Two answers: overwrite that record with the marks just typed, or
 * discard them and keep the old ones.
 *
 * Closing the sheet (✕, backdrop, Escape) is deliberately neither - it goes
 * back to the form with everything still typed, so a mistyped mobile number
 * can be fixed instead of forcing a choice about the wrong student.
 */
export function DuplicateSheet({
  existing,
  incoming,
  currentRev,
  replacing,
  onReplace,
  onKeep,
  onClose,
}: {
  /** The record already stored (or still queued). Null keeps the sheet closed. */
  existing: MarkEntry | null;
  incoming: Marks;
  currentRev: RevConfig | null;
  replacing: boolean;
  onReplace: () => void;
  onKeep: () => void;
  onClose: () => void;
}) {
  if (!existing) return null;

  // Same rule as the form: while the REV is still loading, show every type.
  const rows = ROWS.filter((r) => !currentRev || Number(currentRev[r.count]) > 0);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Already marked"
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button fullWidth loading={replacing} onClick={onReplace}>
            Replace with new marks
          </Button>
          <Button variant="secondary" fullWidth disabled={replacing} onClick={onKeep}>
            Keep old marks
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-body font-semibold text-paper">
            {existing.student_name || "No name"}
          </span>
          <span className="text-label text-dim">
            <span className="num">{existing.phone_no || "No mobile"}</span>
            {existing.isOffline
              ? " · waiting to sync"
              : existing.staff
                ? ` · saved by ${existing.staff}`
                : ""}
          </span>
        </div>

        <table className="w-full text-label">
          <thead>
            <tr className="text-micro uppercase tracking-wider text-dim">
              <th className="py-1 text-left font-medium">
                <span className="sr-only">Mark</span>
              </th>
              <th className="py-1 text-right font-medium">Old</th>
              <th className="py-1 text-right font-medium">New</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mark} className="border-t border-line">
                <td className="py-2 text-dim">{r.label}</td>
                <td className="num py-2 text-right text-paper">
                  {formatMark(existing[r.mark])}
                </td>
                <td className="num py-2 text-right text-paper">
                  {formatMark(incoming[r.mark])}
                </td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="py-2 font-semibold text-paper">Total</td>
              <td className="num py-2 text-right font-semibold text-paper">
                {formatTotal(calcTotal(existing, currentRev))}
              </td>
              <td className="num py-2 text-right font-semibold text-brand-hot">
                {formatTotal(calcTotal(incoming, currentRev))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}
