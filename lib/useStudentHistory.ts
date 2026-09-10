"use client";

import { useEffect, useMemo, useState } from "react";
import { phoneDigits } from "@/lib/phone";

export interface HistoryStudent {
  student_name: string;
  phone_no: string | null;
}

const MAX_SUGGESTIONS = 3;
const MIN_PHONE_DIGITS = 4;
const MIN_NAME_CHARS = 2;

/**
 * Returning students for one town, with the matchers the entry form needs.
 *
 * Scoped to a town rather than the whole database — see the comment in
 * app/api/students/history/route.ts for why.
 */
export function useStudentHistory(town: string | null | undefined) {
  const [students, setStudents] = useState<HistoryStudent[]>([]);

  useEffect(() => {
    if (!town) {
      setStudents([]);
      return;
    }

    // Guards against a slow response for a previous town landing after the
    // marker has already switched, which would suggest the wrong town's students.
    let cancelled = false;

    fetch(`/api/students/history?town=${encodeURIComponent(town)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.students)) setStudents(d.students);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [town]);

  return students;
}

/** Students whose number contains the digits typed so far. */
export function matchByPhone(
  students: HistoryStudent[],
  typed: string
): HistoryStudent[] {
  const digits = phoneDigits(typed);
  if (digits.length < MIN_PHONE_DIGITS) return [];
  return students
    .filter((s) => s.phone_no && phoneDigits(s.phone_no).includes(digits))
    .slice(0, MAX_SUGGESTIONS);
}

/** Students whose name contains what has been typed so far. */
export function matchByName(
  students: HistoryStudent[],
  typed: string
): HistoryStudent[] {
  const needle = typed.trim().toLowerCase();
  if (needle.length < MIN_NAME_CHARS) return [];
  return students
    .filter((s) => s.student_name.toLowerCase().includes(needle))
    .slice(0, MAX_SUGGESTIONS);
}
