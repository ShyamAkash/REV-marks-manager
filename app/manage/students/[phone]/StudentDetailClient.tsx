"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  GraduationCap,
  MapPin,
  Phone,
  User,
  Award,
  BookOpen,
  CheckCircle2,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatMark, formatTotal } from "@/lib/format";
import { StudentModal } from "../StudentModal";
import { DeleteStudentModal } from "../DeleteStudentModal";

interface StudentRecord {
  id: number;
  town: string;
  rev_id: number;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff: string | null;
  created_at: string;
  updated_at: string;
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
  total: number;
}

interface StudentInfo {
  phone_no: string;
  student_name: string;
  town: string;
  created_at: string;
  updated_at: string;
}

interface StudentStats {
  totalExams: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  latestRev: string | null;
}

interface StudentDetailData {
  student: StudentInfo;
  records: StudentRecord[];
  stats: StudentStats;
}

export default function StudentDetailClient({ phone }: { phone: string }) {
  const router = useRouter();
  const [data, setData] = useState<StudentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(phone)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch student details (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load student history.");
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleEditSuccess = (savedStudent: { phone_no: string; student_name: string; town: string }) => {
    if (savedStudent.phone_no !== phone) {
      router.push(`/manage/students/${encodeURIComponent(savedStudent.phone_no)}`);
    } else {
      fetchDetails();
    }
  };

  const handleDeleteSuccess = () => {
    router.push("/manage/students");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          id="back-to-students-link"
          href="/manage/students"
          className="inline-flex items-center gap-2 text-body font-medium text-dim transition-colors hover:text-paper"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <Card id="student-detail-error" className="border-danger/40 bg-danger/10 p-5 text-paper">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-title font-semibold text-danger">Unable to load student profile</h2>
              <p className="mt-1 text-body text-dim">{error}</p>
            </div>
            <button
              type="button"
              onClick={fetchDetails}
              className="self-start rounded-control border border-danger/50 px-4 py-2 text-label font-medium text-danger hover:bg-danger/20 sm:self-auto"
            >
              Try Again
            </button>
          </div>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6" aria-busy="true">
          <Card className="p-6">
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-5 w-40" />
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-7 w-24" />
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Card className="p-6">
              <Skeleton className="h-20 w-full" />
            </Card>
          </div>
        </div>
      )}

      {/* Student Profile Card */}
      {!loading && !error && data && (
        <>
          <Card id="student-profile-header-card" className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control border border-brand/30 bg-brand-dim text-brand-hot">
                  <User className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 id="student-name-heading" className="text-display font-bold text-paper">
                      {data.student.student_name}
                    </h1>
                    <span
                      id="student-town-badge"
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-label font-semibold text-paper"
                    >
                      <MapPin className="h-3.5 w-3.5 text-brand-hot" />
                      Assigned Town: {data.student.town}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-body text-dim">
                    <a
                      href={`tel:${data.student.phone_no}`}
                      className="num inline-flex items-center gap-1.5 text-paper hover:text-brand-hot hover:underline"
                    >
                      <Phone className="h-4 w-4 text-faint" />
                      {data.student.phone_no}
                    </a>
                    {data.student.created_at && (
                      <span className="hidden items-center gap-1.5 text-faint sm:inline-flex">
                        <Calendar className="h-4 w-4" />
                        Registered: {new Date(data.student.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap shrink-0 items-center gap-2 sm:self-center">
                <button
                  type="button"
                  id="detail-edit-student-btn"
                  onClick={() => setIsEditOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-label font-semibold text-paper transition-colors hover:border-brand-hot hover:text-white"
                >
                  <Pencil className="h-4 w-4 text-dim" />
                  Edit
                </button>

                <button
                  type="button"
                  id="detail-delete-student-btn"
                  onClick={() => setIsDeleteOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-label font-semibold text-dim transition-colors hover:border-danger/60 hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>

                <Link
                  href={`/manage/records?town=${encodeURIComponent(data.student.town)}&search=${encodeURIComponent(data.student.phone_no)}`}
                  className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface-2 px-3 py-2 text-label font-semibold text-paper transition-colors hover:border-dim hover:text-white"
                >
                  <BookOpen className="h-4 w-4 text-dim" />
                  View in Records
                </Link>
              </div>
            </div>
          </Card>

          {/* Performance Overview Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card id="stat-total-exams" className="p-4">
              <div className="text-micro uppercase tracking-wider text-dim">Exams Sat</div>
              <div className="num mt-1 text-display font-bold text-paper">
                {data.stats.totalExams}
              </div>
              <div className="mt-1 text-micro text-faint">Total completed revision tests</div>
            </Card>

            <Card id="stat-avg-score" className="p-4">
              <div className="text-micro uppercase tracking-wider text-dim">Average Score</div>
              <div className="num mt-1 text-display font-bold text-brand-hot">
                {data.stats.totalExams > 0 ? formatTotal(data.stats.avgScore) : "—"}
              </div>
              <div className="mt-1 text-micro text-faint">Overall cumulative average</div>
            </Card>

            <Card id="stat-highest-score" className="p-4">
              <div className="text-micro uppercase tracking-wider text-dim">Highest Score</div>
              <div className="num mt-1 text-display font-bold text-ok">
                {data.stats.totalExams > 0 ? formatTotal(data.stats.highestScore) : "—"}
              </div>
              <div className="mt-1 text-micro text-faint">Personal peak score</div>
            </Card>

            <Card id="stat-latest-rev" className="p-4">
              <div className="text-micro uppercase tracking-wider text-dim">Latest Exam</div>
              <div className="mt-1 text-display font-bold text-paper">
                {data.stats.latestRev ? `REV ${data.stats.latestRev}` : "—"}
              </div>
              <div className="mt-1 text-micro text-faint">Most recently recorded paper</div>
            </Card>
          </div>

          {/* REV Exam History & Individual Performance Scores */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="rev-history-heading" className="text-title font-bold text-paper">
                  REV History & Performance Scores
                </h2>
                <p className="mt-0.5 text-body text-dim">
                  Detailed marks breakdown across MCQ, Structured, and Essay sections for each exam.
                </p>
              </div>
              <span className="rounded-full border border-line bg-surface-2 px-3 py-0.5 text-micro font-medium text-dim">
                {data.records.length} {data.records.length === 1 ? "record" : "records"}
              </span>
            </div>

            {data.records.length === 0 ? (
              <EmptyState
                title="No Exam Records Found"
                hint="This student is enrolled in the directory, but has not completed any REV examinations yet."
                action={
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 rounded-control bg-brand-deep px-4 py-2 text-label font-semibold text-white hover:bg-brand"
                  >
                    Record Marks Now
                  </Link>
                }
              />
            ) : (
              <div id="student-rev-history-list" className="space-y-4">
                {data.records.map((rec) => {
                  const maxMcq = rec.num_mcq;
                  const maxStructured = rec.num_structured * 5;
                  const maxEssay = rec.num_essay * 7.5;

                  const mcqPct = maxMcq > 0 ? Math.min(100, (rec.mcq_mark / maxMcq) * 100) : 0;
                  const structPct =
                    maxStructured > 0 ? Math.min(100, (rec.structured_mark / maxStructured) * 100) : 0;
                  const essayPct = maxEssay > 0 ? Math.min(100, (rec.essay_mark / maxEssay) * 100) : 0;

                  return (
                    <Card
                      key={rec.id}
                      id={`rev-record-card-${rec.id}`}
                      className="overflow-hidden p-0 transition-colors hover:border-line/90"
                    >
                      {/* Card Header */}
                      <div className="flex flex-col gap-3 border-b border-line bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="flex items-center gap-3">
                          <span className="rounded-control border border-brand/40 bg-brand-dim px-3 py-1.5 text-title font-bold text-brand-hot">
                            REV {rec.rev_no}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-body font-semibold text-paper">
                                Exam Session: {rec.town}
                              </span>
                            </div>
                            <div className="text-micro text-dim">
                              Recorded:{" "}
                              {new Date(rec.updated_at || rec.created_at).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Overall Total for this REV */}
                        <div className="flex items-center justify-between gap-4 border-t border-line/40 pt-2 sm:border-t-0 sm:pt-0">
                          <div className="sm:text-right">
                            <span className="text-micro uppercase tracking-wider text-dim">Overall Total</span>
                            <div className="num text-display font-black text-brand-hot">
                              {formatTotal(rec.total)}
                            </div>
                          </div>
                          <Link
                            href={`/manage/records?town=${encodeURIComponent(rec.town)}&rev_id=${rec.rev_id}`}
                            className="inline-flex items-center gap-1 rounded-control border border-line bg-surface px-2.5 py-1.5 text-label font-medium text-dim hover:border-dim hover:text-paper"
                            title="Inspect in Records Sheet"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Records Sheet</span>
                          </Link>
                        </div>
                      </div>

                      {/* Individual Performance Scores Grid */}
                      <div className="p-4 sm:p-5">
                        <div className="text-micro font-medium uppercase tracking-wider text-dim">
                          Individual Section Scores
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                          {/* MCQ Mark Section */}
                          <div
                            id={`rec-${rec.id}-mcq`}
                            className="rounded-control border border-line bg-surface p-3.5"
                          >
                            <div className="flex items-baseline justify-between">
                              <span className="text-label font-semibold text-paper">MCQ Paper</span>
                              <span className="text-micro text-dim">Max: {maxMcq}</span>
                            </div>

                            <div className="mt-2 flex items-baseline justify-between">
                              <div className="num text-title font-bold text-paper">
                                {formatMark(rec.mcq_mark)}{" "}
                                <span className="text-label font-normal text-dim">/ {maxMcq}</span>
                              </div>
                              <span className="num text-label font-semibold text-brand-hot">
                                {mcqPct.toFixed(1)}%
                              </span>
                            </div>

                            {/* Score Progress Bar */}
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-brand transition-all"
                                style={{ width: `${mcqPct}%` }}
                              />
                            </div>
                            <div className="mt-1.5 text-micro text-faint">
                              {rec.num_mcq} multiple-choice questions
                            </div>
                          </div>

                          {/* Structured Mark Section */}
                          <div
                            id={`rec-${rec.id}-structured`}
                            className="rounded-control border border-line bg-surface p-3.5"
                          >
                            <div className="flex items-baseline justify-between">
                              <span className="text-label font-semibold text-paper">Structured</span>
                              <span className="text-micro text-dim">Max: {maxStructured}</span>
                            </div>

                            <div className="mt-2 flex items-baseline justify-between">
                              <div className="num text-title font-bold text-paper">
                                {formatMark(rec.structured_mark)}{" "}
                                <span className="text-label font-normal text-dim">/ {maxStructured}</span>
                              </div>
                              <span className="num text-label font-semibold text-brand-hot">
                                {structPct.toFixed(1)}%
                              </span>
                            </div>

                            {/* Score Progress Bar */}
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-ok transition-all"
                                style={{ width: `${structPct}%` }}
                              />
                            </div>
                            <div className="mt-1.5 text-micro text-faint">
                              {rec.num_structured} questions (5 marks each)
                            </div>
                          </div>

                          {/* Essay Mark Section */}
                          <div
                            id={`rec-${rec.id}-essay`}
                            className="rounded-control border border-line bg-surface p-3.5"
                          >
                            <div className="flex items-baseline justify-between">
                              <span className="text-label font-semibold text-paper">Essay</span>
                              <span className="text-micro text-dim">Max: {maxEssay}</span>
                            </div>

                            <div className="mt-2 flex items-baseline justify-between">
                              <div className="num text-title font-bold text-paper">
                                {formatMark(rec.essay_mark)}{" "}
                                <span className="text-label font-normal text-dim">/ {maxEssay}</span>
                              </div>
                              <span className="num text-label font-semibold text-brand-hot">
                                {essayPct.toFixed(1)}%
                              </span>
                            </div>

                            {/* Score Progress Bar */}
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-warn transition-all"
                                style={{ width: `${essayPct}%` }}
                              />
                            </div>
                            <div className="mt-1.5 text-micro text-faint">
                              {rec.num_essay} questions (7.5 marks each)
                            </div>
                          </div>
                        </div>

                        {/* Footer metadata */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/40 pt-3 text-micro text-dim">
                          <div className="flex items-center gap-1.5">
                            <span className="text-faint">Marked / Entered by:</span>
                            <span className="font-medium text-paper">
                              {rec.staff ? rec.staff : "Unassigned staff"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
                            <span>Verified record ID #{rec.id}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Edit Student Modal */}
          <StudentModal
            isOpen={isEditOpen}
            mode="edit"
            initialData={{
              phone_no: data.student.phone_no,
              student_name: data.student.student_name,
              town: data.student.town,
            }}
            onClose={() => setIsEditOpen(false)}
            onSuccess={handleEditSuccess}
          />

          {/* Delete Student Modal */}
          <DeleteStudentModal
            isOpen={isDeleteOpen}
            student={{
              phone_no: data.student.phone_no,
              student_name: data.student.student_name,
              records_count: data.stats.totalExams,
            }}
            onClose={() => setIsDeleteOpen(false)}
            onSuccess={handleDeleteSuccess}
          />
        </>
      )}
    </div>
  );
}
