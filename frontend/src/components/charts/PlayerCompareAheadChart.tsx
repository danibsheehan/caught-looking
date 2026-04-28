import { useMemo, useState } from 'react'
import type { PlayersRadarResponse } from '../../types/api.compat'
import { usePlayerCompareChartColors } from '../../hooks/usePlayerCompareChartColors'
import {
  buildCompareMetricRows,
  type CompareMetricRow,
} from '../../utils/playerCompareMetricRows'

function formatRadarTooltipValue(
  key: string,
  v: number,
  group: 'hitting' | 'pitching',
): string {
  if (!Number.isFinite(v)) return '—'
  if (group === 'hitting') {
    if (key === 'hr' || key === 'rbi') return String(Math.round(v))
    return v.toFixed(3)
  }
  return v.toFixed(2)
}

function DumbbellRowTip({
  row,
  nameA,
  nameB,
  group,
}: {
  row: CompareMetricRow
  nameA: string
  nameB: string
  group: 'hitting' | 'pitching'
}) {
  const v1s = formatRadarTooltipValue(row.key, row.v1, group)
  const v2s = formatRadarTooltipValue(row.key, row.v2, group)

  return (
    <div
      className="player-ahead-chart__flyout"
      role="tooltip"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '0.5rem 0.65rem',
        fontSize: 12,
        color: 'var(--text-h)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{row.metric}</div>
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>
        {nameA}: {v1s}{' '}
        <span className="muted">({Math.round(row.a)}%)</span>
      </div>
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>
        {nameB}: {v2s}{' '}
        <span className="muted">({Math.round(row.b)}%)</span>
      </div>
    </div>
  )
}

type Props = {
  data: PlayersRadarResponse
  group: 'hitting' | 'pitching'
  teamId1?: number | null
  teamId2?: number | null
}

export default function PlayerCompareAheadChart({
  data,
  group,
  teamId1,
  teamId2,
}: Props) {
  const rows = useMemo(() => buildCompareMetricRows(data, group), [data, group])
  const nameA = data.players?.[0]?.fullName ?? 'Player 1'
  const nameB = data.players?.[1]?.fullName ?? 'Player 2'
  const { colorA, colorB } = usePlayerCompareChartColors(teamId1, teamId2)
  const [tipRow, setTipRow] = useState<CompareMetricRow | null>(null)

  if (!rows.length) return null

  return (
    <div className="player-ahead-chart">
      <div className="player-ahead-chart__rows">
        {rows.map((row) => {
          const lo = Math.min(row.a, row.b)
          const hi = Math.max(row.a, row.b)
          const span = Math.max(hi - lo, 0.35)
          const tied = Math.abs(row.a - row.b) < 0.25

          return (
            <div
              key={row.key}
              className="player-ahead-chart__row"
              onMouseEnter={() => setTipRow(row)}
              onMouseLeave={() => setTipRow(null)}
            >
              <div className="player-ahead-chart__metric">{row.metric}</div>
              <div className="player-ahead-chart__track">
                <div className="player-ahead-chart__track-inner" aria-hidden>
                  <div className="player-ahead-chart__guides">
                    {[25, 50, 75].map((pct) => (
                      <span
                        key={pct}
                        className="player-ahead-chart__guide"
                        style={{ left: `${pct}%` }}
                      />
                    ))}
                  </div>
                  {!tied ? (
                    <div
                      className="player-ahead-chart__connector"
                      style={{
                        left: `${lo}%`,
                        width: `${span}%`,
                      }}
                    />
                  ) : null}
                  {tied ? (
                    <div
                      className="player-ahead-chart__dot player-ahead-chart__dot--tie"
                      style={{
                        left: `${row.a}%`,
                        background: `linear-gradient(90deg, ${colorA} 50%, ${colorB} 50%)`,
                      }}
                    />
                  ) : (
                    <>
                      <div
                        className="player-ahead-chart__dot"
                        style={{
                          left: `${row.a}%`,
                          background: colorA,
                          zIndex: 2,
                        }}
                      />
                      <div
                        className="player-ahead-chart__dot"
                        style={{
                          left: `${row.b}%`,
                          background: colorB,
                          zIndex: 3,
                        }}
                      />
                    </>
                  )}
                </div>
                {tipRow?.key === row.key ? (
                  <div className="player-ahead-chart__flyout-wrap">
                    <DumbbellRowTip row={row} nameA={nameA} nameB={nameB} group={group} />
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="player-ahead-chart__scale" aria-hidden>
        <span className="player-ahead-chart__scale-spacer" />
        <div className="player-ahead-chart__scale-ticks">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      <p className="muted small player-ahead-chart__axis-label">
        Scale: pair-normalized strength (100 = better for this matchup).
      </p>

      <div className="player-ahead-chart__legend" aria-label="Series">
        <span className="player-ahead-chart__legend-item">
          <span
            className="player-ahead-chart__legend-dot"
            style={{ background: colorA }}
          />
          {nameA}
        </span>
        <span className="player-ahead-chart__legend-item">
          <span
            className="player-ahead-chart__legend-dot"
            style={{ background: colorB }}
          />
          {nameB}
        </span>
      </div>
    </div>
  )
}
