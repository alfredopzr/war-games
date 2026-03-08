// =============================================================================
// HexWar — Game State Machine
// =============================================================================
// Central module that ties the entire engine together.
// Manages game phases, unit placement, battle resolution, and round scoring.
// =============================================================================

import type {
  GameState,
  PlayerId,
  UnitType,
  CubeCoord,
  MovementDirective,
  AttackDirective,
  SpecialtyModifier,
  DirectiveTarget,
  Command,
  RoundEndResult,
  Unit,
} from './types';
import { generateMap } from './map-gen';
import { createUnit, UNIT_STATS, scaledUnitStats } from './units';
import { canAfford, calculateIncome, applyCarryover, applyMaintenance } from './economy';
import { createCommandPool } from './commands';
import { hexToKey, cubeDistance } from './hex';

// -----------------------------------------------------------------------------
// createGame
// -----------------------------------------------------------------------------

export function createGame(seed?: number): GameState {
  const map = generateMap(seed);

  // Initialize city ownership — all city hexes start neutral
  const cityOwnership = new Map<string, PlayerId | null>();
  for (const [key, terrain] of map.terrain) {
    if (terrain === 'city') {
      cityOwnership.set(key, null);
    }
  }

  return {
    phase: 'build',
    players: {
      player1: {
        id: 'player1',
        resources: 800,
        units: [],
        roundsWon: 0,
      },
      player2: {
        id: 'player2',
        resources: 800,
        units: [],
        roundsWon: 0,
      },
    },
    round: {
      roundNumber: 1,
      turnNumber: 0,
      currentPlayer: 'player1',
      maxTurns: 12,
      turnsPlayed: 0,
      commandPools: { player1: createCommandPool(), player2: createCommandPool() },
      objective: { occupiedBy: null, turnsHeld: 0 },
      unitsKilledThisRound: { player1: 0, player2: 0 },
    },
    map,
    unitStats: scaledUnitStats(map.mapRadius * 2),
    maxRounds: 3,
    winner: null,
    cityOwnership,
    pendingEvents: [],
    buildings: [],
  };
}

// -----------------------------------------------------------------------------
// placeUnit
// -----------------------------------------------------------------------------

export function placeUnit(
  state: GameState,
  playerId: PlayerId,
  unitType: UnitType,
  position: CubeCoord,
  movementDirective: MovementDirective = 'advance',
  attackDirective: AttackDirective = 'ignore',
  specialtyModifier: SpecialtyModifier | null = null,
  directiveTarget?: DirectiveTarget,
): GameState {
  if (state.phase !== 'build') {
    throw new Error('Can only place units during build phase');
  }

  const deploymentZone = playerId === 'player1'
    ? state.map.player1Deployment
    : state.map.player2Deployment;

  const posKey = hexToKey(position);
  const inZone = deploymentZone.some((hex) => hexToKey(hex) === posKey);
  if (!inZone) {
    throw new Error('Position is not in deployment zone');
  }

  // Check hex is unoccupied by any unit from either player
  const allUnits = [...state.players.player1.units, ...state.players.player2.units];
  const occupied = allUnits.some((u) => hexToKey(u.position) === posKey);
  if (occupied) {
    throw new Error('Hex is already occupied');
  }

  const cost = UNIT_STATS[unitType].cost;
  if (!canAfford(state.players[playerId].resources, cost)) {
    throw new Error('Cannot afford unit');
  }

  const unit = createUnit(unitType, playerId, position, movementDirective, attackDirective, specialtyModifier, directiveTarget ?? { type: 'hex', hex: position });
  state.players[playerId].resources -= cost;
  state.players[playerId].units.push(unit);

  return state;
}

// -----------------------------------------------------------------------------
// startBattlePhase
// -----------------------------------------------------------------------------

export function startBattlePhase(state: GameState): GameState {
  if (state.phase !== 'build') {
    throw new Error('Can only start battle from build phase');
  }

  state.phase = 'battle';
  state.round.turnNumber = 1;
  state.round.currentPlayer = 'player1';
  state.round.turnsPlayed = 0;
  state.round.commandPools = { player1: createCommandPool(), player2: createCommandPool() };
  state.round.objective = { occupiedBy: null, turnsHeld: 0 };
  state.round.unitsKilledThisRound = { player1: 0, player2: 0 };

  // Reset all units' hasActed
  for (const player of Object.values(state.players)) {
    for (const unit of player.units) {
      unit.hasActed = false;
    }
  }

  return state;
}

// -----------------------------------------------------------------------------
// filterValidCommands
// -----------------------------------------------------------------------------

export function filterValidCommands(
  state: GameState,
  commands: Command[],
  playerId: PlayerId,
): Command[] {
  const friendlyUnits = state.players[playerId].units;
  const pool = state.round.commandPools[playerId];
  const seen = new Set<string>();
  let remaining = pool.remaining;

  return commands.filter((cmd) => {
    if (cmd.type !== 'redirect' && cmd.type !== 'build') return false;
    if (remaining <= 0) return false;

    const unit = friendlyUnits.find((u) => u.id === cmd.unitId);
    if (!unit) return false;

    if (seen.has(cmd.unitId)) return false;
    if (pool.commandedUnitIds.has(cmd.unitId)) return false;

    // Build commands require the unit to be an engineer
    if (cmd.type === 'build') {
      if (unit.type !== 'engineer') return false;
    }

    seen.add(cmd.unitId);
    remaining--;
    return true;
  });
}

// -----------------------------------------------------------------------------
// checkRoundEnd
// -----------------------------------------------------------------------------

export function checkRoundEnd(state: GameState): RoundEndResult {
  // a. King of the Hill
  if (
    state.round.objective.occupiedBy !== null &&
    state.round.objective.turnsHeld >= 2
  ) {
    return {
      roundOver: true,
      winner: state.round.objective.occupiedBy,
      reason: 'king-of-the-hill',
    };
  }

  // b. Elimination
  const p1Units = state.players.player1.units.length;
  const p2Units = state.players.player2.units.length;

  if (p1Units === 0 && p2Units > 0) {
    return { roundOver: true, winner: 'player2', reason: 'elimination' };
  }
  if (p2Units === 0 && p1Units > 0) {
    return { roundOver: true, winner: 'player1', reason: 'elimination' };
  }
  if (p1Units === 0 && p2Units === 0) {
    // Both eliminated — first-mover tiebreak
    return { roundOver: true, winner: 'player1', reason: 'elimination' };
  }

  // c. Turn limit
  if (state.round.turnsPlayed >= state.round.maxTurns) {
    const winner = resolveTurnLimitTiebreaker(state);
    return { roundOver: true, winner, reason: 'turn-limit' };
  }

  return { roundOver: false, winner: null, reason: null };
}

function resolveTurnLimitTiebreaker(state: GameState): PlayerId {
  const objectiveKey = hexToKey(state.map.centralObjective);

  // 1. Who has a unit on the central hex
  const p1OnCenter = state.players.player1.units.some(
    (u) => hexToKey(u.position) === objectiveKey,
  );
  const p2OnCenter = state.players.player2.units.some(
    (u) => hexToKey(u.position) === objectiveKey,
  );

  if (p1OnCenter && !p2OnCenter) return 'player1';
  if (p2OnCenter && !p1OnCenter) return 'player2';

  // 2. Closest unit to central hex
  const p1Closest = getClosestDistance(state.players.player1.units, state.map.centralObjective);
  const p2Closest = getClosestDistance(state.players.player2.units, state.map.centralObjective);

  if (p1Closest < p2Closest) return 'player1';
  if (p2Closest < p1Closest) return 'player2';

  // 3. More total surviving HP
  const p1Hp = getTotalHp(state.players.player1.units);
  const p2Hp = getTotalHp(state.players.player2.units);

  if (p1Hp > p2Hp) return 'player1';
  if (p2Hp > p1Hp) return 'player2';

  // 4. First-mover tiebreak
  return 'player1';
}

// -----------------------------------------------------------------------------
// scoreRound
// -----------------------------------------------------------------------------

export function scoreRound(
  state: GameState,
  roundWinner: PlayerId | null,
): GameState {
  // Increment winner's roundsWon
  if (roundWinner) {
    state.players[roundWinner].roundsWon += 1;
  }

  // Count cities held (units on city hexes)
  const p1Cities = countCitiesHeld(state, 'player1');
  const p2Cities = countCitiesHeld(state, 'player2');

  // Calculate income
  const p1Income = calculateIncome({
    citiesHeld: p1Cities,
    unitsKilled: state.round.unitsKilledThisRound.player1,
    wonRound: roundWinner === 'player1',
    lostRound: roundWinner === 'player2',
  });
  const p2Income = calculateIncome({
    citiesHeld: p2Cities,
    unitsKilled: state.round.unitsKilledThisRound.player2,
    wonRound: roundWinner === 'player2',
    lostRound: roundWinner === 'player1',
  });

  // Apply maintenance for surviving units
  const p1Maintenance = applyMaintenance(
    state.players.player1.units.map((u) => UNIT_STATS[u.type].cost),
  );
  const p2Maintenance = applyMaintenance(
    state.players.player2.units.map((u) => UNIT_STATS[u.type].cost),
  );

  // Apply carryover for unspent resources
  const p1Carryover = applyCarryover(state.players.player1.resources);
  const p2Carryover = applyCarryover(state.players.player2.resources);

  // New resources = carryover - maintenance + income
  state.players.player1.resources = Math.max(0, p1Carryover - p1Maintenance + p1Income);
  state.players.player2.resources = Math.max(0, p2Carryover - p2Maintenance + p2Income);

  // Check if game is over
  const gameWinner = getWinner(state);
  if (gameWinner) {
    state.phase = 'game-over';
    state.winner = gameWinner;
    return state;
  }

  // Transition to next round's build phase
  state.phase = 'build';
  state.round.roundNumber += 1;

  // Move surviving units back to deployment zones
  resetUnitsToDeployment(state, 'player1');
  resetUnitsToDeployment(state, 'player2');

  // Reset round state
  state.round.turnNumber = 0;
  state.round.currentPlayer = 'player1';
  state.round.turnsPlayed = 0;
  state.round.commandPools = { player1: createCommandPool(), player2: createCommandPool() };
  state.round.objective = { occupiedBy: null, turnsHeld: 0 };
  state.round.unitsKilledThisRound = { player1: 0, player2: 0 };

  // Reset city ownership to neutral
  for (const key of state.cityOwnership.keys()) {
    state.cityOwnership.set(key, null);
  }

  // Clear all buildings (ephemeral per round)
  state.buildings = [];

  // Reset all units' hasActed
  for (const player of Object.values(state.players)) {
    for (const unit of player.units) {
      unit.hasActed = false;
    }
  }

  return state;
}

// -----------------------------------------------------------------------------
// getWinner
// -----------------------------------------------------------------------------

export function getWinner(state: GameState): PlayerId | null {
  const roundsNeeded = Math.ceil(state.maxRounds / 2);

  if (state.players.player1.roundsWon >= roundsNeeded) return 'player1';
  if (state.players.player2.roundsWon >= roundsNeeded) return 'player2';

  return null;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getClosestDistance(units: Unit[], target: CubeCoord): number {
  if (units.length === 0) return Infinity;
  return Math.min(...units.map((u) => cubeDistance(u.position, target)));
}

function getTotalHp(units: Unit[]): number {
  return units.reduce((sum, u) => sum + u.hp, 0);
}

function countCitiesHeld(state: GameState, playerId: PlayerId): number {
  let count = 0;
  for (const owner of state.cityOwnership.values()) {
    if (owner === playerId) {
      count += 1;
    }
  }
  return count;
}

function resetUnitsToDeployment(state: GameState, playerId: PlayerId): void {
  const deploymentZone = playerId === 'player1'
    ? state.map.player1Deployment
    : state.map.player2Deployment;

  const units = state.players[playerId].units;
  if (units.length === 0) return;

  // Hexes occupied by the other player's units are off-limits
  const otherPlayer: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
  const otherOccupied = new Set(
    state.players[otherPlayer].units.map((u) => hexToKey(u.position)),
  );

  // Filter to available hexes, sort left-to-right then front-to-back
  const available = deploymentZone.filter((h) => !otherOccupied.has(hexToKey(h)));
  const sorted = [...available].sort((a, b) => {
    if (a.q !== b.q) return a.q - b.q;
    return a.r - b.r;
  });

  const count = units.length;
  const zoneSize = sorted.length;
  const claimed = new Set<string>();

  for (let i = 0; i < count; i++) {
    const targetIdx = Math.floor((i * zoneSize) / count);
    let placed = false;
    for (let offset = 0; offset < zoneSize; offset++) {
      const idx = (targetIdx + offset) % zoneSize;
      const hex = sorted[idx]!;
      const key = hexToKey(hex);
      if (!claimed.has(key)) {
        units[i]!.position = hex;
        claimed.add(key);
        placed = true;
        break;
      }
    }
    if (!placed) {
      for (const hex of sorted) {
        const key = hexToKey(hex);
        if (!claimed.has(key)) {
          units[i]!.position = hex;
          claimed.add(key);
          break;
        }
      }
    }
  }
}
