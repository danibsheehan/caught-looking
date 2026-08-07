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

function shortPlayerLabel(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0]!.slice(0, 14);
  return parts[parts.length - 1]!.slice(0, 14);
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
