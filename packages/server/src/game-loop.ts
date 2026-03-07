// =============================================================================
// HexWar Server — Game Loop
// =============================================================================
// Orchestrates the full multiplayer flow using engine functions.
// All functions take a Server (socket.io) instance to emit messages.
// =============================================================================

import type { Server } from 'socket.io';
import type { Room } from './types';
import type {
  PlayerId,
  CubeCoord,
  UnitType,
  MovementDirective,
  AttackDirective,
  SpecialtyModifier,
  DirectiveTarget,
  Command,
} from '@hexwar/engine';

import {
  createGame,
  placeUnit,
  startBattlePhase,
  filterValidCommands,
  checkRoundEnd,
  scoreRound,
  UNIT_STATS,
  mulberry32,
  formatBattleEvent,
  resolveTurn,
  calculateVisibility,
} from '@hexwar/engine';

import { filterStateForPlayer, filterEventsForPlayer } from './state-filter';
import {
  startBuildTimer,
  startTurnTimer,
  clearBuildTimer,
  clearTurnTimer,
} from './timers';
import { log } from './logger';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function emitFilteredState(
  io: Server,
  room: Room,
  eventName: string,
  extraFields?: Record<string, unknown>,
): void {
  if (!room.gameState) return;

  for (const [playerId, player] of room.players) {
    const filtered = filterStateForPlayer(room.gameState, playerId);
    io.to(player.socketId).emit(eventName, {
      type: eventName,
      state: filtered,
      ...extraFields,
    });
  }
}

// -----------------------------------------------------------------------------
// Game Lifecycle
// -----------------------------------------------------------------------------

export function startGame(room: Room, io: Server): void {
  const seed = Math.floor(Math.random() * 2147483647);
  room.gameSeed = seed;
  const state = createGame(seed);
  room.gameState = state;
  log('info', 'game', `Game started in room ${room.id}`);

  for (const [playerId, player] of room.players) {
    const filtered = filterStateForPlayer(state, playerId);
    io.to(player.socketId).emit('game-start', {
      type: 'game-start',
      state: filtered,
      playerId,
    });
  }

  startBuildTimer(room, () => handleBuildTimeout(room, io));
}

// -----------------------------------------------------------------------------
// Build Phase Handlers
// -----------------------------------------------------------------------------

export function handlePlaceUnit(
  room: Room,
  playerId: PlayerId,
  unitType: UnitType,
  position: CubeCoord,
  movementDirective: MovementDirective,
  attackDirective: AttackDirective,
  specialtyModifier: SpecialtyModifier | null,
  io: Server,
  target?: DirectiveTarget,
): void {
  if (!room.gameState) {
    throw new Error('Game has not started');
  }
  if (room.gameState.phase !== 'build') {
    throw new Error('Can only place units during build phase');
  }
  if (room.buildConfirmed.has(playerId)) {
    throw new Error('Build already confirmed');
  }

  placeUnit(room.gameState, playerId, unitType, position, movementDirective, attackDirective, specialtyModifier, target);

  for (const [pid, player] of room.players) {
    const filtered = filterStateForPlayer(room.gameState, pid);
    io.to(player.socketId).emit('state-update', {
      type: 'state-update',
      state: filtered,
    });
  }
}

export function handleRemoveUnit(
  room: Room,
  playerId: PlayerId,
  unitId: string,
  io: Server,
): void {
  if (!room.gameState) {
    throw new Error('Game has not started');
  }
  if (room.buildConfirmed.has(playerId)) {
    throw new Error('Build already confirmed');
  }

  const playerState = room.gameState.players[playerId];
  const unitIndex = playerState.units.findIndex((u) => u.id === unitId);
  if (unitIndex === -1) {
    throw new Error('Unit not found');
  }

  const unit = playerState.units[unitIndex]!;
  if (unit.owner !== playerId) {
    throw new Error('Unit does not belong to this player');
  }

  const cost = UNIT_STATS[unit.type].cost;
  playerState.units.splice(unitIndex, 1);
  playerState.resources += cost;

  for (const [pid, player] of room.players) {
    const filtered = filterStateForPlayer(room.gameState, pid);
    io.to(player.socketId).emit('state-update', {
      type: 'state-update',
      state: filtered,
    });
  }
}

export function handleSetDirective(
  room: Room,
  playerId: PlayerId,
  unitId: string,
  movementDirective: MovementDirective,
  attackDirective: AttackDirective,
  specialtyModifier: SpecialtyModifier | null,
  io: Server,
  target?: DirectiveTarget,
): void {
  if (!room.gameState) {
    throw new Error('Game has not started');
  }
  if (room.buildConfirmed.has(playerId)) {
    throw new Error('Build already confirmed');
  }

  const playerState = room.gameState.players[playerId];
  const unit = playerState.units.find((u) => u.id === unitId);
  if (!unit) {
    throw new Error('Unit not found');
  }
  if (unit.owner !== playerId) {
    throw new Error('Unit does not belong to this player');
  }

  unit.movementDirective = movementDirective;
  unit.attackDirective = attackDirective;
  unit.specialtyModifier = specialtyModifier;
  if (target) {
    unit.directiveTarget = target;
  }

  for (const [pid, player] of room.players) {
    const filtered = filterStateForPlayer(room.gameState, pid);
    io.to(player.socketId).emit('state-update', {
      type: 'state-update',
      state: filtered,
    });
  }
}

export function handleConfirmBuild(
  room: Room,
  playerId: PlayerId,
  io: Server,
): void {
  if (!room.gameState) return;

  room.buildConfirmed.add(playerId);
  log('info', 'game', `Player confirmed build in room ${room.id}`);

  // Emit 'build-confirmed' to the OTHER player
  const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
  const enemyPlayer = room.players.get(enemyId);
  if (enemyPlayer) {
    io.to(enemyPlayer.socketId).emit('build-confirmed', {
      type: 'build-confirmed',
      playerId,
    });
  }

  // If both confirmed, transition to battle
  if (room.buildConfirmed.size === 2) {
    transitionToBattle(room, io);
  }
}

function transitionToBattle(room: Room, io: Server): void {
  if (!room.gameState) return;

  clearBuildTimer(room);
  startBattlePhase(room.gameState);
  log('info', 'game', `Battle phase started in room ${room.id}`);
  room.buildConfirmed.clear();
  room.bufferedCommands.clear();

  emitFilteredState(io, room, 'battle-start');
  startTurnTimer(room, () => handleTurnTimeout(room, io));
}

// -----------------------------------------------------------------------------
// Battle Phase Handlers
// -----------------------------------------------------------------------------

export function handleSubmitCommands(
  room: Room,
  playerId: PlayerId,
  commands: Command[],
  io: Server,
): void {
  if (!room.gameState) {
    throw new Error('Game has not started');
  }

  if (room.gameState.phase !== 'battle') {
    const player = room.players.get(playerId);
    if (player) {
      io.to(player.socketId).emit('room-error', {
        type: 'room-error',
        message: 'Cannot submit commands outside battle phase',
      });
    }
    return;
  }

  if (room.bufferedCommands.has(playerId)) {
    const player = room.players.get(playerId);
    if (player) {
      io.to(player.socketId).emit('room-error', {
        type: 'room-error',
        message: 'Commands already submitted',
      });
    }
    return;
  }

  log('info', 'game', `Player ${playerId} submitted ${commands.length} commands in room ${room.id}`);

  // Validate commands against current state — both players validate against same pre-resolution state
  const validCommands = filterValidCommands(room.gameState, commands, playerId);
  const rejected = commands.length - validCommands.length;
  if (rejected > 0) {
    log('warn', 'game', `Player ${playerId}: ${rejected}/${commands.length} commands rejected (CP ${room.gameState.round.commandPools[playerId].remaining} remaining)`);
  }
  room.bufferedCommands.set(playerId, validCommands);

  // Acknowledge submission to the player
  const player = room.players.get(playerId);
  if (player) {
    io.to(player.socketId).emit('commands-received', { type: 'commands-received' });
  }

  // Notify opponent
  const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
  const enemyPlayer = room.players.get(enemyId);
  if (enemyPlayer) {
    io.to(enemyPlayer.socketId).emit('opponent-commands-received', { type: 'opponent-commands-received' });
  }

  // If both players have submitted, resolve
  if (room.bufferedCommands.size === 2) {
    resolveSimultaneousTurn(room, io);
  }
}

function resolveSimultaneousTurn(room: Room, io: Server): void {
  const state = room.gameState!;

  clearTurnTimer(room);

  const originalTurnNumber = state.round.turnNumber;

  // Deterministic RNG for this turn
  const turnSeed = (room.gameSeed! * 37 + originalTurnNumber) | 0;
  const rng = mulberry32(turnSeed);
  const combatRng = (): number => 0.85 + rng() * 0.3;

  const p1Cmds = room.bufferedCommands.get('player1') ?? [];
  const p2Cmds = room.bufferedCommands.get('player2') ?? [];

  // Snapshot unit positions BEFORE resolution for LOS-based event filtering.
  // Spec (EVENT_LOG_SPEC.md §Fog Filtering): LOS computed from Phase 1 snapshot.
  const p1UnitsSnapshot = state.players.player1.units.map(u => ({ ...u, position: { ...u.position } }));
  const p2UnitsSnapshot = state.players.player2.units.map(u => ({ ...u, position: { ...u.position } }));

  // Single pipeline call replaces two sequential executeTurn() calls
  resolveTurn(state, p1Cmds, p2Cmds, combatRng);

  // Drain events (resolveTurn accumulates in state.pendingEvents)
  const allEvents = [...state.pendingEvents];
  state.pendingEvents = [];

  for (const event of allEvents) {
    log('info', 'game', formatBattleEvent(event));
  }

  // Record turn log (unfiltered — server-side record)
  room.turnLog.push({
    turnNumber: originalTurnNumber,
    resolutionOrder: ['player1', 'player2'],
    players: [
      { player: 'player1', commandsSubmitted: p1Cmds.length, rngSeed: turnSeed },
      { player: 'player2', commandsSubmitted: p2Cmds.length, rngSeed: turnSeed },
    ],
    events: allEvents,
  });

  room.bufferedCommands.clear();

  // Compute per-player LOS from pre-resolution snapshots for event filtering
  const p1Los = calculateVisibility(p1UnitsSnapshot, state.map.terrain, state.map.elevation, state.unitStats);
  const p2Los = calculateVisibility(p2UnitsSnapshot, state.map.terrain, state.map.elevation, state.unitStats);

  // Check round end
  const roundEnd = checkRoundEnd(state);

  if (roundEnd.roundOver) {
    allEvents.push({
      type: 'round-end',
      actingPlayer: roundEnd.winner ?? 'player1',
      phase: 'round',
      pipelinePhase: 10,
      winner: roundEnd.winner,
      reason: roundEnd.reason!,
    });
  }

  if (!roundEnd.roundOver) {
    // Normal turn — emit turn-result with fog-filtered events per player
    for (const [pid, player] of room.players) {
      const filtered = filterStateForPlayer(state, pid);
      const losSet = pid === 'player1' ? p1Los : p2Los;
      const playerEvents = filterEventsForPlayer(allEvents, pid as PlayerId, losSet);
      io.to(player.socketId).emit('turn-result', {
        type: 'turn-result',
        state: filtered,
        events: playerEvents,
      });
    }
    startTurnTimer(room, () => handleTurnTimeout(room, io));
  } else {
    room.gameState = scoreRound(state, roundEnd.winner);

    if (room.gameState.phase === 'game-over') {
      allEvents.push({
        type: 'game-end',
        actingPlayer: room.gameState.winner ?? 'player1',
        phase: 'round',
        pipelinePhase: 10,
        winner: room.gameState.winner!,
      });
      log('info', 'game', `Game over in room ${room.id}, winner: ${room.gameState.winner}, turns: ${room.turnLog.length}`);
      for (const [pid, player] of room.players) {
        const filtered = filterStateForPlayer(room.gameState, pid);
        const losSet = pid === 'player1' ? p1Los : p2Los;
        const playerEvents = filterEventsForPlayer(allEvents, pid as PlayerId, losSet);
        io.to(player.socketId).emit('game-over', {
          type: 'game-over',
          state: filtered,
          winner: room.gameState!.winner,
          events: playerEvents,
        });
      }
    } else {
      log('info', 'game', `Round ended in room ${room.id}, winner: ${roundEnd.winner}`);
      for (const [pid, player] of room.players) {
        const filtered = filterStateForPlayer(room.gameState, pid);
        const losSet = pid === 'player1' ? p1Los : p2Los;
        const playerEvents = filterEventsForPlayer(allEvents, pid as PlayerId, losSet);
        io.to(player.socketId).emit('round-end', {
          type: 'round-end',
          winner: roundEnd.winner,
          reason: roundEnd.reason,
          state: filtered,
          events: playerEvents,
          incomeBreakdown: {},
        });
      }
      room.buildConfirmed.clear();
      room.bufferedCommands.clear();
      startBuildTimer(room, () => handleBuildTimeout(room, io));
    }
  }
}

// -----------------------------------------------------------------------------
// Timeout Handlers
// -----------------------------------------------------------------------------

function handleBuildTimeout(room: Room, io: Server): void {
  if (!room.gameState) return;
  log('warn', 'game', `Build timeout in room ${room.id}`);

  // Auto-confirm for any player who hasn't confirmed yet
  for (const [playerId] of room.players) {
    if (!room.buildConfirmed.has(playerId)) {
      room.buildConfirmed.add(playerId);
    }
  }

  // If we now have both confirmed (may have been partially confirmed before)
  if (room.buildConfirmed.size >= 2) {
    transitionToBattle(room, io);
  }
}

function handleTurnTimeout(room: Room, io: Server): void {
  if (!room.gameState) return;
  log('warn', 'game', `Turn timeout in room ${room.id}`);

  // Submit empty commands for any player who hasn't submitted yet
  for (const playerId of ['player1', 'player2'] as PlayerId[]) {
    if (!room.bufferedCommands.has(playerId)) {
      handleSubmitCommands(room, playerId, [], io);
    }
  }
}
