// =============================================================================
// HexWar — AI Opponent
// =============================================================================
// Provides two phases of AI logic:
//   aiBuildPhase  — purchase and deploy units within budget constraints
//   aiBattlePhase — issue up to CP_PER_ROUND worth of commands per turn
// =============================================================================

import type {
  GameState,
  PlayerId,
  UnitType,
  CubeCoord,
  DirectiveType,
  Command,
  Unit,
  CommandPool,
  TerrainType,
} from './types';
import { UNIT_STATS, getTypeAdvantage } from './units';
import { hexToKey, cubeDistance, hexesInRadius, createHex } from './hex';
import { canAttack, calculateDamage } from './combat';
import { canIssueCommand, CP_PER_ROUND } from './commands';
import { findPath } from './pathfinding';
import { getDefenseModifier } from './terrain';

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
// Build-phase presets — varied army compositions
// -----------------------------------------------------------------------------

type BudgetAllocation = { unitType: UnitType; fraction: number };

interface BuildPreset {
  name: string;
  allocation: BudgetAllocation[];
  directiveFn: (unitType: UnitType, index: number) => DirectiveType;
}

const BUILD_PRESETS: BuildPreset[] = [
  {
    // Balanced combined arms
    name: 'balanced',
    allocation: [
      { unitType: 'tank', fraction: 0.40 },
      { unitType: 'infantry', fraction: 0.30 },
      { unitType: 'artillery', fraction: 0.20 },
      { unitType: 'recon', fraction: 0.10 },
    ],
    directiveFn: (unitType, index) => {
      switch (unitType) {
        case 'tank': return 'advance';
        case 'infantry': return index % 3 === 0 ? 'flank-left' : index % 3 === 1 ? 'flank-right' : 'advance';
        case 'artillery': return 'support';
        case 'recon': return 'scout';
      }
    },
  },
  {
    // Infantry rush — cheap bodies flooding the center
    name: 'infantry-rush',
    allocation: [
      { unitType: 'infantry', fraction: 0.80 },
      { unitType: 'recon', fraction: 0.20 },
    ],
    directiveFn: (unitType, index) => {
      if (unitType === 'recon') return 'scout';
      return index % 2 === 0 ? 'advance' : 'capture';
    },
  },
  {
    // Armor push — heavy tank force with artillery cover
    name: 'armor-push',
    allocation: [
      { unitType: 'tank', fraction: 0.60 },
      { unitType: 'artillery', fraction: 0.30 },
      { unitType: 'recon', fraction: 0.10 },
    ],
    directiveFn: (unitType) => {
      switch (unitType) {
        case 'tank': return 'advance';
        case 'artillery': return 'support';
        case 'recon': return 'scout';
        default: return 'advance';
      }
    },
  },
  {
    // Artillery fortress — sit back and shell
    name: 'artillery-fortress',
    allocation: [
      { unitType: 'artillery', fraction: 0.50 },
      { unitType: 'infantry', fraction: 0.30 },
      { unitType: 'tank', fraction: 0.20 },
    ],
    directiveFn: (unitType, index) => {
      if (unitType === 'artillery') return 'support';
      if (unitType === 'infantry') return index % 2 === 0 ? 'hold' : 'advance';
      return 'advance';
    },
  },
  {
    // Flanker — fast units on the sides, infantry capturing
    name: 'flanker',
    allocation: [
      { unitType: 'recon', fraction: 0.30 },
      { unitType: 'infantry', fraction: 0.40 },
      { unitType: 'tank', fraction: 0.30 },
    ],
    directiveFn: (unitType, index) => {
      if (unitType === 'recon') return index % 2 === 0 ? 'flank-left' : 'flank-right';
      if (unitType === 'infantry') return 'capture';
      return 'advance';
    },
  },
  {
    // Tank-infantry combo — classic combined arms, no arty
    name: 'tank-infantry',
    allocation: [
      { unitType: 'tank', fraction: 0.50 },
      { unitType: 'infantry', fraction: 0.50 },
    ],
    directiveFn: (unitType, index) => {
      if (unitType === 'tank') return 'advance';
      return index % 3 === 0 ? 'flank-left' : index % 3 === 1 ? 'flank-right' : 'capture';
    },
  },
];

// -----------------------------------------------------------------------------
// aiBuildPhase
// -----------------------------------------------------------------------------

export function aiBuildPhase(state: GameState, playerId: PlayerId): AiBuildAction[] {
  const budget = state.players[playerId].resources;
  const deploymentZone = playerId === 'player1'
    ? state.map.player1Deployment
    : state.map.player2Deployment;

  // Pick a random preset
  const preset = BUILD_PRESETS[Math.floor(Math.random() * BUILD_PRESETS.length)]!;

  // Build set of occupied hex keys
  const allUnits = [...state.players.player1.units, ...state.players.player2.units];
  const occupied = new Set<string>(allUnits.map((u) => hexToKey(u.position)));

  // Compute how many of each type to buy based on budget fractions
  const queue: UnitType[] = [];

  for (const { unitType, fraction } of preset.allocation) {
    const targetSpend = budget * fraction;
    const cost = UNIT_STATS[unitType].cost;
    const count = Math.floor(targetSpend / cost);
    for (let i = 0; i < count; i++) {
      queue.push(unitType);
    }
  }

  // Fill leftover budget — keep buying the cheapest unit in the preset
  // until we can't afford anything
  let totalQueued = queue.reduce((sum, t) => sum + UNIT_STATS[t].cost, 0);
  const presetTypes = preset.allocation.map((a) => a.unitType);
  const cheapestInPreset = presetTypes.reduce((cheapest, t) =>
    UNIT_STATS[t].cost < UNIT_STATS[cheapest].cost ? t : cheapest,
  );
  while (totalQueued + UNIT_STATS[cheapestInPreset].cost <= budget) {
    queue.push(cheapestInPreset);
    totalQueued += UNIT_STATS[cheapestInPreset].cost;
  }

  // Sort queue by cost descending so expensive units get placed first
  queue.sort((a, b) => UNIT_STATS[b].cost - UNIT_STATS[a].cost);

  const results: AiBuildAction[] = [];
  let remaining = budget;
  const typeCounters = new Map<UnitType, number>();

  let zoneIdx = 0;

  for (const unitType of queue) {
    const cost = UNIT_STATS[unitType].cost;
    if (cost > remaining) continue;

    while (zoneIdx < deploymentZone.length) {
      const hex = deploymentZone[zoneIdx]!;
      zoneIdx++;
      const key = hexToKey(hex);
      if (!occupied.has(key)) {
        const count = typeCounters.get(unitType) ?? 0;
        const directive = preset.directiveFn(unitType, count);
        typeCounters.set(unitType, count + 1);

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
// aiBattlePhase — Competent AI
// -----------------------------------------------------------------------------

interface ScoredAttack {
  attacker: Unit;
  target: Unit;
  expectedDamage: number;
  isKill: boolean;
  typeAdvantage: number;
  score: number;
}

function estimateDamageRange(
  attacker: Unit,
  defender: Unit,
  defenderTerrain: TerrainType,
): { min: number; max: number; avg: number } {
  const min = calculateDamage(attacker, defender, defenderTerrain, () => 0.85);
  const max = calculateDamage(attacker, defender, defenderTerrain, () => 1.15);
  const avg = calculateDamage(attacker, defender, defenderTerrain, () => 1.0);
  return { min, max, avg };
}

function scoreAttack(
  attacker: Unit,
  target: Unit,
  defenderTerrain: TerrainType,
  focusTargetId: string | null,
): ScoredAttack {
  const dmg = estimateDamageRange(attacker, target, defenderTerrain);
  const isKill = dmg.min >= target.hp;
  const typeAdv = getTypeAdvantage(attacker.type, target.type);

  let score = dmg.avg * 10;

  // Massive bonus for guaranteed kills
  if (isKill) score += 100;
  // Bonus for probable kills (avg damage >= hp)
  else if (dmg.avg >= target.hp) score += 50;

  // Focus fire bonus — prioritize the unit we've already been hitting
  if (focusTargetId && target.id === focusTargetId) score += 40;

  // Prioritize low-HP targets (easier to kill)
  const hpFraction = target.hp / UNIT_STATS[target.type].maxHp;
  score += (1 - hpFraction) * 30;

  // Prioritize high-value targets (expensive units)
  score += UNIT_STATS[target.type].cost / 25;

  // Type advantage bonus
  if (typeAdv > 1.0) score += typeAdv * 15;

  // Artillery attacking from range is safe — slight bonus
  if (attacker.type === 'artillery') score += 5;

  return { attacker, target, expectedDamage: dmg.avg, isKill, typeAdvantage: typeAdv, score };
}

export function aiBattlePhase(state: GameState, playerId: PlayerId): Command[] {
  const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
  const myUnits = state.players[playerId].units;
  const enemyUnits = state.players[enemyId].units;

  const commands: Command[] = [];
  let pool: CommandPool = state.round.commandPool;
  const usedUnitIds = new Set<string>();

  const getUnitTerrain = (unit: Unit): TerrainType =>
    state.map.terrain.get(hexToKey(unit.position)) ?? 'plains';

  // Track which enemies we've committed to attacking (for focus fire)
  const damageCommitted = new Map<string, number>(); // enemyId -> total committed damage
  let focusTargetId: string | null = null;

  // Find the weakest enemy (lowest HP) to focus fire on
  const weakestEnemy = [...enemyUnits].sort((a, b) => a.hp - b.hp)[0];
  if (weakestEnemy && weakestEnemy.hp < UNIT_STATS[weakestEnemy.type].maxHp) {
    focusTargetId = weakestEnemy.id;
  }

  // Occupied hexes for pathfinding
  const allUnits = [...myUnits, ...enemyUnits];
  const occupiedKeys = new Set(allUnits.map((u) => hexToKey(u.position)));

  // Track hexes claimed by move commands this turn
  const claimedHexes = new Set<string>();

  // -------------------------------------------------------------------------
  // Priority 1: Score all possible attacks and pick the best ones
  // -------------------------------------------------------------------------
  const allAttacks: ScoredAttack[] = [];

  for (const unit of myUnits) {
    if (!canIssueCommand(pool, unit.id)) continue;
    for (const enemy of enemyUnits) {
      if (!canAttack(unit, enemy)) continue;
      allAttacks.push(scoreAttack(unit, enemy, getUnitTerrain(enemy), focusTargetId));
    }
  }

  // Sort by score descending
  allAttacks.sort((a, b) => b.score - a.score);

  // Greedily pick best non-conflicting attacks
  for (const atk of allAttacks) {
    if (commands.length >= CP_PER_ROUND) break;
    if (usedUnitIds.has(atk.attacker.id)) continue;
    if (!canIssueCommand(pool, atk.attacker.id)) continue;

    // Skip if the target is already dead from committed damage
    const committed = damageCommitted.get(atk.target.id) ?? 0;
    if (committed >= atk.target.hp) continue;

    commands.push({ type: 'direct-attack', unitId: atk.attacker.id, targetUnitId: atk.target.id });
    pool = { ...pool, remaining: pool.remaining - 1, commandedUnitIds: new Set([...pool.commandedUnitIds, atk.attacker.id]) };
    usedUnitIds.add(atk.attacker.id);
    damageCommitted.set(atk.target.id, committed + atk.expectedDamage);
  }

  if (commands.length >= CP_PER_ROUND) return commands;

  // -------------------------------------------------------------------------
  // Priority 2: Move units toward high-value targets
  // -------------------------------------------------------------------------
  // Units that couldn't attack — move them into range or toward objective/cities

  const objective = state.map.centralObjective;
  const objectiveKey = hexToKey(objective);

  // Find unowned or enemy-owned cities
  const valuableCityHexes: CubeCoord[] = [];
  for (const [key, owner] of state.cityOwnership) {
    if (owner !== playerId) {
      const [cq, cr] = key.split(',');
      valuableCityHexes.push(createHex(Number(cq), Number(cr)));
    }
  }

  // Sort candidate movers by strategic value
  const moveCandidates = myUnits
    .filter((u) => !usedUnitIds.has(u.id) && canIssueCommand(pool, u.id))
    .sort((a, b) => {
      // Prioritize units closer to the objective
      return cubeDistance(a.position, objective) - cubeDistance(b.position, objective);
    });

  for (const unit of moveCandidates) {
    if (commands.length >= CP_PER_ROUND) break;
    if (usedUnitIds.has(unit.id)) continue;
    if (!canIssueCommand(pool, unit.id)) continue;

    const stats = UNIT_STATS[unit.type];
    const unitKey = hexToKey(unit.position);

    // Artillery shouldn't move if it can already hit someone (min range 2)
    if (unit.type === 'artillery') {
      const canHitSomeone = enemyUnits.some((e) => canAttack(unit, e));
      if (canHitSomeone) continue;
    }

    // Find best move target
    let bestTarget: CubeCoord | null = null;
    let bestScore = -Infinity;

    // Gather potential destinations within move range
    const reachableHexes: CubeCoord[] = [];

    for (const hex of hexesInRadius(unit.position, stats.moveRange)) {
      const key = hexToKey(hex);
      if (key === unitKey) continue;
      if (occupiedKeys.has(key)) continue;
      if (claimedHexes.has(key)) continue;
      if (!state.map.terrain.has(key)) continue;

      // Verify pathable
      const path = findPath(unit.position, hex, state.map.terrain, unit.type, occupiedKeys, undefined, state.map.modifiers, state.map.elevation);
      if (!path) continue;

      reachableHexes.push(hex);
    }

    for (const hex of reachableHexes) {
      const key = hexToKey(hex);
      let score = 0;

      // Proximity to objective
      const distToObj = cubeDistance(hex, objective);
      score += (10 - distToObj) * 5;

      // Bonus for being ON the objective
      if (key === objectiveKey) score += 50;

      // Bonus for being on/near enemy units (for melee units)
      if (stats.attackRange === 1) {
        for (const enemy of enemyUnits) {
          const distToEnemy = cubeDistance(hex, enemy.position);
          if (distToEnemy === 1) score += 25; // Can attack next turn
          else if (distToEnemy === 2) score += 10;
        }
      }

      // For artillery, prefer staying at range 2-3 from enemies
      if (unit.type === 'artillery') {
        for (const enemy of enemyUnits) {
          const distToEnemy = cubeDistance(hex, enemy.position);
          if (distToEnemy >= stats.minAttackRange && distToEnemy <= stats.attackRange) {
            score += 30; // Can attack from this position
          }
        }
      }

      // Bonus for cities
      for (const cityHex of valuableCityHexes) {
        if (hexToKey(cityHex) === key) score += 35;
      }

      // Terrain defense bonus
      const terrain = state.map.terrain.get(key);
      if (terrain) {
        score += getDefenseModifier(terrain) * 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestTarget = hex;
      }
    }

    if (bestTarget && bestScore > 0) {
      const targetKey = hexToKey(bestTarget);
      commands.push({ type: 'direct-move', unitId: unit.id, targetHex: bestTarget });
      pool = { ...pool, remaining: pool.remaining - 1, commandedUnitIds: new Set([...pool.commandedUnitIds, unit.id]) };
      usedUnitIds.add(unit.id);
      claimedHexes.add(targetKey);
      // Update occupied for subsequent pathfinding
      occupiedKeys.delete(unitKey);
      occupiedKeys.add(targetKey);
    }
  }

  if (commands.length >= CP_PER_ROUND) return commands;

  // -------------------------------------------------------------------------
  // Priority 3: Retreat critically wounded units under threat
  // -------------------------------------------------------------------------
  for (const unit of myUnits) {
    if (commands.length >= CP_PER_ROUND) break;
    if (usedUnitIds.has(unit.id)) continue;
    if (!canIssueCommand(pool, unit.id)) continue;

    // Only retreat if HP is 1 and there's an adjacent enemy that can kill us
    if (unit.hp > 1) continue;

    const adjacentThreat = enemyUnits.some((e) => {
      if (cubeDistance(unit.position, e.position) > 1) return false;
      const dmg = calculateDamage(e, unit, getUnitTerrain(unit), () => 0.85);
      return dmg >= unit.hp;
    });

    if (!adjacentThreat) continue;

    // Check retreat is possible
    const deploymentZone = playerId === 'player1'
      ? state.map.player1Deployment
      : state.map.player2Deployment;

    const hasRetreatHex = deploymentZone.some((h) => !occupiedKeys.has(hexToKey(h)));
    if (!hasRetreatHex) continue;

    commands.push({ type: 'retreat', unitId: unit.id });
    pool = { ...pool, remaining: pool.remaining - 1, commandedUnitIds: new Set([...pool.commandedUnitIds, unit.id]) };
    usedUnitIds.add(unit.id);
  }

  return commands;
}
