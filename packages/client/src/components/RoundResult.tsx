import type { ReactElement } from 'react';
import type { PlayerId } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

function playerLabel(player: PlayerId): string {
  return player === 'player1' ? 'Player 1' : 'Player 2';
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'king-of-the-hill': return 'King of the Hill';
    case 'elimination': return 'Elimination';
    case 'turn-limit': return 'Tiebreaker (Turn Limit)';
    default: return reason;
  }
}

export function RoundResult(): ReactElement | null {
  const showRoundResult = useGameStore((s) => s.showRoundResult);
  const roundResult = useGameStore((s) => s.roundResult);
  const gameState = useGameStore((s) => s.gameState);
  const continueToNextRound = useGameStore((s) => s.continueToNextRound);

  if (!showRoundResult || !roundResult || !gameState) return null;

  const p1Units = gameState.players.player1.units.length;
  const p2Units = gameState.players.player2.units.length;
  const p1Wins = gameState.players.player1.roundsWon;
  const p2Wins = gameState.players.player2.roundsWon;
  const isGameOver = gameState.phase === 'game-over';
  const roundNumber = gameState.round.roundNumber;

  const winnerText = roundResult.winner
    ? `${playerLabel(roundResult.winner)} wins the round!`
    : 'Round ended in a draw!';

  const { p1Income, p2Income } = roundResult;

  return (
    <div className="round-result">
      <h1>{winnerText}</h1>
      <div className="result-details">
        <div>Reason: {reasonLabel(roundResult.reason)}</div>
        <div>Player 1 surviving units: {p1Units}</div>
        <div>Player 2 surviving units: {p2Units}</div>
        <div>Score: P1 {p1Wins} — P2 {p2Wins}</div>
      </div>
      {!isGameOver && p1Income && p2Income && (
        <div className="result-details income-breakdown">
          <h3>Next Round Resources</h3>
          <div className="income-columns">
            <div className="income-column">
              <div className="income-header">Player 1</div>
              <div>Income: +{p1Income.income}g</div>
              <div>Carryover: +{p1Income.carryover}g</div>
              <div>Maintenance: -{p1Income.maintenance}g</div>
              <div className="income-total">Total: {p1Income.total}g</div>
            </div>
            <div className="income-column">
              <div className="income-header">Player 2</div>
              <div>Income: +{p2Income.income}g</div>
              <div>Carryover: +{p2Income.carryover}g</div>
              <div>Maintenance: -{p2Income.maintenance}g</div>
              <div className="income-total">Total: {p2Income.total}g</div>
            </div>
          </div>
        </div>
      )}
      <button
        className="continue-btn"
        onClick={continueToNextRound}
        type="button"
      >
        {isGameOver ? 'Game Over' : `Continue to Round ${roundNumber}`}
      </button>
    </div>
  );
}
