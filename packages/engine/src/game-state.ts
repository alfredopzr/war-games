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
  DirectiveType,
  DirectiveTarget,
  Command,
  RoundEndResult,
  Unit,
  UnitAction,
  DirectiveContext,
} from './types';
import { generateMap } from './map-gen';
import { createUnit, UNIT_STATS, scaledUnitStats } from './units';
import { canAfford, calculateIncome, applyCarryover, applyMaintenance } from './economy';
import { createCommandPool, spendCommand } from './commands';
import { hexToKey, cubeDistance, hexNeighbors } from './hex';
import { canAttack, calculateDamage } from './combat';
import { findPath } from './pathfinding';
import { executeDirective } from './directives';
import { getMoveCost } from './terrain';

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
      commandPool: createCommandPool(),
      objective: { occupiedBy: null, turnsHeld: 0 },
      unitsKilledThisRound: { player1: 0, player2: 0 },
    },
    map,
    unitStats: scaledUnitStats(map.mapRadius * 2),
    maxRounds: 3,
    winner: null,
    cityOwnership,
    pendingEvents: [],
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
  directive: DirectiveType = 'advance',
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

  const unit = createUnit(unitType, playerId, position, directive, directiveTarget);
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
  state.round.commandPool = createCommandPool();
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
  const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
  const enemyUnits = state.players[enemyId].units;
  const allUnits = [...friendlyUnits, ...enemyUnits];

  return commands.filter((cmd) => {
    const unit = friendlyUnits.find((u) => u.id === cmd.unitId);
    if (!unit) return false;

    switch (cmd.type) {
      case 'direct-move': {
        const targetKey = hexToKey(cmd.targetHex);
        if (!state.map.terrain.has(targetKey)) return false;
        const occupied = allUnits.some(
          (u) => u.id !== unit.id && hexToKey(u.position) === targetKey,
        );
        if (occupied) return false;
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
// executeTurn
// -----------------------------------------------------------------------------

export function executeTurn(
  state: GameState,
  commands: Command[],
  randomFn?: () => number,
): GameState {
  if (state.phase !== 'battle') {
    throw new Error('Can only execute turns during battle phase');
  }

  // Clear pending events from previous turn
  state.pendingEvents = [];

  const currentPlayer = state.round.currentPlayer;
  const enemyPlayer: PlayerId = currentPlayer === 'player1' ? 'player2' : 'player1';
  const friendlyUnits = state.players[currentPlayer].units;

  // Track which units were directly commanded
  let commandPool = state.round.commandPool;
  const commandedUnitIds = new Set<string>();

  // Apply player commands
  for (const command of commands) {
    const unit = findUnitById(friendlyUnits, command.unitId);
    if (!unit) continue; // dead unit — skip, don't spend CP
    commandPool = spendCommand(commandPool, command);
    commandedUnitIds.add(command.unitId);

    applyCommand(state, command, currentPlayer, enemyPlayer, randomFn);
  }

  state.round.commandPool = commandPool;

  // Execute directive AI for non-commanded friendly units
  // Pass 1: Scout units act first
  for (const unit of [...friendlyUnits]) {
    if (unit.directive !== 'scout') continue;
    executeUnitDirective(state, unit, commandedUnitIds, friendlyUnits, currentPlayer, enemyPlayer, randomFn);
  }

  // Pass 2: All other non-commanded units
  for (const unit of [...friendlyUnits]) {
    if (unit.directive === 'scout') continue;
    executeUnitDirective(state, unit, commandedUnitIds, friendlyUnits, currentPlayer, enemyPlayer, randomFn);
  }

  // Update city ownership BEFORE objective tracking (so KotH gate has current data)
  updateCityOwnership(state);

  // Update objective tracking (with city gate check)
  updateObjective(state);

  return state;
}

// -----------------------------------------------------------------------------
// Directive Execution Helper
// -----------------------------------------------------------------------------

function executeUnitDirective(
  state: GameState,
  unit: Unit,
  commandedUnitIds: Set<string>,
  friendlyUnits: Unit[],
  currentPlayer: PlayerId,
  enemyPlayer: PlayerId,
  randomFn?: () => number,
): void {
  if (commandedUnitIds.has(unit.id)) return;
  if (unit.hasActed) return;
  // Unit may have been killed during command resolution
  if (!friendlyUnits.includes(unit)) return;

  const context: DirectiveContext = {
    friendlyUnits: [...friendlyUnits],
    enemyUnits: [...state.players[enemyPlayer].units],
    terrain: state.map.terrain,
    elevation: state.map.elevation,
    modifiers: state.map.modifiers,
    centralObjective: state.map.centralObjective,
    cities: state.cityOwnership,
    unitStats: state.unitStats,
  };

  const action = executeDirective(unit, context);
  applyDirectiveAction(state, unit, action, currentPlayer, enemyPlayer, randomFn);
  unit.hasActed = true;

  // Support directive: heal adjacent friendly with lowest HP (below maxHp)
  if (unit.directive === 'support') {
    const neighbors = hexNeighbors(unit.position);
    const neighborKeys = new Set(neighbors.map(hexToKey));
    let bestTarget: Unit | null = null;
    let lowestHp = Infinity;

    for (const friendly of friendlyUnits) {
      if (friendly.id === unit.id) continue;
      const fKey = hexToKey(friendly.position);
      if (!neighborKeys.has(fKey)) continue;
      const stats = UNIT_STATS[friendly.type];
      if (friendly.hp < stats.maxHp && friendly.hp < lowestHp) {
        lowestHp = friendly.hp;
        bestTarget = friendly;
      }
    }

    if (bestTarget) {
      bestTarget.hp += 1;
    }
  }
}

// -----------------------------------------------------------------------------
// Command Application
// -----------------------------------------------------------------------------

function applyCommand(
  state: GameState,
  command: Command,
  currentPlayer: PlayerId,
  enemyPlayer: PlayerId,
  randomFn?: () => number,
): void {
  const friendlyUnits = state.players[currentPlayer].units;

  // Stale unit refs: unit may have died between command submission and execution.
  // Soft-fail (return) instead of throwing. Non-issue once we switch to
  // resolve-all-turns-simultaneously mode — commands will reference live state.
  switch (command.type) {
    case 'direct-move': {
      const unit = findUnitById(friendlyUnits, command.unitId);
      if (!unit) return;

      const targetKey = hexToKey(command.targetHex);
      if (!state.map.terrain.has(targetKey)) return;

      // Check unoccupied — may have been claimed by an earlier command this turn
      const allUnits = [...state.players.player1.units, ...state.players.player2.units];
      const isOccupied = allUnits.some(
        (u) => u.id !== unit.id && hexToKey(u.position) === targetKey,
      );
      if (isOccupied) return;

      // Validate in move range
      const stats = UNIT_STATS[unit.type];
      const dist = cubeDistance(unit.position, command.targetHex);
      if (dist > stats.moveRange) return;

      unit.position = command.targetHex;
      unit.hasActed = true;
      break;
    }

    case 'direct-attack': {
      const attacker = findUnitById(friendlyUnits, command.unitId);
      if (!attacker) return;

      const enemyUnits = state.players[enemyPlayer].units;
      const defender = findUnitById(enemyUnits, command.targetUnitId);
      if (!defender) return;

      if (!canAttack(attacker, defender)) return;

      const defenderTerrain = state.map.terrain.get(hexToKey(defender.position)) ?? 'plains';
      const damage = calculateDamage(attacker, defender, defenderTerrain, randomFn);
      defender.hp -= damage;

      if (defender.hp <= 0) {
        removeUnit(state.players[enemyPlayer].units, defender.id);
        state.round.unitsKilledThisRound[currentPlayer] += 1;
      }

      attacker.hasActed = true;
      break;
    }

    case 'redirect': {
      const unit = findUnitById(friendlyUnits, command.unitId);
      if (!unit) return;
      unit.directive = command.newDirective;
      if (command.target) {
        unit.directiveTarget = command.target;
      }
      unit.hasActed = true;
      break;
    }

    case 'retreat': {
      const unit = findUnitById(friendlyUnits, command.unitId);
      if (!unit) return;

      const deploymentZone = currentPlayer === 'player1'
        ? state.map.player1Deployment
        : state.map.player2Deployment;

      // Find closest deployment zone hex
      const allUnits = [...state.players.player1.units, ...state.players.player2.units];
      const occupied = new Set(
        allUnits.filter((u) => u.id !== unit.id).map((u) => hexToKey(u.position)),
      );

      let bestHex: CubeCoord | null = null;
      let bestDist = Infinity;

      for (const dzHex of deploymentZone) {
        const key = hexToKey(dzHex);
        if (occupied.has(key)) continue;
        const dist = cubeDistance(unit.position, dzHex);
        if (dist < bestDist) {
          bestDist = dist;
          bestHex = dzHex;
        }
      }

      if (bestHex) {
        // Move toward best hex, limited by move cost budget
        const stats = UNIT_STATS[unit.type];
        const path = findPath(
          unit.position,
          bestHex,
          state.map.terrain,
          unit.type,
          occupied,
          unit.directive,
          state.map.modifiers,
          state.map.elevation,
        );
        if (path && path.length > 1) {
          let costBudget = stats.moveRange;
          let lastValid = 0;
          for (let i = 1; i < path.length; i++) {
            const prevKey = hexToKey(path[i - 1]!);
            const curKey = hexToKey(path[i]!);
            const terrain = state.map.terrain.get(curKey);
            if (!terrain) break;
            const stepCost = getMoveCost(
              terrain, unit.type, unit.directive,
              state.map.modifiers.get(curKey),
              state.map.elevation.get(prevKey),
              state.map.elevation.get(curKey),
            );
            if (stepCost === Infinity) break;
            costBudget -= stepCost;
            if (costBudget < 0) break;
            lastValid = i;
          }
          if (lastValid > 0) {
            unit.position = path[lastValid]!;
          }
        }
      }

      unit.hasActed = true;
      break;
    }
  }
}

// -----------------------------------------------------------------------------
// Directive Action Application
// -----------------------------------------------------------------------------

function applyDirectiveAction(
  state: GameState,
  unit: Unit,
  action: UnitAction,
  currentPlayer: PlayerId,
  enemyPlayer: PlayerId,
  randomFn?: () => number,
): void {
  switch (action.type) {
    case 'move': {
      const targetKey = hexToKey(action.targetHex);
      // Validate the hex exists and is unoccupied
      if (!state.map.terrain.has(targetKey)) break;

      const allUnits = [...state.players.player1.units, ...state.players.player2.units];
      const isOccupied = allUnits.some(
        (u) => u.id !== unit.id && hexToKey(u.position) === targetKey,
      );
      if (isOccupied) break;

      unit.position = action.targetHex;
      break;
    }

    case 'attack': {
      const enemyUnits = state.players[enemyPlayer].units;
      const defender = findUnitById(enemyUnits, action.targetUnitId);
      if (!defender) break;

      if (!canAttack(unit, defender)) break;

      const defenderTerrain = state.map.terrain.get(hexToKey(defender.position)) ?? 'plains';
      const damage = calculateDamage(unit, defender, defenderTerrain, randomFn);
      defender.hp -= damage;

      if (defender.hp <= 0) {
        removeUnit(state.players[enemyPlayer].units, defender.id);
        state.round.unitsKilledThisRound[currentPlayer] += 1;
      }
      break;
    }

    case 'hold':
      break;
  }
}

// -----------------------------------------------------------------------------
// Objective Tracking
// -----------------------------------------------------------------------------

function updateObjective(state: GameState): void {
  const objectiveKey = hexToKey(state.map.centralObjective);
  const allUnits = [...state.players.player1.units, ...state.players.player2.units];

  const unitOnObjective = allUnits.find(
    (u) => hexToKey(u.position) === objectiveKey,
  );

  const previousOccupier = state.round.objective.occupiedBy;

  if (!unitOnObjective) {
    if (previousOccupier !== null) {
      const prevLabel = previousOccupier === 'player1' ? 'P1' : 'P2';
      state.pendingEvents.push({
        type: 'objective-change',
        actingPlayer: previousOccupier,
        message: `${prevLabel} lost control of the objective`,
      });
    }
    state.round.objective = { occupiedBy: null, turnsHeld: 0 };
    return;
  }

  const occupier = unitOnObjective.owner;
  const label = occupier === 'player1' ? 'P1' : 'P2';

  // KotH city gate: occupier must hold 2+ cities to progress
  const citiesHeld = countCitiesHeld(state, occupier);

  if (state.round.objective.occupiedBy === occupier) {
    if (citiesHeld >= 2) {
      state.round.objective.turnsHeld += 1;
      state.pendingEvents.push({
        type: 'koth-progress',
        actingPlayer: occupier,
        message: `${label} holds objective (${state.round.objective.turnsHeld}/2 turns)`,
      });
    } else {
      // Present but not progressing — reset turnsHeld
      state.round.objective.turnsHeld = 0;
    }
  } else {
    // New occupier seized the objective
    state.pendingEvents.push({
      type: 'objective-change',
      actingPlayer: occupier,
      message: `${label} seized the objective`,
    });
    state.round.objective = { occupiedBy: occupier, turnsHeld: citiesHeld >= 2 ? 1 : 0 };
    if (citiesHeld >= 2) {
      state.pendingEvents.push({
        type: 'koth-progress',
        actingPlayer: occupier,
        message: `${label} holds objective (1/2 turns)`,
      });
    }
  }
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
  state.round.commandPool = createCommandPool();
  state.round.objective = { occupiedBy: null, turnsHeld: 0 };
  state.round.unitsKilledThisRound = { player1: 0, player2: 0 };

  // Reset city ownership to neutral
  for (const key of state.cityOwnership.keys()) {
    state.cityOwnership.set(key, null);
  }

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
// City Ownership
// -----------------------------------------------------------------------------

function updateCityOwnership(state: GameState): void {
  const allUnits = [...state.players.player1.units, ...state.players.player2.units];
  const unitByHex = new Map<string, Unit>();
  for (const unit of allUnits) {
    unitByHex.set(hexToKey(unit.position), unit);
  }

  const unitLabels: Record<string, string> = { infantry: 'Infantry', tank: 'Tank', artillery: 'Artillery', recon: 'Recon' };

  for (const cityKey of state.cityOwnership.keys()) {
    const unit = unitByHex.get(cityKey);
    if (unit) {
      const currentOwner = state.cityOwnership.get(cityKey);
      if (currentOwner !== unit.owner) {
        // City flips to new owner — unit loses 1 HP
        state.cityOwnership.set(cityKey, unit.owner);
        unit.hp -= 1;
        const label = unit.owner === 'player1' ? 'P1' : 'P2';
        const unitName = unitLabels[unit.type] ?? unit.type;
        if (unit.hp <= 0) {
          removeUnit(state.players[unit.owner].units, unit.id);
          state.pendingEvents.push({
            type: 'capture-death',
            actingPlayer: unit.owner,
            message: `${label} ${unitName} died capturing a city`,
          });
        } else {
          state.pendingEvents.push({
            type: 'capture-damage',
            actingPlayer: unit.owner,
            message: `${label} ${unitName} took 1 damage capturing a city (${unit.hp} HP left)`,
          });
        }
      }
      // If city already owned by this player, no HP cost
    }
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function findUnitById(units: Unit[], id: string): Unit | undefined {
  return units.find((u) => u.id === id);
}

function removeUnit(units: Unit[], id: string): void {
  const index = units.findIndex((u) => u.id === id);
  if (index !== -1) {
    units.splice(index, 1);
  }
}

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
