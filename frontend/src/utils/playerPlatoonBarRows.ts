import type { PlatoonPlayer } from '../types/api.compat'

export type PlatoonBarDatum = {
  code: string
  bucket: string
  opsPlayer1: number
  opsPlayer2: number
  sample1: number
  sample2: number
}

const ORDER = ['vl', 'vr'] as const

/** Merge two players’ vl/vr splits into rows for a grouped bar chart. */
export function buildPlatoonBarData(
  player1: PlatoonPlayer | undefined,
  player2: PlatoonPlayer | undefined,
): PlatoonBarDatum[] {
  const m1 = new Map((player1?.splits ?? []).map((s) => [s.code, s]))
  const m2 = new Map((player2?.splits ?? []).map((s) => [s.code, s]))
  const rows: PlatoonBarDatum[] = []
  for (const code of ORDER) {
    const a = m1.get(code)
    const b = m2.get(code)
    if (!a && !b) continue
    rows.push({
      code,
      bucket: a?.description ?? b?.description ?? code,
      opsPlayer1: a?.ops ?? 0,
      opsPlayer2: b?.ops ?? 0,
      sample1: a?.sample ?? 0,
      sample2: b?.sample ?? 0,
    })
  }
  return rows
}
