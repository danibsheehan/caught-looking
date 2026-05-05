import type { StandingDivision, StandingTeam, TeamsResponse } from '../types/api.compat';

export function teamLabelMap(teamsPayload: TeamsResponse | null | undefined): Map<number, string> {
  const map = new Map<number, string>();
  if (!teamsPayload?.teams) return map;
  for (const t of teamsPayload.teams) {
    map.set(t.id, t.abbreviation || t.teamName || t.name);
  }
  return map;
}

export function sortStandingTeams(teams: StandingTeam[]): StandingTeam[] {
  return [...teams].sort((a, b) => Number(a.divisionRank) - Number(b.divisionRank));
}

export function divisionIndexForTeam(divisions: StandingDivision[], teamId: number): number {
  for (let i = 0; i < divisions.length; i++) {
    if (divisions[i].teams.some((t) => t.teamId === teamId)) return i;
  }
  return -1;
}

export function standingTeamForId(
  divisions: StandingDivision[] | undefined,
  teamId: number,
): { division: StandingDivision; team: StandingTeam } | null {
  if (!divisions?.length) return null;
  for (const d of divisions) {
    const team = d.teams.find((t) => t.teamId === teamId);
    if (team) return { division: d, team };
  }
  return null;
}
