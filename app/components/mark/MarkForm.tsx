"use client";

import { useMemo, useRef, useState } from "react";
import { calcTotal, type RevConfig } from "@/lib/calc";
import { formatTotal } from "@/lib/format";
import { triggerHaptic } from "@/lib/haptics";
import { findDuplicate } from "@/lib/duplicates";
import { addOfflineRecord, updateOfflineRecord } from "@/lib/offlineQueue";
import { formatSriLankanPhone } from "@/lib/phone";
import {
  matchByName,
  matchByPhone,
  useStudentHistory,
  type HistoryStudent,
} from "@/lib/useStudentHistory";
import { Button, Field, useToast } from "@/app/components/ui";
import { DuplicateSheet } from "./DuplicateSheet";
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

/** fetch() rejects with one of these when there is no connection (Safari says "Load failed"). */
function isNetworkError(message: string): boolean {
  return (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Load failed")
  );
}

/** A records row from the API, in the session list's shape. Postgres numerics arrive as strings. */
function fromServerRow(r: MarkEntry, rev: RevConfig | null): MarkEntry {
  const marks = {
    mcq_mark: Number(r.mcq_mark),
    structured_mark: Number(r.structured_mark),
    essay_mark: Number(r.essay_mark),
  };
  return {
    id: r.id,
    student_name: r.student_name,
    phone_no: r.phone_no,
    ...marks,
    staff: r.staff,
    total: calcTotal(marks, rev),
    isOffline: false,
  };
}

export function MarkForm({
  session,
  currentRev,
  entries,
  onSaved,
  onUpserted,
  onRemoved,
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
  /**
   * Puts a record into the session list, replacing the entry with the same id
   * (or tempId) - or adding it, when it is another marker's record this phone
   * only learned about from the server's duplicate check.
   */
  onUpserted: (entry: MarkEntry) => void;
  /** Drops an entry whose record turned out to be deleted server-side. */
  onRemoved: (entry: MarkEntry) => void;
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
   * This student's existing record in this town + REV, if this phone knows of
   * one. Drives the warning while typing, and lets Save open the Replace / Keep
   * sheet without a round trip - the server check still catches the records
   * this phone has not seen. See lib/duplicates.ts for what counts as a match.
   */
  const duplicate = useMemo(
    () => findDuplicate(entries, { student_name: studentName, phone_no: phone }),
    [phone, studentName, entries]
  );

  /** The record the Replace / Keep sheet is asking about; null while closed. */
  const [conflict, setConflict] = useState<MarkEntry | null>(null);
  const [replacing, setReplacing] = useState(false);

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
      phoneRef.current?.focus();
      phoneRef.current?.select();
    }, 50);
  }

  function currentPayload() {
    return {
      town: session.town,
      rev_id: Number(session.revId),
      staff: session.checkedBy,
      student_name: studentName.trim() || null,
      phone_no: phone.trim() || null,
      mcq_mark: toNumber(mcq),
      structured_mark: toNumber(structured),
      essay_mark: toNumber(essay),
    };
  }

  function askAboutDuplicate(existing: MarkEntry) {
    triggerHaptic("warning");
    setConflict(existing);
  }

  async function save() {
    if (saving || conflict) return;

    const payload = currentPayload();
    const total = calcTotal(payload, currentRev);

    // Already known on this phone: ask straight away. While offline this is
    // the only check there is.
    const known = findDuplicate(entries, payload);
    if (known) {
      askAboutDuplicate(known.record);
      return;
    }

    setSaving(true);

    function queueOffline(message: string) {
      const queued = addOfflineRecord(payload);
      onSaved({ ...payload, tempId: queued.tempId, total, isOffline: true });
      triggerHaptic("warning");
      toast(message, "warn");
      resetAndRefocus();
    }

    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // The server knows a record this phone does not - usually one another
      // marker saved after this session loaded its list.
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        if (data.existing) {
          askAboutDuplicate(fromServerRow(data.existing, currentRev));
          return;
        }
      }
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
      if (isNetworkError(message)) {
        queueOffline("Connection lost - saved offline");
      } else {
        triggerHaptic("error");
        toast(message, "danger");
      }
    } finally {
      setSaving(false);
    }
  }

  /** Overwrite the record this student already has with the marks just typed. */
  async function replaceExisting() {
    if (!conflict || replacing) return;

    const payload = currentPayload();
    // A blank name or mobile here means "not retyped", not "erase it".
    const updated = {
      student_name: payload.student_name ?? conflict.student_name,
      phone_no: payload.phone_no ?? conflict.phone_no,
      mcq_mark: payload.mcq_mark,
      structured_mark: payload.structured_mark,
      essay_mark: payload.essay_mark,
      staff: payload.staff,
    };
    const replaced: MarkEntry = {
      ...conflict,
      ...updated,
      total: calcTotal(updated, currentRev),
    };

    // Not uploaded yet: change the queued copy, and it syncs with the new marks.
    if (conflict.isOffline && conflict.tempId) {
      updateOfflineRecord(conflict.tempId, updated);
      finishReplace(replaced);
      return;
    }

    setReplacing(true);
    try {
      const res = await fetch(`/api/records/${conflict.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.status === 404) {
        // Deleted in Manage after it was found. Forget it, so pressing Save
        // again stores these marks as a new record instead of re-asking.
        onRemoved(conflict);
        setConflict(null);
        triggerHaptic("warning");
        toast("That record was just deleted - press Save to add these marks", "warn");
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to replace");
      }
      finishReplace(replaced);
    } catch (e) {
      // The sheet stays open, so Keep - or Replace again once back online - is
      // still one tap away.
      const message = e instanceof Error ? e.message : "Failed to replace";
      triggerHaptic("error");
      if (isNetworkError(message)) {
        toast("Can't replace while offline - try again when connected", "warn");
      } else {
        toast(message, "danger");
      }
    } finally {
      setReplacing(false);
    }
  }

  function finishReplace(entry: MarkEntry) {
    onUpserted(entry);
    setConflict(null);
    triggerHaptic("success");
    toast("Replaced old marks");
    resetAndRefocus();
  }

  /** Throw away what was typed; the stored record stays as it is. */
  function keepExisting() {
    // A record the server found is one this phone had not seen. Adding it to
    // the list means the next check - and "View all" - knows it is there.
    if (conflict) onUpserted(conflict);
    setConflict(null);
    toast("Kept old marks");
    resetAndRefocus();
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

  /** Student name hands off to the first mark this REV has — or saves, if it has none. */
  function advanceFromName(e: React.KeyboardEvent) {
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
          ref={phoneRef}
          label="Mobile"
          placeholder="e.g. 0771234567"
          size="lg"
          inputMode="tel"
          value={phone}
          enterKeyHint="next"
          autoComplete="off"
          onChange={(e) => setPhone(formatSriLankanPhone(e.target.value, phone))}
          onKeyDown={(e) => advanceOn(e, nameRef)}
        />
        <SuggestionRow items={phoneSuggestions} onPick={applySuggestion} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Field
          ref={nameRef}
          label="Student name"
          placeholder="e.g. K. Nimal Perera"
          size="lg"
          value={studentName}
          enterKeyHint={visibleMarks.length > 0 ? "next" : "done"}
          autoComplete="off"
          onChange={(e) => setStudentName(e.target.value)}
          onKeyDown={advanceFromName}
        />
        <SuggestionRow items={nameSuggestions} onPick={applySuggestion} />
      </div>

      {duplicate && (
        <div className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2.5">
          <p className="text-label text-warn">
            Already marked in {session.town} for this REV:{" "}
            <strong className="font-semibold">
              {duplicate.record.student_name || "this student"}
            </strong>{" "}
            ({duplicate.by} matches). Saving will ask whether to replace those marks.
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

      <DuplicateSheet
        existing={conflict}
        incoming={{
          mcq_mark: toNumber(mcq),
          structured_mark: toNumber(structured),
          essay_mark: toNumber(essay),
        }}
        currentRev={currentRev}
        replacing={replacing}
        onReplace={() => void replaceExisting()}
        onKeep={keepExisting}
        onClose={() => {
          if (!replacing) setConflict(null);
        }}
      />
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
