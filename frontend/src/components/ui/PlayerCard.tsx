import type { CSSProperties, ReactNode } from 'react';

type PlayerCardProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Layout shell for player-focused pages (Phase 3+). */
export default function PlayerCard({
  title,
  subtitle,
  children,
  className,
  style,
}: PlayerCardProps) {
  return (
    <article className={className ? `player-card ${className}` : 'player-card'} style={style}>
      <header className="player-card__head">
        <h3 className="player-card__title">{title}</h3>
        {subtitle ? <p className="player-card__sub">{subtitle}</p> : null}
      </header>
      {children ? <div className="player-card__body">{children}</div> : null}
    </article>
  );
}
