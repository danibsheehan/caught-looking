import type { PlayersRadarResponse } from '../../types/api.compat'

function slashStat(n: number): string {
  const s = n.toFixed(3)
  return s.startsWith('0.') ? s.slice(1) : s
}

function fmtFixed(n: number, digits: number): string {
  return n.toFixed(digits)
}

function fmtInt(n: number): string {
  return String(Math.round(n))
}

function fmtBaseballIP(n: number): string {
  const whole = Math.floor(n)
  const frac = n - whole
  if (frac < 0.001) return String(whole)
  if (Math.abs(frac - 1 / 3) < 0.02) return `${whole}.1`
  if (Math.abs(frac - 2 / 3) < 0.02) return `${whole}.2`
  return n.toFixed(1)
}

function cell(
  stats: Record<string, number> | undefined,
  key: string,
  format: (n: number) => string,
): string {
  const v = stats?.[key]
  if (v === undefined || !Number.isFinite(v)) return '—'
  return format(v)
}

type Row = { label: string; key: string; format: (n: number) => string }

const HITTING_ROWS: Row[] = [
  { label: 'G', key: 'g', format: fmtInt },
  { label: 'PA', key: 'pa', format: fmtInt },
  { label: 'AVG', key: 'avg', format: slashStat },
  { label: 'OBP', key: 'obp', format: slashStat },
  { label: 'SLG', key: 'slg', format: slashStat },
  { label: 'OPS', key: 'ops', format: (n) => fmtFixed(n, 3) },
  { label: 'wOBA', key: 'woba', format: slashStat },
  { label: 'R', key: 'runs', format: fmtInt },
  { label: 'H', key: 'hits', format: fmtInt },
  { label: '2B', key: 'doubles', format: fmtInt },
  { label: '3B', key: 'triples', format: fmtInt },
  { label: 'HR', key: 'hr', format: fmtInt },
  { label: 'RBI', key: 'rbi', format: fmtInt },
  { label: 'BB', key: 'walks', format: fmtInt },
  { label: 'SO', key: 'strikeouts', format: fmtInt },
  { label: 'SB', key: 'stolenBases', format: fmtInt },
]

const PITCHING_ROWS: Row[] = [
  { label: 'IP', key: 'ip', format: fmtBaseballIP },
  { label: 'G', key: 'g', format: fmtInt },
  { label: 'W', key: 'wins', format: fmtInt },
  { label: 'L', key: 'losses', format: fmtInt },
  { label: 'SV', key: 'saves', format: fmtInt },
  { label: 'HLD', key: 'holds', format: fmtInt },
  { label: 'ERA', key: 'era', format: (n) => fmtFixed(n, 2) },
  { label: 'WHIP', key: 'whip', format: (n) => fmtFixed(n, 2) },
  { label: 'K/9', key: 'k9', format: (n) => fmtFixed(n, 2) },
  { label: 'BB/9', key: 'bb9', format: (n) => fmtFixed(n, 2) },
  { label: 'K', key: 'strikeouts', format: fmtInt },
  { label: 'BB', key: 'walks', format: fmtInt },
  { label: 'HR', key: 'hrAllowed', format: fmtInt },
  { label: 'FIP', key: 'fip', format: (n) => fmtFixed(n, 2) },
]

const tdNum = {
  textAlign: 'right' as const,
}

type Props = {
  data: PlayersRadarResponse
  group: 'hitting' | 'pitching'
}

export default function PlayerCompareStatsTable({ data, group }: Props) {
  const [a, b] = data.players ?? []
  if (!a?.stats || !b?.stats) return null

  const rows = group === 'pitching' ? PITCHING_ROWS : HITTING_ROWS
  const nameA = a.fullName || 'Player 1'
  const nameB = b.fullName || 'Player 2'

  return (
    <div className="player-compare-stats">
      <div className="player-compare-stats__scroll">
        <table className="player-compare-stats__table">
          <thead>
            <tr>
              <th scope="col">Stat</th>
              <th scope="col" style={tdNum}>
                {nameA}
              </th>
              <th scope="col" style={tdNum}>
                {nameB}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td style={tdNum}>{cell(a.stats, row.key, row.format)}</td>
                <td style={tdNum}>{cell(b.stats, row.key, row.format)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
