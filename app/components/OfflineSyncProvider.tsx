"use client";

import { createContext, useContext } from "react";
import { useOfflineSync, type OfflineSyncState } from "@/lib/useOfflineSync";

const OfflineSyncContext = createContext<OfflineSyncState | null>(null);

/**
 * Runs the queue-draining engine once for the whole app, from the root layout.
 *
 * It used to run inside `OfflineIndicator`, which meant syncing only happened
 * on screens that had something to display. A marker with queued records who
 * opened the app and sat on the town/REV picker got no drain at all, because
 * Mark mode's indicator lives inside the session bar and that bar only renders
 * once a session is started.
 *
 * Hoisting it here also removes the old footgun: every `useOfflineSync()` call
 * installs its own listeners and its own 15s interval, so two indicators on one
 * route meant two drains racing to upload the same records. There is now
 * exactly one engine, and `OfflineIndicator` is pure display.
 */
export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const state = useOfflineSync();
  return (
    <OfflineSyncContext.Provider value={state}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncState(): OfflineSyncState {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error(
      "useOfflineSyncState must be used inside <OfflineSyncProvider> (mounted in app/layout.tsx)"
    );
  }
  return ctx;
}
