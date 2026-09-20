"use client";

import { useEffect, useState } from "react";
import { X, UserPlus, UserCheck, AlertCircle } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Field } from "@/app/components/ui/Field";
import { Select } from "@/app/components/ui/Select";
import { TOWNS } from "@/lib/towns";

interface StudentModalProps {
  isOpen: boolean;
  mode: "add" | "edit";
  initialData?: {
    phone_no: string;
    student_name: string;
    town: string;
  };
  onClose: () => void;
  onSuccess: (student: { phone_no: string; student_name: string; town: string }) => void;
}

const TOWN_OPTIONS = TOWNS.map((t) => ({ value: t, label: t }));

export function StudentModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSuccess,
}: StudentModalProps) {
  const [studentName, setStudentName] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [town, setTown] = useState(TOWNS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        setStudentName(initialData.student_name || "");
        setPhoneNo(initialData.phone_no || "");
        setTown((initialData.town as any) || TOWNS[0]);
      } else {
        setStudentName("");
        setPhoneNo("");
        setTown(TOWNS[0]);
      }
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = studentName.trim();
    const cleanPhone = phoneNo.trim();

    if (!cleanName) {
      setError("Please enter the student's name");
      return;
    }
    if (!cleanPhone) {
      setError("Please enter a valid phone number");
      return;
    }
    if (!town) {
      setError("Please select an assigned town");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (mode === "add") {
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_name: cleanName,
            phone_no: cleanPhone,
            town,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to add student");
        }
        onSuccess(data.student);
        onClose();
      } else {
        const originalPhone = initialData?.phone_no || cleanPhone;
        const res = await fetch(`/api/students/${encodeURIComponent(originalPhone)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_name: cleanName,
            phone_no: cleanPhone,
            town,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to update student");
        }
        onSuccess(data.student);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const isEdit = mode === "edit";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between border-b border-line/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-control border border-brand/30 bg-brand-dim text-brand-hot">
              {isEdit ? <UserCheck className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="student-modal-title" className="text-title font-semibold text-paper">
                {isEdit ? "Edit Student" : "Add New Student"}
              </h2>
              <p className="text-micro text-dim">
                {isEdit
                  ? "Update student information and assigned town"
                  : "Register a new student profile"}
              </p>
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

        {/* Error Alert */}
        {error && (
          <div
            id="student-modal-error"
            className="mb-4 flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 p-3 text-label text-danger"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            id="student-modal-name-input"
            label="Student Name"
            placeholder="e.g. Kamal Perera"
            value={studentName}
            autoFocus
            disabled={submitting}
            onChange={(e) => {
              setStudentName(e.target.value);
              if (error) setError(null);
            }}
          />

          <Field
            id="student-modal-phone-input"
            label="Phone Number"
            placeholder="e.g. 0771234567"
            value={phoneNo}
            type="tel"
            disabled={submitting}
            hint={isEdit ? "Note: Modifying phone will update all linked test records" : undefined}
            onChange={(e) => {
              setPhoneNo(e.target.value);
              if (error) setError(null);
            }}
          />

          <Select
            id="student-modal-town-select"
            label="Assigned Town"
            options={TOWN_OPTIONS}
            value={town}
            disabled={submitting}
            onChange={(e) => {
              setTown(e.target.value as any);
              if (error) setError(null);
            }}
          />

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <Button
              id="student-modal-cancel-btn"
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              id="student-modal-submit-btn"
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              disabled={submitting}
            >
              {isEdit ? "Save Changes" : "Create Student"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
