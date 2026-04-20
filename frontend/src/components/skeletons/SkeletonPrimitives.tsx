import type { CSSProperties } from 'react'

type SkeletonLineProps = {
  className?: string
  style?: CSSProperties
}

export function SkeletonLine({ className = '', style }: SkeletonLineProps) {
  return (
    <span
      className={`skeleton__line ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  )
}

type SkeletonBoxProps = {
  className?: string
}

export function SkeletonBox({ className = '' }: SkeletonBoxProps) {
  return (
    <span className={`skeleton__box ${className}`.trim()} aria-hidden="true" />
  )
}
