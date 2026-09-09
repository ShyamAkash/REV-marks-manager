export type RevConfig = {
  rev_no: string;
  num_mcq: number;
  num_structured: number;
  num_essay: number;
};

export type Record = {
  id: number;
  town: string;
  rev_no: string;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * total = ((mcq + structured + essay) / (num_mcq + num_structured*5 + num_essay*7.5)) * 100
 */
export function calcTotal(
  rec: Pick<Record, "mcq_mark" | "structured_mark" | "essay_mark">,
  rev: Pick<RevConfig, "num_mcq" | "num_structured" | "num_essay"> | null
): number {
  if (!rev) return 0;
  const denom =
    Number(rev.num_mcq || 0) +
    Number(rev.num_structured || 0) * 5 +
    Number(rev.num_essay || 0) * 7.5;
  if (!denom) return 0;
  const numer =
    Number(rec.mcq_mark || 0) +
    Number(rec.structured_mark || 0) +
    Number(rec.essay_mark || 0);
  return (numer / denom) * 100;
}
