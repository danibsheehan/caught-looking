import { useCallback, useId, useMemo, useState } from 'react'
import type { GameBoxscoreResponse, StatcastPitch } from '../../types/api'
import {
  buildPitcherStrikeZoneRows,
  type PitcherStatcastRow,
} from '../../utils/gameStatcastPitchers'
import { pitchTypeColor } from '../../utils/pitchTypeColors'
import {
  NORM_X_MAX,
  NORM_X_MIN,
  NORM_Z_MAX,
  NORM_Z_MIN,
  normalizedPlateLocation,
  projNormToSvg,
  resolveStrikeZoneFeet,
  svgPointString,
} from '../../utils/statcastPlateNormalized'

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

function PitcherStrikeZoneSvg({ pitches }: { pitches: StatcastPitch[] }) {
  const svgId = useId()
  const gradId = `${svgId}-zoneFill`
  const [tip, setTip] = useState<HoverTip | null>(null)

  const zonePoints = useMemo(
    () => ZONE_POLYGON_NORM.map(([x, z]) => svgPointString(x, z)).join(' '),
    [],
  )
  const platePoints = useMemo(
    () => PLATE_POLYGON_NORM.map(([x, z]) => svgPointString(x, z)).join(' '),
    [],
  )

  const gridLines = useMemo(() => {
    const xs = [-1, 0, 1]
    const zs = [0, 0.5, 1]
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (const xN of xs) {
      const a = projNormToSvg(xN, NORM_Z_MIN)
      const b = projNormToSvg(xN, NORM_Z_MAX)
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    for (const zN of zs) {
      const a = projNormToSvg(NORM_X_MIN, zN)
      const b = projNormToSvg(NORM_X_MAX, zN)
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    return segs
  }, [])

  const clearTip = useCallback(() => setTip(null), [])

  return (
    <div
      className="game-pitcher-zones__svg-wrap"
      onMouseLeave={clearTip}
      onBlur={clearTip}
    >
      <svg
        className="game-pitcher-zones__svg"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Pitch locations normalized to the batter strike zone"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="var(--bg)" rx="0.8" />
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
          const { x, y } = projNormToSvg(xN, zN)
          const fill = pitchTypeColor((p.pitchName && p.pitchName.trim()) || 'Unknown')
          return (
            <circle
              key={`${p.pitcher}-${i}-${p.plateX}-${p.plateZ}`}
              cx={x}
              cy={y}
              r={1.35}
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
  const label = (p.pitchName && p.pitchName.trim()) || 'Unknown'
  const { xN, zN } = normalizedPlateLocation(p)
  const { bot, top } = resolveStrikeZoneFeet(p)
  const zoneFromPitchBounds = p.szTop != null && p.szBot != null && p.szTop > p.szBot
  return (
    <div
      role="tooltip"
      className="game-pitcher-zones__tooltip game-pitcher-zones__tooltip--floating"
      style={{
        position: 'fixed',
        left: tip.clientX + 12,
        top: tip.clientY + 12,
        zIndex: 40,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        color: 'var(--text-h)',
        padding: '0.45rem 0.6rem',
        borderRadius: '0.35rem',
        fontSize: '0.82rem',
        boxShadow: 'var(--shadow)',
        maxWidth: '16rem',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: '0.2rem', color: 'var(--text)' }}>
        {p.plateX.toFixed(2)} ft · {p.plateZ.toFixed(2)} ft
      </div>
      <div style={{ marginTop: '0.15rem', color: 'var(--text)' }}>
        Norm: x {xN.toFixed(2)} · z {zN.toFixed(2)} (zone height 0–1)
      </div>
      <div style={{ marginTop: '0.15rem', color: 'var(--text)' }}>
        Zone: {bot.toFixed(2)}–{top.toFixed(2)} ft
        {zoneFromPitchBounds ? ' (per pitch)' : ' (default)'}
      </div>
      {p.releaseSpeed != null ? (
        <div style={{ marginTop: '0.15rem', color: 'var(--text)' }}>
          {p.releaseSpeed.toFixed(1)} mph
        </div>
      ) : null}
      {p.inningHalf ? (
        <div style={{ marginTop: '0.15rem', color: 'var(--text)' }}>{p.inningHalf}</div>
      ) : null}
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
        <article
          key={row.id}
          className="game-pitcher-zones__card"
          aria-label={`Pitch location for ${row.name}`}
        >
          <header className="game-pitcher-zones__head">
            <h3 className="game-pitcher-zones__title">{row.name}</h3>
            {showTeamUnderName && row.side !== 'unknown' && box ? (
              <p className="muted small game-pitcher-zones__team">
                {row.side === 'away' ? box.away.teamName : box.home.teamName}
              </p>
            ) : null}
            <p className="muted small game-pitcher-zones__mix">{mixSummary(row.pitches)}</p>
          </header>
          <PitcherStrikeZoneSvg pitches={row.pitches} />
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
      ))}
    </>
  )
}

export default function GamePitcherStrikeZones({ pitches, box }: GamePitcherStrikeZonesProps) {
  const rows = useMemo(() => buildPitcherStrikeZoneRows(pitches, box), [pitches, box])
  const { away, home, unknown } = useMemo(() => partitionPitchersBySide(rows), [rows])

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
    </div>
  )
}
