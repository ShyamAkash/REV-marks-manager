"use client";

import { useCallback, useEffect, useState } from "react";
import { calcTotal } from "@/lib/calc";
import { formatTotal } from "@/lib/format";
import { getOfflineQueue } from "@/lib/offlineQueue";
import { Button, Card, Skeleton } from "@/app/components/ui";
import { OfflineIndicator } from "@/app/components/OfflineIndicator";
import { InstallPrompt } from "@/app/components/InstallPrompt";
import { MarkForm } from "./MarkForm";
import { SessionEntriesSheet } from "./SessionEntriesSheet";
import { SessionStart } from "./SessionStart";
import { useMarkSession } from "./useMarkSession";
import type { MarkEntry } from "./types";

export function MarkScreen() {
  const { session, revs, currentRev, startSession, endSession, ready } =
    useMarkSession();
  const [entries, setEntries] = useState<MarkEntry[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!session) return;

    const queued: MarkEntry[] = getOfflineQueue()
      .filter((q) => String(q.rev_id) === session.revId)
      .map((q) => ({
        tempId: q.tempId,
        student_name: q.student_name,
        phone_no: q.phone_no,
        mcq_mark: q.mcq_mark,
        structured_mark: q.structured_mark,
        essay_mark: q.essay_mark,
        staff: q.staff,
        total: calcTotal(q, currentRev),
        isOffline: true,
      }));

    try {
      const res = await fetch(
        `/api/records?town=${encodeURIComponent(session.town)}&rev_id=${session.revId}`
      );
      const data = await res.json();
      const saved: MarkEntry[] = (data.records || []).map((r: MarkEntry & { total: number }) => ({
        id: r.id,
        student_name: r.student_name,
        phone_no: r.phone_no,
        mcq_mark: Number(r.mcq_mark),
        structured_mark: Number(r.structured_mark),
        essay_mark: Number(r.essay_mark),
        staff: r.staff,
        total: r.total,
        isOffline: false,
      }));
      setEntries([...queued, ...saved]);
    } catch {
      setEntries(queued);
    }
  }, [session, currentRev]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  function handleSaved(entry: MarkEntry) {
    setEntries((prev) => [entry, ...prev]);
  }

  function handleUpdated(entry: MarkEntry) {
    setEntries((prev) =>
      prev.map((e) =>
        (entry.id && e.id === entry.id) ||
        (entry.tempId && e.tempId === entry.tempId)
          ? entry
          : e
      )
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        {/* Someone reopening the app with records still queued lands here, so
            this is exactly where they need to see that those marks are waiting
            and watch them go. */}
        <OfflineIndicator variant="banner" />
        <InstallPrompt />
        <SessionStart revs={revs} onStart={startSession} />
      </div>
    );
  }

  const last = entries[0];

  return (
    <div className="flex flex-col gap-4">
      <Card padded={false} className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-label font-semibold text-paper">
              {session.town} - {currentRev?.rev_no ?? `REV ${session.revId}`}
            </span>
            <span className="flex items-center gap-2 truncate text-micro text-dim">
              {session.checkedBy}
              <OfflineIndicator variant="inline" />
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={endSession}>
            Change
          </Button>
        </div>
      </Card>

      <MarkForm
        session={session}
        currentRev={currentRev}
        entries={entries}
        onSaved={handleSaved}
      />

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface px-3 py-3 text-left transition-colors hover:border-dim"
      >
        <span className="min-w-0 truncate text-label text-dim">
          {last ? (
            <>
              Last: <span className="text-paper">{last.student_name || "No name"}</span>
            </>
          ) : (
            "No entries yet this session"
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {last && (
            <span className="num text-label font-semibold text-paper">
              {formatTotal(last.total)}
            </span>
          )}
          <span className="text-micro text-brand-hot">
            View all ({entries.length})
          </span>
        </span>
      </button>

      <SessionEntriesSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        entries={entries}
        currentRev={currentRev}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
