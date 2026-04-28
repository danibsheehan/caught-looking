import type { GameBoxscoreResponse, StatcastPitch } from '../types/api.compat'

export type PitcherStatcastRow = {
  id: number
  name: string
  side: 'away' | 'home' | 'unknown'
  pitches: StatcastPitch[]
}

/**
 * Groups pitch-tracking rows by pitcher and orders pitchers to match the box score (away then home),
 * with any extra tracking-only ids appended.
 */
export function buildPitcherStrikeZoneRows(
  pitches: StatcastPitch[],
  box: GameBoxscoreResponse | null,
): PitcherStatcastRow[] {
  const byPitcher = new Map<number, StatcastPitch[]>()
  for (const p of pitches) {
    const arr = byPitcher.get(p.pitcher) ?? []
    arr.push(p)
    byPitcher.set(p.pitcher, arr)
  }

  const nameById = new Map<number, { name: string; side: 'away' | 'home' }>()
  if (box) {
    for (const line of box.away.pitching) {
      nameById.set(line.playerId, { name: line.name, side: 'away' })
    }
    for (const line of box.home.pitching) {
      if (!nameById.has(line.playerId)) {
        nameById.set(line.playerId, { name: line.name, side: 'home' })
      }
    }
  }

  const orderedIds: number[] = []
  const seen = new Set<number>()
  if (box) {
    for (const line of [...box.away.pitching, ...box.home.pitching]) {
      if (byPitcher.has(line.playerId) && !seen.has(line.playerId)) {
        seen.add(line.playerId)
        orderedIds.push(line.playerId)
      }
    }
  }
  const rest = [...byPitcher.keys()]
    .filter((id) => !seen.has(id))
    .sort((a, b) => a - b)
  for (const id of rest) {
    orderedIds.push(id)
  }

  return orderedIds.map((id) => {
    const meta = nameById.get(id)
    return {
      id,
      name: meta?.name ?? `Player ${id}`,
      side: meta?.side ?? 'unknown',
      pitches: byPitcher.get(id) ?? [],
    }
  })
}
