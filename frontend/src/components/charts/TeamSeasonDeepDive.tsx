import { useMemo, type CSSProperties } from 'react';
import type {
  TeamSeasonStatsResponse,
  TeamVenueSplitLine,
  TeamVenueSplits,
} from '../../types/api.compat';
import { teamSplitChartColors } from '../../utils/mlbTeamColors';
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex';

type TeamSeasonDeepDiveProps = {
  stats: TeamSeasonStatsResponse;
  teamId: number;
};

function formatTwo(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toFixed(2);
}

function formatSlashThree(v: number | undefined): string {
  if (v == null || Number.isNaN(v) || v === 0) return '—';
  const s = v.toFixed(3);
  return s.startsWith('0.') ? s.slice(1) : s;
}

/** Like `formatSlashThree` but allows numeric zero (e.g. ISO). */
function formatRateThree(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  const s = v.toFixed(3);
  return s.startsWith('0.') ? s.slice(1) : s;
}

function formatPctOne(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function fillHigherBetter(value: number, ceiling: number): number {
  if (!Number.isFinite(value) || ceiling <= 0) return 0;
  return Math.max(0, Math.min(100, (value / ceiling) * 100));
}

/** Longer bar = better (lower raw value). */
function fillLowerBetter(value: number, good: number, bad: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return ((bad - value) / (bad - good)) * 100;
}

const HIT_CEIL = {
  ops: 1.0,
  obp: 0.45,
  slg: 0.55,
  avg: 0.33,
  rpg: 7,
  k9: 11,
  iso: 0.22,
  hrpg: 1.65,
  bbPct: 10.5,
  babip: 0.32,
} as const;
const HIT_KPCT = { good: 19.0, bad: 26.5 } as const;
const PITCH_RA = { good: 3.4, bad: 6.2 } as const;
const PITCH_ERA = { good: 2.9, bad: 5.8 } as const;
const PITCH_WHIP = { good: 1.08, bad: 1.52 } as const;
const PITCH_BB9 = { good: 2.4, bad: 4.8 } as const;
const PITCH_HR9 = { good: 0.95, bad: 1.38 } as const;
const PITCH_H9 = { good: 7.35, bad: 9.15 } as const;
const PITCH_KBB_CEIL = 3.85 as const;

export default function TeamSeasonDeepDive({ stats, teamId }: TeamSeasonDeepDiveProps) {
  const surfaceHex = useChartSurfaceHex();
  const { offense: offenseColor, defense: defenseColor } = useMemo(
    () => teamSplitChartColors(teamId, surfaceHex),
    [teamId, surfaceHex],
  );

  const hitting = stats.hitting;
  const pitching = stats.pitching;
  const hasHitting = hitting.gamesPlayed > 0;
  const hasPitching = pitching.gamesPlayed > 0;

  const hitRows = useMemo(() => {
    if (!hasHitting) return [];
    const rows: Array<{
      key: string;
      label: string;
      display: string;
      fill: number;
      empty: boolean;
    }> = [];
    const add = (
      key: string,
      label: string,
      raw: number | undefined,
      ceiling: number,
      fmt: (v: number) => string,
    ) => {
      if (raw == null || Number.isNaN(raw)) {
        rows.push({ key, label, display: '—', fill: 0, empty: true });
        return;
      }
      rows.push({
        key,
        label,
        display: fmt(raw),
        fill: fillHigherBetter(raw, ceiling),
        empty: false,
      });
    };
    add('rpg', 'R/G', hitting.runsPerGame, HIT_CEIL.rpg, formatTwo);
    add('ops', 'OPS', hitting.ops, HIT_CEIL.ops, formatSlashThree);
    add('obp', 'OBP', hitting.obp, HIT_CEIL.obp, formatSlashThree);
    add('slg', 'SLG', hitting.slg, HIT_CEIL.slg, formatSlashThree);
    add('avg', 'AVG', hitting.avg, HIT_CEIL.avg, formatSlashThree);
    add('iso', 'ISO', hitting.isolatedPower, HIT_CEIL.iso, formatRateThree);
    add('hrpg', 'HR/G', hitting.homeRunsPerGame, HIT_CEIL.hrpg, formatTwo);
    add('bbpct', 'BB%', hitting.bbPct, HIT_CEIL.bbPct, formatPctOne);
    const addKpct = (
      key: string,
      label: string,
      raw: number | undefined,
      good: number,
      bad: number,
      fmt: (v: number) => string,
    ) => {
      if (raw == null || Number.isNaN(raw)) {
        rows.push({ key, label, display: '—', fill: 0, empty: true });
        return;
      }
      rows.push({
        key,
        label,
        display: fmt(raw),
        fill: fillLowerBetter(raw, good, bad),
        empty: false,
      });
    };
    addKpct('kpct', 'K%', hitting.kPct, HIT_KPCT.good, HIT_KPCT.bad, formatPctOne);
    add('babip', 'BABIP', hitting.babip, HIT_CEIL.babip, formatRateThree);
    return rows;
  }, [hasHitting, hitting]);

  const pitchRows = useMemo(() => {
    if (!hasPitching) return [];
    const rows: Array<{
      key: string;
      label: string;
      display: string;
      fill: number;
      empty: boolean;
    }> = [];
    const addLower = (
      key: string,
      label: string,
      raw: number | undefined,
      good: number,
      bad: number,
      fmt: (v: number) => string,
    ) => {
      if (raw == null || Number.isNaN(raw)) {
        rows.push({ key, label, display: '—', fill: 0, empty: true });
        return;
      }
      rows.push({
        key,
        label,
        display: fmt(raw),
        fill: fillLowerBetter(raw, good, bad),
        empty: false,
      });
    };
    const addHigher = (
      key: string,
      label: string,
      raw: number | undefined,
      ceiling: number,
      fmt: (v: number) => string,
    ) => {
      if (raw == null || Number.isNaN(raw)) {
        rows.push({ key, label, display: '—', fill: 0, empty: true });
        return;
      }
      rows.push({
        key,
        label,
        display: fmt(raw),
        fill: fillHigherBetter(raw, ceiling),
        empty: false,
      });
    };
    addLower('rag', 'RA/G', pitching.runsAllowedPerGame, PITCH_RA.good, PITCH_RA.bad, formatTwo);
    addLower('era', 'ERA', pitching.era, PITCH_ERA.good, PITCH_ERA.bad, formatTwo);
    addLower('whip', 'WHIP', pitching.whip, PITCH_WHIP.good, PITCH_WHIP.bad, formatTwo);
    addHigher('k9', 'K/9', pitching.k9, HIT_CEIL.k9, formatTwo);
    addLower('bb9', 'BB/9', pitching.bb9, PITCH_BB9.good, PITCH_BB9.bad, formatTwo);
    addLower('hr9', 'HR/9', pitching.hr9, PITCH_HR9.good, PITCH_HR9.bad, formatTwo);
    addLower('h9', 'H/9', pitching.h9, PITCH_H9.good, PITCH_H9.bad, formatTwo);
    addHigher('kbb', 'K/BB', pitching.kbb, PITCH_KBB_CEIL, formatTwo);
    return rows;
  }, [hasPitching, pitching]);

  return (
    <div
      className="teams-deep-dive"
      style={
        {
          '--team-chart-offense': offenseColor,
          '--team-chart-defense': defenseColor,
        } as CSSProperties
      }
    >
      <p className="muted small teams-deep-dive__totals">
        <span className="teams-deep-dive__total-item">
          Runs scored (season): <strong>{hitting.runs}</strong>
        </span>
        <span aria-hidden="true"> · </span>
        <span className="teams-deep-dive__total-item">
          Runs allowed: <strong>{pitching.runsAllowed}</strong>
        </span>
        {hasHitting ? (
          <>
            <span aria-hidden="true"> · </span>
            <span className="teams-deep-dive__total-item">
              2B: <strong>{hitting.doubles ?? 0}</strong>
            </span>
            <span aria-hidden="true"> · </span>
            <span className="teams-deep-dive__total-item">
              HR: <strong>{hitting.homeRuns ?? 0}</strong>
            </span>
            <span aria-hidden="true"> · </span>
            <span className="teams-deep-dive__total-item">
              SB: <strong>{hitting.stolenBases ?? 0}</strong>
            </span>
          </>
        ) : null}
      </p>

      {hasHitting && hasPitching ? (
        <RgDumbbell
          runsPerGame={hitting.runsPerGame}
          runsAllowedPerGame={pitching.runsAllowedPerGame}
          offenseColor={offenseColor}
          defenseColor={defenseColor}
        />
      ) : null}

      <VenueSplitsPanel splits={stats.venueSplits} />

      {hasHitting ? (
        <>
          <h3 className="teams-deep-dive__section-title">Offense</h3>
          <p className="muted small teams-deep-dive__hint">
            Bar length vs rough full-season ceilings (not league rank). For K%, a longer bar means
            less strikeout-heavy team offense on this scale.
          </p>
          <div className="teams-deep-dive__bar-list" role="list">
            {hitRows.map((row) => (
              <StatBarRow
                key={row.key}
                label={row.label}
                display={row.display}
                fill={row.fill}
                variant="hit"
                empty={row.empty}
              />
            ))}
          </div>
        </>
      ) : null}

      {hasPitching ? (
        <>
          <h3 className="teams-deep-dive__section-title">Pitching</h3>
          <p className="muted small teams-deep-dive__hint">
            For ERA / WHIP / BB/9 / RA/G / HR/9 / H/9, a longer bar means stronger run prevention on
            this scale. K/9 and K/BB use higher-is-better bars.
          </p>
          <div className="teams-deep-dive__bar-list" role="list">
            {pitchRows.map((row) => (
              <StatBarRow
                key={row.key}
                label={row.label}
                display={row.display}
                fill={row.fill}
                variant="pitch"
                empty={row.empty}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function VenueSplitsPanel({ splits }: { splits: TeamVenueSplits }) {
  const gamesTotal = splits.home.games + splits.away.games;
  if (gamesTotal === 0) {
    return (
      <div className="teams-deep-dive__venue">
        <h3 className="teams-deep-dive__section-title">Home and road</h3>
        <p className="muted small teams-deep-dive__hint">
          Run environment and record by venue from the regular-season schedule (completed games with
          scores). Loads when the schedule feed is available.
        </p>
        <p className="muted small">No completed home/road games in this response yet.</p>
      </div>
    );
  }

  return (
    <div className="teams-deep-dive__venue">
      <h3 className="teams-deep-dive__section-title">Home and road</h3>
      <p className="muted small teams-deep-dive__hint">
        Completed regular-season games only: runs and record at home vs on the road, derived from
        the same schedule feed as the game-by-game strip.
      </p>
      <table className="teams-deep-dive__venue-table">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Home</th>
            <th scope="col">Road</th>
          </tr>
        </thead>
        <tbody>
          <VenueRow label="Record" home={fmtRecord(splits.home)} away={fmtRecord(splits.away)} />
          <VenueRow
            label="Games"
            home={String(splits.home.games)}
            away={String(splits.away.games)}
          />
          <VenueRow
            label="R/G"
            home={fmtOptionalTwo(splits.home.runsPerGame)}
            away={fmtOptionalTwo(splits.away.runsPerGame)}
          />
          <VenueRow
            label="RA/G"
            home={fmtOptionalTwo(splits.home.runsAllowedPerGame)}
            away={fmtOptionalTwo(splits.away.runsAllowedPerGame)}
          />
        </tbody>
      </table>
    </div>
  );
}

function VenueRow({ label, home, away }: { label: string; home: string; away: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{home}</td>
      <td>{away}</td>
    </tr>
  );
}

function fmtRecord(line: TeamVenueSplitLine): string {
  if (line.games === 0) return '—';
  return `${line.wins}-${line.losses}`;
}

function fmtOptionalTwo(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toFixed(2);
}

const RG_DOMAIN: [number, number] = [2.25, 7.85];

function rgPosition(v: number): number {
  const [lo, hi] = RG_DOMAIN;
  const x = Math.min(Math.max(v, lo), hi);
  return ((x - lo) / (hi - lo)) * 100;
}

function RgDumbbell({
  runsPerGame,
  runsAllowedPerGame,
  offenseColor,
  defenseColor,
}: {
  runsPerGame: number;
  runsAllowedPerGame: number;
  offenseColor: string;
  defenseColor: string;
}) {
  const pRg = rgPosition(runsPerGame);
  const pRa = rgPosition(runsAllowedPerGame);
  const lo = Math.min(pRg, pRa);
  const hi = Math.max(pRg, pRa);
  const span = Math.max(hi - lo, 1.5);
  const tied = Math.abs(pRg - pRa) < 0.8;

  const ticks = [3, 4, 5, 6, 7];
  const [d0, d1] = RG_DOMAIN;

  return (
    <div className="teams-deep-dive__rg">
      <p className="muted small teams-deep-dive__rg-lead">
        Runs per game: offense (R/G) vs runs allowed per game (RA/G) on one scale ({d0.toFixed(2)}–
        {d1.toFixed(2)} R/9).
      </p>
      <div className="teams-deep-dive__rg-inner">
        <div className="teams-deep-dive__rg-track" aria-hidden>
          <div className="teams-deep-dive__rg-guides">
            {ticks.map((t) => {
              const left = rgPosition(t);
              return (
                <span key={t} className="teams-deep-dive__rg-guide" style={{ left: `${left}%` }} />
              );
            })}
          </div>
          {!tied ? (
            <div
              className="teams-deep-dive__rg-connector"
              style={{ left: `${lo}%`, width: `${span}%` }}
            />
          ) : null}
          {tied ? (
            <div
              className="teams-deep-dive__rg-dot teams-deep-dive__rg-dot--tie"
              style={{
                left: `${pRg}%`,
                background: `linear-gradient(90deg, ${offenseColor} 50%, ${defenseColor} 50%)`,
              }}
            />
          ) : (
            <>
              <div
                className="teams-deep-dive__rg-dot"
                style={{ left: `${pRg}%`, background: offenseColor }}
                title={`R/G ${formatTwo(runsPerGame)}`}
              />
              <div
                className="teams-deep-dive__rg-dot"
                style={{ left: `${pRa}%`, background: defenseColor }}
                title={`RA/G ${formatTwo(runsAllowedPerGame)}`}
              />
            </>
          )}
        </div>
        <div className="teams-deep-dive__rg-scale" aria-hidden>
          {ticks.map((t) => (
            <span key={t} style={{ left: `${rgPosition(t)}%` }}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="teams-deep-dive__rg-legend">
        <span className="teams-deep-dive__rg-legend-item">
          <span
            className="teams-deep-dive__rg-legend-swatch"
            style={{ background: offenseColor }}
          />
          R/G <strong>{formatTwo(runsPerGame)}</strong>
        </span>
        <span className="teams-deep-dive__rg-legend-item">
          <span
            className="teams-deep-dive__rg-legend-swatch"
            style={{ background: defenseColor }}
          />
          RA/G <strong>{formatTwo(runsAllowedPerGame)}</strong>
        </span>
      </div>
    </div>
  );
}

function StatBarRow({
  label,
  display,
  fill,
  variant,
  empty,
}: {
  label: string;
  display: string;
  fill: number;
  variant: 'hit' | 'pitch';
  empty: boolean;
}) {
  const fillMod =
    variant === 'hit' ? 'teams-deep-dive__bar-fill--hit' : 'teams-deep-dive__bar-fill--pitch';
  return (
    <div className="teams-deep-dive__bar-row" role="listitem">
      <span className="teams-deep-dive__bar-label">{label}</span>
      <span className="teams-deep-dive__bar-value">{display}</span>
      <div
        className="teams-deep-dive__bar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={empty ? undefined : Math.round(fill)}
        aria-label={`${label} ${empty ? 'no data' : `${Math.round(fill)} percent bar`}`}
      >
        {!empty ? (
          <div className={`teams-deep-dive__bar-fill ${fillMod}`} style={{ width: `${fill}%` }} />
        ) : null}
      </div>
    </div>
  );
}
