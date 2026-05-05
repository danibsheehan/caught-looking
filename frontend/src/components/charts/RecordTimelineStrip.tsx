import type { RecordPoint } from '../../types/api.compat';
import ChartSkeleton from '../skeletons/ChartSkeleton';
import { useRecordTimeline } from '../../hooks/useRecordTimeline';

type RecordTimelineStripProps = {
  teamId: number | null | undefined;
  season: number | null | undefined;
};

export default function RecordTimelineStrip({ teamId, season }: RecordTimelineStripProps) {
  const { data, error, loading } = useRecordTimeline(teamId, season);

  if (teamId == null || season == null) {
    return <p className="muted">Select a team and season to see the result strip.</p>;
  }

  if (loading && !data) {
    return <ChartSkeleton height={120} label="Loading game results" />;
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  }

  if (!data?.points?.length) {
    return <p className="muted">No completed games in this sample yet.</p>;
  }

  return (
    <div className="record-timeline">
      <div className="record-timeline__strip" role="list" aria-label="Game results in order">
        {data.points.map((p) => (
          <StripCell key={`${p.gameIndex}-${p.officialDate}`} point={p} />
        ))}
      </div>
      <p className="muted small record-timeline__legend">
        <span className="record-timeline__abbr record-timeline__abbr--win">W</span> win ·{' '}
        <span className="record-timeline__abbr record-timeline__abbr--loss">L</span> loss
        {data.points.some((p) => p.result === 'T') ? (
          <>
            {' '}
            · <span className="record-timeline__abbr record-timeline__abbr--tie">T</span> tie
          </>
        ) : null}
        · hover for date
      </p>
    </div>
  );
}

function StripCell({ point }: { point: RecordPoint }) {
  const mod =
    point.result === 'W'
      ? 'record-timeline__cell--win'
      : point.result === 'L'
        ? 'record-timeline__cell--loss'
        : 'record-timeline__cell--tie';
  const title = `Game ${point.gameIndex} · ${point.officialDate} · ${point.result} (${point.wins}-${point.losses})`;
  return (
    <span role="listitem" className={`record-timeline__cell ${mod}`} title={title}>
      {point.result}
    </span>
  );
}
