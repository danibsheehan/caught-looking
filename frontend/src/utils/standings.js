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

/**
 * Division + standing row for a club (season snapshot).
 * @param {import('../types/api').StandingDivision[] | undefined} divisions
 * @param {number} teamId
 * @returns {{ division: import('../types/api').StandingDivision, team: import('../types/api').StandingTeam } | null}
 */
export function standingTeamForId(divisions, teamId) {
  if (!divisions?.length) return null
  for (const d of divisions) {
    const team = d.teams.find((t) => t.teamId === teamId)
    if (team) return { division: d, team }
  }
  return null
}
