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

const QUEUE_KEY = "revmarks_offline_queue";

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

export async function syncOfflineQueue(): Promise<{ syncedCount: number; remainingCount: number }> {
  if (typeof window === "undefined") return { syncedCount: 0, remainingCount: 0 };
  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

  let syncedCount = 0;
  const remaining: OfflineRecord[] = [];

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

      if (res.ok) {
        syncedCount++;
      } else {
        remaining.push(item);
      }
    } catch {
      // Network failure, keep this and rest in queue
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  return { syncedCount, remainingCount: remaining.length };
}
