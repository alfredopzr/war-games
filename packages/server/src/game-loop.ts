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
  DirectiveType,
  DirectiveTarget,
  Command,
  GameState,
  BattleEvent,
  Unit,
} from '@hexwar/engine';

import {
  createGame,
  placeUnit,
  startBattlePhase,
  filterValidCommands,
  executeTurn,
  checkRoundEnd,
  scoreRound,
  createCommandPool,
  UNIT_STATS,
  mulberry32,
} from '@hexwar/engine';

import { filterStateForPlayer } from './state-filter';
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

function emitFilteredStatePerPlayer(
  io: Server,
  room: Room,
  eventName: string,
  extraFieldsFn: (playerId: PlayerId) => Record<string, unknown>,
): void {
  if (!room.gameState) return;

  for (const [playerId, player] of room.players) {
    const filtered = filterStateForPlayer(room.gameState, playerId);
    io.to(player.socketId).emit(eventName, {
      type: eventName,
      state: filtered,
      ...extraFieldsFn(playerId),
    });
  }
}

interface UnitSnapshot {
  type: string;
  owner: PlayerId;
  hp: number;
}

function snapshotUnits(state: GameState): Map<string, UnitSnapshot> {
  const map = new Map<string, UnitSnapshot>();
  for (const player of Object.values(state.players)) {
    for (const unit of player.units) {
      map.set(unit.id, { type: unit.type, owner: unit.owner, hp: unit.hp });
    }
  }
  return map;
}

function snapshotCities(state: GameState): Map<string, PlayerId | null> {
  return new Map(state.cityOwnership);
}

function generateBattleEvents(
  prevUnits: Map<string, UnitSnapshot>,
  prevCities: Map<string, PlayerId | null>,
  newState: GameState,
  actingPlayer: PlayerId,
): BattleEvent[] {
  const events: BattleEvent[] = [];

  // Build a map of current units
  const currentUnits = new Map<string, Unit>();
  for (const player of Object.values(newState.players)) {
    for (const unit of player.units) {
      currentUnits.set(unit.id, unit);
    }
  }

  // Check for kills and damage
  for (const [unitId, prev] of prevUnits) {
    const current = currentUnits.get(unitId);
    if (!current) {
      // Unit is gone — kill event
      events.push({
        type: 'kill',
        actingPlayer,
        message: `${actingPlayer} destroyed a ${prev.type} belonging to ${prev.owner}`,
      });
    } else if (current.hp < prev.hp) {
      // Unit took damage
      events.push({
        type: 'damage',
        actingPlayer,
        message: `${actingPlayer} dealt ${prev.hp - current.hp} damage to ${prev.owner}'s ${prev.type}`,
      });
    }
  }

  // Check for city captures/recaptures
  for (const [cityKey, prevOwner] of prevCities) {
    const newOwner = newState.cityOwnership.get(cityKey) ?? null;
    if (newOwner !== prevOwner && newOwner !== null) {
      if (prevOwner === null) {
        events.push({
          type: 'capture',
          actingPlayer,
          message: `${actingPlayer} captured a city at ${cityKey}`,
        });
      } else {
        events.push({
          type: 'recapture',
          actingPlayer,
          message: `${actingPlayer} recaptured a city at ${cityKey} from ${prevOwner}`,
        });
      }
    }
  }

  return events;
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
  directive: DirectiveType,
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

  placeUnit(room.gameState, playerId, unitType, position, directive, target);

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
  directive: DirectiveType,
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

  unit.directive = directive;
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

  // Determine resolution order (randomized, deterministic from seed)
  const orderSeed = (room.gameSeed! * 31 + originalTurnNumber) | 0;
  const orderRng = mulberry32(orderSeed);
  const order: [PlayerId, PlayerId] = orderRng() < 0.5
    ? ['player1', 'player2']
    : ['player2', 'player1'];

  // Snapshot state before any resolution
  const prevUnits = snapshotUnits(state);
  const prevCities = snapshotCities(state);
  const turnsHeldBefore = state.round.objective.turnsHeld;
  const occupierBefore = state.round.objective.occupiedBy;

  // --- Resolve first player ---
  state.round.currentPlayer = order[0];
  const turnSeed1 = (room.gameSeed! * 37 + originalTurnNumber) | 0;
  const rng1 = mulberry32(turnSeed1);
  const combatRng1 = (): number => 0.85 + rng1() * 0.3;

  executeTurn(state, room.bufferedCommands.get(order[0])!, combatRng1);

  const events1 = generateBattleEvents(prevUnits, prevCities, state, order[0]);
  if (state.pendingEvents.length > 0) {
    events1.push(...state.pendingEvents);
    state.pendingEvents = [];
  }

  const occupierAfterFirst = state.round.objective.occupiedBy;

  // Check early round end (e.g. elimination after first resolution)
  const earlyRoundEnd = checkRoundEnd(state);
  let events2: BattleEvent[] = [];
  let turnSeed2 = 0;

  if (!earlyRoundEnd.roundOver) {
    // --- Resolve second player ---
    state.round.currentPlayer = order[1];
    state.round.commandPool = createCommandPool();
    for (const unit of state.players[order[1]].units) {
      unit.hasActed = false;
    }

    const midUnits = snapshotUnits(state);
    const midCities = snapshotCities(state);
    turnSeed2 = (room.gameSeed! * 41 + originalTurnNumber) | 0;
    const rng2 = mulberry32(turnSeed2);
    const combatRng2 = (): number => 0.85 + rng2() * 0.3;

    executeTurn(state, room.bufferedCommands.get(order[1])!, combatRng2);

    events2 = generateBattleEvents(midUnits, midCities, state, order[1]);
    if (state.pendingEvents.length > 0) {
      events2.push(...state.pendingEvents);
      state.pendingEvents = [];
    }

    // Fix turnsHeld double increment: if same occupier held across both calls
    // and turnsHeld went up by more than 1, clamp to +1
    if (
      state.round.objective.occupiedBy === occupierAfterFirst &&
      occupierAfterFirst === occupierBefore &&
      state.round.objective.turnsHeld > turnsHeldBefore + 1
    ) {
      state.round.objective.turnsHeld = turnsHeldBefore + 1;
    }
  }

  // Increment turn counters (once per simultaneous resolution)
  state.round.turnsPlayed += 1;
  state.round.turnNumber += 1;

  const allEvents = [...events1, ...events2];

  for (const event of allEvents) {
    log('info', 'game', event.message);
  }

  // Record turn log
  room.turnLog.push({
    turnNumber: originalTurnNumber,
    resolutionOrder: order,
    players: [
      { player: order[0], commandsSubmitted: room.bufferedCommands.get(order[0])!.length, rngSeed: turnSeed1 },
      { player: order[1], commandsSubmitted: room.bufferedCommands.get(order[1])!.length, rngSeed: turnSeed2 },
    ],
    events: allEvents,
  });

  room.bufferedCommands.clear();

  // Check final round end (after both resolutions)
  const roundEnd = earlyRoundEnd.roundOver ? earlyRoundEnd : checkRoundEnd(state);

  if (roundEnd.roundOver) {
    const winnerLabel = roundEnd.winner === 'player1' ? 'P1' : roundEnd.winner === 'player2' ? 'P2' : 'No one';
    const reasonLabel = roundEnd.reason === 'king-of-the-hill' ? 'King of the Hill'
      : roundEnd.reason === 'elimination' ? 'Elimination' : 'Turn Limit';
    allEvents.push({
      type: 'round-end',
      actingPlayer: roundEnd.winner ?? 'player1',
      message: `${winnerLabel} wins the round (${reasonLabel})`,
    });
  }

  if (!roundEnd.roundOver) {
    for (const [pid, player] of room.players) {
      const filtered = filterStateForPlayer(state, pid);
      io.to(player.socketId).emit('turn-result', {
        type: 'turn-result',
        state: filtered,
        events: allEvents,
      });
    }
    startTurnTimer(room, () => handleTurnTimeout(room, io));
  } else {
    room.gameState = scoreRound(state, roundEnd.winner);

    if (room.gameState.phase === 'game-over') {
      const gameWinnerLabel = room.gameState.winner === 'player1' ? 'P1' : 'P2';
      allEvents.push({
        type: 'game-end',
        actingPlayer: room.gameState.winner ?? 'player1',
        message: `${gameWinnerLabel} wins the game!`,
      });
      log('info', 'game', `Game over in room ${room.id}, winner: ${room.gameState.winner}, turns: ${room.turnLog.length}`);
      emitFilteredStatePerPlayer(io, room, 'game-over', () => ({
        winner: room.gameState!.winner,
      }));
    } else {
      log('info', 'game', `Round ended in room ${room.id}, winner: ${roundEnd.winner}`);
      for (const [pid, player] of room.players) {
        const filtered = filterStateForPlayer(room.gameState, pid);
        io.to(player.socketId).emit('round-end', {
          type: 'round-end',
          winner: roundEnd.winner,
          reason: roundEnd.reason,
          state: filtered,
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
