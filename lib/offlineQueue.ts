export type OfflineRecord = {
  tempId: string;
  town: string;
  rev_id: number;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff: string | null;
  created_at: string;
};

export const QUEUE_KEY = "revmarks_offline_queue";

const SYNC_LOCK_NAME = "revmarks_sync";
const SYNC_LOCK_KEY = "revmarks_sync_lock";
/**
 * Long enough to cover a slow drain of a large queue, short enough that a tab
 * killed mid-drain (phone closes the browser to reclaim memory) does not block
 * syncing for the rest of the session. Only the fallback path uses it — Web
 * Locks releases automatically when a tab dies.
 */
const SYNC_LOCK_TTL_MS = 60_000;

/**
 * Runs `drain` only if no other tab is already draining, returning `skipped`
 * when one is.
 *
 * The queue lives in localStorage, which every tab of the app shares, but each
 * tab runs its own sync engine. Without this, two open tabs both drain the same
 * records and the database ends up with duplicate rows for one student.
 *
 * Web Locks is the real mechanism: the browser arbitrates between tabs and
 * releases the lock automatically if a tab crashes. `ifAvailable` means we skip
 * rather than queue up behind the other tab — a drain we skip is retried by the
 * next interval anyway, so waiting buys nothing.
 */
async function withSyncLock<T>(drain: () => Promise<T>, skipped: T): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;

  if (locks?.request) {
    return await locks.request(
      SYNC_LOCK_NAME,
      { ifAvailable: true },
      async (lock) => (lock ? await drain() : skipped)
    );
  }

  // Fallback for browsers without Web Locks (Safari before 15.4). A timestamped
  // claim in localStorage cannot be made atomic, so the write-then-reread below
  // is best effort: it closes the window to the few milliseconds between two
  // tabs claiming, instead of leaving it wide open for the whole upload.
  const owner = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  try {
    const raw = localStorage.getItem(SYNC_LOCK_KEY);
    const held = raw ? (JSON.parse(raw) as { owner: string; expiresAt: number }) : null;
    if (held && held.expiresAt > Date.now()) return skipped;

    localStorage.setItem(
      SYNC_LOCK_KEY,
      JSON.stringify({ owner, expiresAt: Date.now() + SYNC_LOCK_TTL_MS })
    );
    await new Promise((r) => setTimeout(r, 50));

    const confirmRaw = localStorage.getItem(SYNC_LOCK_KEY);
    const confirmed = confirmRaw
      ? (JSON.parse(confirmRaw) as { owner: string })
      : null;
    // Another tab overwrote our claim, so it owns the drain and we stand down.
    if (confirmed?.owner !== owner) return skipped;
  } catch {
    // localStorage unavailable (Safari private browsing). Draining unlocked is
    // still better than never syncing at all.
    return await drain();
  }

  try {
    return await drain();
  } finally {
    try {
      const raw = localStorage.getItem(SYNC_LOCK_KEY);
      const held = raw ? (JSON.parse(raw) as { owner: string }) : null;
      if (held?.owner === owner) localStorage.removeItem(SYNC_LOCK_KEY);
    } catch {}
  }
}

export function getOfflineQueue(): OfflineRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("revmarks-queue-updated", { detail: queue }));
  } catch {}
}

export function addOfflineRecord(
  rec: Omit<OfflineRecord, "tempId" | "created_at">
): OfflineRecord {
  const queue = getOfflineQueue();
  const newRec: OfflineRecord = {
    ...rec,
    tempId: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  queue.push(newRec);
  saveOfflineQueue(queue);
  return newRec;
}

export function removeOfflineRecord(tempId: string) {
  const queue = getOfflineQueue().filter((r) => r.tempId !== tempId);
  saveOfflineQueue(queue);
}

export function updateOfflineRecord(tempId: string, updates: Partial<OfflineRecord>) {
  const queue = getOfflineQueue().map((r) => {
    if (r.tempId === tempId) {
      return { ...r, ...updates };
    }
    return r;
  });
  saveOfflineQueue(queue);
}

/**
 * Uploads every queued record, then removes from the queue only the records
 * this drain actually uploaded.
 *
 * The re-read at the end is load-bearing. A marker keeps working while a sync
 * runs, and on a slow connection that drain takes seconds. Any mark saved in
 * that window lands in localStorage after our snapshot was taken, so writing
 * the snapshot's leftovers back would erase it - silently, with the marker
 * already looking at the next student. Filtering the *current* queue by the
 * tempIds we uploaded keeps those late arrivals.
 *
 * Held under a cross-tab lock so two open tabs cannot upload the same records
 * twice — see `withSyncLock`.
 */
export async function syncOfflineQueue(): Promise<{ syncedCount: number; remainingCount: number }> {
  if (typeof window === "undefined") return { syncedCount: 0, remainingCount: 0 };
  if (getOfflineQueue().length === 0) return { syncedCount: 0, remainingCount: 0 };

  return await withSyncLock(drainQueue, {
    syncedCount: 0,
    remainingCount: getOfflineQueue().length,
  });
}

async function drainQueue(): Promise<{ syncedCount: number; remainingCount: number }> {
  // Re-read inside the lock: we may have waited for another tab, and it may
  // have already uploaded some or all of what we saw before acquiring.
  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

  const syncedIds = new Set<string>();

  for (const item of queue) {
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          town: item.town,
          rev_id: item.rev_id,
          student_name: item.student_name,
          phone_no: item.phone_no,
          mcq_mark: item.mcq_mark,
          structured_mark: item.structured_mark,
          essay_mark: item.essay_mark,
          staff: item.staff,
        }),
      });

      if (res.ok) syncedIds.add(item.tempId);
    } catch {
      // Network failure - leave it queued for the next drain.
    }
  }

  // Nothing uploaded, so nothing to remove. Skipping the write also avoids
  // firing a queue-updated event that changes no state.
  if (syncedIds.size === 0) {
    return { syncedCount: 0, remainingCount: getOfflineQueue().length };
  }

  const remaining = getOfflineQueue().filter((r) => !syncedIds.has(r.tempId));
  saveOfflineQueue(remaining);
  return { syncedCount: syncedIds.size, remainingCount: remaining.length };
}
