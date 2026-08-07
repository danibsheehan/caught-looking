import type { LeaderRow } from '../types/api.compat';

export type LeadersBarDatum = {
  rank: number;
  label: string;
  fullName: string;
  value: number;
  valueLabel: string;
  teamId: number;
  teamName: string;
};

/** Parse MLB leader display strings (e.g. "60", "1.97", ".312") for chart scales. */
export function parseLeaderValue(raw: string): number {
  const n = Number.parseFloat(String(raw).trim());
  return Number.isFinite(n) ? n : 0;
}

/** Generational / honorific suffixes that should not become the chart label. */
const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'vi']);

function isNameSuffix(token: string): boolean {
  return NAME_SUFFIXES.has(token.toLowerCase());
}

/** Last-name-ish tick for horizontal bars; skips Jr./Sr./II/… suffixes. */
export function shortPlayerLabel(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && isNameSuffix(parts[parts.length - 1]!)) {
    parts.pop();
  }
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0]!.slice(0, 18);
  return parts[parts.length - 1]!.slice(0, 18);
}

/** Pixel width for the category Y-axis from the longest tick label. */
export function leadersYAxisWidth(labels: readonly string[]): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  // ~7.5px per character at 11px sans, plus end-anchor gutter.
  return Math.min(152, Math.max(100, Math.ceil(longest * 7.5) + 20));
}

export function buildLeadersBarData(leaders: readonly LeaderRow[]): LeadersBarDatum[] {
  return leaders.slice(0, 10).map((row) => ({
    rank: row.rank,
    label: shortPlayerLabel(row.playerName),
    fullName: row.playerName,
    value: parseLeaderValue(row.value),
    valueLabel: row.value,
    teamId: row.teamId,
    teamName: row.teamName || '—',
  }));
}
