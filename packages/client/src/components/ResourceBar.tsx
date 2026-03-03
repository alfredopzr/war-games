import { type ReactElement } from 'react';
import { BASE_INCOME, CITY_INCOME, KILL_BONUS } from '@hexwar/engine';
import type { PlayerId } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

function playerLabel(player: PlayerId): string {
  return player === 'player1' ? 'P1' : 'P2';
}

function winsDisplay(p1Wins: number, p2Wins: number): string {
  return `P1: ${p1Wins} | P2: ${p2Wins}`;
}

export function ResourceBar(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);

  if (!gameState) return null;

  const player = gameState.players[currentPlayerView];
  const { round, maxRounds } = gameState;
  const p1Wins = gameState.players.player1.roundsWon;
  const p2Wins = gameState.players.player2.roundsWon;

  const isScoringPhase = gameState.phase === 'scoring';

  return (
    <div className="resource-bar">
      <span className="resource-amount">
        {player.resources}g
      </span>

      <span className="round-info">
        Round {round.roundNumber}/{maxRounds}
      </span>

      <span className="round-info">
        Wins: {winsDisplay(p1Wins, p2Wins)}
      </span>

      {isScoringPhase && (
        <span className="round-info income-breakdown">
          Base: {BASE_INCOME}
          {' + Cities: '}{CITY_INCOME}/ea
          {' + Kills: '}{KILL_BONUS}/ea
        </span>
      )}

      <span className="round-info">
        {playerLabel(currentPlayerView)}
      </span>
    </div>
  );
}
