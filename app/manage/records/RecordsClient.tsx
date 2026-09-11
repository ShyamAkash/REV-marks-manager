"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TOWNS } from "@/lib/towns";
import type { RevConfig } from "@/lib/calc";
import { formatMark, formatTotal } from "@/lib/format";
import {
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  Field,
  Select,
  Sheet,
  Skeleton,
  useToast,
} from "@/app/components/ui";

const POLL_MS = 3000;

interface Rec {
  id: number;
  town: string;
  rev_id: number;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff: string | null;
  updated_at: string;
  total: number;
}

type Sort = "modified_desc" | "modified_asc" | "total_desc" | "total_asc" | "modified";

export default function RecordsClient() {
  const toast = useToast();

  const [revs, setRevs] = useState<RevConfig[]>([]);
  const [town, setTown] = useState("");
  const [revId, setRevId] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("modified_desc");

  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<Rec | null>(null);
  const [deleting, setDeleting] = useState<Rec | null>(null);
  const [busy, setBusy] = useState(false);

  // Polling must not clobber a record the user is currently editing.
  const editingRef = useRef(false);
  editingRef.current = editing !== null;

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }, []);

  const ready = Boolean(town && revId);

  const load = useCallback(async () => {
    if (!town || !revId) {
      setRecords([]);
      return;
    }
    const params = new URLSearchParams({ town, rev_id: revId, sort });
    if (search.trim()) params.set("search", search.trim());
    try {
      const res = await fetch(`/api/records?${params.toString()}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch {
      /* keep whatever is on screen */
    }
  }, [town, revId, search, sort]);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load, ready]);

  useEffect(() => {
    if (!ready) return;

    const interval = setInterval(() => {
      // Do not refetch while the tab is hidden or a record is open for editing.
      if (document.visibilityState !== "visible") return;
      if (editingRef.current) return;
      void load();
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [load, ready]);

  const stats = useMemo(() => {
    if (records.length === 0) return null;
    const totals = records.map((r) => r.total);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    return { count: records.length, avg, high: Math.max(...totals) };
  }, [records]);

  function exportSheet() {
    if (!ready) return;
    const params = new URLSearchParams({ town, rev_id: revId });
    window.location.href = `/api/records/export?${params.toString()}`;
  }

  async function saveEdit(values: Partial<Rec>) {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/records/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        // 409 means this edit would give the student a second record in the
        // same town + REV - usually a mobile number typed onto the wrong row.
        // The sheet stays open with the values intact so it can be corrected.
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update");
      }
      setEditing(null);
      toast("Record updated");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update record", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/records/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleting(null);
      toast("Record deleted");
      await load();
    } catch {
      toast("Could not delete record", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-semibold text-paper">Records</h1>

      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Town"
            value={town}
            onChange={(e) => setTown(e.target.value)}
            options={TOWNS.map((t) => ({ value: t, label: t }))}
          />
          <Select
            label="REV No."
            value={revId}
            onChange={(e) => setRevId(e.target.value)}
            options={revs.map((r) => ({ value: String(r.id), label: r.rev_no }))}
          />
        </div>

        {ready && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field
                label="Search"
                placeholder="Name or mobile"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="sm:w-52">
              <Select
                label="Sort"
                placeholder={null}
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                options={[
                  { value: "modified_desc", label: "Modified  ↓" },
                  { value: "modified_asc", label: "Modified  ↑" },
                  { value: "total_desc", label: "Total  ↓" },
                  { value: "total_asc", label: "Total  ↑" },
                ]}
              />
            </div>
            <Button variant="secondary" onClick={exportSheet}>
              Export xlsx
            </Button>
          </div>
        )}
      </Card>

      {!ready && (
        <EmptyState
          title="Choose a town and REV No."
          hint="Records load once both are selected."
        />
      )}

      {ready && stats && (
        <p className="num text-label text-dim">
          {stats.count} records - avg {formatTotal(stats.avg)} - high{" "}
          {formatTotal(stats.high)}
        </p>
      )}

      {ready && loading && records.length === 0 && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {ready && !loading && records.length === 0 && (
        <EmptyState
          title="No records"
          hint={search ? "No match for that search." : "Nothing marked yet for this REV."}
        />
      )}

      {/* Phone: cards */}
      {records.length > 0 && (
        <ul className="flex flex-col gap-2 md:hidden">
          {records.map((r) => (
            <li key={r.id}>
              <Card className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-body text-paper">
                    {r.student_name || "No name"}
                  </span>
                  <span className="num truncate text-micro text-dim">
                    {r.phone_no || "No mobile"}
                  </span>
                  <span className="num text-micro text-dim">
                    MCQ {formatMark(r.mcq_mark)} - Struct {formatMark(r.structured_mark)} -
                    Essay {formatMark(r.essay_mark)}
                  </span>
                  <span className="text-micro text-faint">Staff: {r.staff || "-"}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="num text-body font-semibold text-brand-hot">
                    {formatTotal(r.total)}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleting(r)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Desktop: table */}
      {records.length > 0 && (
        <div className="hidden overflow-x-auto rounded-card border border-line md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-surface">
                {["Name", "Mobile", "MCQ", "Struct", "Essay", "Total", "Staff", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-label font-semibold text-dim"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 text-body text-paper">
                    {r.student_name || "No name"}
                  </td>
                  <td className="num px-3 py-2.5 text-label text-dim">
                    {r.phone_no || "-"}
                  </td>
                  <td className="num px-3 py-2.5 text-label">{formatMark(r.mcq_mark)}</td>
                  <td className="num px-3 py-2.5 text-label">
                    {formatMark(r.structured_mark)}
                  </td>
                  <td className="num px-3 py-2.5 text-label">
                    {formatMark(r.essay_mark)}
                  </td>
                  <td className="num px-3 py-2.5 text-body font-semibold text-brand-hot">
                    {formatTotal(r.total)}
                  </td>
                  <td className="px-3 py-2.5 text-label text-dim">{r.staff || "-"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleting(r)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RecordEditSheet
          // Keyed by id so switching to a different record remounts the sheet
          // and reseeds its form state. RecordEditSheet seeds from props with
          // useState, which runs only on mount, and Sheet focuses its panel
          // without trapping Tab — so a keyboard user can reach an Edit button
          // behind the open sheet. Without this key that would leave record A's
          // marks in a form now bound to record B, and saving would overwrite
          // record B using record A's marks.
          key={editing.id}
          record={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete record"
        message={`Delete the record for ${
          deleting?.student_name || "this student"
        }? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={busy}
      />
    </div>
  );
}

function RecordEditSheet({
  record,
  busy,
  onClose,
  onSave,
}: {
  record: Rec;
  busy: boolean;
  onClose: () => void;
  onSave: (values: Partial<Rec>) => void;
}) {
  const [name, setName] = useState(record.student_name ?? "");
  const [phone, setPhone] = useState(record.phone_no ?? "");
  const [mcq, setMcq] = useState(String(record.mcq_mark));
  const [structured, setStructured] = useState(String(record.structured_mark));
  const [essay, setEssay] = useState(String(record.essay_mark));

  function toNumber(v: string) {
    if (v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit record"
      footer={
        <>
          <Button
            fullWidth
            loading={busy}
            onClick={() =>
              onSave({
                student_name: name.trim() || null,
                phone_no: phone.trim() || null,
                mcq_mark: toNumber(mcq),
                structured_mark: toNumber(structured),
                essay_mark: toNumber(essay),
              })
            }
          >
            Save changes
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Student name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label="Mobile"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="MCQ"
            className="num"
            inputMode="decimal"
            value={mcq}
            onChange={(e) => setMcq(e.target.value)}
          />
          <Field
            label="Struct"
            className="num"
            inputMode="decimal"
            value={structured}
            onChange={(e) => setStructured(e.target.value)}
          />
          <Field
            label="Essay"
            className="num"
            inputMode="decimal"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />
        </div>
      </div>
    </Sheet>
  );
}
