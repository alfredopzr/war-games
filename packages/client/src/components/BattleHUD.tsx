import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  executeTurn, filterValidCommands, checkRoundEnd, scoreRound,
  CP_PER_ROUND, UNIT_STATS,
  calculateIncome, applyCarryover, applyMaintenance,
  aiBattlePhase, createCommandPool, calculateVisibility,
} from '@hexwar/engine';
import type { PlayerId, ObjectiveState, GameState, CubeCoord, Unit } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';
import type { BattleLogEntry } from '../store/game-store';
import { perf } from '../perf-monitor';
import { skipReplay, diffTurnEvents, startReplay } from '../renderer/replay-sequencer';

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
  return player === 'player1' ? '#6a7a5a' : '#8a5a4a';
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

function resolveSimultaneousLocal(
  gameState: GameState,
  p1Commands: import('@hexwar/engine').Command[],
): void {
  const store = useGameStore.getState();
  const turnNum = gameState.round.turnNumber;

  // Generate AI commands from pre-resolution state
  const aiCommands = aiBattlePhase(gameState, 'player2');

  console.log(`[TURN ${turnNum}] P1 units: ${gameState.players.player1.units.length}, P2 units: ${gameState.players.player2.units.length}`);
  console.log(`[TURN ${turnNum}] P1 commands (${p1Commands.length}):`, p1Commands.map((c) => `${c.type}:${c.unitId}`));
  console.log(`[TURN ${turnNum}] AI commands (${aiCommands.length}):`, aiCommands.map((c) => {
    return `redirect:${c.unitId}→${c.newMovementDirective}/${c.newAttackDirective}`;
  }));
  for (const u of gameState.players.player2.units) {
    console.log(`  P2 ${u.type} [${u.movementDirective}/${u.attackDirective}] hp=${u.hp} @ (${u.position.q},${u.position.r})`);
  }

  // Snapshot before any resolution — positions, HP, cities (for replay diff)
  const unitsBefore = new Map<string, { position: { q: number; r: number; s: number }; hp: number; owner: PlayerId }>();
  for (const pid of ['player1', 'player2'] as PlayerId[]) {
    for (const unit of gameState.players[pid].units) {
      unitsBefore.set(unit.id, { position: { ...unit.position }, hp: unit.hp, owner: pid });
    }
  }
  const citiesBefore = new Map(gameState.cityOwnership);
  const turnsHeldBefore = gameState.round.objective.turnsHeld;
  const occupierBefore = gameState.round.objective.occupiedBy;

  // Randomize resolution order
  const order: [PlayerId, PlayerId] = Math.random() < 0.5
    ? ['player1', 'player2']
    : ['player2', 'player1'];

  const commandsMap: Record<PlayerId, import('@hexwar/engine').Command[]> = {
    player1: p1Commands,
    player2: aiCommands,
  };

  // --- Resolve first player ---
  gameState.round.currentPlayer = order[0];
  gameState.round.commandPool = createCommandPool();
  for (const unit of gameState.players[order[0]].units) {
    unit.hasActed = false;
  }

  executeTurn(gameState, commandsMap[order[0]]);

  const logEntries: BattleLogEntry[] = [];
  if (gameState.pendingEvents.length > 0) {
    for (const evt of gameState.pendingEvents) {
      logEntries.push({ turn: turnNum, player: evt.actingPlayer, type: evt.type, message: evt.message });
    }
    gameState.pendingEvents = [];
  }

  const occupierAfterFirst = gameState.round.objective.occupiedBy;

  // Check early round end (elimination after first resolution)
  const earlyRoundEnd = checkRoundEnd(gameState);

  if (!earlyRoundEnd.roundOver) {
    // --- Resolve second player ---
    gameState.round.currentPlayer = order[1];
    gameState.round.commandPool = createCommandPool();
    for (const unit of gameState.players[order[1]].units) {
      unit.hasActed = false;
    }

    executeTurn(gameState, commandsMap[order[1]]);

    if (gameState.pendingEvents.length > 0) {
      for (const evt of gameState.pendingEvents) {
        logEntries.push({ turn: turnNum, player: evt.actingPlayer, type: evt.type, message: evt.message });
      }
      gameState.pendingEvents = [];
    }

    // Fix turnsHeld double-increment
    if (
      gameState.round.objective.occupiedBy === occupierAfterFirst &&
      occupierAfterFirst === occupierBefore &&
      gameState.round.objective.turnsHeld > turnsHeldBefore + 1
    ) {
      gameState.round.objective.turnsHeld = turnsHeldBefore + 1;
    }
  }

  // Increment turn counters (once per simultaneous resolution)
  gameState.round.turnsPlayed += 1;
  gameState.round.turnNumber += 1;

  // Snapshot after resolution
  const unitsAfter = new Map<string, { position: { q: number; r: number; s: number }; hp: number; owner: PlayerId }>();
  for (const pid of ['player1', 'player2'] as PlayerId[]) {
    for (const unit of gameState.players[pid].units) {
      unitsAfter.set(unit.id, { position: { ...unit.position }, hp: unit.hp, owner: pid });
    }
  }
  const citiesAfter = new Map(gameState.cityOwnership);

  // Generate replay events from state diff
  const replayEvents = diffTurnEvents(unitsBefore, unitsAfter, citiesBefore, citiesAfter);

  // Flash damaged units (immediate — CSS effect on HP bars)
  const updated = new Map(store.damagedUnits);
  for (const [id, before] of unitsBefore) {
    const after = unitsAfter.get(id);
    if (after && after.hp < before.hp) {
      updated.set(id, Date.now());
    }
  }
  useGameStore.setState({ damagedUnits: updated });

  if (logEntries.length > 0) {
    store.addBattleLogEntries(logEntries);
  }

  // Check round end
  const roundEnd = earlyRoundEnd.roundOver ? earlyRoundEnd : checkRoundEnd(gameState);

  // Deferred state application — called after replay finishes (or immediately if no events)
  const applyFinalState = (): void => {
    if (roundEnd.roundOver) {
      const winnerLabel = roundEnd.winner === 'player1' ? 'P1' : roundEnd.winner === 'player2' ? 'P2' : 'No one';
      const reasonLabel = roundEnd.reason === 'king-of-the-hill' ? 'King of the Hill'
        : roundEnd.reason === 'elimination' ? 'Elimination' : 'Turn Limit';
      useGameStore.getState().addBattleLogEntries([{
        turn: turnNum,
        player: roundEnd.winner ?? 'player1',
        type: 'round-end',
        message: `${winnerLabel} wins the round (${reasonLabel})`,
      }]);

      const p1Breakdown = computeIncomeBreakdown(gameState, 'player1', roundEnd.winner);
      const p2Breakdown = computeIncomeBreakdown(gameState, 'player2', roundEnd.winner);
      scoreRound(gameState, roundEnd.winner);

      if (gameState.phase === 'game-over' && gameState.winner) {
        const gameWinnerLabel = gameState.winner === 'player1' ? 'P1' : 'P2';
        useGameStore.getState().addBattleLogEntries([{
          turn: turnNum,
          player: gameState.winner,
          type: 'game-end',
          message: `${gameWinnerLabel} wins the game!`,
        }]);
      }

      useGameStore.getState().setGameState({ ...gameState });
      useGameStore.getState().showRoundResultScreen(roundEnd.winner, roundEnd.reason ?? 'unknown', p1Breakdown, p2Breakdown);
      return;
    }

    // Round not over — reset for player1's next planning phase
    gameState.round.currentPlayer = 'player1';
    gameState.round.commandPool = createCommandPool();
    for (const unit of gameState.players.player1.units) {
      unit.hasActed = false;
    }

    useGameStore.getState().setGameState({ ...gameState });
  };

  if (replayEvents.length > 0) {
    // Track intermediate positions for progressive fog clearing
    const replayPositions = new Map<string, CubeCoord>();
    for (const [id, snap] of unitsBefore) {
      if (snap.owner === 'player1') {
        replayPositions.set(id, { ...snap.position });
      }
    }

    store.setReplayPlaying(true);
    startReplay(replayEvents, gameState.map.elevation, {
      onComplete: () => {
        store.setReplayPlaying(false);
        applyFinalState();
      },
      onUnitArrived: (unitId: string, to: CubeCoord) => {
        if (!replayPositions.has(unitId)) return;
        replayPositions.set(unitId, to);
        // Build synthetic unit list with current replay positions
        const syntheticUnits: Unit[] = [];
        for (const [id, pos] of replayPositions) {
          const orig = gameState.players.player1.units.find((u) => u.id === id);
          if (orig) {
            syntheticUnits.push({ ...orig, position: pos });
          }
        }
        const vis = calculateVisibility(syntheticUnits, gameState.map.terrain, gameState.map.elevation);
        useGameStore.getState().setVisibleHexes(vis);
        // Accumulate explored
        const prevExplored = useGameStore.getState().exploredHexes;
        const merged = new Set(prevExplored);
        for (const k of vis) merged.add(k);
        if (merged.size !== prevExplored.size) {
          useGameStore.setState({ exploredHexes: merged });
        }
      },
    });
  } else {
    applyFinalState();
  }
}

export function BattleHUD(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const pendingCommands = useGameStore((s) => s.pendingCommands);
  const gameMode = useGameStore((s) => s.gameMode);
  const clearPendingCommands = useGameStore((s) => s.clearPendingCommands);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const waitingForServer = useGameStore((s) => s.waitingForServer);
  const commandsSubmitted = useGameStore((s) => s.commandsSubmitted);
  const opponentCommandsSubmitted = useGameStore((s) => s.opponentCommandsSubmitted);

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

    const t0 = performance.now();

    // Online mode: send commands to server
    if (useGameStore.getState().gameMode === 'online') {
      import('../network/network-manager').then(({ networkManager }) => {
        networkManager.submitCommands(pendingCommands);
        perf.logAction('endTurn:online', performance.now() - t0);
      });
      useGameStore.getState().setWaitingForServer(true);
      clearPendingCommands();
      selectUnit(null);
      return;
    }

    // vsAI mode: simultaneous resolution
    const validCommands = filterValidCommands(gameState, pendingCommands, 'player1');
    clearPendingCommands();
    selectUnit(null);
    setAiThinking(true);
    perf.logAction('endTurn:local', performance.now() - t0);
    setTimeout(() => {
      const resolveT0 = performance.now();
      const currentGame = useGameStore.getState().gameState;
      if (!currentGame || currentGame.phase !== 'battle') {
        setAiThinking(false);
        return;
      }
      resolveSimultaneousLocal(currentGame, validCommands);
      setAiThinking(false);
      perf.logAction('resolve:ai', performance.now() - resolveT0);
    }, 500);
  }, [gameState, pendingCommands, clearPendingCommands, selectUnit, aiThinking]);

  if (!gameState) return null;

  const { phase, round } = gameState;
  const cpRemaining = CP_PER_ROUND - pendingCommands.length;
  const turnTotal = round.maxTurns;
  const currentTurn = round.turnsPlayed + 1;

  const isBuildPhase = phase === 'build';
  const isBattlePhase = phase === 'battle';
  const showEndTurn = isBattlePhase && (
    gameMode === 'online' ? !commandsSubmitted : true
  );

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
        <span className="current-player-label" data-color={playerColor(currentPlayerView)}>
          <span className="player-indicator" style={{ color: playerColor(currentPlayerView) }}>
            {playerLabel(currentPlayerView)}
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
            {gameMode === 'online' && waitingForServer
              ? (opponentCommandsSubmitted ? 'Resolving...' : 'Waiting for opponent...')
              : aiThinking ? 'AI thinking...' : 'End Turn'}
          </button>
        )}
      </div>
    </div>
  );
}
