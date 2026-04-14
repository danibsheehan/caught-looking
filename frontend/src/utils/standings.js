/**
 * @param {import('../types/api').TeamsResponse | null | undefined} teamsPayload
 * @returns {Map<number, string>}
 */
export function teamLabelMap(teamsPayload) {
  const map = new Map()
  if (!teamsPayload?.teams) return map
  for (const t of teamsPayload.teams) {
    map.set(t.id, t.abbreviation || t.teamName || t.name)
  }
  return map
}

/**
 * @param {import('../types/api').StandingTeam[]} teams
 * @returns {import('../types/api').StandingTeam[]}
 */
export function sortStandingTeams(teams) {
  return [...teams].sort(
    (a, b) => Number(a.divisionRank) - Number(b.divisionRank),
  )
}

/**
 * @param {import('../types/api').StandingDivision[]} divisions
 * @param {number} teamId
 * @returns {number} division index, or -1
 */
export function divisionIndexForTeam(divisions, teamId) {
  for (let i = 0; i < divisions.length; i++) {
    if (divisions[i].teams.some((t) => t.teamId === teamId)) return i
  }
  return -1
}
