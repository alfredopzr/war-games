import type { ReactElement } from 'react';
import type { PlayerId } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

function playerLabel(player: PlayerId): string {
  return player === 'player1' ? 'Player 1' : 'Player 2';
}

function playerTextClass(player: PlayerId): string {
  return player === 'player1' ? 'player1-text' : 'player2-text';
}

export function GameOverScreen(): ReactElement | null {
  const showGameOver = useGameStore((s) => s.showGameOver);
  const gameState = useGameStore((s) => s.gameState);
  const resetGame = useGameStore((s) => s.resetGame);

  if (!showGameOver || !gameState || !gameState.winner) return null;

  const winner = gameState.winner;
  const p1Wins = gameState.players.player1.roundsWon;
  const p2Wins = gameState.players.player2.roundsWon;

  return (
    <div className="game-over">
      <h1 className={playerTextClass(winner)}>{playerLabel(winner)} Wins!</h1>
      <div className="score-display">
        Final Score: P1 {p1Wins} — P2 {p2Wins}
      </div>
      <button className="play-again-btn" onClick={resetGame} type="button">
        Play Again
      </button>
    </div>
  );
}
