import ChartSkeleton from './ChartSkeleton.jsx'
import { SkeletonBox, SkeletonLine } from './SkeletonPrimitives.jsx'
import TableSkeleton from './TableSkeleton.jsx'

/** Shape-matched loading state for the standings view. */
export default function StandingsPageSkeleton() {
  return (
    <section className="page" aria-busy="true" aria-label="Loading standings">
      <header className="page-head">
        <div>
          <SkeletonLine style={{ width: '9rem', height: '1.75rem', marginBottom: '0.4rem' }} />
          <SkeletonLine style={{ width: '16rem', height: '0.9rem' }} />
          <div className="stat-cards" style={{ marginTop: '0.85rem' }}>
            <SkeletonBox className="skeleton-stat" />
            <SkeletonBox className="skeleton-stat" />
            <SkeletonBox className="skeleton-stat" />
          </div>
        </div>
        <div className="page-controls">
          <SkeletonBox className="skeleton-field" />
          <SkeletonBox className="skeleton-field" />
        </div>
      </header>
      <div className="panel chart-panel">
        <SkeletonLine style={{ width: '8rem', height: '1.05rem', marginBottom: '0.35rem' }} />
        <SkeletonLine style={{ width: '14rem', height: '0.8rem', marginBottom: '0.5rem' }} />
        <ChartSkeleton />
      </div>
      <div className="panel">
        <SkeletonLine style={{ width: '11rem', height: '1.1rem', marginBottom: '0.65rem' }} />
        <TableSkeleton rows={6} cols={7} />
      </div>
    </section>
  )
}
