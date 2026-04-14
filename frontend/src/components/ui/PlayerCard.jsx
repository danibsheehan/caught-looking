/**
 * Layout shell for player-focused pages (Phase 3+).
 * @param {{ title: string, subtitle?: string, children?: import('react').ReactNode }} props
 */
export default function PlayerCard({ title, subtitle, children }) {
  return (
    <article className="player-card">
      <header className="player-card-head">
        <h3 className="player-card-title">{title}</h3>
        {subtitle ? <p className="player-card-sub">{subtitle}</p> : null}
      </header>
      {children ? <div className="player-card-body">{children}</div> : null}
    </article>
  )
}
