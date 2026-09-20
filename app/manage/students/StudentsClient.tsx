"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Phone,
  ArrowRight,
  X,
  User,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Field } from "@/app/components/ui/Field";
import { Select } from "@/app/components/ui/Select";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { TOWNS } from "@/lib/towns";
import { formatTotal } from "@/lib/format";
import { StudentModal } from "./StudentModal";
import { DeleteStudentModal } from "./DeleteStudentModal";

interface StudentItem {
  phone_no: string;
  student_name: string;
  town: string;
  created_at: string;
  updated_at: string;
  records_count: number;
  avg_score: number | null;
  latest_rev: string | null;
}

const TOWN_OPTIONS = [
  { value: "", label: "All Towns" },
  ...TOWNS.map((t) => ({ value: t, label: t })),
];

export default function StudentsClient() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTown, setSelectedTown] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<StudentItem | null>(null);

  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchStudents = useCallback(async (town: string, search: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (town) params.set("town", town);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/students?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch students (${res.status})`);
      }
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err: any) {
      setError(err.message || "Failed to load students directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(selectedTown, searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedTown, searchQuery, fetchStudents]);

  // Auto-dismiss feedback message
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const totalRegistered = students.length;

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleResetFilters = () => {
    setSelectedTown("");
    setSearchQuery("");
  };

  const handleOpenAdd = () => {
    setModalMode("add");
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (student: StudentItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalMode("edit");
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (student: StudentItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingStudent(student);
    setIsDeleteOpen(true);
  };

  const handleModalSuccess = (savedStudent: { phone_no: string; student_name: string; town: string }) => {
    setFeedback(
      modalMode === "add"
        ? `Added student ${savedStudent.student_name} successfully.`
        : `Updated student ${savedStudent.student_name} successfully.`
    );
    fetchStudents(selectedTown, searchQuery);
  };

  const handleDeleteSuccess = (deletedPhone: string) => {
    setFeedback(`Deleted student (${deletedPhone}) successfully.`);
    fetchStudents(selectedTown, searchQuery);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="students-page-title" className="text-display font-bold tracking-tight text-paper">
            Students
          </h1>
          <p className="mt-1 text-label text-dim">
            Manage student profiles, contact numbers, and assigned towns.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!loading && (
            <span
              id="students-count-badge"
              className="hidden rounded-full border border-line bg-surface-2 px-3 py-1 text-label font-medium text-paper sm:inline-block"
            >
              {totalRegistered} {totalRegistered === 1 ? "student" : "students"}
            </span>
          )}
          <Button
            id="add-student-btn"
            variant="primary"
            size="md"
            onClick={handleOpenAdd}
          >
            <Plus className="h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Success Feedback Banner */}
      {feedback && (
        <div
          id="student-feedback-banner"
          className="flex items-center justify-between gap-3 rounded-control border border-brand/50 bg-brand-dim p-4 text-paper"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-brand-hot" />
            <span className="text-body font-medium">{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-dim hover:text-paper"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card id="students-filter-card" className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
          {/* Search Field */}
          <div className="md:col-span-8">
            <div className="relative">
              <Field
                id="student-search-input"
                label="Search Student"
                hint="Filter by name or phone"
                placeholder="Search by student name or mobile number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  id="student-search-clear-btn"
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search input"
                  className="absolute right-3 top-[34px] p-1 text-dim transition-colors hover:text-paper"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Town Dropdown */}
          <div className="md:col-span-4">
            <Select
              id="student-town-select"
              label="Assigned Town"
              placeholder={null}
              options={TOWN_OPTIONS}
              value={selectedTown}
              onChange={(e) => setSelectedTown(e.target.value)}
            />
          </div>
        </div>

        {/* Active filters strip */}
        {(selectedTown || searchQuery) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3 text-label text-dim">
            <span>Active filters:</span>
            {selectedTown && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-paper">
                <MapPin className="h-3 w-3 text-brand-hot" />
                Town: {selectedTown}
                <button
                  type="button"
                  onClick={() => setSelectedTown("")}
                  className="ml-1 hover:text-warn"
                  aria-label={`Remove ${selectedTown} filter`}
                >
                  ×
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-paper">
                <Search className="h-3 w-3 text-brand-hot" />
                Query: &quot;{searchQuery}&quot;
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="ml-1 hover:text-warn"
                  aria-label="Remove search query filter"
                >
                  ×
                </button>
              </span>
            )}
            <button
              id="reset-all-filters-btn"
              type="button"
              onClick={handleResetFilters}
              className="ml-auto text-micro font-medium text-brand-hot hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </Card>

      {/* Error Banner */}
      {error && (
        <Card id="students-error-card" className="border-danger/40 bg-danger/10 p-4 text-paper">
          <div className="flex items-center justify-between gap-3">
            <p className="text-body text-danger">{error}</p>
            <button
              type="button"
              onClick={() => fetchStudents(selectedTown, searchQuery)}
              className="rounded-control border border-danger/50 px-3 py-1 text-label font-medium text-danger hover:bg-danger/20"
            >
              Retry
            </button>
          </div>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3, 4, 5].map((idx) => (
            <Card key={idx} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-control" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && students.length === 0 && (
        <EmptyState
          title={searchQuery || selectedTown ? "No matching students found" : "No students registered"}
          hint={
            searchQuery || selectedTown
              ? "Try adjusting your search query or town filter to find the student."
              : "Register students manually using the 'Add Student' button, or they will be automatically recorded during marking sessions."
          }
          action={
            searchQuery || selectedTown ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-control border border-line bg-surface-2 px-3 py-1.5 text-label font-medium text-paper transition-colors hover:border-dim hover:bg-surface"
              >
                Clear Filters
              </button>
            ) : (
              <Button
                id="empty-state-add-student-btn"
                variant="primary"
                size="md"
                onClick={handleOpenAdd}
              >
                <Plus className="h-4 w-4" />
                Add First Student
              </Button>
            )
          }
        />
      )}

      {/* Students List */}
      {!loading && !error && students.length > 0 && (
        <div id="students-directory-list" className="space-y-3">
          {students.map((student) => {
            const hasExams = student.records_count > 0;
            const avgFormatted = student.avg_score != null ? formatTotal(student.avg_score) : "—";
            const detailUrl = `/manage/students/${encodeURIComponent(student.phone_no)}`;

            return (
              <div
                key={student.phone_no}
                id={`student-row-${student.phone_no}`}
                className="group block transition-all"
              >
                <Card className="p-4 transition-colors hover:border-brand/60 hover:bg-surface-2 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left: Student Identity */}
                    <Link href={detailUrl} className="flex flex-1 items-start gap-3 min-w-0">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line bg-surface-2 text-dim group-hover:border-brand/40 group-hover:text-brand-hot">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-title font-semibold text-paper group-hover:text-white">
                            {student.student_name}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2.5 py-0.5 text-micro font-medium text-paper">
                            <MapPin className="h-3 w-3 text-brand-hot" />
                            {student.town}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-label text-dim">
                          <span className="num flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-faint" />
                            {student.phone_no}
                          </span>
                          {student.latest_rev && (
                            <span className="hidden text-faint sm:inline">•</span>
                          )}
                          {student.latest_rev && (
                            <span className="hidden text-dim sm:inline">
                              Latest: REV {student.latest_rev}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* Right: Academic Performance & Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/40 pt-3 sm:border-t-0 sm:pt-0">
                      <div className="flex items-center gap-4 sm:text-right">
                        <div>
                          <div className="text-micro uppercase tracking-wider text-dim">Exams</div>
                          <div className="num text-title font-semibold text-paper">
                            {student.records_count}
                          </div>
                        </div>

                        {hasExams && (
                          <div className="border-l border-line/60 pl-4">
                            <div className="text-micro uppercase tracking-wider text-dim">Avg Score</div>
                            <div className="num text-title font-bold text-brand-hot">
                              {avgFormatted}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons: Edit, Delete, View */}
                      <div className="flex items-center gap-1.5 sm:pl-2">
                        <button
                          type="button"
                          id={`edit-student-${student.phone_no}-btn`}
                          onClick={(e) => handleOpenEdit(student, e)}
                          title="Edit Student"
                          aria-label={`Edit ${student.student_name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-surface text-dim transition-colors hover:border-brand-hot hover:bg-surface-2 hover:text-paper"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          id={`delete-student-${student.phone_no}-btn`}
                          onClick={(e) => handleOpenDelete(student, e)}
                          title="Delete Student"
                          aria-label={`Delete ${student.student_name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-surface text-dim transition-colors hover:border-danger/60 hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <Link
                          href={detailUrl}
                          title="View History"
                          aria-label={`View history for ${student.student_name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-surface text-dim transition-colors hover:border-brand-hot hover:bg-brand-deep hover:text-white"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Student Modal */}
      <StudentModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={
          editingStudent
            ? {
                phone_no: editingStudent.phone_no,
                student_name: editingStudent.student_name,
                town: editingStudent.town,
              }
            : undefined
        }
        onClose={() => {
          setIsModalOpen(false);
          setEditingStudent(null);
        }}
        onSuccess={handleModalSuccess}
      />

      {/* Delete Student Modal */}
      <DeleteStudentModal
        isOpen={isDeleteOpen}
        student={deletingStudent}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingStudent(null);
        }}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
