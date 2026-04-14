import { SkeletonLine } from './SkeletonPrimitives.jsx'

/**
 * @param {{ rows?: number, cols?: number }} props
 */
export default function TableSkeleton({ rows = 8, cols = 7 }) {
  return (
    <div className="table-skeleton" aria-hidden="true">
      <div className="table-skeleton-head">
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonLine key={`h-${i}`} style={{ height: '0.7rem', flex: 1 }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={`r-${r}`} className="table-skeleton-row">
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonLine
              key={`c-${r}-${c}`}
              style={{
                height: '0.75rem',
                flex: c === 1 ? 2 : 1,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
