import { SkeletonBox, SkeletonLine } from './SkeletonPrimitives'

/** Shown while lazy route chunks load (Suspense). */
export default function PageRouteSkeleton() {
  return (
    <div className="page page-skeleton" aria-busy="true" aria-label="Loading page">
      <div className="page-head">
        <div style={{ flex: '1 1 12rem' }}>
          <SkeletonLine style={{ width: '40%', height: '1.75rem', marginBottom: '0.5rem' }} />
          <SkeletonLine style={{ width: '70%', height: '0.9rem' }} />
        </div>
        <SkeletonBox className="skeleton__box--field" />
      </div>
      <div className="panel">
        <SkeletonLine style={{ width: '30%', height: '1.1rem', marginBottom: '0.75rem' }} />
        <SkeletonLine style={{ width: '100%', height: '0.85rem', marginBottom: '0.4rem' }} />
        <SkeletonLine style={{ width: '92%', height: '0.85rem', marginBottom: '0.4rem' }} />
        <SkeletonLine style={{ width: '85%', height: '0.85rem' }} />
      </div>
      <div className="panel chart-panel">
        <SkeletonLine style={{ width: '35%', height: '1.05rem', marginBottom: '0.65rem' }} />
        <div className="chart-skeleton chart-skeleton--route" />
      </div>
    </div>
  )
}
