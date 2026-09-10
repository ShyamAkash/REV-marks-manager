"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RevConfig } from "@/lib/calc";

// Unchanged from the previous implementation on purpose - see constraint above.
const SESSION_KEY = "marks_session_v2";
const LAST_STAFF_KEY = "revmarks_last_staff";

export interface MarkSession {
  town: string;
  revId: string;
  checkedBy: string;
}

export function useMarkSession() {
  const [session, setSession] = useState<MarkSession | null>(null);
  const [revs, setRevs] = useState<RevConfig[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});

    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.town && s?.revId && s?.checkedBy) {
          setSession({
            town: s.town,
            revId: String(s.revId),
            checkedBy: s.checkedBy,
          });
        }
      }
    } catch {}

    setReady(true);
  }, []);

  const startSession = useCallback((s: MarkSession) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    // Remembered across sessions so the marker does not retype their own name.
    localStorage.setItem(LAST_STAFF_KEY, s.checkedBy);
    setSession(s);
  }, []);

  const endSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const currentRev = useMemo(
    () => revs.find((r) => String(r.id) === session?.revId) ?? null,
    [revs, session]
  );

  return { session, revs, currentRev, startSession, endSession, ready };
}

export function getLastStaff(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LAST_STAFF_KEY) ?? "";
  } catch {
    return "";
  }
}
