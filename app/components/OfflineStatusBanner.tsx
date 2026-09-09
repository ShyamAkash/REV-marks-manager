"use client";

import { useEffect, useState } from "react";
import { getOfflineQueue, syncOfflineQueue } from "@/lib/offlineQueue";
import { triggerHaptic } from "@/lib/haptics";

export function OfflineStatusBanner() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const refreshCount = () => {
    setPendingCount(getOfflineQueue().length);
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    triggerHaptic("light");
    try {
      const { syncedCount, remainingCount } = await syncOfflineQueue();
      setPendingCount(remainingCount);
      if (syncedCount > 0) {
        triggerHaptic("success");
        setSyncMessage(`Synced ${syncedCount} record${syncedCount > 1 ? "s" : ""}`);
        setTimeout(() => setSyncMessage(null), 2500);
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    refreshCount();

    const onOnline = () => {
      setIsOnline(true);
      triggerHaptic("light");
      handleSync();
    };

    const onOffline = () => {
      setIsOnline(false);
      triggerHaptic("warning");
    };

    const onQueueUpdated = () => {
      refreshCount();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("revmarks-queue-updated", onQueueUpdated);

    // Periodic check every 15 seconds if online and items exist
    const interval = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine && getOfflineQueue().length > 0) {
        handleSync();
      }
    }, 15000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("revmarks-queue-updated", onQueueUpdated);
      clearInterval(interval);
    };
  }, []);

  // During SSR and initial client hydration, don't render to prevent mismatch
  if (!mounted) {
    return null;
  }

  // Do not show anything if online and no pending records and no message
  if (isOnline && pendingCount === 0 && !syncMessage) {
    return null;
  }

  return (
    <div className="mx-4 mt-2 px-3 py-2 rounded-xl border border-line bg-surface/95 text-xs flex items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            !isOnline
              ? "bg-amber-400 animate-pulse"
              : pendingCount > 0
              ? "bg-yellow-400 animate-pulse"
              : "bg-emerald-400"
          }`}
        />
        <span className="truncate text-[11px] text-paper">
          {syncMessage ? (
            <span className="text-emerald-400 font-medium">{syncMessage}</span>
          ) : !isOnline ? (
            <span>
              <strong className="font-semibold text-amber-400">Offline Mode</strong> ·{" "}
              {pendingCount > 0
                ? `${pendingCount} saved locally`
                : "Safe to mark (saves locally)"}
            </span>
          ) : pendingCount > 0 ? (
            <span>
              <strong className="text-paper">{pendingCount} offline record{pendingCount > 1 ? "s" : ""}</strong> ready to sync
            </span>
          ) : (
            <span className="text-emerald-400">Back online · Connected</span>
          )}
        </span>
      </div>

      {pendingCount > 0 && isOnline && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-outline text-[11px] !py-1 !px-2.5 shrink-0"
        >
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
      )}
    </div>
  );
}
