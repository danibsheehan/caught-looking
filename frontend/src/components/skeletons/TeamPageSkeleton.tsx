import ChartSkeleton from './ChartSkeleton'
import { SkeletonBox, SkeletonLine } from './SkeletonPrimitives'

export default function TeamPageSkeleton() {
  return (
    <section className="page teams-page" aria-busy="true" aria-label="Loading teams">
      <header className="teams-page__header">
        <div>
          <SkeletonLine style={{ width: '6rem', height: '1.75rem', marginBottom: '0.4rem' }} />
          <SkeletonLine style={{ width: 'min(100%, 22rem)', height: '0.9rem' }} />
        </div>
        <SkeletonBox className="skeleton__box--field" />
      </header>
      <div className="teams-page__panel">
        <SkeletonLine style={{ width: '40%', height: '1.05rem', marginBottom: '0.65rem' }} />
        <SkeletonLine style={{ width: '100%', height: '0.85rem', marginBottom: '0.35rem' }} />
        <SkeletonLine style={{ width: '70%', height: '0.85rem' }} />
      </div>
      <div className="teams-page__panel teams-page__panel--chart">
        <SkeletonLine style={{ width: '14rem', height: '1.05rem', marginBottom: '0.5rem' }} />
        <ChartSkeleton label="Loading win chart" />
      </div>
    </section>
  )
}
