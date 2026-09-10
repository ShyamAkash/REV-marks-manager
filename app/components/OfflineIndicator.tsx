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
  const { mounted, isOnline, pendingCount, syncing, syncNow } = useOfflineSync();

  if (!mounted) return null;
  if (isOnline && pendingCount === 0) return null;

  const label = !isOnline
    ? pendingCount > 0
      ? `Offline - ${pendingCount} saved locally`
      : "Offline - saving locally"
    : `${pendingCount} to sync`;

  if (variant === "inline") {
    return (
      <span className="flex items-center gap-1.5 text-micro text-warn">
        <StatusDot tone="warn" pulse />
        {label}
      </span>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-label text-paper">
        <StatusDot tone="warn" pulse />
        <span className="truncate">{label}</span>
      </span>
      {isOnline && pendingCount > 0 && (
        <Button variant="secondary" size="sm" loading={syncing} onClick={syncNow}>
          Sync now
        </Button>
      )}
    </div>
  );
}
