import { lazy, useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { ChartSuspense } from '../components/charts/ChartSuspense';
import GameStatcastSpray from '../components/charts/GameStatcastSpray';

const GameStatcastScatter = lazy(() => import('../components/charts/GameStatcastScatter'));
import GameBoxscorePanel from '../components/game/GameBoxscorePanel';
import { useGameDetailData } from '../hooks/useGameDetailData';
import { gameStatusSettled } from '../utils/gameStatus';

export default function GameDetail() {
  const { gamePk: gamePkParam } = useParams();
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');

  const gamePk = useMemo(() => {
    const n = Number(gamePkParam);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [gamePkParam]);

  const { box, statcast, pitches } = useGameDetailData(gamePk);
  const livePolling = Boolean(box.data && !gameStatusSettled(box.data.status));

  const backTo = useMemo(() => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return `/games?date=${encodeURIComponent(date)}`;
    }
    return '/games';
  }, [date]);

  if (gamePk == null) {
    return <Navigate to="/games" replace />;
  }

  return (
    <section className="page games-detail">
      <header className="games-detail__header">
        <div>
          <p className="text text--muted text--small games-detail__back-row">
            <Link className="games-detail__back" to={backTo}>
              ← Games
              {date ? ` · ${date}` : ''}
            </Link>
          </p>
          <h1>Box score</h1>
          <p className="text text--muted">
            Team totals, pitching and batting lines, and runs by inning.
          </p>
          {livePolling ? (
            <p className="text text--muted text--small">
              Live game — box score and timeline refresh about every 45 seconds (paused while this
              tab is hidden).
            </p>
          ) : null}
        </div>
      </header>

      {box.loading ? (
        <p className="text text--muted">Loading box score…</p>
      ) : box.error ? (
        <p className="text text--error" role="alert">
          {box.error.message}
        </p>
      ) : box.data ? (
        <GameBoxscorePanel
          data={box.data}
          gamePk={gamePk}
          pitchLocation={{
            loading: pitches.loading,
            error: pitches.error,
            data: pitches.data,
          }}
        />
      ) : null}

      <div className="game-statcast">
        <h2>Batted balls</h2>
        <p className="text text--muted text--small">
          The field view shows roughly where each ball was put in play. The scatter chart uses the
          same batted balls for exit velocity and launch angle. Team colors for away vs home batting
          match the runs-by-inning chart (circles vs diamonds repeat the away/home split).
        </p>
        {statcast.loading ? (
          <p className="text text--muted">Loading batted-ball data…</p>
        ) : statcast.error ? (
          <p className="text text--error" role="alert">
            {statcast.error.message}
          </p>
        ) : statcast.data ? (
          <>
            <h3 className="game-statcast__subhead">Spray (field view)</h3>
            <GameStatcastSpray
              battedBalls={statcast.data.battedBalls}
              venueId={statcast.data.venueId}
              venueName={statcast.data.venueName}
              awayTeamId={box.data?.away.teamId}
              homeTeamId={box.data?.home.teamId}
            />
            <h3 className="game-statcast__subhead">How each batted ball was struck</h3>
            <ChartSuspense height={400} label="Loading Statcast scatter">
              <GameStatcastScatter
                battedBalls={statcast.data.battedBalls}
                awayTeamId={box.data?.away.teamId}
                homeTeamId={box.data?.home.teamId}
              />
            </ChartSuspense>
          </>
        ) : null}
      </div>
    </section>
  );
}
