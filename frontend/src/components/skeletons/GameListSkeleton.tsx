import { SkeletonLine } from './SkeletonPrimitives'

type GameListSkeletonProps = {
  rows?: number
}

export default function GameListSkeleton({ rows = 6 }: GameListSkeletonProps) {
  return (
    <div className="games-list-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="games-list-skeleton__row">
          <SkeletonLine style={{ width: '55%', height: '0.95rem' }} />
          <SkeletonLine style={{ width: '28%', height: '0.75rem' }} />
        </div>
      ))}
    </div>
  )
}
