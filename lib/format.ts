/**
 * Single source of truth for how numbers are rendered in the UI.
 *
 * Before this existed, ViewDataTab rendered totals as "72.3333" while the
 * entry form rendered the same value as "72.4%".
 */

/** Render a percentage total: one decimal place, always suffixed with %. */
export function formatTotal(total: number | null | undefined): string {
  const n = Number(total ?? 0);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}

/**
 * Render a raw mark. Integers stay integers ("12", not "12.00");
 * fractional marks keep at most two decimals ("7.5").
 */
export function formatMark(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}
