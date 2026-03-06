// =============================================================================
// HexWar — Directive AI System
// =============================================================================
// Each unit has a movement directive + attack directive that determines its
// autonomous behavior. executeDirective() returns a UnitAction for the given
// unit based on context.
// =============================================================================

import type { Unit, UnitAction, DirectiveContext, CubeCoord, ResolvedTarget, MovementDirective, AttackDirective } from './types';
import { cubeDistance, hexToKey, hexNeighbors, createHex } from './hex';
import { canAttack } from './combat';
import { calculateVisibility } from './vision';
import { findPath } from './pathfinding';
import { getMoveCost } from './terrain';

// -----------------------------------------------------------------------------
// Behavior Matrix — human-readable names for each movement × attack combo
// -----------------------------------------------------------------------------

export const BEHAVIOR_NAMES: Record<MovementDirective, Record<AttackDirective, string>> = {
  advance:        { 'shoot-on-sight': 'Assault',        skirmish: 'Advance in Contact', 'retreat-on-contact': 'Probe',       hunt: 'Search & Destroy', ignore: 'March' },
  'flank-left':   { 'shoot-on-sight': 'Envelop Left',   skirmish: 'Harass Left',        'retreat-on-contact': 'Feint Left',  hunt: 'Pursue Left',      ignore: 'Bypass Left' },
  'flank-right':  { 'shoot-on-sight': 'Envelop Right',  skirmish: 'Harass Right',       'retreat-on-contact': 'Feint Right', hunt: 'Pursue Right',     ignore: 'Bypass Right' },
  scout:          { 'shoot-on-sight': 'Recon in Force',  skirmish: 'Armed Recon',        'retreat-on-contact': 'Recon',       hunt: 'Track',            ignore: 'Silent Recon' },
  hold:           { 'shoot-on-sight': 'Defend',          skirmish: 'Harassing Defense',  'retreat-on-contact': 'Tripwire',    hunt: 'Ambush',           ignore: 'Dig In' },
};

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Resolve a unit's directiveTarget to an actual hex coordinate,
 * with automatic fallback when targets become invalid.
 */
export function resolveTarget(unit: Unit, context: DirectiveContext): ResolvedTarget {
  const target = unit.directiveTarget;

  switch (target.type) {
    case 'central-objective':
      return { hex: context.centralObjective, isValid: true };

    case 'hex':
      return { hex: target.hex!, isValid: true };

    case 'enemy-unit': {
      const enemy = context.enemyUnits.find((e) => e.id === target.unitId);
      if (enemy) return { hex: enemy.position, isValid: true };
      // Fallback: nearest enemy
      const nearest = findNearestEnemy(unit, context);
      if (nearest) {
        unit.directiveTarget = { type: 'enemy-unit', unitId: nearest.id };
        return { hex: nearest.position, isValid: false };
      }
      unit.directiveTarget = { type: 'central-objective' };
      return { hex: context.centralObjective, isValid: false };
    }

    case 'friendly-unit': {
      const friendly = context.friendlyUnits.find(
        (f) => f.id === target.unitId && f.id !== unit.id,
      );
      if (friendly) return { hex: friendly.position, isValid: true };
      const nearestFriendly = findNearestFriendly(unit, context, Infinity);
      if (nearestFriendly) {
        unit.directiveTarget = { type: 'friendly-unit', unitId: nearestFriendly.id };
        return { hex: nearestFriendly.position, isValid: false };
      }
      return { hex: unit.position, isValid: false };
    }

    case 'city': {
      const cityId = target.cityId!;
      if (context.cities.has(cityId)) {
        const [qStr, rStr] = cityId.split(',');
        return { hex: createHex(Number(qStr), Number(rStr)), isValid: true };
      }
      const fallbackCity = findNearestEnemyCity(unit, context);
      if (fallbackCity) {
        unit.directiveTarget = { type: 'city', cityId: fallbackCity.key };
        return { hex: fallbackCity.hex, isValid: false };
      }
      unit.directiveTarget = { type: 'central-objective' };
      return { hex: context.centralObjective, isValid: false };
    }

    case 'deployment-zone': {
      const nearest = context.deploymentZone
        .filter(hex => {
          const key = hexToKey(hex);
          const occupied = context.friendlyUnits.some(u => u.id !== unit.id && hexToKey(u.position) === key)
            || context.enemyUnits.some(u => hexToKey(u.position) === key);
          return !occupied;
        })
        .sort((a, b) => cubeDistance(unit.position, a) - cubeDistance(unit.position, b))[0];
      return { hex: nearest ?? unit.position, isValid: !!nearest };
    }
  }
}

/**
 * Execute a unit's directive, returning the action it should take this turn.
 */
export function executeDirective(unit: Unit, context: DirectiveContext): UnitAction {
  // Specialty modifiers with custom behavior (TEMPORARY: overrides movement.
  // When combat timeline lands, these move to Phase 8 and movement always runs.)
  if (unit.specialtyModifier === 'support') return executeSupport(unit, context);
  // 'engineer' and 'sniper' are no-ops, fall through to movement

  switch (unit.movementDirective) {
    case 'advance': return executeAdvance(unit, context);
    case 'hold': return executeHold(unit, context);
    case 'flank-left': return executeFlank(unit, context, 'left');
    case 'flank-right': return executeFlank(unit, context, 'right');
    case 'scout': return executeScout(unit, context);
  }
}

// -----------------------------------------------------------------------------
// Attack Layer Wiring
// -----------------------------------------------------------------------------

/**
 * Check the attack layer and return an action if engagement should occur.
 * Returns null if attack layer is 'ignore' or no valid target exists.
 */
export function resolveAttackBehavior(unit: Unit, context: DirectiveContext): UnitAction | null {
  if (unit.attackDirective === 'ignore') return null;

  const visibleHexes = calculateVisibility([unit], context.terrain, context.elevation);
  const nearest = findClosestAttackableEnemy(unit, context, visibleHexes);
  if (!nearest) return null;

  switch (unit.attackDirective) {
    case 'shoot-on-sight':
    case 'hunt':       // temporary: same as shoot-on-sight until vision gating
    case 'skirmish':   // temporary: same as shoot-on-sight until combat timeline
      if (canAttack(unit, nearest, visibleHexes)) return { type: 'attack', targetUnitId: nearest.id };
      return null;
    case 'retreat-on-contact': {
      // Enemy in detection range -> flee toward deployment zone
      const nearestEnemy = findNearestEnemy(unit, context);
      if (nearestEnemy && cubeDistance(unit.position, nearestEnemy.position) <= context.unitStats[unit.type].visionRange) {
        return retreatFrom(unit, context, nearestEnemy);
      }
      return null;
    }
  }
}

// -----------------------------------------------------------------------------
// Directive Implementations
// -----------------------------------------------------------------------------

function executeAdvance(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = resolveAttackBehavior(unit, context);
  if (attackAction) return attackAction;

  const resolved = resolveTarget(unit, context);
  return moveToward(unit, context, resolved.hex);
}

function executeHold(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = resolveAttackBehavior(unit, context);
  if (attackAction) return attackAction;

  const resolved = resolveTarget(unit, context);
  if (unit.directiveTarget.type !== 'central-objective') {
    const dist = cubeDistance(unit.position, resolved.hex);
    if (dist > 1) return moveToward(unit, context, resolved.hex);
  }

  return { type: 'hold' };
}

function executeFlank(
  unit: Unit,
  context: DirectiveContext,
  side: 'left' | 'right',
): UnitAction {
  const attackAction = resolveAttackBehavior(unit, context);
  if (attackAction) return attackAction;

  const resolved = resolveTarget(unit, context);
  const objective = resolved.hex;
  const mapDiameter = context.mapRadius * 2;
  const flankOffset = Math.max(2, Math.floor(mapDiameter * 0.25));

  // Vector from unit to objective
  const dq = objective.q - unit.position.q;
  const dr = objective.r - unit.position.r;

  // Perpendicular in cube coords: rotate 60 degrees left or right
  // Left rotation: (q,r,s) -> (-r,-s,-q)
  // Right rotation: (q,r,s) -> (-s,-q,-r)
  const ds = -dq - dr;
  let pq: number, pr: number;
  if (side === 'left') {
    pq = -dr; pr = -ds;
  } else {
    pq = -ds; pr = -dq;
  }

  // Normalize perpendicular to unit length, scale by flankOffset
  const len = Math.max(Math.abs(pq), Math.abs(pr), Math.abs(pq + pr)) || 1;
  const scale = flankOffset / len;

  // Validate waypoint is on map, fall back to progressively closer offsets
  let intermediateTarget: CubeCoord = objective;
  for (let f = 1.0; f >= 0.25; f -= 0.25) {
    const cq = Math.round(objective.q + pq * scale * f);
    const cr = Math.round(objective.r + pr * scale * f);
    const candidate = createHex(cq, cr);
    if (context.terrain.has(hexToKey(candidate))) {
      intermediateTarget = candidate;
      break;
    }
  }

  return moveToward(unit, context, intermediateTarget);
}

function executeScout(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = resolveAttackBehavior(unit, context);
  if (attackAction) return attackAction;

  // Check for adjacent enemies (distance 1) — scout-specific retreat behavior
  const nearestEnemy = findNearestEnemy(unit, context);
  if (nearestEnemy && cubeDistance(unit.position, nearestEnemy.position) === 1) {
    // Retreat: move to neighbor hex that maximizes distance from nearest enemy
    return retreatFrom(unit, context, nearestEnemy);
  }

  if (unit.directiveTarget.type !== 'central-objective') {
    const resolved = resolveTarget(unit, context);
    const dist = cubeDistance(unit.position, resolved.hex);
    if (dist <= 2) return { type: 'hold' };
    return moveToward(unit, context, resolved.hex);
  }

  // Move toward hex farthest from all friendly units (explore new territory)
  return scoutExplore(unit, context);
}

function executeSupport(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = resolveAttackBehavior(unit, context);
  if (attackAction) return attackAction;

  if (unit.directiveTarget.type === 'friendly-unit') {
    const resolved = resolveTarget(unit, context);
    const dist = cubeDistance(unit.position, resolved.hex);
    if (dist <= 2) return { type: 'hold' };
    return moveToward(unit, context, resolved.hex);
  }

  if (unit.directiveTarget.type !== 'central-objective') {
    const resolved = resolveTarget(unit, context);
    const dist = cubeDistance(unit.position, resolved.hex);
    if (dist <= 1) return { type: 'hold' };
    return moveToward(unit, context, resolved.hex);
  }

  // Default: original behavior
  const nearbyFriendly = findNearestFriendly(unit, context, 3);
  if (!nearbyFriendly) {
    const anyFriendly = findNearestFriendly(unit, context, Infinity);
    if (!anyFriendly) return { type: 'hold' };
    return moveToward(unit, context, anyFriendly.position);
  }

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
 * Find the closest enemy in attack range. If tied on distance, prefer lower HP.
 */
function findClosestAttackableEnemy(unit: Unit, context: DirectiveContext, visibleHexes: Set<string>): Unit | null {
  const targets: { enemy: Unit; distance: number }[] = [];

  for (const enemy of context.enemyUnits) {
    if (canAttack(unit, enemy, visibleHexes)) {
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

  return targets[0]!.enemy;
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
  const occupied = buildOccupiedSet(unit, context);

  const path = findPath(
    unit.position,
    target,
    context.terrain,
    unit.type,
    occupied,
    unit.movementDirective,
    context.modifiers,
    context.elevation,
  );

  if (!path || path.length <= 1) {
    return { type: 'hold' };
  }

  // Walk path spending movement budget (cost-based, not step-based)
  let costBudget = context.unitStats[unit.type].moveRange;
  let lastValidIndex = 0;
  for (let i = 1; i < path.length; i++) {
    const prevKey = hexToKey(path[i - 1]!);
    const curKey = hexToKey(path[i]!);
    const terrain = context.terrain.get(curKey);
    if (!terrain) break;
    const stepCost = getMoveCost(
      terrain, unit.type, unit.movementDirective,
      context.modifiers.get(curKey),
      context.elevation.get(prevKey),
      context.elevation.get(curKey),
    );
    if (stepCost === Infinity) break;
    costBudget -= stepCost;
    if (costBudget < 0) break;
    lastValidIndex = i;
  }
  if (lastValidIndex === 0) return { type: 'hold' };
  return { type: 'move', targetHex: path[lastValidIndex]! };
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
 * Find the nearest enemy city (not owned by the unit's owner).
 */
function findNearestEnemyCity(
  unit: Unit,
  context: DirectiveContext,
): { key: string; hex: CubeCoord } | null {
  let nearest: { key: string; hex: CubeCoord } | null = null;
  let nearestDist = Infinity;
  for (const [key, owner] of context.cities) {
    if (owner === unit.owner) continue;
    const [qStr, rStr] = key.split(',');
    const hex = createHex(Number(qStr), Number(rStr));
    const dist = cubeDistance(unit.position, hex);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = { key, hex };
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
  const fallbackVisible = calculateVisibility([unit], context.terrain, context.elevation);
  const enemy = findClosestAttackableEnemy(unit, context, fallbackVisible);
  if (enemy) return { type: 'attack', targetUnitId: enemy.id };

  return { type: 'hold' };
}

/**
 * Scout exploration: move toward the hex farthest from all friendly units.
 * This pushes the scout into unexplored territory.
 */
function scoutExplore(unit: Unit, context: DirectiveContext): UnitAction {
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
    unit.movementDirective,
    context.modifiers,
    context.elevation,
  );

  if (!path || path.length <= 1) {
    return { type: 'hold' };
  }

  // Walk path spending movement budget (cost-based)
  let costBudget = context.unitStats[unit.type].moveRange;
  let lastValidIndex = 0;
  for (let i = 1; i < path.length; i++) {
    const prevKey = hexToKey(path[i - 1]!);
    const curKey = hexToKey(path[i]!);
    const terrain = context.terrain.get(curKey);
    if (!terrain) break;
    const stepCost = getMoveCost(
      terrain, unit.type, unit.movementDirective,
      context.modifiers.get(curKey),
      context.elevation.get(prevKey),
      context.elevation.get(curKey),
    );
    if (stepCost === Infinity) break;
    costBudget -= stepCost;
    if (costBudget < 0) break;
    lastValidIndex = i;
  }
  if (lastValidIndex === 0) return { type: 'hold' };
  return { type: 'move', targetHex: path[lastValidIndex]! };
}
