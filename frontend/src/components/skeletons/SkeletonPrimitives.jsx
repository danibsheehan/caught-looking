/** @param {{ className?: string, style?: import('react').CSSProperties }} props */
export function SkeletonLine({ className = '', style }) {
  return (
    <span
      className={`skeleton-block skeleton-line ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  )
}

/** @param {{ className?: string }} props */
export function SkeletonBox({ className = '' }) {
  return (
    <span
      className={`skeleton-block skeleton-box ${className}`.trim()}
      aria-hidden="true"
    />
  )
}

