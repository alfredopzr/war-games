import { type ReactElement } from 'react';
import { useGameStore } from '../store/game-store';
import type { GameState, PlayerId } from '@hexwar/engine';

function countCities(state: GameState, playerId: PlayerId): number {
  let count = 0;
  for (const owner of state.cityOwnership.values()) {
    if (owner === playerId) count++;
  }
  return count;
}

function playerLabel(player: PlayerId): string {
  return player === 'player1' ? 'P1' : 'P2';
}

export function WinConditionPanel(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState || gameState.phase !== 'battle') return null;

  const { objective } = gameState.round;
  const p1Units = gameState.players.player1.units.length;
  const p2Units = gameState.players.player2.units.length;
  const totalTurnsPlayed = gameState.round.turnsPlayed.player1 + gameState.round.turnsPlayed.player2;
  const totalMaxTurns = gameState.round.maxTurnsPerSide * 2;

  // KotH status
  let kothText: string;
  let kothMet = false;
  if (!objective.occupiedBy) {
    kothText = 'No one on objective';
  } else {
    const label = playerLabel(objective.occupiedBy);
    const citiesHeld = countCities(gameState, objective.occupiedBy);
    if (citiesHeld < 2) {
      kothText = `${label} on obj (needs 2 cities, has ${citiesHeld})`;
    } else {
      kothText = `${label} on obj (${objective.turnsHeld}/2 turns)`;
      if (objective.turnsHeld >= 2) kothMet = true;
    }
  }

  // Elimination status
  const elimMet = p1Units === 0 || p2Units === 0;

  // Turn limit status
  const turnsMet = totalTurnsPlayed >= totalMaxTurns;

  return (
    <div className="win-condition-panel">
      <div className="wc-header">Win Conditions</div>
      <div className="wc-entries">
        <div className={`wc-entry ${kothMet ? 'wc-met' : ''}`}>
          <span className="wc-label">KotH</span>
          <span className="wc-value">{kothText}</span>
        </div>
        <div className={`wc-entry ${elimMet ? 'wc-met' : ''}`}>
          <span className="wc-label">Elim</span>
          <span className="wc-value">P1: {p1Units} units | P2: {p2Units} units</span>
        </div>
        <div className={`wc-entry ${turnsMet ? 'wc-met' : ''}`}>
          <span className="wc-label">Turns</span>
          <span className="wc-value">{totalTurnsPlayed} / {totalMaxTurns} played</span>
        </div>
      </div>
    </div>
  );
}
