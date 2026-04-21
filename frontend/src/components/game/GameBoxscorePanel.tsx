import { useMemo, useState } from 'react'
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex'
import { gameInningBarFills } from '../../utils/gameChartColors'
import { GamePitcherStrikeZones, GameScoreBar } from '../charts'
import GameFinalScoreStrip from './GameFinalScoreStrip'
import type {
  BatterLine,
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  PitcherLine,
  TeamBoxSide,
} from '../../types/api'

/** MLB IP string to outs (e.g. 9.0 → 27, 0.1 → 1). */
function ipToOuts(ip: string): number {
  const s = String(ip).trim()
  if (!s) return 0
  const [w, frac = '0'] = s.split('.')
  const whole = parseInt(w, 10) || 0
  const t = parseInt(frac, 10) || 0
  let extra = 0
  if (t === 1) extra = 1
  else if (t === 2) extra = 2
  return whole * 3 + extra
}

function sortedCopy<T>(
  rows: T[],
  dir: 'asc' | 'desc',
  valueOf: (row: T) => number | string,
): T[] {
  const out = [...rows]
  out.sort((a, b) => {
    const va = valueOf(a)
    const vb = valueOf(b)
    if (typeof va === 'number' && typeof vb === 'number') {
      return dir === 'asc' ? va - vb : vb - va
    }
    const sa = String(va ?? '')
    const sb = String(vb ?? '')
    const c = sa.localeCompare(sb, undefined, { sensitivity: 'base' })
    return dir === 'asc' ? c : -c
  })
  return out
}

type SortThProps = {
  label: string
  sortKey: string
  activeKey: string | null
  activeDir: 'asc' | 'desc'
  onSort: (k: string) => void
}

function SortTh({ label, sortKey, activeKey, activeDir, onSort }: SortThProps) {
  const active = activeKey === sortKey
  return (
    <th scope="col">
      <button
        type="button"
        className="game-boxscore__sort-btn"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active ? (activeDir === 'asc' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

function TeamTotalsCard({ side }: { side: TeamBoxSide }) {
  const t = side.totals
  return (
    <div className="game-boxscore__team-totals">
      <h3 className="game-boxscore__team-name">{side.teamName}</h3>
      <dl className="game-boxscore__totals-dl">
        <div>
          <dt>R</dt>
          <dd>{t.runs}</dd>
        </div>
        <div>
          <dt>H</dt>
          <dd>{t.hits}</dd>
        </div>
        <div>
          <dt>E</dt>
          <dd>{t.errors}</dd>
        </div>
        <div>
          <dt>LOB</dt>
          <dd>{t.leftOnBase ?? '—'}</dd>
        </div>
        <div>
          <dt>2B</dt>
          <dd>{t.doubles ?? '—'}</dd>
        </div>
        <div>
          <dt>3B</dt>
          <dd>{t.triples ?? '—'}</dd>
        </div>
        <div>
          <dt>HR</dt>
          <dd>{t.homeRuns ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

export type GameBoxscorePitchLocation = {
  loading: boolean
  error: Error | null
  data: GameStatcastPitchesResponse | null
}

export default function GameBoxscorePanel({
  data,
  gamePk,
  pitchLocation,
}: {
  data: GameBoxscoreResponse
  /** When set, renders “Runs by inning” directly below team totals. */
  gamePk?: number
  /** Pitch-location charts; shown below pitching tables when provided. */
  pitchLocation?: GameBoxscorePitchLocation
}) {
  const [batAway, setBatAway] = useState<SortState>(null)
  const [batHome, setBatHome] = useState<SortState>(null)
  const [pitAway, setPitAway] = useState<SortState>(null)
  const [pitHome, setPitHome] = useState<SortState>(null)

  const surfaceHex = useChartSurfaceHex()
  /** Same fills as {@link GameScoreBar} stacked bars so the score strip matches the chart. */
  const runsByInningTeamFills = useMemo(
    () => gameInningBarFills(data.away.teamId, data.home.teamId, surfaceHex),
    [data.away.teamId, data.home.teamId, surfaceHex],
  )

  const batAwayRows = useMemo(() => {
    const batting = data.away.batting ?? []
    if (!batAway) return batting
    const k = batAway.key
    return sortedCopy<BatterLine>(batting, batAway.dir, (row) => {
      const v = (row as unknown as Record<string, number | string>)[k]
      return v ?? ''
    })
  }, [data.away.batting, batAway])

  const batHomeRows = useMemo(() => {
    const batting = data.home.batting ?? []
    if (!batHome) return batting
    const k = batHome.key
    return sortedCopy<BatterLine>(batting, batHome.dir, (row) => {
      const v = (row as unknown as Record<string, number | string>)[k]
      return v ?? ''
    })
  }, [data.home.batting, batHome])

  const pitAwayRows = useMemo(() => {
    const pitching = data.away.pitching ?? []
    if (!pitAway) return pitching
    if (pitAway.key === 'ip') {
      return sortedCopy<PitcherLine>(pitching, pitAway.dir, (row) =>
        ipToOuts(row.ip),
      )
    }
    const k = pitAway.key
    return sortedCopy<PitcherLine>(pitching, pitAway.dir, (row) => {
      const v = (row as unknown as Record<string, number | string>)[k]
      return v ?? ''
    })
  }, [data.away.pitching, pitAway])

  const pitHomeRows = useMemo(() => {
    const pitching = data.home.pitching ?? []
    if (!pitHome) return pitching
    if (pitHome.key === 'ip') {
      return sortedCopy<PitcherLine>(pitching, pitHome.dir, (row) =>
        ipToOuts(row.ip),
      )
    }
    const k = pitHome.key
    return sortedCopy<PitcherLine>(pitching, pitHome.dir, (row) => {
      const v = (row as unknown as Record<string, number | string>)[k]
      return v ?? ''
    })
  }, [data.home.pitching, pitHome])

  function toggleSort(
    which: 'awayBat' | 'homeBat' | 'awayPit' | 'homePit',
    key: string,
  ) {
    const map = {
      awayBat: [batAway, setBatAway] as const,
      homeBat: [batHome, setBatHome] as const,
      awayPit: [pitAway, setPitAway] as const,
      homePit: [pitHome, setPitHome] as const,
    }
    const [, setSortState] = map[which]
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' }
      if (prev.dir === 'desc') return { key, dir: 'asc' }
      return null
    })
  }

  return (
    <div className="game-boxscore">
      <h2 className="game-boxscore__heading">Team totals</h2>
      <div className="game-boxscore__totals-grid">
        <div className="game-boxscore__panel game-boxscore__totals-card">
          <TeamTotalsCard side={data.away} />
        </div>
        <div className="game-boxscore__panel game-boxscore__totals-card">
          <TeamTotalsCard side={data.home} />
        </div>
      </div>

      {gamePk != null ? (
        <div className="game-boxscore__runs-panel panel chart-panel">
          <h2>Runs by inning</h2>
          <p className="muted small">
            Stacked bars use each team’s primary color, brightened for readability on a dark
            background (fast-read scoring by inning).
          </p>
          <GameFinalScoreStrip
            awayTeamName={data.away.teamName}
            homeTeamName={data.home.teamName}
            awayRuns={data.away.totals.runs}
            homeRuns={data.home.totals.runs}
            awayScoreColor={runsByInningTeamFills.awayFill}
            homeScoreColor={runsByInningTeamFills.homeFill}
          />
          <GameScoreBar key={String(gamePk)} gamePk={gamePk} showCaption={false} />
        </div>
      ) : null}

      <h2 className="game-boxscore__heading">Pitching</h2>
      <div className="game-boxscore__pitch-grid">
        <div className="game-boxscore__panel">
          <h3 className="game-boxscore__team-name">{data.away.teamName}</h3>
          <div className="game-boxscore__table-wrap">
            <table className="game-boxscore__table">
              <thead>
                <tr>
                  <SortTh
                    label="Pitcher"
                    sortKey="name"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="IP"
                    sortKey="ip"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="H"
                    sortKey="h"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="R"
                    sortKey="r"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="ER"
                    sortKey="er"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="BB"
                    sortKey="bb"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="SO"
                    sortKey="so"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="HR"
                    sortKey="hr"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                </tr>
              </thead>
              <tbody>
                {pitAwayRows.map((p) => (
                  <tr key={p.playerId}>
                    <td>{p.name}</td>
                    <td>{p.ip}</td>
                    <td>{p.h}</td>
                    <td>{p.r}</td>
                    <td>{p.er}</td>
                    <td>{p.bb}</td>
                    <td>{p.so}</td>
                    <td>{p.hr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="game-boxscore__panel">
          <h3 className="game-boxscore__team-name">{data.home.teamName}</h3>
          <div className="game-boxscore__table-wrap">
            <table className="game-boxscore__table">
              <thead>
                <tr>
                  <SortTh
                    label="Pitcher"
                    sortKey="name"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="IP"
                    sortKey="ip"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="H"
                    sortKey="h"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="R"
                    sortKey="r"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="ER"
                    sortKey="er"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="BB"
                    sortKey="bb"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="SO"
                    sortKey="so"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="HR"
                    sortKey="hr"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                </tr>
              </thead>
              <tbody>
                {pitHomeRows.map((p) => (
                  <tr key={p.playerId}>
                    <td>{p.name}</td>
                    <td>{p.ip}</td>
                    <td>{p.h}</td>
                    <td>{p.r}</td>
                    <td>{p.er}</td>
                    <td>{p.bb}</td>
                    <td>{p.so}</td>
                    <td>{p.hr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {pitchLocation != null ? (
        <div className="panel chart-panel game-boxscore__pitch-location">
          <h2>Pitch location</h2>
          <p className="muted small">
            Catcher&apos;s view toward the pitcher: each pitch where it crossed the plate (horizontal
            and vertical feet), with a light depth perspective on the grid. Colors are pitch
            type.
          </p>
          {pitchLocation.loading ? (
            <p className="muted">Loading pitch data…</p>
          ) : pitchLocation.error ? (
            <p className="error" role="alert">
              {pitchLocation.error.message}
            </p>
          ) : pitchLocation.data ? (
            <GamePitcherStrikeZones pitches={pitchLocation.data.pitches} box={data} />
          ) : null}
        </div>
      ) : null}

      <h2 className="game-boxscore__heading">Batting</h2>
      <div className="game-boxscore__bat-grid">
        <div className="game-boxscore__panel">
          <h3 className="game-boxscore__team-name">{data.away.teamName}</h3>
          <div className="game-boxscore__table-wrap">
            <table className="game-boxscore__table">
              <thead>
                <tr>
                  <SortTh
                    label="Batter"
                    sortKey="name"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="Pos"
                    sortKey="pos"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="AB"
                    sortKey="ab"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="R"
                    sortKey="r"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="H"
                    sortKey="h"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="2B"
                    sortKey="doubles"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="3B"
                    sortKey="triples"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="HR"
                    sortKey="hr"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="RBI"
                    sortKey="rbi"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="BB"
                    sortKey="bb"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="SO"
                    sortKey="so"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                </tr>
              </thead>
              <tbody>
                {batAwayRows.map((b) => (
                  <tr key={b.playerId}>
                    <td>{b.name}</td>
                    <td>{b.pos}</td>
                    <td>{b.ab}</td>
                    <td>{b.r}</td>
                    <td>{b.h}</td>
                    <td>{b.doubles}</td>
                    <td>{b.triples}</td>
                    <td>{b.hr}</td>
                    <td>{b.rbi}</td>
                    <td>{b.bb}</td>
                    <td>{b.so}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="game-boxscore__panel">
          <h3 className="game-boxscore__team-name">{data.home.teamName}</h3>
          <div className="game-boxscore__table-wrap">
            <table className="game-boxscore__table">
              <thead>
                <tr>
                  <SortTh
                    label="Batter"
                    sortKey="name"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="Pos"
                    sortKey="pos"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="AB"
                    sortKey="ab"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="R"
                    sortKey="r"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="H"
                    sortKey="h"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="2B"
                    sortKey="doubles"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="3B"
                    sortKey="triples"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="HR"
                    sortKey="hr"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="RBI"
                    sortKey="rbi"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="BB"
                    sortKey="bb"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="SO"
                    sortKey="so"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                </tr>
              </thead>
              <tbody>
                {batHomeRows.map((b) => (
                  <tr key={b.playerId}>
                    <td>{b.name}</td>
                    <td>{b.pos}</td>
                    <td>{b.ab}</td>
                    <td>{b.r}</td>
                    <td>{b.h}</td>
                    <td>{b.doubles}</td>
                    <td>{b.triples}</td>
                    <td>{b.hr}</td>
                    <td>{b.rbi}</td>
                    <td>{b.bb}</td>
                    <td>{b.so}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
