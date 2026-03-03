import { useCallback, type ReactElement } from 'react';
import {
  executeTurn, checkRoundEnd, scoreRound,
  CP_PER_ROUND, UNIT_STATS,
  calculateIncome, applyCarryover, applyMaintenance,
  hexToKey, aiBattlePhase,
} from '@hexwar/engine';
import type { PlayerId, ObjectiveState, GameState } from '@hexwar/engine';
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

interface IncomeBreakdown {
  income: number;
  carryover: number;
  maintenance: number;
  total: number;
}

function computeIncomeBreakdown(
  state: GameState,
  playerId: PlayerId,
  roundWinner: PlayerId | null,
): IncomeBreakdown {
  const player = state.players[playerId];
  const citiesHeld = player.units.reduce((count, unit) => {
    const terrain = state.map.terrain.get(hexToKey(unit.position));
    return terrain === 'city' ? count + 1 : count;
  }, 0);

  const income = calculateIncome({
    citiesHeld,
    unitsKilled: state.round.unitsKilledThisRound[playerId],
    wonRound: roundWinner === playerId,
    lostRound: roundWinner !== null && roundWinner !== playerId,
  });

  const carryover = applyCarryover(player.resources);
  const maintenance = applyMaintenance(
    player.units.map((u) => UNIT_STATS[u.type].cost),
  );

  return {
    income,
    carryover,
    maintenance,
    total: Math.max(0, carryover - maintenance + income),
  };
}

function executeAiTurn(gameState: GameState): void {
  // Snapshot unit HPs before AI execution for damage flash detection
  const allUnitsBefore = new Map<string, number>();
  for (const player of Object.values(gameState.players)) {
    for (const unit of player.units) {
      allUnitsBefore.set(unit.id, unit.hp);
    }
  }

  const aiCommands = aiBattlePhase(gameState, 'player2');
  executeTurn(gameState, aiCommands);

  // Flash damaged units
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

  // Check if round ended after AI turn
  const result = checkRoundEnd(gameState);
  if (result.roundOver) {
    const p1Breakdown = computeIncomeBreakdown(gameState, 'player1', result.winner);
    const p2Breakdown = computeIncomeBreakdown(gameState, 'player2', result.winner);
    scoreRound(gameState, result.winner);
    store.setGameState({ ...gameState });
    store.showRoundResultScreen(result.winner, result.reason ?? 'unknown', p1Breakdown, p2Breakdown);
    return;
  }

  // Round not over — it's player1's turn again
  store.setGameState({ ...gameState });
}

export function BattleHUD(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const pendingCommands = useGameStore((s) => s.pendingCommands);
  const vsAI = useGameStore((s) => s.vsAI);
  const setGameState = useGameStore((s) => s.setGameState);
  const clearPendingCommands = useGameStore((s) => s.clearPendingCommands);
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
    const result = checkRoundEnd(gameState);
    if (result.roundOver) {
      // Compute income breakdown BEFORE scoreRound mutates resources
      const p1Breakdown = computeIncomeBreakdown(gameState, 'player1', result.winner);
      const p2Breakdown = computeIncomeBreakdown(gameState, 'player2', result.winner);

      scoreRound(gameState, result.winner);

      // Clear pending commands and deselect
      clearPendingCommands();
      selectUnit(null);

      // Force re-render then show round result
      setGameState({ ...gameState });
      store.showRoundResultScreen(result.winner, result.reason ?? 'unknown', p1Breakdown, p2Breakdown);
      return;
    }

    // Clear pending commands
    clearPendingCommands();

    // Deselect unit
    selectUnit(null);

    if (vsAI && currentPlayerView === 'player1') {
      // VS AI: after P1 ends their turn, auto-execute AI (P2) turn after brief delay
      setGameState({ ...gameState });
      setTimeout(() => {
        const currentGame = useGameStore.getState().gameState;
        if (!currentGame || currentGame.phase !== 'battle') return;
        executeAiTurn(currentGame);
      }, 500);
    } else {
      // Hot-seat: show turn transition overlay for the next player
      setGameState({ ...gameState });
      useGameStore.setState({ showTransition: true });
    }
  }, [gameState, pendingCommands, vsAI, currentPlayerView, clearPendingCommands, selectUnit, setGameState]);

  if (!gameState) return null;

  const { phase, round } = gameState;
  const cpRemaining = CP_PER_ROUND - pendingCommands.length;
  const turnTotal = round.maxTurnsPerSide;
  const currentTurn = round.turnsPlayed[round.currentPlayer] + 1;

  const isBuildPhase = phase === 'build';
  const isBattlePhase = phase === 'battle';
  const isCurrentPlayersTurn = round.currentPlayer === currentPlayerView;
  const showEndTurn = isBattlePhase && isCurrentPlayersTurn;

  if (isBuildPhase) {
    return (
      <div className="battle-hud">
        <div className="turn-info">
          <span className={phaseClass(phase)}>{phaseLabel(phase)}</span>
          <span className="current-player-label">
            <span className="player-indicator" style={{ color: playerColor(currentPlayerView) }}>
              {playerLabel(currentPlayerView)}
            </span>
          </span>
        </div>

        <div className="turn-info">
          <span className="resource-amount">{gameState.players[currentPlayerView].resources}g</span>
        </div>

        <div className="turn-info">
          <span className="round-info">
            Round {round.roundNumber}/{gameState.maxRounds}
          </span>
          <span className="round-info">
            Wins: P1 {gameState.players.player1.roundsWon} | P2 {gameState.players.player2.roundsWon}
          </span>
        </div>
      </div>
    );
  }

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
