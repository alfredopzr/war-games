import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  executeTurn, checkRoundEnd, scoreRound,
  CP_PER_ROUND, UNIT_STATS,
  calculateIncome, applyCarryover, applyMaintenance,
  aiBattlePhase,
} from '@hexwar/engine';
import type { PlayerId, ObjectiveState, GameState, Unit } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';
import type { BattleLogEntry } from '../store/game-store';
import { diffTurnEvents, startReplay, skipReplay } from '../renderer/replay-sequencer';

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

function objectiveText(objective: ObjectiveState, state: GameState): string {
  if (!objective.occupiedBy) return 'Objective: Neutral';
  const label = playerLabel(objective.occupiedBy);
  const citiesHeld = countCitiesForPlayer(state, objective.occupiedBy);
  if (citiesHeld < 2) {
    return `${label} on objective (needs 2 cities)`;
  }
  return `${label} holds (${objective.turnsHeld}/2)`;
}

function countCitiesForPlayer(state: GameState, playerId: PlayerId): number {
  let count = 0;
  for (const owner of state.cityOwnership.values()) {
    if (owner === playerId) count++;
  }
  return count;
}

function cityOwnershipText(state: GameState): string {
  let p1 = 0;
  let p2 = 0;
  for (const owner of state.cityOwnership.values()) {
    if (owner === 'player1') p1++;
    else if (owner === 'player2') p2++;
  }
  if (p1 === 0 && p2 === 0) return '';
  return `Cities: P1 \u00D7${p1} | P2 \u00D7${p2}`;
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
  let citiesHeld = 0;
  for (const owner of state.cityOwnership.values()) {
    if (owner === playerId) citiesHeld++;
  }

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

function diffBattleLog(
  before: { units: Map<string, Unit>; cities: Map<string, PlayerId | null> },
  after: GameState,
  actingPlayer: PlayerId,
  turnNumber: number,
): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  const unitLabels: Record<string, string> = { infantry: 'Infantry', tank: 'Tank', artillery: 'Artillery', recon: 'Recon' };

  // Check for kills
  for (const [id, unit] of before.units) {
    const allAfter = [...after.players.player1.units, ...after.players.player2.units];
    if (!allAfter.find((u) => u.id === id)) {
      entries.push({
        turn: turnNumber,
        player: actingPlayer,
        type: 'kill',
        message: `${actingPlayer === 'player1' ? 'P1' : 'P2'} destroyed ${unit.owner === 'player1' ? 'P1' : 'P2'} ${unitLabels[unit.type] ?? unit.type}`,
      });
    }
  }

  // Check for city captures
  for (const [key, newOwner] of after.cityOwnership) {
    const prevOwner = before.cities.get(key);
    if (newOwner !== prevOwner) {
      if (newOwner) {
        const label = newOwner === 'player1' ? 'P1' : 'P2';
        const type = prevOwner ? 'recapture' : 'capture';
        entries.push({
          turn: turnNumber,
          player: newOwner,
          type,
          message: `${label} ${type === 'recapture' ? 'recaptured' : 'captured'} a city`,
        });
      }
    }
  }

  return entries;
}

function snapshotUnits(gameState: GameState): Map<string, Unit> {
  const m = new Map<string, Unit>();
  for (const player of Object.values(gameState.players)) {
    for (const unit of player.units) {
      m.set(unit.id, { ...unit });
    }
  }
  return m;
}

function snapshotCities(gameState: GameState): Map<string, PlayerId | null> {
  return new Map(gameState.cityOwnership);
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
  const gameMode = useGameStore((s) => s.gameMode);
  const setGameState = useGameStore((s) => s.setGameState);
  const clearPendingCommands = useGameStore((s) => s.clearPendingCommands);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const waitingForServer = useGameStore((s) => s.waitingForServer);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const buildTimeRemaining = useGameStore((s) => s.buildTimeRemaining);
  const startBuildTimer = useGameStore((s) => s.startBuildTimer);
  const confirmBuild = useGameStore((s) => s.confirmBuild);
  const buildTimerInterval = useGameStore((s) => s.buildTimerInterval);
  const isReplayPlaying = useGameStore((s) => s.isReplayPlaying);
  const [aiThinking, setAiThinking] = useState(false);

  // Start build timer when build phase begins and no interval is running
  useEffect(() => {
    if (gameState?.phase === 'build' && !buildTimerInterval) {
      startBuildTimer();
    }
  }, [gameState?.phase, buildTimerInterval, startBuildTimer]);

  // Space key to skip replay
  useEffect(() => {
    if (!isReplayPlaying) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        e.preventDefault();
        skipReplay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReplayPlaying]);

  const handleEndTurn = useCallback((): void => {
    if (aiThinking) return;
    if (useGameStore.getState().isReplayPlaying) return;
    if (!gameState) return;

    // Online mode: send commands to server
    if (useGameStore.getState().gameMode === 'online') {
      import('../network/network-manager').then(({ networkManager }) => {
        networkManager.submitCommands(pendingCommands);
      });
      useGameStore.getState().setWaitingForServer(true);
      clearPendingCommands();
      selectUnit(null);
      return;
    }

    // Snapshot state before turn for diff
    const unitsBefore = snapshotUnits(gameState);
    const citiesBefore = snapshotCities(gameState);
    const actingPlayer = gameState.round.currentPlayer;
    const turnNum = gameState.round.turnNumber;

    // Snapshot unit HPs before execution for damage flash detection
    const allUnitsBefore = new Map<string, number>();
    for (const player of Object.values(gameState.players)) {
      for (const unit of player.units) {
        allUnitsBefore.set(unit.id, unit.hp);
      }
    }

    // Snapshot for replay diff (position + hp + owner)
    const replayUnitsBefore = new Map<string, { position: { q: number; r: number; s: number }; hp: number; owner: PlayerId }>();
    for (const player of Object.values(gameState.players)) {
      for (const unit of player.units) {
        replayUnitsBefore.set(unit.id, { position: { ...unit.position }, hp: unit.hp, owner: unit.owner });
      }
    }
    const replayCitiesBefore = new Map(gameState.cityOwnership);

    // Execute the turn with pending commands
    executeTurn(gameState, pendingCommands);

    // Generate and store battle log entries
    const logEntries = diffBattleLog(
      { units: unitsBefore, cities: citiesBefore },
      gameState,
      actingPlayer,
      turnNum,
    );
    if (logEntries.length > 0) {
      useGameStore.getState().addBattleLogEntries(logEntries);
    }

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

    // Generate replay events from before/after diff
    const replayUnitsAfter = new Map<string, { position: { q: number; r: number; s: number }; hp: number; owner: PlayerId }>();
    for (const player of Object.values(gameState.players)) {
      for (const unit of player.units) {
        replayUnitsAfter.set(unit.id, { position: { ...unit.position }, hp: unit.hp, owner: unit.owner });
      }
    }
    const replayEvents = diffTurnEvents(replayUnitsBefore, replayUnitsAfter, replayCitiesBefore, gameState.cityOwnership);

    // Post-turn flow: check round end, then continue to next player
    const finishPostTurn = (): void => {
      const result = checkRoundEnd(gameState);
      if (result.roundOver) {
        const p1Breakdown = computeIncomeBreakdown(gameState, 'player1', result.winner);
        const p2Breakdown = computeIncomeBreakdown(gameState, 'player2', result.winner);

        scoreRound(gameState, result.winner);

        clearPendingCommands();
        selectUnit(null);

        setGameState({ ...gameState });
        useGameStore.getState().showRoundResultScreen(result.winner, result.reason ?? 'unknown', p1Breakdown, p2Breakdown);
        return;
      }

      clearPendingCommands();
      selectUnit(null);

      if (gameMode === 'vsAI' && currentPlayerView === 'player1') {
        setGameState({ ...gameState });
        setAiThinking(true);
        setTimeout(() => {
          const currentGame = useGameStore.getState().gameState;
          if (!currentGame || currentGame.phase !== 'battle') {
            setAiThinking(false);
            return;
          }
          executeAiTurn(currentGame);
          setAiThinking(false);
        }, 500);
      } else {
        setGameState({ ...gameState });
        useGameStore.setState({ showTransition: true });
      }
    };

    // If there are replay events, play the replay before continuing
    if (replayEvents.length > 0) {
      store.setTurnReplayEvents(replayEvents);
      store.setReplayPlaying(true);
      setGameState({ ...gameState });
      startReplay(replayEvents, () => {
        useGameStore.getState().setReplayPlaying(false);
        useGameStore.getState().setTurnReplayEvents([]);
        finishPostTurn();
      });
    } else {
      finishPostTurn();
    }
  }, [gameState, pendingCommands, gameMode, currentPlayerView, clearPendingCommands, selectUnit, setGameState, aiThinking]);

  if (!gameState) return null;

  const { phase, round } = gameState;
  const cpRemaining = CP_PER_ROUND - pendingCommands.length;
  const turnTotal = round.maxTurnsPerSide;
  const currentTurn = round.turnsPlayed[round.currentPlayer] + 1;

  const isBuildPhase = phase === 'build';
  const isBattlePhase = phase === 'battle';
  const isCurrentPlayersTurn = round.currentPlayer === currentPlayerView;
  const showEndTurn = isBattlePhase && isCurrentPlayersTurn
    && (gameMode !== 'online' || myPlayerId === round.currentPlayer);

  if (isBuildPhase) {
    const timerColorClass = buildTimeRemaining <= 10
      ? 'hud-timer-critical'
      : buildTimeRemaining <= 30
        ? 'hud-timer-warning'
        : 'hud-timer-normal';
    const m = Math.floor(buildTimeRemaining / 60);
    const s = buildTimeRemaining % 60;
    const timerText = `${m}:${s.toString().padStart(2, '0')}`;

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
          <span className={`hud-timer ${timerColorClass}`}>{timerText}</span>
          <button className="hud-ready-btn" onClick={confirmBuild} type="button">
            Ready
          </button>
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
        <span className="objective-status">{objectiveText(round.objective, gameState)}</span>
        <span className="city-ownership">{cityOwnershipText(gameState)}</span>
      </div>

      <div className="turn-info">
        <span className="round-info">
          Round {round.roundNumber}/{gameState.maxRounds}
        </span>
        {isReplayPlaying && (
          <button
            className="end-turn-btn"
            onClick={skipReplay}
            type="button"
          >
            Skip Replay
          </button>
        )}
        {showEndTurn && !isReplayPlaying && (
          <button
            className="end-turn-btn"
            onClick={handleEndTurn}
            type="button"
            disabled={aiThinking || waitingForServer}
          >
            {waitingForServer ? 'Waiting...' : aiThinking ? 'AI thinking...' : 'End Turn'}
          </button>
        )}
      </div>
    </div>
  );
}
