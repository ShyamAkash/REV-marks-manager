"use client";

import { useOfflineSync } from "@/lib/useOfflineSync";
import { Button, StatusDot } from "@/app/components/ui";

/**
 * `inline` is used inside Mark mode's session bar.
 * `banner` is used on Manage routes, and renders nothing when there is
 * nothing to report.
 *
 * Every call to `useOfflineSync()` installs its own event listeners and its
 * own 15s interval. Mount at most one `OfflineIndicator` per rendered route.
 */
export function OfflineIndicator({
  variant = "banner",
}: {
  variant?: "inline" | "banner";
}) {
  const { mounted, isOnline, pendingCount, syncing, justSynced, syncNow } =
    useOfflineSync();

  if (!mounted) return null;
  // Stay visible while confirming a sync, otherwise the indicator vanishes the
  // instant the queue empties and the marker never learns their offline records
  // landed.
  if (isOnline && pendingCount === 0 && justSynced === null) return null;

  const confirming = justSynced !== null;
  const tone = confirming ? "ok" : "warn";
  const label = confirming
    ? `Synced ${justSynced} record${justSynced === 1 ? "" : "s"}`
    : !isOnline
      ? pendingCount > 0
        ? `Offline - ${pendingCount} saved locally`
        : "Offline - saving locally"
      : `${pendingCount} to sync`;

  if (variant === "inline") {
    return (
      <span
        className={`flex items-center gap-1.5 text-micro ${
          confirming ? "text-ok" : "text-warn"
        }`}
      >
        <StatusDot tone={tone} pulse={!confirming} />
        {label}
      </span>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-label text-paper">
        <StatusDot tone={tone} pulse={!confirming} />
        <span className={`truncate ${confirming ? "text-ok" : ""}`}>{label}</span>
      </span>
      {isOnline && pendingCount > 0 && (
        <Button variant="secondary" size="sm" loading={syncing} onClick={syncNow}>
          Sync now
        </Button>
      )}
    </div>
  );
}
