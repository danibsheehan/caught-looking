import { useState } from 'react'
import { PlayerRadar } from '../components/charts'
import { PlayerPicker, type PlayerPick } from '../components/ui'

const DEFAULT_SEASON = 2026

export default function PlayerComparison() {
  const [pick1, setPick1] = useState<PlayerPick | null>({
    id: 660271,
    fullName: 'Shohei Ohtani',
  })
  const [pick2, setPick2] = useState<PlayerPick | null>({
    id: 592450,
    fullName: 'Aaron Judge',
  })
  const [season, setSeason] = useState(DEFAULT_SEASON)
  const [group, setGroup] = useState<'hitting' | 'pitching'>('hitting')

  const p1 = pick1?.id
  const p2 = pick2?.id
  const valid =
    p1 != null &&
    p2 != null &&
    Number.isFinite(p1) &&
    Number.isFinite(p2) &&
    p1 > 0 &&
    p2 > 0 &&
    p1 !== p2

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Player comparison</h1>
          <p className="muted">
            Search by name (MLB stats API via this app), then compare season stats on
            the radar.
          </p>
        </div>
      </header>

      <div className="panel">
        <div className="player-pick-grid">
          <PlayerPicker label="Player 1" selected={pick1} onChange={setPick1} />
          <PlayerPicker label="Player 2" selected={pick2} onChange={setPick2} />
        </div>
        <div className="form-grid" style={{ marginTop: '1rem' }}>
          <label className="field">
            <span className="field-label">Season</span>
            <input
              className="field-input"
              type="number"
              min={1900}
              max={2100}
              value={season}
              onChange={(e) => setSeason(Number(e.target.value) || DEFAULT_SEASON)}
            />
          </label>
          <label className="field">
            <span className="field-label">Stat group</span>
            <select
              value={group}
              onChange={(e) => {
                const v = e.target.value
                setGroup(v === 'pitching' ? 'pitching' : 'hitting')
              }}
            >
              <option value="hitting">Hitting</option>
              <option value="pitching">Pitching</option>
            </select>
          </label>
        </div>
        {!valid ? (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Choose two different players to render the chart.
          </p>
        ) : null}
      </div>

      <div className="panel chart-panel">
        <h2>Radar</h2>
        <p className="muted small">
          Axes are pair-normalized for display (better stat fills the spoke vs the
          other player).
        </p>
        <PlayerRadar
          key={`${p1}-${p2}-${season}-${group}`}
          playerId1={valid ? p1 : null}
          playerId2={valid ? p2 : null}
          season={valid ? season : null}
          group={group}
        />
      </div>
    </section>
  )
}
