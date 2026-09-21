"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RevConfig } from "@/lib/calc";
import { getAuthHeaders } from "@/app/components/PasswordGate";

// Unchanged from the previous implementation on purpose - see constraint above.
const SESSION_KEY = "marks_session_v2";
const LAST_STAFF_KEY = "revmarks_last_staff";
const SESSION_ID_KEY = "revmarks_active_session_id";

export interface MarkSession {
  town: string;
  revId: string;
  checkedBy: string;
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }
}

export function useMarkSession() {
  const [session, setSession] = useState<MarkSession | null>(null);
  const [revs, setRevs] = useState<RevConfig[]>([]);
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const marksCountRef = useRef<number>(0);

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});

    try {
      const sid = getOrCreateSessionId();
      setSessionId(sid);

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

  const currentRev = useMemo(
    () => revs.find((r) => String(r.id) === session?.revId) ?? null,
    [revs, session]
  );

  // Send periodic heartbeat to keep the active session registered for admins
  useEffect(() => {
    if (!session || !sessionId) return;

    const reportHeartbeat = () => {
      fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          id: sessionId,
          staffName: session.checkedBy,
          town: session.town,
          revId: session.revId,
          revNo: currentRev?.rev_no,
          marksCount: marksCountRef.current,
        }),
      }).catch(() => {});
    };

    reportHeartbeat();
    const interval = setInterval(reportHeartbeat, 25_000);

    return () => clearInterval(interval);
  }, [session, sessionId, currentRev]);

  const startSession = useCallback(
    (s: MarkSession) => {
      const sid = getOrCreateSessionId();
      setSessionId(sid);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      try {
        localStorage.setItem(LAST_STAFF_KEY, s.checkedBy);
      } catch {}
      setSession(s);

      const revObj = revs.find((r) => String(r.id) === String(s.revId));

      // Immediate registration
      fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          id: sid,
          staffName: s.checkedBy,
          town: s.town,
          revId: s.revId,
          revNo: revObj?.rev_no,
          marksCount: marksCountRef.current,
        }),
      }).catch(() => {});
    },
    [revs]
  );

  const endSession = useCallback(() => {
    const sid = sessionId || getOrCreateSessionId();
    if (sid) {
      fetch(`/api/sessions?id=${encodeURIComponent(sid)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      }).catch(() => {});
    }
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_ID_KEY);
    } catch {}
    marksCountRef.current = 0;
    setSession(null);
    setSessionId("");
  }, [sessionId]);

  const reportMarksCount = useCallback(
    (count: number) => {
      marksCountRef.current = count;
      if (!session || !sessionId) return;
      fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          id: sessionId,
          staffName: session.checkedBy,
          town: session.town,
          revId: session.revId,
          revNo: currentRev?.rev_no,
          marksCount: count,
        }),
      }).catch(() => {});
    },
    [session, sessionId, currentRev]
  );

  return {
    session,
    revs,
    currentRev,
    startSession,
    endSession,
    reportMarksCount,
    ready,
  };
}

export function getLastStaff(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LAST_STAFF_KEY) ?? "";
  } catch {
    return "";
  }
}
