import { useCallback, type ReactElement } from 'react';
import {
  executeTurn, checkRoundEnd, scoreRound, calculateVisibility,
  CP_PER_ROUND,
} from '@hexwar/engine';
import type { GameState, PlayerId, ObjectiveState } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

function phaseClass(phase: string): string {
  switch (phase) {
    case 'build': return 'phase-badge phase-build';
    case 'battle': return 'phase-badge phase-battle';
    case 'scoring': return 'phase-badge phase-scoring';
    default: return 'phase-badge';
  }
}

function phaseLabel(phase: string): string {
  return phase.toUpperCase();
}

function playerLabel(player: PlayerId): string {
  return player === 'player1' ? 'P1' : 'P2';
}

function playerColor(player: PlayerId): string {
  return player === 'player1' ? '#4488cc' : '#cc4444';
}

function objectiveText(objective: ObjectiveState): string {
  if (!objective.occupiedBy) return 'Neutral';
  const label = playerLabel(objective.occupiedBy);
  return `${label} holds (${objective.turnsHeld}/2)`;
}

function getPlayerUnits(state: GameState, player: PlayerId): GameState['players']['player1']['units'] {
  return state.players[player].units;
}

export function BattleHUD(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const pendingCommands = useGameStore((s) => s.pendingCommands);
  const setGameState = useGameStore((s) => s.setGameState);
  const clearPendingCommands = useGameStore((s) => s.clearPendingCommands);
  const setVisibleHexes = useGameStore((s) => s.setVisibleHexes);
  const selectUnit = useGameStore((s) => s.selectUnit);

  const handleEndTurn = useCallback((): void => {
    if (!gameState) return;

    // Snapshot unit HPs before execution for damage flash detection
    const allUnitsBefore = new Map<string, number>();
    for (const player of Object.values(gameState.players)) {
      for (const unit of player.units) {
        allUnitsBefore.set(unit.id, unit.hp);
      }
    }

    // Execute the turn with pending commands
    executeTurn(gameState, pendingCommands);

    // Check for damage and flash units
    const store = useGameStore.getState();
    const updated = new Map(store.damagedUnits);
    for (const player of Object.values(gameState.players)) {
      for (const unit of player.units) {
        const prevHp = allUnitsBefore.get(unit.id);
        if (prevHp !== undefined && unit.hp < prevHp) {
          updated.set(unit.id, Date.now());
        }
      }
    }
    useGameStore.setState({ damagedUnits: updated });

    // Check if round ended
    const roundResult = checkRoundEnd(gameState);
    if (roundResult.roundOver) {
      scoreRound(gameState, roundResult.winner);
    }

    // Clear pending commands
    clearPendingCommands();

    // Deselect unit
    selectUnit(null);

    // Recalculate visibility for the new current player
    const newCurrentPlayer = gameState.round.currentPlayer;
    const friendly = getPlayerUnits(gameState, newCurrentPlayer);
    const vis = calculateVisibility(friendly, gameState.map.terrain);
    setVisibleHexes(vis);

    // Force re-render by setting game state
    setGameState({ ...gameState });
  }, [gameState, pendingCommands, clearPendingCommands, selectUnit, setVisibleHexes, setGameState]);

  if (!gameState) return null;

  const { phase, round } = gameState;
  const cpRemaining = CP_PER_ROUND - pendingCommands.length;
  const turnTotal = round.maxTurnsPerSide;
  const currentTurn = round.turnsPlayed[round.currentPlayer] + 1;

  const isBattlePhase = phase === 'battle';
  const isCurrentPlayersTurn = round.currentPlayer === currentPlayerView;
  const showEndTurn = isBattlePhase && isCurrentPlayersTurn;

  return (
    <div className="battle-hud">
      <div className="turn-info">
        <span className={phaseClass(phase)}>{phaseLabel(phase)}</span>
        <span>
          Turn{' '}
          <span className="turn-counter">{currentTurn}/{turnTotal}</span>
        </span>
        <span className="current-player-label" data-color={playerColor(round.currentPlayer)}>
          <span className="player-indicator" style={{ color: playerColor(round.currentPlayer) }}>
            {playerLabel(round.currentPlayer)}
          </span>
        </span>
      </div>

      <div className="turn-info">
        <span className="cp-label">CP:</span>
        <div className="cp-dots">
          {Array.from({ length: CP_PER_ROUND }, (_, i) => (
            <div
              key={i}
              className={`cp-dot ${i < cpRemaining ? 'filled' : 'empty'}`}
            />
          ))}
        </div>
        <span className="objective-status">{objectiveText(round.objective)}</span>
      </div>

      <div className="turn-info">
        <span className="round-info">
          Round {round.roundNumber}/{gameState.maxRounds}
        </span>
        {showEndTurn && (
          <button className="end-turn-btn" onClick={handleEndTurn} type="button">
            End Turn
          </button>
        )}
      </div>
    </div>
  );
}
