import type { ReactNode } from 'react'

type PlayerCardProps = {
  title: string
  subtitle?: string
  children?: ReactNode
}

/** Layout shell for player-focused pages (Phase 3+). */
export default function PlayerCard({ title, subtitle, children }: PlayerCardProps) {
  return (
    <article className="player-card">
      <header className="player-card__head">
        <h3 className="player-card__title">{title}</h3>
        {subtitle ? <p className="player-card__sub">{subtitle}</p> : null}
      </header>
      {children ? <div className="player-card__body">{children}</div> : null}
    </article>
  )
}
