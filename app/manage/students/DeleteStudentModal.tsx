"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

interface DeleteStudentModalProps {
  isOpen: boolean;
  student: {
    phone_no: string;
    student_name: string;
    records_count?: number;
  } | null;
  onClose: () => void;
  onSuccess: (deletedPhone: string) => void;
}

export function DeleteStudentModal({
  isOpen,
  student,
  onClose,
  onSuccess,
}: DeleteStudentModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !student) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(student.phone_no)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete student");
      }
      onSuccess(student.phone_no);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete student. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const recordsCount = student.records_count ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-student-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-danger/40 bg-danger/10 text-danger">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="delete-student-modal-title" className="text-title font-semibold text-paper">
                Delete Student
              </h2>
              <p className="text-micro text-dim">This action cannot be undone.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-control p-1 text-dim transition-colors hover:bg-surface-2 hover:text-paper"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Details */}
        <div className="my-4 rounded-control border border-line/60 bg-surface-2 p-4 text-label">
          <p className="font-semibold text-paper">{student.student_name}</p>
          <p className="num text-micro text-dim">{student.phone_no}</p>
          {recordsCount > 0 ? (
            <p className="mt-2 text-micro text-warn">
              Warning: Deleting this student will also permanently remove their{" "}
              <span className="font-semibold">{recordsCount}</span> recorded exam mark
              {recordsCount === 1 ? "" : "s"}.
            </p>
          ) : (
            <p className="mt-2 text-micro text-dim">
              This student has no exam records logged.
            </p>
          )}
        </div>

        {error && (
          <div
            id="delete-student-error"
            className="mb-4 rounded-control border border-danger/40 bg-danger/10 p-3 text-micro font-medium text-danger"
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            id="delete-student-cancel-btn"
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            id="delete-student-confirm-btn"
            type="button"
            variant="danger"
            size="md"
            loading={deleting}
            disabled={deleting}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete Student
          </Button>
        </div>
      </div>
    </div>
  );
}
