import { SkeletonLine } from './SkeletonPrimitives';

type TableSkeletonProps = {
  rows?: number;
  cols?: number;
};

export default function TableSkeleton({ rows = 8, cols = 7 }: TableSkeletonProps) {
  return (
    <div className="table-skeleton" role="status" aria-busy="true" aria-label="Loading table">
      <div className="table-skeleton__head">
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonLine key={`h-${i}`} style={{ height: '0.7rem', flex: 1 }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={`r-${r}`} className="table-skeleton__row">
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
  );
}
