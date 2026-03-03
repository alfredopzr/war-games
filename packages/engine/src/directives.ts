// =============================================================================
// HexWar — Directive AI System
// =============================================================================
// Each unit has a directive that determines its autonomous behavior.
// executeDirective() returns a UnitAction for the given unit based on context.
// =============================================================================

import type { Unit, UnitAction, DirectiveContext, CubeCoord } from './types';
import { cubeDistance, hexToKey, hexNeighbors, createHex } from './hex';
import { UNIT_STATS } from './units';
import { canAttack } from './combat';
import { findPath } from './pathfinding';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Execute a unit's directive, returning the action it should take this turn.
 */
export function executeDirective(unit: Unit, context: DirectiveContext): UnitAction {
  switch (unit.directive) {
    case 'advance':
      return executeAdvance(unit, context);
    case 'hold':
      return executeHold(unit, context);
    case 'flank-left':
      return executeFlank(unit, context, 'left');
    case 'flank-right':
      return executeFlank(unit, context, 'right');
    case 'scout':
      return executeScout(unit, context);
    case 'support':
      return executeSupport(unit, context);
  }
}

// -----------------------------------------------------------------------------
// Directive Implementations
// -----------------------------------------------------------------------------

function executeAdvance(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  return moveToward(unit, context, context.centralObjective);
}

function executeHold(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  return { type: 'hold' };
}

function executeFlank(
  unit: Unit,
  context: DirectiveContext,
  side: 'left' | 'right',
): UnitAction {
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  // Compute an intermediate waypoint offset from the objective.
  // "Left" = lower q, "Right" = higher q.
  // We pick a point that's laterally offset from the objective so the unit
  // arcs around instead of going straight.
  const objective = context.centralObjective;
  const offsets = side === 'left' ? [-3, -2, -1] : [3, 2, 1];

  let intermediateTarget: CubeCoord = objective;
  for (const offset of offsets) {
    const candidate = createHex(objective.q + offset, objective.r);
    const key = hexToKey(candidate);
    // Must be on-map and not the unit's current position
    if (
      context.terrain.has(key) &&
      !(candidate.q === unit.position.q && candidate.r === unit.position.r)
    ) {
      intermediateTarget = candidate;
      break;
    }
  }

  // If the intermediate target is the same as our position, just go to objective
  if (
    intermediateTarget.q === unit.position.q &&
    intermediateTarget.r === unit.position.r
  ) {
    intermediateTarget = objective;
  }

  return moveToward(unit, context, intermediateTarget);
}

function executeScout(unit: Unit, context: DirectiveContext): UnitAction {
  // Check for adjacent enemies (distance 1)
  const nearestEnemy = findNearestEnemy(unit, context);
  if (nearestEnemy && cubeDistance(unit.position, nearestEnemy.position) === 1) {
    // Retreat: move to neighbor hex that maximizes distance from nearest enemy
    return retreatFrom(unit, context, nearestEnemy);
  }

  // Move toward hex farthest from all friendly units (explore new territory)
  return scoutExplore(unit, context);
}

function executeSupport(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  // Find nearest friendly unit within 3 hexes (not self)
  const nearbyFriendly = findNearestFriendly(unit, context, 3);
  if (!nearbyFriendly) {
    // Extend search to all friendly units
    const anyFriendly = findNearestFriendly(unit, context, Infinity);
    if (!anyFriendly) return { type: 'hold' };
    return moveToward(unit, context, anyFriendly.position);
  }

  // Stay ~2 hexes behind the friendly unit (path toward them but stop early)
  const dist = cubeDistance(unit.position, nearbyFriendly.position);
  if (dist <= 2) {
    return { type: 'hold' };
  }

  return moveToward(unit, context, nearbyFriendly.position);
}

// -----------------------------------------------------------------------------
// Shared Helpers
// -----------------------------------------------------------------------------

/**
 * Try to attack the closest enemy in range. If tied on distance, prefer lower HP.
 */
function tryAttackClosest(unit: Unit, context: DirectiveContext): UnitAction | null {
  const targets: { enemy: Unit; distance: number }[] = [];

  for (const enemy of context.enemyUnits) {
    if (canAttack(unit, enemy)) {
      targets.push({
        enemy,
        distance: cubeDistance(unit.position, enemy.position),
      });
    }
  }

  if (targets.length === 0) return null;

  targets.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.enemy.hp - b.enemy.hp;
  });

  return { type: 'attack', targetUnitId: targets[0].enemy.id };
}

/**
 * Build the set of occupied hex keys (all units except the moving unit).
 */
function buildOccupiedSet(unit: Unit, context: DirectiveContext): Set<string> {
  const occupied = new Set<string>();
  for (const u of context.friendlyUnits) {
    if (u.id !== unit.id) occupied.add(hexToKey(u.position));
  }
  for (const u of context.enemyUnits) {
    occupied.add(hexToKey(u.position));
  }
  return occupied;
}

/**
 * Move toward a target hex, limited by unit's moveRange.
 * Returns hold if no path exists.
 */
function moveToward(
  unit: Unit,
  context: DirectiveContext,
  target: CubeCoord,
): UnitAction {
  const stats = UNIT_STATS[unit.type];
  const occupied = buildOccupiedSet(unit, context);

  const path = findPath(
    unit.position,
    target,
    context.terrain,
    unit.type,
    occupied,
  );

  if (!path || path.length <= 1) {
    return { type: 'hold' };
  }

  // Follow the path up to moveRange steps
  const stepIndex = Math.min(stats.moveRange, path.length - 1);
  return { type: 'move', targetHex: path[stepIndex] };
}

/**
 * Find the nearest enemy unit to the given unit.
 */
function findNearestEnemy(unit: Unit, context: DirectiveContext): Unit | null {
  let nearest: Unit | null = null;
  let nearestDist = Infinity;

  for (const enemy of context.enemyUnits) {
    const dist = cubeDistance(unit.position, enemy.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }

  return nearest;
}

/**
 * Find the nearest friendly unit (not self) within maxRange.
 */
function findNearestFriendly(
  unit: Unit,
  context: DirectiveContext,
  maxRange: number,
): Unit | null {
  let nearest: Unit | null = null;
  let nearestDist = Infinity;

  for (const friendly of context.friendlyUnits) {
    if (friendly.id === unit.id) continue;
    const dist = cubeDistance(unit.position, friendly.position);
    if (dist <= maxRange && dist < nearestDist) {
      nearestDist = dist;
      nearest = friendly;
    }
  }

  return nearest;
}

/**
 * Retreat from an enemy: pick the neighbor hex that maximizes distance
 * from the threat, is on the map, and is not occupied.
 */
function retreatFrom(
  unit: Unit,
  context: DirectiveContext,
  threat: Unit,
): UnitAction {
  const neighbors = hexNeighbors(unit.position);
  const occupied = buildOccupiedSet(unit, context);

  let bestHex: CubeCoord | null = null;
  let bestDist = -1;

  for (const neighbor of neighbors) {
    const key = hexToKey(neighbor);
    if (!context.terrain.has(key)) continue;
    if (occupied.has(key)) continue;

    const dist = cubeDistance(neighbor, threat.position);
    if (dist > bestDist) {
      bestDist = dist;
      bestHex = neighbor;
    }
  }

  if (bestHex) {
    return { type: 'move', targetHex: bestHex };
  }

  // All retreat paths blocked — attack if possible as last resort
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  return { type: 'hold' };
}

/**
 * Scout exploration: move toward the hex farthest from all friendly units.
 * This pushes the scout into unexplored territory.
 */
function scoutExplore(unit: Unit, context: DirectiveContext): UnitAction {
  const stats = UNIT_STATS[unit.type];
  const occupied = buildOccupiedSet(unit, context);

  // Evaluate all hexes on the map, find the one farthest from all friendly units
  let bestHex: CubeCoord | null = null;
  let bestMinFriendlyDist = -1;

  for (const key of context.terrain.keys()) {
    if (occupied.has(key)) continue;

    const [qStr, rStr] = key.split(',');
    const candidate = createHex(Number(qStr), Number(rStr));

    // Compute minimum distance from any friendly unit
    let minFriendlyDist = Infinity;
    for (const friendly of context.friendlyUnits) {
      const dist = cubeDistance(candidate, friendly.position);
      if (dist < minFriendlyDist) {
        minFriendlyDist = dist;
      }
    }

    if (minFriendlyDist > bestMinFriendlyDist) {
      bestMinFriendlyDist = minFriendlyDist;
      bestHex = candidate;
    }
  }

  if (!bestHex) {
    return { type: 'hold' };
  }

  // Path toward that exploration target
  const path = findPath(
    unit.position,
    bestHex,
    context.terrain,
    unit.type,
    occupied,
  );

  if (!path || path.length <= 1) {
    return { type: 'hold' };
  }

  const stepIndex = Math.min(stats.moveRange, path.length - 1);
  return { type: 'move', targetHex: path[stepIndex] };
}
