export interface MarkEntry {
  /** Present once the record exists server-side. */
  id?: number;
  /** Present while the record is only in the offline queue. */
  tempId?: string;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff?: string | null;
  total: number;
  isOffline?: boolean;
}
