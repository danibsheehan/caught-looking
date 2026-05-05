import ChartSkeleton from './ChartSkeleton';
import { SkeletonBox, SkeletonLine } from './SkeletonPrimitives';
import TableSkeleton from './TableSkeleton';

/** Shape-matched loading state for the standings view. */
export default function StandingsPageSkeleton() {
  return (
    <section className="page standings-page" aria-busy="true" aria-label="Loading standings">
      <header className="standings-page__header">
        <div>
          <SkeletonLine style={{ width: '9rem', height: '1.75rem', marginBottom: '0.4rem' }} />
          <SkeletonLine style={{ width: '16rem', height: '0.9rem' }} />
          <div className="standings-page__stat-cards">
            <SkeletonBox className="skeleton__box--stat" />
            <SkeletonBox className="skeleton__box--stat" />
            <SkeletonBox className="skeleton__box--stat" />
          </div>
        </div>
        <div className="standings-page__controls">
          <SkeletonBox className="skeleton__box--field" />
          <SkeletonBox className="skeleton__box--field" />
        </div>
      </header>
      <div className="standings-page__panel standings-page__panel--chart">
        <SkeletonLine style={{ width: '8rem', height: '1.05rem', marginBottom: '0.35rem' }} />
        <SkeletonLine style={{ width: '14rem', height: '0.8rem', marginBottom: '0.5rem' }} />
        <ChartSkeleton />
      </div>
      <div className="standings-page__panel">
        <SkeletonLine style={{ width: '11rem', height: '1.1rem', marginBottom: '0.65rem' }} />
        <TableSkeleton rows={6} cols={7} />
      </div>
    </section>
  );
}
