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
  executeTurn,
  checkRoundEnd,
  scoreRound,
  UNIT_STATS,
  hexToKey,
  canAttack,
  cubeDistance,
} from '@hexwar/engine';

import { filterStateForPlayer } from './state-filter';
import {
  startBuildTimer,
  startTurnTimer,
  clearBuildTimer,
  clearTurnTimer,
} from './timers';

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
  const state = createGame(seed);
  room.gameState = state;
  room.phase = 'playing';

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

  placeUnit(room.gameState, playerId, unitType, position, directive, target);

  const player = room.players.get(playerId);
  if (player) {
    const filtered = filterStateForPlayer(room.gameState, playerId);
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

  const player = room.players.get(playerId);
  if (player) {
    const filtered = filterStateForPlayer(room.gameState, playerId);
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

  const player = room.players.get(playerId);
  if (player) {
    const filtered = filterStateForPlayer(room.gameState, playerId);
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
  room.buildConfirmed.clear();

  emitFilteredState(io, room, 'battle-start');
  startTurnTimer(room, () => handleTurnTimeout(room, io));
}

// -----------------------------------------------------------------------------
// Command Validation
// -----------------------------------------------------------------------------

function filterValidCommands(
  state: GameState,
  commands: Command[],
  playerId: PlayerId,
): Command[] {
  const friendlyUnits = state.players[playerId].units;
  const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
  const enemyUnits = state.players[enemyId].units;

  const allUnits = [...friendlyUnits, ...enemyUnits];

  return commands.filter((cmd) => {
    // Every command references a unit — check it exists and belongs to player
    const unit = friendlyUnits.find((u) => u.id === cmd.unitId);
    if (!unit) return false;

    switch (cmd.type) {
      case 'direct-move': {
        const targetKey = hexToKey(cmd.targetHex);
        // Target hex must exist on the map
        if (!state.map.terrain.has(targetKey)) return false;
        // Target hex must be unoccupied
        const occupied = allUnits.some(
          (u) => u.id !== unit.id && hexToKey(u.position) === targetKey,
        );
        if (occupied) return false;
        // Must be within move range
        const stats = UNIT_STATS[unit.type];
        if (cubeDistance(unit.position, cmd.targetHex) > stats.moveRange) return false;
        return true;
      }

      case 'direct-attack': {
        const target = enemyUnits.find((u) => u.id === cmd.targetUnitId);
        if (!target) return false;
        if (!canAttack(unit, target)) return false;
        return true;
      }

      case 'redirect':
        return true;

      case 'retreat':
        return true;

      default:
        return false;
    }
  });
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

  if (room.gameState.round.currentPlayer !== playerId) {
    const player = room.players.get(playerId);
    if (player) {
      io.to(player.socketId).emit('room-error', {
        type: 'room-error',
        message: 'It is not your turn',
      });
    }
    return;
  }

  clearTurnTimer(room);

  // Validate commands against current state — filter out stale/invalid ones
  const validCommands = filterValidCommands(room.gameState, commands, playerId);

  // Snapshot state for event generation
  const prevUnits = snapshotUnits(room.gameState);
  const prevCities = snapshotCities(room.gameState);

  executeTurn(room.gameState, validCommands);

  const events = generateBattleEvents(prevUnits, prevCities, room.gameState, playerId);
  const roundEnd = checkRoundEnd(room.gameState);

  if (!roundEnd.roundOver) {
    // Emit turn result and start next turn timer
    for (const [pid, player] of room.players) {
      const filtered = filterStateForPlayer(room.gameState, pid);
      io.to(player.socketId).emit('turn-result', {
        type: 'turn-result',
        state: filtered,
        events,
      });
    }
    startTurnTimer(room, () => handleTurnTimeout(room, io));
  } else {
    // Round ended
    scoreRound(room.gameState, roundEnd.winner);

    if ((room.gameState.phase as string) === 'game-over') {
      emitFilteredStatePerPlayer(io, room, 'game-over', () => ({
        winner: room.gameState!.winner,
      }));
      room.phase = 'finished';
    } else {
      // Next round — back to build phase
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
      startBuildTimer(room, () => handleBuildTimeout(room, io));
    }
  }
}

// -----------------------------------------------------------------------------
// Timeout Handlers
// -----------------------------------------------------------------------------

function handleBuildTimeout(room: Room, io: Server): void {
  if (!room.gameState) return;

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

  const currentPlayer = room.gameState.round.currentPlayer;
  handleSubmitCommands(room, currentPlayer, [], io);
}
