import { useState } from 'react';
import type { RecordPoint } from '../../types/api.compat';
import ChartSkeleton from '../skeletons/ChartSkeleton';
import { useRecordTimeline } from '../../hooks/useRecordTimeline';
import {
  WEEKDAY_LABELS,
  buildRecordCalendarMonths,
  type CalendarDay,
  type CalendarMonth,
} from '../../utils/recordTimelineCalendar';

type RecordTimelineStripProps = {
  teamId: number | null | undefined;
  season: number | null | undefined;
};

export default function RecordTimelineStrip({ teamId, season }: RecordTimelineStripProps) {
  const { data, error, loading } = useRecordTimeline(teamId, season);

  if (teamId == null || season == null) {
    return <p className="muted">Select a team and season to see the results calendar.</p>;
  }

  if (loading && !data) {
    return <ChartSkeleton height={240} label="Loading game results" />;
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

  return <RecordCalendar points={data.points} resetKey={`${teamId}-${season}`} />;
}

function RecordCalendar({ points, resetKey }: { points: RecordPoint[]; resetKey: string }) {
  const months = buildRecordCalendarMonths(points);
  if (!months.length) {
    return (
      <p className="muted">
        Games are available, but their dates could not be placed on the calendar.
      </p>
    );
  }

  const hasTies = points.some((p) => p.result === 'T');
  return <RecordCalendarPager key={resetKey} months={months} hasTies={hasTies} />;
}

function RecordCalendarPager({ months, hasTies }: { months: CalendarMonth[]; hasTies: boolean }) {
  const lastIndex = Math.max(0, months.length - 1);
  const [monthIndex, setMonthIndex] = useState(lastIndex);
  const [hoverDetail, setHoverDetail] = useState<string | null>(null);
  const safeIndex = Math.min(Math.max(monthIndex, 0), lastIndex);
  const month = months[safeIndex];
  const atStart = safeIndex <= 0;
  const atEnd = safeIndex >= lastIndex;

  if (!month) {
    return (
      <p className="muted">
        Games are available, but their dates could not be placed on the calendar.
      </p>
    );
  }

  return (
    <div className="record-calendar">
      <div className="record-calendar__nav">
        <button
          type="button"
          className="record-calendar__nav-btn"
          aria-label="Previous month"
          disabled={atStart}
          onClick={() => setMonthIndex((i) => Math.max(0, Math.min(i, lastIndex) - 1))}
        >
          ‹
        </button>
        <h3 className="record-calendar__month-title" aria-live="polite">
          {month.label}
        </h3>
        <button
          type="button"
          className="record-calendar__nav-btn"
          aria-label="Next month"
          disabled={atEnd}
          onClick={() => setMonthIndex((i) => Math.min(lastIndex, Math.max(i, 0) + 1))}
        >
          ›
        </button>
      </div>
      <p className="muted small record-calendar__position">
        {safeIndex + 1} of {months.length}
      </p>
      <section className="record-calendar__month" aria-label={month.label}>
        <div className="record-calendar__weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="record-calendar__weekday">
              {label}
            </span>
          ))}
        </div>
        <div
          className="record-calendar__grid"
          role="list"
          aria-label={`Game results for ${month.label}`}
        >
          {month.days.map((day, index) => (
            <DayCell
              key={day.date ?? `pad-${month.key}-${index}`}
              day={day}
              onShowDetail={setHoverDetail}
            />
          ))}
        </div>
      </section>
      <p className="record-calendar__detail" aria-live="polite">
        {hoverDetail ?? 'Hover a game day for date and record'}
      </p>
      <p className="muted small record-calendar__legend">
        <span className="record-calendar__abbr record-calendar__abbr--win">W</span> win ·{' '}
        <span className="record-calendar__abbr record-calendar__abbr--loss">L</span> loss
        {hasTies ? (
          <>
            {' '}
            · <span className="record-calendar__abbr record-calendar__abbr--tie">T</span> tie
          </>
        ) : null}
      </p>
    </div>
  );
}

function DayCell({
  day,
  onShowDetail,
}: {
  day: CalendarDay;
  onShowDetail: (detail: string | null) => void;
}) {
  if (day.dayOfMonth == null) {
    return <span className="record-calendar__day record-calendar__day--pad" aria-hidden="true" />;
  }

  if (day.games.length === 0) {
    return (
      <span className="record-calendar__day record-calendar__day--empty">
        <span className="record-calendar__day-num">{day.dayOfMonth}</span>
      </span>
    );
  }

  const detail = day.games
    .map((g) => `Game ${g.gameIndex} · ${g.officialDate} · ${g.result} (${g.wins}-${g.losses})`)
    .join(' · ');

  return (
    <button
      type="button"
      role="listitem"
      className={`record-calendar__day record-calendar__day--played ${resultModifier(day.games)}`}
      aria-label={detail}
      onMouseEnter={() => onShowDetail(detail)}
      onMouseLeave={() => onShowDetail(null)}
      onFocus={() => onShowDetail(detail)}
      onBlur={() => onShowDetail(null)}
    >
      <span className="record-calendar__day-num">{day.dayOfMonth}</span>
      <span className="record-calendar__results" aria-hidden="true">
        {day.games.map((g) => (
          <span
            key={`${g.gameIndex}-${g.officialDate}`}
            className={`record-calendar__mark record-calendar__mark--${resultClass(g.result)}`}
          >
            {g.result}
          </span>
        ))}
      </span>
    </button>
  );
}

function resultClass(result: string): 'win' | 'loss' | 'tie' {
  if (result === 'W') return 'win';
  if (result === 'L') return 'loss';
  return 'tie';
}

/** Dominant day tint when multiple games share a date. */
function resultModifier(games: RecordPoint[]): string {
  if (games.length === 1) {
    return `record-calendar__day--${resultClass(games[0].result)}`;
  }
  const wins = games.filter((g) => g.result === 'W').length;
  const losses = games.filter((g) => g.result === 'L').length;
  if (wins > 0 && losses > 0) return 'record-calendar__day--split';
  if (wins > 0) return 'record-calendar__day--win';
  if (losses > 0) return 'record-calendar__day--loss';
  return 'record-calendar__day--tie';
}
