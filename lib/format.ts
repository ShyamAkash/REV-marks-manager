/**
 * Single source of truth for how numbers are rendered in the UI.
 *
 * Before this existed the same total rendered three different ways:
 * ViewDataTab showed "72.3333", the live entry preview showed "72.33%",
 * and the recent-entries strip showed "72.3%".
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
