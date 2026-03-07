// =============================================================================
// HexWar — Basic AI Opponent
// =============================================================================
// Provides two phases of AI logic:
//   aiBuildPhase  — purchase and deploy units within budget constraints
//   aiBattlePhase — issue up to 3 CP worth of commands per turn
// =============================================================================

import type {
  GameState,
  PlayerId,
  UnitType,
  CubeCoord,
  DirectiveType,
  Command,
  Unit,
} from './types';
import { UNIT_STATS } from './units';
import { hexToKey, cubeDistance } from './hex';
import { canAttack, calculateDamage } from './combat';
import { canIssueCommand, CP_PER_ROUND } from './commands';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AiBuildAction {
  unitType: UnitType;
  position: CubeCoord;
  directive: DirectiveType;
  cost: number;
}

// -----------------------------------------------------------------------------
// Build-phase budget allocation (by cost)
// 40% tanks, 30% infantry, 20% artillery, 10% recon
// -----------------------------------------------------------------------------

type BudgetAllocation = { unitType: UnitType; fraction: number };

const BUDGET_ALLOCATION: BudgetAllocation[] = [
  { unitType: 'tank', fraction: 0.4 },
  { unitType: 'infantry', fraction: 0.3 },
  { unitType: 'artillery', fraction: 0.2 },
  { unitType: 'recon', fraction: 0.1 },
];

function directiveForUnit(unitType: UnitType, index: number): DirectiveType {
  switch (unitType) {
    case 'tank':
      return 'advance';
    case 'infantry':
      return index % 3 === 0 ? 'flank-left' : index % 3 === 1 ? 'flank-right' : 'advance';
    case 'artillery':
      return 'support';
    case 'recon':
      return 'scout';
    case 'engineer':
      return 'support';
  }
}

// -----------------------------------------------------------------------------
// aiBuildPhase
// -----------------------------------------------------------------------------

export function aiBuildPhase(state: GameState, playerId: PlayerId): AiBuildAction[] {
  const budget = state.players[playerId].resources;
  const deploymentZone =
    playerId === 'player1' ? state.map.player1Deployment : state.map.player2Deployment;

  // Build set of occupied hex keys
  const allUnits = [...state.players.player1.units, ...state.players.player2.units];
  const occupied = new Set<string>(allUnits.map((u) => hexToKey(u.position)));

  // Compute how many of each type to buy based on budget fractions
  // We'll use a greedy approach: fill a queue of desired unit types in priority order
  const queue: UnitType[] = [];

  for (const { unitType, fraction } of BUDGET_ALLOCATION) {
    const targetSpend = budget * fraction;
    const cost = UNIT_STATS[unitType].cost;
    const count = Math.floor(targetSpend / cost);
    for (let i = 0; i < count; i++) {
      queue.push(unitType);
    }
  }

  // If we still have leftover budget after fractions, fill with cheapest units
  // Sort queue by cost descending so expensive units get placed first
  queue.sort((a, b) => UNIT_STATS[b].cost - UNIT_STATS[a].cost);

  const results: AiBuildAction[] = [];
  let remaining = budget;
  let infantryCount = 0;

  // Walk through deployment zone hexes and assign units
  let zoneIdx = 0;

  for (const unitType of queue) {
    const cost = UNIT_STATS[unitType].cost;
    if (cost > remaining) continue;

    // Find next available hex in deployment zone
    while (zoneIdx < deploymentZone.length) {
      const hex = deploymentZone[zoneIdx]!;
      zoneIdx++;
      const key = hexToKey(hex);
      if (!occupied.has(key)) {
        const isInfantry = unitType === 'infantry';
        const directive = directiveForUnit(unitType, isInfantry ? infantryCount : 0);
        if (isInfantry) infantryCount++;

        results.push({ unitType, position: hex, directive, cost });
        occupied.add(key);
        remaining -= cost;
        break;
      }
    }

    if (zoneIdx >= deploymentZone.length) break;
  }

  return results;
}

// -----------------------------------------------------------------------------
// aiBattlePhase
// -----------------------------------------------------------------------------

export function aiBattlePhase(state: GameState, playerId: PlayerId): Command[] {
  const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
  const myUnits = state.players[playerId].units;
  const enemyUnits = state.players[enemyId].units;

  const commands: Command[] = [];
  let pool = state.round.commandPool;
  const usedUnitIds = new Set<string>();

  // Helper: get terrain for a unit's position
  const getUnitTerrain = (unit: Unit) => state.map.terrain.get(hexToKey(unit.position)) ?? 'plains';

  // Priority 1: kill shots — find any unit that can kill an enemy this turn
  for (const unit of myUnits) {
    if (commands.length >= CP_PER_ROUND) break;
    if (!canIssueCommand(pool, unit.id)) continue;
    if (usedUnitIds.has(unit.id)) continue;

    for (const enemy of enemyUnits) {
      if (!canAttack(unit, enemy)) continue;

      const estimatedDamage = calculateDamage(unit, enemy, getUnitTerrain(enemy), () => 1.0);
      if (estimatedDamage >= enemy.hp) {
        const cmd: Command = { type: 'direct-attack', unitId: unit.id, targetUnitId: enemy.id };
        commands.push(cmd);
        pool = {
          ...pool,
          remaining: pool.remaining - 1,
          commandedUnitIds: new Set([...pool.commandedUnitIds, unit.id]),
        };
        usedUnitIds.add(unit.id);
        break;
      }
    }
  }

  // Priority 2: retreat units that are adjacent to a much stronger enemy
  for (const unit of myUnits) {
    if (commands.length >= CP_PER_ROUND) break;
    if (!canIssueCommand(pool, unit.id)) continue;
    if (usedUnitIds.has(unit.id)) continue;

    const myStats = UNIT_STATS[unit.type];

    // Find adjacent enemies
    const adjacentEnemies = enemyUnits.filter((e) => cubeDistance(unit.position, e.position) === 1);

    if (adjacentEnemies.length === 0) continue;

    // Check if any adjacent enemy is significantly stronger (2x+ attack)
    const threatEnemy = adjacentEnemies.find((e) => {
      const enemyStats = UNIT_STATS[e.type];
      return enemyStats.atk >= myStats.atk * 2;
    });

    if (!threatEnemy) continue;

    // Check retreat is safe: deployment zone has a free hex
    const deploymentZone =
      playerId === 'player1' ? state.map.player1Deployment : state.map.player2Deployment;

    const allPositions = new Set<string>(
      [...myUnits, ...enemyUnits].filter((u) => u.id !== unit.id).map((u) => hexToKey(u.position)),
    );

    const hasRetreatHex = deploymentZone.some((h) => !allPositions.has(hexToKey(h)));
    if (!hasRetreatHex) continue;

    const cmd: Command = { type: 'retreat', unitId: unit.id };
    commands.push(cmd);
    pool = {
      ...pool,
      remaining: pool.remaining - 1,
      commandedUnitIds: new Set([...pool.commandedUnitIds, unit.id]),
    };
    usedUnitIds.add(unit.id);
  }

  // Priority 3: redirect units toward the objective
  if (commands.length < CP_PER_ROUND) {
    const objective = state.map.centralObjective;

    // Find units that are not yet on 'advance' and are closest to objective
    const candidates = myUnits
      .filter((u) => !usedUnitIds.has(u.id) && canIssueCommand(pool, u.id))
      .sort((a, b) => cubeDistance(a.position, objective) - cubeDistance(b.position, objective));

    for (const unit of candidates) {
      if (commands.length >= CP_PER_ROUND) break;

      const cmd: Command = { type: 'redirect', unitId: unit.id, newDirective: 'advance' };
      commands.push(cmd);
      pool = {
        ...pool,
        remaining: pool.remaining - 1,
        commandedUnitIds: new Set([...pool.commandedUnitIds, unit.id]),
      };
      usedUnitIds.add(unit.id);
    }
  }

  return commands;
}
