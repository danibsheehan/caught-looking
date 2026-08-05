type GameFinalScoreStripProps = {
  awayTeamName: string;
  homeTeamName: string;
  awayRuns: number;
  homeRuns: number;
  awayScoreColor: string;
  homeScoreColor: string;
  /** e.g. Final, In progress */
  statusLabel?: string;
};

export default function GameFinalScoreStrip({
  awayTeamName,
  homeTeamName,
  awayRuns,
  homeRuns,
  awayScoreColor,
  homeScoreColor,
  statusLabel = 'Live',
}: GameFinalScoreStripProps) {
  return (
    <div className="game-final-score-strip" aria-label={`${statusLabel} score`}>
      <div className="game-final-score-strip__team">
        <div className="game-final-score-strip__name">{awayTeamName}</div>
        <div className="game-final-score-strip__num" style={{ color: awayScoreColor }}>
          {awayRuns}
        </div>
      </div>
      <div className="game-final-score-strip__mid">
        <span className="game-final-score-strip__badge">{statusLabel}</span>
      </div>
      <div className="game-final-score-strip__team">
        <div className="game-final-score-strip__name">{homeTeamName}</div>
        <div className="game-final-score-strip__num" style={{ color: homeScoreColor }}>
          {homeRuns}
        </div>
      </div>
    </div>
  );
}
