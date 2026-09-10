"use client";

import { useMemo, useRef, useState } from "react";
import { calcTotal, type RevConfig } from "@/lib/calc";
import { formatTotal } from "@/lib/format";
import { triggerHaptic } from "@/lib/haptics";
import { addOfflineRecord } from "@/lib/offlineQueue";
import { formatSriLankanPhone, phoneDigits } from "@/lib/phone";
import {
  matchByName,
  matchByPhone,
  useStudentHistory,
  type HistoryStudent,
} from "@/lib/useStudentHistory";
import { Button, Field, useToast } from "@/app/components/ui";
import type { MarkSession } from "./useMarkSession";
import type { MarkEntry } from "./types";

type MarkKey = "mcq" | "structured" | "essay";

/**
 * Written out as whole class names because Tailwind scans source text — a
 * computed `grid-cols-${n}` would never be generated.
 */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/** Blank marks are deliberately valid and store as 0 - students often omit details. */
function toNumber(value: string): number {
  if (value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function MarkForm({
  session,
  currentRev,
  entries,
  onSaved,
}: {
  session: MarkSession;
  currentRev: RevConfig | null;
  /**
   * Records already in this session (town + REV), used to warn about a
   * duplicate before it is saved. MarkScreen has already fetched these for the
   * entries list, so reusing them avoids a second request for the same data.
   */
  entries: MarkEntry[];
  onSaved: (entry: MarkEntry) => void;
}) {
  const toast = useToast();

  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [mcq, setMcq] = useState("");
  const [structured, setStructured] = useState("");
  const [essay, setEssay] = useState("");
  const [saving, setSaving] = useState(false);

  // Returning students for this town only.
  const history = useStudentHistory(session.town);
  const nameSuggestions = useMemo(
    () => matchByName(history, studentName),
    [history, studentName]
  );
  const phoneSuggestions = useMemo(
    () => matchByPhone(history, phone),
    [history, phone]
  );

  /**
   * Warn when this student already has a record in this town + REV. Phone is
   * checked first because it is the stronger identifier — two students can
   * share a name, but not a number.
   */
  const duplicate = useMemo(() => {
    const typedDigits = phoneDigits(phone);
    if (typedDigits.length >= 9) {
      const byPhone = entries.find(
        (e) => e.phone_no && phoneDigits(e.phone_no) === typedDigits
      );
      if (byPhone) return { by: "mobile" as const, entry: byPhone };
    }

    const typedName = studentName.trim().toLowerCase();
    if (typedName.length >= 3) {
      const byName = entries.find(
        (e) => (e.student_name ?? "").trim().toLowerCase() === typedName
      );
      if (byName) return { by: "name" as const, entry: byName };
    }

    return null;
  }, [phone, studentName, entries]);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const mcqRef = useRef<HTMLInputElement>(null);
  const structuredRef = useRef<HTMLInputElement>(null);
  const essayRef = useRef<HTMLInputElement>(null);

  const maxMcq = currentRev && Number(currentRev.num_mcq) > 0 ? Number(currentRev.num_mcq) : null;
  const maxStructured =
    currentRev && Number(currentRev.num_structured) > 0
      ? Number(currentRev.num_structured) * 5
      : null;
  const maxEssay =
    currentRev && Number(currentRev.num_essay) > 0
      ? Number(currentRev.num_essay) * 7.5
      : null;

  const overMcq = maxMcq !== null && mcq !== "" && Number(mcq) > maxMcq;
  const overStructured =
    maxStructured !== null && structured !== "" && Number(structured) > maxStructured;
  const overEssay = maxEssay !== null && essay !== "" && Number(essay) > maxEssay;
  /**
   * A paper that has none of a question type gets no input for it. Some papers
   * have no structured essays, so the REV is configured with 0 — showing a box
   * that can only ever be 0 costs the marker a field in the Enter chain for
   * nothing.
   *
   * While currentRev is still loading every field shows: defaulting to visible
   * means a slow load never hides an input the marker needs, whereas defaulting
   * to hidden would briefly lose fields on every session start.
   */
  const showMcq = !currentRev || Number(currentRev.num_mcq) > 0;
  const showStructured = !currentRev || Number(currentRev.num_structured) > 0;
  const showEssay = !currentRev || Number(currentRev.num_essay) > 0;

  const anyOver =
    (showMcq && overMcq) ||
    (showStructured && overStructured) ||
    (showEssay && overEssay);

  // Only the fields actually on screen count towards "all marks in".
  const allMarksEntered =
    (!showMcq || mcq !== "") &&
    (!showStructured || structured !== "") &&
    (!showEssay || essay !== "") &&
    (showMcq || showStructured || showEssay);

  const liveTotal = useMemo(() => {
    if (!currentRev) return 0;
    return calcTotal(
      {
        mcq_mark: toNumber(mcq),
        structured_mark: toNumber(structured),
        essay_mark: toNumber(essay),
      },
      currentRev
    );
  }, [mcq, structured, essay, currentRev]);

  function resetAndRefocus() {
    setStudentName("");
    setPhone("");
    setMcq("");
    setStructured("");
    setEssay("");
    window.setTimeout(() => {
      nameRef.current?.focus();
      nameRef.current?.select();
    }, 50);
  }

  async function save() {
    if (saving) return;
    setSaving(true);

    const payload = {
      town: session.town,
      rev_id: Number(session.revId),
      staff: session.checkedBy,
      student_name: studentName.trim() || null,
      phone_no: phone.trim() || null,
      mcq_mark: toNumber(mcq),
      structured_mark: toNumber(structured),
      essay_mark: toNumber(essay),
    };
    const total = calcTotal(payload, currentRev);

    function queueOffline(message: string) {
      const queued = addOfflineRecord(payload);
      onSaved({ ...payload, tempId: queued.tempId, total, isOffline: true });
      triggerHaptic("warning");
      toast(message, "warn");
      resetAndRefocus();
    }

    if (!navigator.onLine) {
      queueOffline("Saved offline");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      const data = await res.json();
      onSaved({ ...payload, id: data.record?.id, total, isOffline: false });
      triggerHaptic("success");
      toast("Saved");
      resetAndRefocus();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      const networkDown =
        !navigator.onLine ||
        message.includes("Failed to fetch") ||
        message.includes("NetworkError");
      if (networkDown) {
        queueOffline("Connection lost - saved offline");
      } else {
        triggerHaptic("error");
        toast(message, "danger");
      }
    } finally {
      setSaving(false);
    }
  }

  function advanceOn(
    e: React.KeyboardEvent,
    next: React.RefObject<HTMLInputElement | null>
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    triggerHaptic("light");
    next.current?.focus();
    next.current?.select();
  }

  /**
   * The Enter chain runs over whichever mark fields this REV actually has, so
   * a paper with no structured essays goes MCQ -> Essay -> save with nothing
   * to tab past.
   */
  const visibleMarks: MarkKey[] = [
    ...(showMcq ? (["mcq"] as const) : []),
    ...(showStructured ? (["structured"] as const) : []),
    ...(showEssay ? (["essay"] as const) : []),
  ];

  const markRefs: Record<MarkKey, React.RefObject<HTMLInputElement | null>> = {
    mcq: mcqRef,
    structured: structuredRef,
    essay: essayRef,
  };

  function focusMark(key: MarkKey) {
    triggerHaptic("light");
    markRefs[key].current?.focus();
    markRefs[key].current?.select();
  }

  /** "done" on the last visible mark so phone keyboards show the right key. */
  function enterHintFor(key: MarkKey): "next" | "done" {
    const i = visibleMarks.indexOf(key);
    return i > -1 && i < visibleMarks.length - 1 ? "next" : "done";
  }

  function advanceFromMark(e: React.KeyboardEvent, key: MarkKey) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = visibleMarks[visibleMarks.indexOf(key) + 1];
    if (next) focusMark(next);
    else void save();
  }

  /** Mobile hands off to the first mark this REV has — or saves, if it has none. */
  function advanceFromPhone(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = visibleMarks[0];
    if (first) focusMark(first);
    else void save();
  }

  /** One tap fills identity only — never marks — then jumps to the first mark. */
  function applySuggestion(s: HistoryStudent) {
    setStudentName(s.student_name);
    if (s.phone_no) setPhone(formatSriLankanPhone(s.phone_no));
    window.setTimeout(() => {
      const first = visibleMarks[0];
      if (first) focusMark(first);
    }, 0);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Field
          ref={nameRef}
          label="Student name"
          placeholder="e.g. K. Nimal Perera"
          size="lg"
          value={studentName}
          enterKeyHint="next"
          autoComplete="off"
          onChange={(e) => setStudentName(e.target.value)}
          onKeyDown={(e) => advanceOn(e, phoneRef)}
        />
        <SuggestionRow items={nameSuggestions} onPick={applySuggestion} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Field
          ref={phoneRef}
          label="Mobile"
          placeholder="e.g. 0771234567"
          size="lg"
          inputMode="tel"
          value={phone}
          enterKeyHint="next"
          autoComplete="off"
          onChange={(e) => setPhone(formatSriLankanPhone(e.target.value, phone))}
          onKeyDown={advanceFromPhone}
        />
        <SuggestionRow items={phoneSuggestions} onPick={applySuggestion} />
      </div>

      {duplicate && (
        <div className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2.5">
          <p className="text-label text-warn">
            Already marked in {session.town} for this REV:{" "}
            <strong className="font-semibold">
              {duplicate.entry.student_name || "this student"}
            </strong>{" "}
            ({duplicate.by} matches). Saving will create a second record.
          </p>
        </div>
      )}

      {visibleMarks.length === 0 ? (
        <div className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2.5">
          <p className="text-label text-warn">
            {currentRev?.rev_no ?? "This REV"} has no MCQs, structured essays or
            essays configured, so there is nothing to mark. Set its question
            counts under Manage &rarr; REV Numbers.
          </p>
        </div>
      ) : (
      <div className={`grid gap-2 ${GRID_COLS[visibleMarks.length]}`}>
        {showMcq && (
        <Field
          ref={mcqRef}
          label="MCQ"
          hint={maxMcq !== null ? `/${maxMcq}` : undefined}
          size="lg"
          className="num"
          inputMode="decimal"
          value={mcq}
          enterKeyHint={enterHintFor("mcq")}
          error={overMcq ? "Over max" : undefined}
          onChange={(e) => {
            setMcq(e.target.value);
            if (maxMcq !== null && Number(e.target.value) > maxMcq) {
              triggerHaptic("warning");
            }
          }}
          onKeyDown={(e) => advanceFromMark(e, "mcq")}
        />
        )}
        {showStructured && (
        <Field
          ref={structuredRef}
          label="Struct"
          hint={maxStructured !== null ? `/${maxStructured}` : undefined}
          size="lg"
          className="num"
          inputMode="decimal"
          value={structured}
          enterKeyHint={enterHintFor("structured")}
          error={overStructured ? "Over max" : undefined}
          onChange={(e) => {
            setStructured(e.target.value);
            if (maxStructured !== null && Number(e.target.value) > maxStructured) {
              triggerHaptic("warning");
            }
          }}
          onKeyDown={(e) => advanceFromMark(e, "structured")}
        />
        )}
        {showEssay && (
        <Field
          ref={essayRef}
          label="Essay"
          hint={maxEssay !== null ? `/${maxEssay}` : undefined}
          size="lg"
          className="num"
          inputMode="decimal"
          value={essay}
          enterKeyHint={enterHintFor("essay")}
          error={overEssay ? "Over max" : undefined}
          onChange={(e) => {
            setEssay(e.target.value);
            if (maxEssay !== null && Number(e.target.value) > maxEssay) {
              triggerHaptic("warning");
            }
          }}
          onKeyDown={(e) => advanceFromMark(e, "essay")}
        />
        )}
      </div>
      )}

      <div
        className={[
          "flex flex-col items-center gap-1 rounded-card border px-4 py-5",
          allMarksEntered ? "border-brand/40 bg-brand/10" : "border-line bg-surface",
        ].join(" ")}
      >
        <span className="text-label uppercase tracking-wider text-dim">Total</span>
        <span
          className={[
            "num text-display font-semibold",
            allMarksEntered ? "text-brand-hot" : "text-dim",
          ].join(" ")}
        >
          {formatTotal(liveTotal)}
        </span>
        {anyOver && (
          <span className="text-micro font-medium text-warn">
            A mark is above its maximum - it will still be saved
          </span>
        )}
      </div>

      <Button size="lg" fullWidth loading={saving} onClick={save}>
        Save and next
      </Button>
    </div>
  );
}

/**
 * Returning-student suggestions under a field. Rendered as buttons rather than
 * a dropdown so they never capture the keyboard: the Enter chain through the
 * form has to keep working untouched, so picking a suggestion is tap-only.
 */
function SuggestionRow({
  items,
  onPick,
}: {
  items: HistoryStudent[];
  onPick: (s: HistoryStudent) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <button
          key={`${s.student_name}-${s.phone_no ?? ""}`}
          type="button"
          tabIndex={-1}
          onClick={() => onPick(s)}
          className="flex min-h-[36px] items-center gap-2 rounded-control border border-line bg-surface px-3 text-label text-dim transition-colors hover:border-brand hover:text-paper"
        >
          <span className="text-paper">{s.student_name}</span>
          {s.phone_no && <span className="num text-micro text-dim">{s.phone_no}</span>}
        </button>
      ))}
    </div>
  );
}
