import { lazy, useMemo } from 'react';
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex';
import { gameInningBarFills } from '../../utils/gameChartColors';
import { gameStatusLabel } from '../../utils/gameStatus';
import { ChartSuspense } from '../charts/ChartSuspense';
import GamePitcherStrikeZones from '../charts/GamePitcherStrikeZones';
import BoxscoreSortableTable, { type BoxscoreColumn } from './BoxscoreSortableTable';

const GameScoreBar = lazy(() => import('../charts/GameScoreBar'));
import GameFinalScoreStrip from './GameFinalScoreStrip';
import type {
  BatterLine,
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  PitcherLine,
  TeamBoxSide,
} from '../../types/api.compat';

/** MLB IP string to outs (e.g. 9.0 → 27, 0.1 → 1). */
function ipToOuts(ip: string): number {
  const s = String(ip).trim();
  if (!s) return 0;
  const [w, frac = '0'] = s.split('.');
  const whole = parseInt(w, 10) || 0;
  const t = parseInt(frac, 10) || 0;
  let extra = 0;
  if (t === 1) extra = 1;
  else if (t === 2) extra = 2;
  return whole * 3 + extra;
}

const PITCHING_COLUMNS: BoxscoreColumn<PitcherLine>[] = [
  { label: 'Pitcher', sortKey: 'name', cell: (p) => p.name, sortValue: (p) => p.name ?? '' },
  { label: 'IP', sortKey: 'ip', cell: (p) => p.ip, sortValue: (p) => ipToOuts(p.ip) },
  { label: 'H', sortKey: 'h', cell: (p) => p.h, sortValue: (p) => p.h ?? '' },
  { label: 'R', sortKey: 'r', cell: (p) => p.r, sortValue: (p) => p.r ?? '' },
  { label: 'ER', sortKey: 'er', cell: (p) => p.er, sortValue: (p) => p.er ?? '' },
  { label: 'BB', sortKey: 'bb', cell: (p) => p.bb, sortValue: (p) => p.bb ?? '' },
  { label: 'SO', sortKey: 'so', cell: (p) => p.so, sortValue: (p) => p.so ?? '' },
  { label: 'HR', sortKey: 'hr', cell: (p) => p.hr, sortValue: (p) => p.hr ?? '' },
];

const BATTING_COLUMNS: BoxscoreColumn<BatterLine>[] = [
  { label: 'Batter', sortKey: 'name', cell: (b) => b.name, sortValue: (b) => b.name ?? '' },
  { label: 'Pos', sortKey: 'pos', cell: (b) => b.pos, sortValue: (b) => b.pos ?? '' },
  { label: 'AB', sortKey: 'ab', cell: (b) => b.ab, sortValue: (b) => b.ab ?? '' },
  { label: 'R', sortKey: 'r', cell: (b) => b.r, sortValue: (b) => b.r ?? '' },
  { label: 'H', sortKey: 'h', cell: (b) => b.h, sortValue: (b) => b.h ?? '' },
  {
    label: '2B',
    sortKey: 'doubles',
    cell: (b) => b.doubles,
    sortValue: (b) => b.doubles ?? '',
  },
  {
    label: '3B',
    sortKey: 'triples',
    cell: (b) => b.triples,
    sortValue: (b) => b.triples ?? '',
  },
  { label: 'HR', sortKey: 'hr', cell: (b) => b.hr, sortValue: (b) => b.hr ?? '' },
  { label: 'RBI', sortKey: 'rbi', cell: (b) => b.rbi, sortValue: (b) => b.rbi ?? '' },
  { label: 'BB', sortKey: 'bb', cell: (b) => b.bb, sortValue: (b) => b.bb ?? '' },
  { label: 'SO', sortKey: 'so', cell: (b) => b.so, sortValue: (b) => b.so ?? '' },
];

function TeamTotalsCard({ side }: { side: TeamBoxSide }) {
  const t = side.totals;
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
  );
}

export type GameBoxscorePitchLocation = {
  loading: boolean;
  error: Error | null;
  data: GameStatcastPitchesResponse | null;
};

export default function GameBoxscorePanel({
  data,
  gamePk,
  pitchLocation,
}: {
  data: GameBoxscoreResponse;
  /** When set, renders “Runs by inning” directly below team totals. */
  gamePk?: number;
  /** Pitch-location charts; shown below pitching tables when provided. */
  pitchLocation?: GameBoxscorePitchLocation;
}) {
  const surfaceHex = useChartSurfaceHex();
  /** Same fills as {@link GameScoreBar} stacked bars so the score strip matches the chart. */
  const runsByInningTeamFills = useMemo(
    () => gameInningBarFills(data.away.teamId, data.home.teamId, surfaceHex),
    [data.away.teamId, data.home.teamId, surfaceHex],
  );

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
        <div className="game-boxscore__panel game-boxscore__panel--chart game-boxscore__runs-panel">
          <h2>Runs by inning</h2>
          <p className="text text--muted text--small">
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
            statusLabel={gameStatusLabel(data.status)}
          />
          <ChartSuspense height={260} label="Loading runs-by-inning chart">
            <GameScoreBar key={String(gamePk)} gamePk={gamePk} showCaption={false} />
          </ChartSuspense>
        </div>
      ) : null}

      <h2 className="game-boxscore__heading">Pitching</h2>
      <div className="game-boxscore__pitch-grid">
        <div className="game-boxscore__panel">
          <h3 className="game-boxscore__team-name">{data.away.teamName}</h3>
          <BoxscoreSortableTable columns={PITCHING_COLUMNS} rows={data.away.pitching ?? []} />
        </div>
        <div className="game-boxscore__panel">
          <h3 className="game-boxscore__team-name">{data.home.teamName}</h3>
          <BoxscoreSortableTable columns={PITCHING_COLUMNS} rows={data.home.pitching ?? []} />
        </div>
      </div>

      {pitchLocation != null ? (
        <div className="game-boxscore__panel game-boxscore__panel--chart game-boxscore__pitch-location">
          <h2>Pitch location</h2>
          <p className="text text--muted text--small">
            Catcher&apos;s view toward the pitcher. <strong>Locations</strong> shows each pitch
            colored by type. <strong>Density</strong> shows a count grid over the plate; use Pitch
            type to filter.
          </p>
          {pitchLocation.loading ? (
            <p className="text text--muted">Loading pitch data…</p>
          ) : pitchLocation.error ? (
            <p className="text text--error" role="alert">
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
          <BoxscoreSortableTable columns={BATTING_COLUMNS} rows={data.away.batting ?? []} />
        </div>
        <div className="game-boxscore__panel">
          <h3 className="game-boxscore__team-name">{data.home.teamName}</h3>
          <BoxscoreSortableTable columns={BATTING_COLUMNS} rows={data.home.batting ?? []} />
        </div>
      </div>
    </div>
  );
}
