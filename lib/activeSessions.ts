export interface ActiveSession {
  id: string;
  staffName: string;
  town: string;
  revId: string;
  revNo: string;
  startedAt: string;
  lastActiveAt: string;
  marksCount: number;
  status: "active" | "idle";
}

const g = globalThis as unknown as {
  __activeSessionsMap?: Map<string, ActiveSession>;
};

if (!g.__activeSessionsMap) {
  g.__activeSessionsMap = new Map<string, ActiveSession>();
}

const sessionStore = g.__activeSessionsMap;

const IDLE_THRESHOLD_MS = 5 * 60_000;
const EXPIRE_THRESHOLD_MS = 60 * 60_000;

export function getActiveSessions(): ActiveSession[] {
  const now = Date.now();
  const result: ActiveSession[] = [];

  for (const [id, s] of sessionStore.entries()) {
    const lastActiveTime = new Date(s.lastActiveAt).getTime();
    const diff = now - lastActiveTime;

    // Prune stale sessions older than expiration window
    if (diff > EXPIRE_THRESHOLD_MS) {
      sessionStore.delete(id);
      continue;
    }

    const status: "active" | "idle" = diff > IDLE_THRESHOLD_MS ? "idle" : "active";
    const updated = { ...s, status };
    sessionStore.set(id, updated);
    result.push(updated);
  }

  // Sort: active sessions first, then most recently active
  return result.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "active" ? -1 : 1;
    }
    return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
  });
}

export function upsertActiveSession(data: {
  id: string;
  staffName: string;
  town: string;
  revId: string;
  revNo?: string;
  marksCount?: number;
}): ActiveSession {
  const now = new Date().toISOString();
  const existing = sessionStore.get(data.id);

  const updated: ActiveSession = {
    id: data.id,
    staffName: data.staffName.trim(),
    town: data.town,
    revId: String(data.revId),
    revNo: data.revNo || existing?.revNo || `REV ${data.revId}`,
    startedAt: existing ? existing.startedAt : now,
    lastActiveAt: now,
    marksCount:
      typeof data.marksCount === "number"
        ? data.marksCount
        : (existing?.marksCount ?? 0),
    status: "active",
  };

  sessionStore.set(data.id, updated);
  return updated;
}

export function endActiveSession(id: string): boolean {
  return sessionStore.delete(id);
}

export function clearAllActiveSessions(): void {
  sessionStore.clear();
}
