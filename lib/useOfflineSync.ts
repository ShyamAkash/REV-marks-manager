"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOfflineQueue, syncOfflineQueue, QUEUE_KEY } from "@/lib/offlineQueue";
import { triggerHaptic } from "@/lib/haptics";

const POLL_MS = 15000;

export interface OfflineSyncState {
  /** False during SSR and first hydration - render nothing status-related until true. */
  mounted: boolean;
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  /**
   * How many records the last successful drain uploaded, held for 2.5s so the
   * UI can confirm it, then cleared. Without this the indicator simply vanishes
   * once the queue empties, which is indistinguishable from "nothing was ever
   * queued" — and this is the one moment a marker needs to know their offline
   * work actually reached the server.
   */
  justSynced: number | null;
  syncNow: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState<number | null>(null);

  // Held in a ref so the interval and event listeners never capture a stale
  // version of the callback.
  const syncingRef = useRef(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const { syncedCount, remainingCount } = await syncOfflineQueue();
      setPendingCount(remainingCount);
      if (syncedCount > 0) {
        triggerHaptic("success");
        setJustSynced(syncedCount);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = setTimeout(() => setJustSynced(null), 2500);
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);
    setPendingCount(getOfflineQueue().length);

    const onOnline = () => {
      setIsOnline(true);
      triggerHaptic("light");
      void syncNow();
    };
    const onOffline = () => {
      setIsOnline(false);
      triggerHaptic("warning");
    };
    const onQueueUpdated = () => setPendingCount(getOfflineQueue().length);

    // `revmarks-queue-updated` is dispatched on this tab's window only, so it
    // never crosses tabs. When another tab drains the shared queue we hear about
    // it here instead — without this, a second tab keeps displaying a count for
    // records that are already uploaded. (`key === null` is a storage clear.)
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === QUEUE_KEY) onQueueUpdated();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("revmarks-queue-updated", onQueueUpdated);
    window.addEventListener("storage", onStorage);

    const interval = setInterval(() => {
      if (navigator.onLine && getOfflineQueue().length > 0) void syncNow();
    }, POLL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("revmarks-queue-updated", onQueueUpdated);
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, [syncNow]);

  return { mounted, isOnline, pendingCount, syncing, justSynced, syncNow };
}
