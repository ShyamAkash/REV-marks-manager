"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOfflineQueue, syncOfflineQueue } from "@/lib/offlineQueue";
import { triggerHaptic } from "@/lib/haptics";

const POLL_MS = 15000;

export interface OfflineSyncState {
  /** False during SSR and first hydration - render nothing status-related until true. */
  mounted: boolean;
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  syncNow: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Held in a ref so the interval and event listeners never capture a stale
  // version of the callback.
  const syncingRef = useRef(false);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const { syncedCount, remainingCount } = await syncOfflineQueue();
      setPendingCount(remainingCount);
      if (syncedCount > 0) triggerHaptic("success");
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

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("revmarks-queue-updated", onQueueUpdated);

    const interval = setInterval(() => {
      if (navigator.onLine && getOfflineQueue().length > 0) void syncNow();
    }, POLL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("revmarks-queue-updated", onQueueUpdated);
      clearInterval(interval);
    };
  }, [syncNow]);

  return { mounted, isOnline, pendingCount, syncing, syncNow };
}
