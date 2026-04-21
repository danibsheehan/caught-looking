import { useCallback, useId, useMemo, useState } from 'react'
import type { GameBoxscoreResponse, StatcastPitch } from '../../types/api'
import {
  buildPitcherStrikeZoneRows,
  type PitcherStatcastRow,
} from '../../utils/gameStatcastPitchers'
import { pitchTypeColor } from '../../utils/pitchTypeColors'
import { buildPitchZoneTooltipRows } from '../../utils/statcastDisplay'
import {
  NORM_X_MAX,
  NORM_X_MIN,
  NORM_Z_MAX,
  NORM_Z_MIN,
  normalizedPlateLocation,
  projNormToSvgStrikeSquare,
  svgPointStringStrikeSquare,
} from '../../utils/statcastPlateNormalized'
import StatcastMetricTooltipContent from './StatcastMetricTooltipContent'

type GamePitcherStrikeZonesProps = {
  pitches: StatcastPitch[]
  box: GameBoxscoreResponse | null
}

function groupByPitchName(pitches: StatcastPitch[]): [string, StatcastPitch[]][] {
  const m = new Map<string, StatcastPitch[]>()
  for (const p of pitches) {
    const key = (p.pitchName && p.pitchName.trim()) || 'Unknown'
    const arr = m.get(key) ?? []
    arr.push(p)
    m.set(key, arr)
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
}

function mixSummary(pitches: StatcastPitch[]): string {
  const counts = new Map<string, number>()
  for (const p of pitches) {
    const k = (p.pitchName && p.pitchName.trim()) || 'Unknown'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${name} ${n}`)
    .join(' · ')
}

/** Label for the pitcher dropdown (team context + name). */
function pitcherOptionLabel(
  row: PitcherStatcastRow,
  box: GameBoxscoreResponse | null,
): string {
  if (row.side === 'away' && box) return `${box.away.teamName} — ${row.name}`
  if (row.side === 'home' && box) return `${box.home.teamName} — ${row.name}`
  if (row.side === 'unknown') return `Other — ${row.name}`
  return row.name
}

/** Strike zone interior in normalized space: x ∈ [-1,1], z ∈ [0,1]. */
const ZONE_POLYGON_NORM = [
  [-1, 0],
  [1, 0],
  [1, 1],
  [-1, 1],
] as const

/** Home plate outline (normalized); point of plate toward catcher (negative z). */
const PLATE_POLYGON_NORM = [
  [-1, 0],
  [1, 0],
  [1, -0.04],
  [0, -0.13],
  [-1, -0.04],
] as const

type HoverTip = { pitch: StatcastPitch; clientX: number; clientY: number }

function PitcherStrikeZoneSvg({
  pitches,
  variant = 'default',
  ariaLabel = 'Pitch locations from catcher view, normalized to the batter strike zone',
}: {
  pitches: StatcastPitch[]
  variant?: 'default' | 'featured'
  ariaLabel?: string
}) {
  const svgId = useId()
  const gradId = `${svgId}-zoneFill`
  const [tip, setTip] = useState<HoverTip | null>(null)

  const zonePoints = useMemo(
    () => ZONE_POLYGON_NORM.map(([x, z]) => svgPointStringStrikeSquare(x, z)).join(' '),
    [],
  )
  const platePoints = useMemo(
    () => PLATE_POLYGON_NORM.map(([x, z]) => svgPointStringStrikeSquare(x, z)).join(' '),
    [],
  )

  const gridLines = useMemo(() => {
    const xs = [-1, 0, 1]
    const zs = [0, 0.5, 1]
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (const xN of xs) {
      const a = projNormToSvgStrikeSquare(xN, NORM_Z_MIN)
      const b = projNormToSvgStrikeSquare(xN, NORM_Z_MAX)
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    for (const zN of zs) {
      const a = projNormToSvgStrikeSquare(NORM_X_MIN, zN)
      const b = projNormToSvgStrikeSquare(NORM_X_MAX, zN)
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    return segs
  }, [])

  const labelPitcher = useMemo(() => ({ x: 50, y: 4.5 }), [])
  const label3b = useMemo(() => projNormToSvgStrikeSquare(-1.22, 0.98), [])
  const label1b = useMemo(() => projNormToSvgStrikeSquare(1.22, 0.98), [])
  const labelCatcher = useMemo(() => ({ x: 50, y: 97.5 }), [])

  const clearTip = useCallback(() => setTip(null), [])

  const wrapClass =
    variant === 'featured'
      ? 'game-pitcher-zones__svg-wrap game-pitcher-zones__svg-wrap--featured'
      : 'game-pitcher-zones__svg-wrap'

  return (
    <div className={wrapClass} onMouseLeave={clearTip} onBlur={clearTip}>
      <svg
        className="game-pitcher-zones__svg"
        viewBox="0 0 100 100"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="var(--bg)" rx="0.8" />
        <g className="game-pitcher-zones__svg-scene">
          <text
            className="game-pitcher-zones__svg-label game-pitcher-zones__svg-label--pitcher"
            x={labelPitcher.x}
            y={labelPitcher.y}
            textAnchor="middle"
          >
            Pitcher
          </text>
          <text
            className="game-pitcher-zones__svg-label game-pitcher-zones__svg-label--corner"
            x={label3b.x}
            y={label3b.y}
            textAnchor="start"
          >
            3B
          </text>
          <text
            className="game-pitcher-zones__svg-label game-pitcher-zones__svg-label--corner"
            x={label1b.x}
            y={label1b.y}
            textAnchor="end"
          >
            1B
          </text>
          <text
            className="game-pitcher-zones__svg-label game-pitcher-zones__svg-label--catcher"
            x={labelCatcher.x}
            y={labelCatcher.y}
            textAnchor="middle"
          >
            Catcher
          </text>
        </g>
        {gridLines.map((s, i) => (
          <line
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke="var(--border)"
            strokeOpacity={0.45}
            strokeWidth={0.35}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon
          points={zonePoints}
          fill={`url(#${gradId})`}
          stroke="var(--border)"
          strokeWidth={0.55}
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points={platePoints}
          fill="var(--game-plate-fill, #e8e4dc)"
          stroke="var(--border)"
          strokeWidth={0.45}
          opacity={0.95}
          vectorEffect="non-scaling-stroke"
        />
        {pitches.map((p, i) => {
          const { xN, zN } = normalizedPlateLocation(p)
          const { x, y } = projNormToSvgStrikeSquare(xN, zN)
          const fill = pitchTypeColor((p.pitchName && p.pitchName.trim()) || 'Unknown')
          const r = variant === 'featured' ? 1.55 : 1.35
          return (
            <circle
              key={`${p.pitcher}-${i}-${p.plateX}-${p.plateZ}`}
              cx={x}
              cy={y}
              r={r}
              fill={fill}
              fillOpacity={0.92}
              stroke="var(--bg)"
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: 'default' }}
              onMouseEnter={(ev) =>
                setTip({ pitch: p, clientX: ev.clientX, clientY: ev.clientY })
              }
              onMouseMove={(ev) =>
                setTip({ pitch: p, clientX: ev.clientX, clientY: ev.clientY })
              }
            />
          )
        })}
      </svg>
      {tip ? <FloatingPitchTooltip tip={tip} /> : null}
    </div>
  )
}

function FloatingPitchTooltip({ tip }: { tip: HoverTip }) {
  const p = tip.pitch
  const rows = buildPitchZoneTooltipRows({
    pitchName: p.pitchName,
    releaseSpeed: p.releaseSpeed,
  })
  return (
    <div
      role="tooltip"
      className="game-pitcher-zones__tooltip statcast-metric-tooltip"
      style={{
        position: 'fixed',
        left: tip.clientX + 12,
        top: tip.clientY + 12,
        zIndex: 40,
        pointerEvents: 'none',
      }}
    >
      <StatcastMetricTooltipContent rows={rows} />
    </div>
  )
}

function partitionPitchersBySide(rows: PitcherStatcastRow[]) {
  const away: PitcherStatcastRow[] = []
  const home: PitcherStatcastRow[] = []
  const unknown: PitcherStatcastRow[] = []
  for (const r of rows) {
    if (r.side === 'away') away.push(r)
    else if (r.side === 'home') home.push(r)
    else unknown.push(r)
  }
  return { away, home, unknown }
}

function OnePitcherCard({
  row,
  box,
  showTeamUnderName,
  showTitle = true,
  featured = false,
}: {
  row: PitcherStatcastRow
  box: GameBoxscoreResponse | null
  showTeamUnderName: boolean
  showTitle?: boolean
  featured?: boolean
}) {
  const titleId = useId()
  return (
    <article
      className={`game-pitcher-zones__card${featured ? ' game-pitcher-zones__card--featured' : ''}`}
      aria-labelledby={showTitle ? titleId : undefined}
      aria-label={showTitle ? undefined : `Pitch location for ${row.name}`}
    >
      {showTitle ? (
        <header className="game-pitcher-zones__head">
          <h3 className="game-pitcher-zones__title" id={titleId}>
            {row.name}
          </h3>
          {showTeamUnderName && row.side !== 'unknown' && box ? (
            <p className="muted small game-pitcher-zones__team">
              {row.side === 'away' ? box.away.teamName : box.home.teamName}
            </p>
          ) : null}
          <p className="muted small game-pitcher-zones__mix">{mixSummary(row.pitches)}</p>
        </header>
      ) : (
        <p className="muted small game-pitcher-zones__mix">{mixSummary(row.pitches)}</p>
      )}
      <PitcherStrikeZoneSvg
        pitches={row.pitches}
        variant={featured ? 'featured' : 'default'}
        ariaLabel={`Pitch locations for ${row.name}`}
      />
      <ul className="game-pitcher-zones__legend" aria-label="Pitch types">
        {groupByPitchName(row.pitches).map(([name, pts]) => (
          <li key={name} className="game-pitcher-zones__legend-item">
            <span
              className="game-pitcher-zones__legend-swatch"
              style={{ background: pitchTypeColor(name) }}
            />
            <span>
              {name} <span className="muted">({pts.length})</span>
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function PitcherCards({
  rows,
  box,
  showTeamUnderName,
}: {
  rows: PitcherStatcastRow[]
  box: GameBoxscoreResponse | null
  showTeamUnderName: boolean
}) {
  return (
    <>
      {rows.map((row) => (
        <OnePitcherCard
          key={row.id}
          row={row}
          box={box}
          showTeamUnderName={showTeamUnderName}
          showTitle
          featured={false}
        />
      ))}
    </>
  )
}

export default function GamePitcherStrikeZones({ pitches, box }: GamePitcherStrikeZonesProps) {
  const rows = useMemo(() => buildPitcherStrikeZoneRows(pitches, box), [pitches, box])
  const { away, home, unknown } = useMemo(() => partitionPitchersBySide(rows), [rows])
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single')
  /** User-chosen pitcher; when null or stale, first available row is used. */
  const [userPitcherId, setUserPitcherId] = useState<number | null>(null)
  const selectId = useId()

  const effectivePitcherId = useMemo(() => {
    if (rows.length === 0) return null
    if (userPitcherId != null && rows.some((r) => r.id === userPitcherId)) {
      return userPitcherId
    }
    return rows[0]!.id
  }, [rows, userPitcherId])

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === effectivePitcherId) ?? null,
    [rows, effectivePitcherId],
  )

  if (!pitches.length) {
    return (
      <p className="muted game-pitcher-zones__empty">
        No pitch tracking data for this game (or data not available yet).
      </p>
    )
  }

  const sectionHeading = (prefix: string, teamName: string) => `${prefix} — ${teamName}`

  return (
    <div className="game-pitcher-zones">
      <div className="game-pitcher-zones__toolbar">
        {viewMode === 'single' && rows.length > 0 ? (
          <div className="game-pitcher-zones__picker">
            <label className="game-pitcher-zones__picker-label" htmlFor={selectId}>
              Pitcher
            </label>
            <select
              id={selectId}
              className="game-pitcher-zones__select"
              value={effectivePitcherId != null ? String(effectivePitcherId) : ''}
              onChange={(e) => setUserPitcherId(Number(e.target.value))}
            >
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {pitcherOptionLabel(row, box)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button
          type="button"
          className="game-pitcher-zones__view-toggle"
          onClick={() => setViewMode((m) => (m === 'single' ? 'all' : 'single'))}
        >
          {viewMode === 'single' ? 'Show all pitchers' : 'Single pitcher'}
        </button>
      </div>

      {viewMode === 'single' && selectedRow ? (
        <OnePitcherCard
          row={selectedRow}
          box={box}
          showTeamUnderName={false}
          showTitle={false}
          featured
        />
      ) : null}

      {viewMode === 'all' ? (
        <>
          {away.length > 0 ? (
            <section
              className="game-pitcher-zones__section game-pitcher-zones__section--away"
              aria-label={box ? sectionHeading('Away', box.away.teamName) : 'Away pitching'}
            >
              <h4 className="game-pitcher-zones__section-head">
                {box ? sectionHeading('Away', box.away.teamName) : 'Away'}
              </h4>
              <div className="game-pitcher-zones__grid">
                <PitcherCards rows={away} box={box} showTeamUnderName={false} />
              </div>
            </section>
          ) : null}

          {home.length > 0 ? (
            <section
              className="game-pitcher-zones__section game-pitcher-zones__section--home"
              aria-label={box ? sectionHeading('Home', box.home.teamName) : 'Home pitching'}
            >
              <h4 className="game-pitcher-zones__section-head">
                {box ? sectionHeading('Home', box.home.teamName) : 'Home'}
              </h4>
              <div className="game-pitcher-zones__grid">
                <PitcherCards rows={home} box={box} showTeamUnderName={false} />
              </div>
            </section>
          ) : null}

          {unknown.length > 0 ? (
            <section
              className="game-pitcher-zones__section game-pitcher-zones__section--unknown"
              aria-label="Pitchers not matched to box score"
            >
              <h4 className="game-pitcher-zones__section-head">Other pitchers</h4>
              <div className="game-pitcher-zones__grid">
                <PitcherCards rows={unknown} box={box} showTeamUnderName />
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
