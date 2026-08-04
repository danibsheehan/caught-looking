/** Cap detail rows in chart a11y tables so large Statcast sets stay usable. */
export const CHART_A11Y_ROW_CAP = 40;

export type ChartA11ySlice<T> = {
  rows: T[];
  /** Rows omitted after the cap (0 when not truncated). */
  omitted: number;
  total: number;
};

export function chartA11ySlice<T>(
  items: readonly T[],
  cap = CHART_A11Y_ROW_CAP,
): ChartA11ySlice<T> {
  const total = items.length;
  if (total <= cap) {
    return { rows: [...items], omitted: 0, total };
  }
  return { rows: items.slice(0, cap), omitted: total - cap, total };
}

export function chartA11yFootnote(
  noun: string,
  slice: { omitted: number; total: number },
): string | undefined {
  if (slice.omitted <= 0) return undefined;
  const shown = slice.total - slice.omitted;
  return `Showing ${shown} of ${slice.total} ${noun}.`;
}

/** Away = top half, home = bottom half (matches chart color split). */
export function chartA11yBattingSide(inningHalf: string | undefined): string {
  const s = (inningHalf ?? '').trim().toLowerCase();
  if (s === 'top') return 'Away';
  if (s === 'bottom' || s === 'bot') return 'Home';
  return 'Unknown';
}
