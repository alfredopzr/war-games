// =============================================================================
// HexWar — Resolution Pipeline (10-Phase Combat Timeline)
// =============================================================================
// Replaces the sequential executeTurn() pattern with a single resolveTurn()
// that processes both players simultaneously through 10 phases.
// Spec: docs/RESOLUTION_PIPELINE.md
// =============================================================================

import type {
  GameState,
  PlayerId,
  CubeCoord,
  Command,
  Unit,
  TurnIntent,
  Engagement,
  ApproachCategory,
  DirectiveContext,
  AttackDirective,
} from './types';
import { cubeDistance, hexToKey, hexNeighbors, CUBE_DIRECTIONS } from './hex';
import { canAttack, calculateDamage } from './combat';
import { calculateVisibility } from './vision';
import { findPath } from './pathfinding';
import { getMoveCost } from './terrain';
import { UNIT_STATS } from './units';
import { spendCommand } from './commands';
import { resolveTarget, computeFlankWaypoint } from './directives';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const INTERCEPT_CAP = 1;
const SKIRMISH_ATTACK_CAP = 1;

// Offensive ROEs that fire during intercept, initiative, and counter-fire
const OFFENSIVE_ROE: ReadonlySet<AttackDirective> = new Set([
  'shoot-on-sight', 'skirmish', 'hunt',
]);

// ROEs that stop movement on contact
const STOPS_ON_CONTACT: ReadonlySet<AttackDirective> = new Set([
  'shoot-on-sight', 'hunt',
]);

// -----------------------------------------------------------------------------
// Snapshot (Phase 1)
// -----------------------------------------------------------------------------

interface UnitSnapshot {
  readonly position: CubeCoord;
  readonly hp: number;
}

function takeSnapshot(state: GameState): Map<string, UnitSnapshot> {
  const snap = new Map<string, UnitSnapshot>();
  for (const player of Object.values(state.players)) {
    for (const unit of player.units) {
      snap.set(unit.id, { position: { ...unit.position }, hp: unit.hp });
    }
  }
  return snap;
}

// -----------------------------------------------------------------------------
// Approach Angle
// -----------------------------------------------------------------------------

/**
 * Find the index of the CUBE_DIRECTION closest to the given vector.
 * Used to snap arbitrary hex vectors to one of the 6 cardinal directions.
 */
function snapToDirection(v: CubeCoord): number {
  let bestIdx = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < CUBE_DIRECTIONS.length; i++) {
    const d = CUBE_DIRECTIONS[i]!;
    const dot = v.q * d.q + v.r * d.r + v.s * d.s;
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Compute the approach angle category between an attacker and a defender.
 * Uses the defender's facing direction and the vector from defender to attacker.
 *
 * Returns 'rear' if attacker is behind, 'flank' if to the side, 'front' if ahead.
 */
export function computeApproachAngle(
  attackerPos: CubeCoord,
  defenderPos: CubeCoord,
  defenderFacing: CubeCoord,
): ApproachCategory {
  // Vector from defender toward attacker
  const toAttacker: CubeCoord = {
    q: attackerPos.q - defenderPos.q,
    r: attackerPos.r - defenderPos.r,
    s: attackerPos.s - defenderPos.s,
  };

  const facingIdx = snapToDirection(defenderFacing);
  const approachIdx = snapToDirection(toAttacker);

  // Steps around the hex ring (0-3, since 6 directions wrap)
  const diff = Math.abs(facingIdx - approachIdx);
  const steps = Math.min(diff, 6 - diff);

  if (steps <= 1) return 'front';
  if (steps === 2) return 'flank';
  return 'rear'; // steps >= 3
}

// -----------------------------------------------------------------------------
// Facing Computation
// -----------------------------------------------------------------------------

/**
 * Compute a unit's facing direction for this tick.
 * - Moving units face their path direction
 * - Hold units face their directive target
 * - Fallback: face nearest enemy
 */
export function computeFacing(
  unit: Unit,
  path: CubeCoord[],
  targetHex: CubeCoord,
  enemyUnits: Unit[],
): CubeCoord {
  // Moving unit: face from current position toward first path step
  if (path.length >= 2) {
    const from = path[0]!;
    const to = path[1]!;
    const v: CubeCoord = { q: to.q - from.q, r: to.r - from.r, s: to.s - from.s };
    if (v.q !== 0 || v.r !== 0 || v.s !== 0) {
      return CUBE_DIRECTIONS[snapToDirection(v)]!;
    }
  }

  // Hold or empty path: face toward target
  const toTarget: CubeCoord = {
    q: targetHex.q - unit.position.q,
    r: targetHex.r - unit.position.r,
    s: targetHex.s - unit.position.s,
  };
  if (toTarget.q !== 0 || toTarget.r !== 0 || toTarget.s !== 0) {
    return CUBE_DIRECTIONS[snapToDirection(toTarget)]!;
  }

  // Fallback: face nearest enemy
  let nearestDist = Infinity;
  let nearestDir: CubeCoord = CUBE_DIRECTIONS[0]!;
  for (const enemy of enemyUnits) {
    const dist = cubeDistance(unit.position, enemy.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestDir = {
        q: enemy.position.q - unit.position.q,
        r: enemy.position.r - unit.position.r,
        s: enemy.position.s - unit.position.s,
      };
    }
  }
  return CUBE_DIRECTIONS[snapToDirection(nearestDir)]!;
}

// -----------------------------------------------------------------------------
// Movement Intent (Phase 2 helper)
// -----------------------------------------------------------------------------

interface MovementIntentResult {
  targetHex: CubeCoord;
  path: CubeCoord[];
  huntTargetId?: string;
  huntLockTurns?: number;
}

const HUNT_LOCK_MAX_TURNS = 4;

/**
 * Compute the movement-only intent for a unit.
 * Extracts just the path logic from the directive system without attack resolution.
 */
function computeMovementIntent(
  unit: Unit,
  context: DirectiveContext,
): MovementIntentResult {
  const resolved = resolveTarget(unit, context);
  let targetHex = resolved.hex;

  // Hunt lock-on resolution
  if (unit.attackDirective === 'hunt') {
    const huntResult = resolveHuntLockOn(unit, context);
    if (huntResult.targetHex) targetHex = huntResult.targetHex;

    // Write lock-on state back to unit for persistence across ticks
    unit.huntTargetId = huntResult.huntTargetId;
    unit.huntLockTurns = huntResult.huntLockTurns;

    if (unit.movementDirective === 'hold') {
      return { targetHex, path: [], huntTargetId: huntResult.huntTargetId, huntLockTurns: huntResult.huntLockTurns };
    }

    const occupied = buildOccupiedSet(unit, context);
    const path = findPath(
      unit.position, targetHex, context.terrain, unit.type,
      occupied, unit.movementDirective, context.modifiers, context.elevation,
    );
    return { targetHex, path: truncatePath(path, unit, context), huntTargetId: huntResult.huntTargetId, huntLockTurns: huntResult.huntLockTurns };
  }

  if (unit.movementDirective === 'hold') {
    return { targetHex, path: [] };
  }

  const occupied = buildOccupiedSet(unit, context);

  if (unit.movementDirective === 'flank-left' || unit.movementDirective === 'flank-right') {
    const side = unit.movementDirective === 'flank-left' ? 'left' : 'right';
    const waypoint = computeFlankWaypoint(
      unit.position, targetHex, side, context.mapRadius, context.terrain,
    );
    const path = findPath(
      unit.position, waypoint, context.terrain, unit.type,
      occupied, unit.movementDirective, context.modifiers, context.elevation,
    );
    return { targetHex, path: truncatePath(path, unit, context) };
  }

  if (unit.movementDirective === 'scout') {
    const dist = cubeDistance(unit.position, targetHex);
    if (dist <= 3) {
      const orbitPath = computeScoutOrbitStep(unit, targetHex, context);
      return { targetHex, path: orbitPath };
    }
    const path = findPath(
      unit.position, targetHex, context.terrain, unit.type,
      occupied, unit.movementDirective, context.modifiers, context.elevation,
    );
    return { targetHex, path: truncatePath(path, unit, context) };
  }

  // advance (default)
  const path = findPath(
    unit.position, targetHex, context.terrain, unit.type,
    occupied, unit.movementDirective, context.modifiers, context.elevation,
  );
  return { targetHex, path: truncatePath(path, unit, context) };
}

/**
 * Resolve hunt lock-on state for a unit with hunt ROE.
 */
function resolveHuntLockOn(
  unit: Unit,
  context: DirectiveContext,
): { targetHex: CubeCoord | null; huntTargetId?: string; huntLockTurns: number } {
  const visibility = calculateVisibility([unit], context.terrain, context.elevation, context.unitStats);

  // Check existing lock-on
  if (unit.huntTargetId) {
    const target = context.enemyUnits.find(e => e.id === unit.huntTargetId);

    if (!target) {
      // Target dead or gone — break lock-on
      return { targetHex: null, huntTargetId: undefined, huntLockTurns: 0 };
    }

    const targetVisible = visibility.has(hexToKey(target.position));

    if (targetVisible) {
      // Target visible — pursue, reset counter
      return { targetHex: target.position, huntTargetId: target.id, huntLockTurns: 0 };
    }

    // Target not visible — pursue last known position
    const lockTurns = (unit.huntLockTurns ?? 0) + 1;
    if (lockTurns >= HUNT_LOCK_MAX_TURNS) {
      // Timeout — break lock-on
      return { targetHex: null, huntTargetId: undefined, huntLockTurns: 0 };
    }

    // Arrived at last known position? Break lock-on
    if (hexToKey(unit.position) === hexToKey(target.position)) {
      return { targetHex: null, huntTargetId: undefined, huntLockTurns: 0 };
    }

    return { targetHex: target.position, huntTargetId: target.id, huntLockTurns: lockTurns };
  }

  // No existing lock-on — acquire new target
  let bestTarget: Unit | null = null;
  let bestDist = Infinity;

  for (const enemy of context.enemyUnits) {
    if (!visibility.has(hexToKey(enemy.position))) continue;
    const dist = cubeDistance(unit.position, enemy.position);
    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = enemy;
    }
  }

  if (bestTarget) {
    return { targetHex: bestTarget.position, huntTargetId: bestTarget.id, huntLockTurns: 0 };
  }

  // No visible enemies — no lock-on, use directive target
  return { targetHex: null, huntTargetId: undefined, huntLockTurns: 0 };
}

/**
 * Scout orbit step: pick the next walkable hex clockwise around targetHex
 * at radius 2-3. Reverse direction if blocked.
 */
function computeScoutOrbitStep(
  unit: Unit,
  targetHex: CubeCoord,
  context: DirectiveContext,
): CubeCoord[] {
  const occupied = buildOccupiedSet(unit, context);
  const currentDist = cubeDistance(unit.position, targetHex);

  // Generate ring of hexes at current distance from target (radius 2-3)
  const ringRadius = Math.max(2, Math.min(3, currentDist));
  const ringHexes: CubeCoord[] = [];

  // Walk ring clockwise: start from a known direction, step around
  let cursor: CubeCoord = { q: targetHex.q + ringRadius, r: targetHex.r - ringRadius, s: targetHex.s };
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < ringRadius; step++) {
      ringHexes.push(cursor);
      const dir = CUBE_DIRECTIONS[(side + 2) % 6]!;
      cursor = { q: cursor.q + dir.q, r: cursor.r + dir.r, s: cursor.s + dir.s };
    }
  }

  // Find the unit's current position in (or nearest to) the ring
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < ringHexes.length; i++) {
    const d = cubeDistance(unit.position, ringHexes[i]!);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  // Try clockwise first, then counter-clockwise
  for (const offset of [1, -1, 2, -2, 3]) {
    const idx = (bestIdx + offset + ringHexes.length) % ringHexes.length;
    const candidate = ringHexes[idx]!;
    const key = hexToKey(candidate);
    if (!context.terrain.has(key)) continue;
    if (occupied.has(key)) continue;

    const path = findPath(
      unit.position, candidate, context.terrain, unit.type,
      occupied, unit.movementDirective, context.modifiers, context.elevation,
    );
    return truncatePath(path, unit, context);
  }

  return []; // blocked — hold
}

/**
 * Walk a path spending movement cost budget. Returns the truncated path
 * (including the start hex).
 */
function truncatePath(
  path: CubeCoord[] | null,
  unit: Unit,
  context: DirectiveContext,
): CubeCoord[] {
  if (!path || path.length <= 1) return [];

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
  if (lastValidIndex === 0) return [];
  return path.slice(0, lastValidIndex + 1);
}

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

// -----------------------------------------------------------------------------
// Phase 2 — Intent Collection
// -----------------------------------------------------------------------------

function collectIntents(
  state: GameState,
  p1Commands: Command[],
  p2Commands: Command[],
): Map<string, TurnIntent> {
  const intents = new Map<string, TurnIntent>();

  // Apply CP commands (redirect only) for both players
  applyRedirects(state, 'player1', p1Commands);
  applyRedirects(state, 'player2', p2Commands);

  // Generate intents for all living units
  for (const playerId of ['player1', 'player2'] as PlayerId[]) {
    const player = state.players[playerId];
    const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
    const enemyUnits = state.players[enemyId].units;

    for (const unit of player.units) {
      const context: DirectiveContext = {
        friendlyUnits: [...player.units],
        enemyUnits: [...enemyUnits],
        terrain: state.map.terrain,
        elevation: state.map.elevation,
        modifiers: state.map.modifiers,
        centralObjective: state.map.centralObjective,
        cities: state.cityOwnership,
        unitStats: state.unitStats,
        mapRadius: state.map.mapRadius,
        deploymentZone: playerId === 'player1' ? state.map.player1Deployment : state.map.player2Deployment,
      };

      const moveResult = computeMovementIntent(unit, context);
      const facing = computeFacing(unit, moveResult.path, moveResult.targetHex, enemyUnits);

      intents.set(unit.id, {
        unitId: unit.id,
        owner: playerId,
        movementDirective: unit.movementDirective,
        attackDirective: unit.attackDirective,
        specialtyModifier: unit.specialtyModifier,
        targetHex: moveResult.targetHex,
        path: moveResult.path,
        facing,
        huntTargetId: moveResult.huntTargetId,
        huntLockTurns: moveResult.huntLockTurns,
      });
    }
  }

  return intents;
}

function applyRedirects(state: GameState, playerId: PlayerId, commands: Command[]): void {
  let commandPool = state.round.commandPool;
  const friendlyUnits = state.players[playerId].units;

  for (const command of commands) {
    const unit = friendlyUnits.find(u => u.id === command.unitId);
    if (!unit) continue;
    commandPool = spendCommand(commandPool, command);

    unit.movementDirective = command.newMovementDirective;
    unit.attackDirective = command.newAttackDirective;
    unit.specialtyModifier = command.newSpecialtyModifier;
    if (command.target) {
      unit.directiveTarget = command.target;
    }
  }

  state.round.commandPool = commandPool;
}

// -----------------------------------------------------------------------------
// Phase 3 — Movement
// -----------------------------------------------------------------------------

interface MovementState {
  /** Proposed final position per unit */
  proposedPositions: Map<string, CubeCoord>;
  /** Intercept engagements queued during movement */
  interceptEngagements: Engagement[];
  /** Track intercept cap usage per unit */
  interceptsUsed: Map<string, number>;
  /** Track skirmish shots fired per unit */
  skirmishShotsFired: Map<string, number>;
}

function resolveMovement(
  state: GameState,
  intents: Map<string, TurnIntent>,
  snapshot: Map<string, UnitSnapshot>,
  randomFn: () => number,
): MovementState {
  const allUnits = getAllUnits(state);
  const unitById = new Map<string, Unit>();
  for (const u of allUnits) unitById.set(u.id, u);

  const proposedPositions = new Map<string, CubeCoord>();
  const interceptEngagements: Engagement[] = [];
  const interceptsUsed = new Map<string, number>();
  const skirmishShotsFired = new Map<string, number>();

  // Step 1: Walk paths with intercept checks
  for (const [unitId, intent] of intents) {
    const unit = unitById.get(unitId);
    if (!unit) continue;

    if (intent.path.length <= 1) {
      // No movement — stay in place
      proposedPositions.set(unitId, { ...unit.position });
      continue;
    }

    let stoppedAt: CubeCoord = intent.path[0]!;
    let stopped = false;

    for (let step = 1; step < intent.path.length; step++) {
      const hex = intent.path[step]!;

      // Check for enemies that can intercept at this hex (using snapshot positions)
      for (const enemy of allUnits) {
        if (enemy.owner === unit.owner) continue;
        if (!OFFENSIVE_ROE.has(enemy.attackDirective)) continue;

        const enemySnap = snapshot.get(enemy.id);
        if (!enemySnap) continue;

        const dist = cubeDistance(enemySnap.position, hex);
        const stats = state.unitStats[enemy.type];
        if (dist < stats.minAttackRange || dist > stats.attackRange) continue;

        // Check intercept cap
        const used = interceptsUsed.get(enemy.id) ?? 0;
        if (used >= INTERCEPT_CAP) continue;

        interceptsUsed.set(enemy.id, used + 1);

        // Compute approach angle for this intercept
        const defenderFacing = intents.get(enemy.id)?.facing ?? CUBE_DIRECTIONS[0]!;
        const approach = computeApproachAngle(hex, enemySnap.position, defenderFacing);

        // Determine moving unit's response category
        let defenderResponse: 'engage' | 'skirmish' | 'flee' | 'none';
        if (STOPS_ON_CONTACT.has(unit.attackDirective)) {
          defenderResponse = 'engage';
        } else if (unit.attackDirective === 'skirmish') {
          defenderResponse = 'skirmish';
        } else if (unit.attackDirective === 'retreat-on-contact') {
          defenderResponse = 'flee';
        } else {
          defenderResponse = 'none';
        }

        // Calculate and apply passive intercept damage for flee/none responses
        const isPassiveHit = defenderResponse === 'flee' || defenderResponse === 'none';
        let interceptDamage = 0;
        if (isPassiveHit) {
          const defTerrain = state.map.terrain.get(hexToKey(hex)) ?? 'plains';
          const defMod = state.map.modifiers.get(hexToKey(hex));
          interceptDamage = calculateDamage(enemy, unit, defTerrain, randomFn, defMod);
          unit.hp -= interceptDamage;

          // Emit passive damage event
          state.pendingEvents.push({
            type: 'damage',
            actingPlayer: enemy.owner,
            phase: 'combat',
            attackerId: enemy.id,
            attackerType: enemy.type,
            attackerPosition: { ...enemySnap.position },
            defenderId: unit.id,
            defenderType: unit.type,
            defenderPosition: { ...hex },
            damage: interceptDamage,
            defenderHpAfter: unit.hp,
            defenderTerrain: defTerrain,
            response: 'none',
          });

          if (unit.hp <= 0) {
            state.pendingEvents.push({
              type: 'kill',
              actingPlayer: enemy.owner,
              phase: 'combat',
              attackerId: enemy.id,
              attackerType: enemy.type,
              attackerPosition: { ...enemySnap.position },
              defenderId: unit.id,
              defenderType: unit.type,
              defenderPosition: { ...hex },
              damage: interceptDamage,
              defenderTerrain: defTerrain,
            });
            removeUnit(state, unit);
            state.round.unitsKilledThisRound[enemy.owner] += 1;
            stopped = true;
            stoppedAt = hex;
            break;
          }
        }

        // Emit intercept event
        state.pendingEvents.push({
          type: 'intercept',
          actingPlayer: enemy.owner,
          phase: 'combat',
          attackerId: enemy.id,
          attackerType: enemy.type,
          defenderId: unit.id,
          defenderType: unit.type,
          hex,
          damage: isPassiveHit ? interceptDamage : 0,
          defenderResponse,
        });

        // For engage/skirmish responses, queue engagement for Phase 5 damage resolution
        if (!isPassiveHit) {
          interceptEngagements.push({
            attackerId: enemy.id,
            defenderId: unit.id,
            distance: dist,
            approachCategory: approach,
            isIntercept: true,
            responseTime: 0,
          });
        }

        // Moving unit's response
        if (STOPS_ON_CONTACT.has(unit.attackDirective)) {
          stoppedAt = intent.path[step - 1]!; // stop one hex before
          stopped = true;

          // Queue mutual engagement
          const unitFacing = intent.facing;
          const reverseApproach = computeApproachAngle(enemySnap.position, hex, unitFacing);
          interceptEngagements.push({
            attackerId: unit.id,
            defenderId: enemy.id,
            distance: dist,
            approachCategory: reverseApproach,
            isIntercept: true,
            responseTime: 0,
          });
          break;
        }

        if (unit.attackDirective === 'skirmish') {
          const shotsFired = skirmishShotsFired.get(unit.id) ?? 0;
          if (shotsFired < SKIRMISH_ATTACK_CAP) {
            skirmishShotsFired.set(unit.id, shotsFired + 1);
            const unitFacing = intent.facing;
            const reverseApproach = computeApproachAngle(enemySnap.position, hex, unitFacing);
            interceptEngagements.push({
              attackerId: unit.id,
              defenderId: enemy.id,
              distance: dist,
              approachCategory: reverseApproach,
              isIntercept: true,
              responseTime: 0,
            });
          }
          // Skirmish keeps moving
          stoppedAt = hex;
          continue;
        }

        if (unit.attackDirective === 'retreat-on-contact') {
          // Reverse movement — stop at previous hex
          stoppedAt = intent.path[step - 1]!;
          stopped = true;
          break;
        }

        // ignore: take the hit, keep moving
        stoppedAt = hex;
      }

      if (stopped) break;
      stoppedAt = hex;
    }

    proposedPositions.set(unitId, stoppedAt);
  }

  // Step 2 + 3: Collision resolution
  resolveCollisions(state, intents, proposedPositions);

  // Step 4: Apply positions and emit move events
  for (const [unitId, newPos] of proposedPositions) {
    const unit = unitById.get(unitId);
    if (!unit) continue;

    const oldPos = snapshot.get(unitId)?.position;
    if (!oldPos) continue;

    if (hexToKey(oldPos) !== hexToKey(newPos)) {
      unit.position = newPos;
      state.pendingEvents.push({
        type: 'move',
        actingPlayer: unit.owner,
        phase: 'movement',
        unitId: unit.id,
        unitType: unit.type,
        from: oldPos,
        to: newPos,
      });
    }
  }

  return { proposedPositions, interceptEngagements, interceptsUsed, skirmishShotsFired };
}

function resolveCollisions(
  state: GameState,
  intents: Map<string, TurnIntent>,
  proposedPositions: Map<string, CubeCoord>,
): void {
  // Build destination map: hex → [unitIds]
  const destMap = new Map<string, string[]>();
  for (const [unitId, pos] of proposedPositions) {
    const key = hexToKey(pos);
    const list = destMap.get(key) ?? [];
    list.push(unitId);
    destMap.set(key, list);
  }

  // Resolve conflicts
  for (const [, unitIds] of destMap) {
    if (unitIds.length <= 1) continue;

    // Determine faction groups
    const byOwner = new Map<PlayerId, string[]>();
    for (const uid of unitIds) {
      const intent = intents.get(uid)!;
      const list = byOwner.get(intent.owner) ?? [];
      list.push(uid);
      byOwner.set(intent.owner, list);
    }

    if (byOwner.size === 1) {
      // Same faction: higher moveRange wins, others stop one hex short
      const ids = unitIds;
      let bestId = ids[0]!;
      let bestRange = state.unitStats[intents.get(bestId)!.movementDirective === 'hold' ? 'infantry' : (getAllUnits(state).find(u => u.id === bestId)?.type ?? 'infantry')].moveRange;

      for (const uid of ids) {
        const unit = getAllUnits(state).find(u => u.id === uid);
        if (!unit) continue;
        const range = state.unitStats[unit.type].moveRange;
        if (range > bestRange) {
          bestRange = range;
          bestId = uid;
        }
      }

      // Winner keeps hex, others fall back
      for (const uid of ids) {
        if (uid === bestId) continue;
        const intent = intents.get(uid);
        if (intent && intent.path.length >= 2) {
          proposedPositions.set(uid, intent.path[intent.path.length - 2]!);
        }
      }
    } else {
      // Cross-faction: both stop one hex short
      for (const uid of unitIds) {
        const intent = intents.get(uid);
        if (intent && intent.path.length >= 2) {
          proposedPositions.set(uid, intent.path[intent.path.length - 2]!);
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Phase 4 — Engagement Detection
// -----------------------------------------------------------------------------

function detectEngagements(
  state: GameState,
  intents: Map<string, TurnIntent>,
  interceptEngagements: Engagement[],
): Engagement[] {
  const engagements: Engagement[] = [...interceptEngagements];
  const allUnits = getAllUnits(state);

  // Track pairs already engaged from intercepts
  const existingPairs = new Set<string>();
  for (const eng of interceptEngagements) {
    existingPairs.add(`${eng.attackerId}->${eng.defenderId}`);
  }

  for (const attacker of allUnits) {
    if (!OFFENSIVE_ROE.has(attacker.attackDirective)) continue;

    const attackerVis = calculateVisibility([attacker], state.map.terrain, state.map.elevation);

    for (const defender of allUnits) {
      if (defender.owner === attacker.owner) continue;
      if (!canAttack(attacker, defender, attackerVis)) continue;

      const pairKey = `${attacker.id}->${defender.id}`;
      if (existingPairs.has(pairKey)) continue;

      const defenderFacing = intents.get(defender.id)?.facing ?? CUBE_DIRECTIONS[0]!;
      const approach = computeApproachAngle(attacker.position, defender.position, defenderFacing);

      engagements.push({
        attackerId: attacker.id,
        defenderId: defender.id,
        distance: cubeDistance(attacker.position, defender.position),
        approachCategory: approach,
        isIntercept: false,
        responseTime: 0,
      });
    }
  }

  return engagements;
}

// -----------------------------------------------------------------------------
// Phase 5 — Initiative Fire
// -----------------------------------------------------------------------------

function resolveInitiativeFire(
  state: GameState,
  engagements: Engagement[],
  randomFn: () => number,
): void {
  const allUnits = getAllUnits(state);
  const unitById = new Map<string, Unit>();
  for (const u of allUnits) unitById.set(u.id, u);

  // Compute response times
  for (const eng of engagements) {
    const attacker = unitById.get(eng.attackerId);
    if (!attacker) { eng.responseTime = Infinity; continue; }

    let rt = state.unitStats[attacker.type].responseTime;

    // Approach angle modifiers
    if (eng.approachCategory === 'rear') rt -= 2;
    else if (eng.approachCategory === 'flank') rt -= 1;

    // Terrain modifiers
    const defender = unitById.get(eng.defenderId);
    if (defender) {
      const defenderTerrain = state.map.terrain.get(hexToKey(defender.position));
      const defenderElev = state.map.elevation.get(hexToKey(defender.position)) ?? 0;
      if (defenderTerrain === 'mountain' || defenderElev >= 3) rt += 1; // defender advantage: but modifier is on defender, so attacker gets +1 (slower)
      if (defenderTerrain === 'forest') rt += 1; // obscured target
    }

    // ROE modifiers
    if (attacker.attackDirective === 'shoot-on-sight' || attacker.attackDirective === 'hunt') {
      rt -= 0.5;
    } else if (attacker.attackDirective === 'skirmish') {
      rt -= 0.25;
    }

    eng.responseTime = rt;
  }

  // Sort by response time (lower fires first), tiebreak with RNG
  engagements.sort((a, b) => {
    if (a.responseTime !== b.responseTime) return a.responseTime - b.responseTime;
    return randomFn() - 0.5;
  });

  // Resolve
  const deadUnits = new Set<string>();

  for (const eng of engagements) {
    if (deadUnits.has(eng.attackerId)) continue;
    if (deadUnits.has(eng.defenderId)) continue;

    const attacker = unitById.get(eng.attackerId);
    const defender = unitById.get(eng.defenderId);
    if (!attacker || !defender) continue;
    if (attacker.hp <= 0 || defender.hp <= 0) continue;

    // Only offensive ROE fires in initiative
    if (!OFFENSIVE_ROE.has(attacker.attackDirective)) continue;

    const defenderTerrain = state.map.terrain.get(hexToKey(defender.position)) ?? 'plains';
    const defenderModifier = state.map.modifiers.get(hexToKey(defender.position));
    const damage = calculateDamage(attacker, defender, defenderTerrain, randomFn, defenderModifier);
    defender.hp -= damage;

    if (defender.hp <= 0) {
      state.pendingEvents.push({
        type: 'kill',
        actingPlayer: attacker.owner,
        phase: 'combat',
        attackerId: attacker.id,
        attackerType: attacker.type,
        attackerPosition: { ...attacker.position },
        defenderId: defender.id,
        defenderType: defender.type,
        defenderPosition: { ...defender.position },
        damage,
        defenderTerrain,
      });
      removeUnit(state, defender);
      deadUnits.add(defender.id);
      state.round.unitsKilledThisRound[attacker.owner] += 1;
    } else {
      state.pendingEvents.push({
        type: 'damage',
        actingPlayer: attacker.owner,
        phase: 'combat',
        attackerId: attacker.id,
        attackerType: attacker.type,
        attackerPosition: { ...attacker.position },
        defenderId: defender.id,
        defenderType: defender.type,
        defenderPosition: { ...defender.position },
        damage,
        defenderHpAfter: defender.hp,
        defenderTerrain,
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Phase 6 — Counter Fire
// -----------------------------------------------------------------------------

function resolveCounterFire(
  state: GameState,
  engagements: Engagement[],
  randomFn: () => number,
): void {
  const allUnits = getAllUnits(state);
  const unitById = new Map<string, Unit>();
  for (const u of allUnits) unitById.set(u.id, u);

  // Find defenders that were targeted and survived, with offensive ROE
  const counterEngagements: Engagement[] = [];
  const targeted = new Map<string, string>(); // defenderId → attackerId

  for (const eng of engagements) {
    // Record who attacked whom
    if (!targeted.has(eng.defenderId)) {
      targeted.set(eng.defenderId, eng.attackerId);
    }
  }

  for (const [defenderId, attackerId] of targeted) {
    const defender = unitById.get(defenderId);
    const attacker = unitById.get(attackerId);
    if (!defender || !attacker) continue;
    if (defender.hp <= 0 || attacker.hp <= 0) continue;
    if (!OFFENSIVE_ROE.has(defender.attackDirective)) continue;

    // Check still in range
    const dist = cubeDistance(defender.position, attacker.position);
    const stats = state.unitStats[defender.type];
    if (dist < stats.minAttackRange || dist > stats.attackRange) continue;

    counterEngagements.push({
      attackerId: defenderId,
      defenderId: attackerId,
      distance: dist,
      approachCategory: 'front', // counter-fire is always "facing the attacker"
      isIntercept: false,
      responseTime: state.unitStats[defender.type].responseTime,
    });
  }

  // Sort counter-fire by response time
  counterEngagements.sort((a, b) => {
    if (a.responseTime !== b.responseTime) return a.responseTime - b.responseTime;
    return randomFn() - 0.5;
  });

  for (const eng of counterEngagements) {
    const attacker = unitById.get(eng.attackerId);
    const defender = unitById.get(eng.defenderId);
    if (!attacker || !defender) continue;
    if (attacker.hp <= 0 || defender.hp <= 0) continue;

    const defenderTerrain = state.map.terrain.get(hexToKey(defender.position)) ?? 'plains';
    const defenderModifier = state.map.modifiers.get(hexToKey(defender.position));
    const damage = calculateDamage(attacker, defender, defenderTerrain, randomFn, defenderModifier);
    defender.hp -= damage;

    if (defender.hp <= 0) {
      state.pendingEvents.push({
        type: 'kill',
        actingPlayer: attacker.owner,
        phase: 'combat',
        attackerId: attacker.id,
        attackerType: attacker.type,
        attackerPosition: { ...attacker.position },
        defenderId: defender.id,
        defenderType: defender.type,
        defenderPosition: { ...defender.position },
        damage,
        defenderTerrain,
      });
      removeUnit(state, defender);
      state.round.unitsKilledThisRound[attacker.owner] += 1;
    } else {
      state.pendingEvents.push({
        type: 'counter',
        actingPlayer: attacker.owner,
        phase: 'combat',
        attackerId: attacker.id,
        attackerType: attacker.type,
        defenderId: defender.id,
        defenderType: defender.type,
        damage,
        defenderHpAfter: defender.hp,
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Phase 7 — Melee (stub, OD-1)
// -----------------------------------------------------------------------------

function resolveMelee(
  _state: GameState,
  _engagements: Engagement[],
): void {
  // Deferred: OD-1 — needs numeric meleeRating values
}

// -----------------------------------------------------------------------------
// Phase 8 — Directive Effects
// -----------------------------------------------------------------------------

function resolveDirectiveEffects(
  state: GameState,
  intents: Map<string, TurnIntent>,
): void {
  for (const playerId of ['player1', 'player2'] as PlayerId[]) {
    const units = state.players[playerId].units;
    const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';

    for (const unit of units) {
      // Support specialty: heal adjacent friendly with lowest HP
      if (unit.specialtyModifier === 'support') {
        const neighbors = hexNeighbors(unit.position);
        const neighborKeys = new Set(neighbors.map(hexToKey));
        let bestTarget: Unit | null = null;
        let lowestHp = Infinity;

        for (const friendly of units) {
          if (friendly.id === unit.id) continue;
          if (!neighborKeys.has(hexToKey(friendly.position))) continue;
          const stats = UNIT_STATS[friendly.type];
          if (friendly.hp < stats.maxHp && friendly.hp < lowestHp) {
            lowestHp = friendly.hp;
            bestTarget = friendly;
          }
        }

        if (bestTarget) {
          bestTarget.hp += 1;
          state.pendingEvents.push({
            type: 'heal',
            actingPlayer: playerId,
            phase: 'combat',
            healerId: unit.id,
            healerType: unit.type,
            targetId: bestTarget.id,
            targetType: bestTarget.type,
            healAmount: 1,
            targetHpAfter: bestTarget.hp,
          });
        }
      }

      // Scout reveal
      const intent = intents.get(unit.id);
      if (intent && intent.movementDirective === 'scout') {
        const visibility = calculateVisibility([unit], state.map.terrain, state.map.elevation, state.unitStats);
        const enemyUnits = state.players[enemyId].units;
        const revealedHexes: CubeCoord[] = [];

        for (const enemy of enemyUnits) {
          if (visibility.has(hexToKey(enemy.position))) {
            revealedHexes.push({ ...enemy.position });
          }
        }

        if (revealedHexes.length > 0) {
          state.pendingEvents.push({
            type: 'reveal',
            actingPlayer: playerId,
            phase: 'combat',
            unitId: unit.id,
            unitType: unit.type,
            hexes: revealedHexes,
          });
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Phase 9 — Territory Resolution
// -----------------------------------------------------------------------------

function resolveTerritoryPhase(state: GameState): void {
  const allUnits = [...state.players.player1.units, ...state.players.player2.units];
  const unitByHex = new Map<string, Unit>();
  for (const unit of allUnits) {
    unitByHex.set(hexToKey(unit.position), unit);
  }

  for (const cityKey of state.cityOwnership.keys()) {
    const unit = unitByHex.get(cityKey);
    if (unit) {
      const currentOwner = state.cityOwnership.get(cityKey);
      if (currentOwner !== unit.owner) {
        state.cityOwnership.set(cityKey, unit.owner);

        if (currentOwner === null) {
          state.pendingEvents.push({
            type: 'capture',
            actingPlayer: unit.owner,
            phase: 'capture',
            unitId: unit.id,
            unitType: unit.type,
            cityKey,
            previousOwner: null,
          });
        } else {
          state.pendingEvents.push({
            type: 'recapture',
            actingPlayer: unit.owner,
            phase: 'capture',
            unitId: unit.id,
            unitType: unit.type,
            cityKey,
            previousOwner: currentOwner as PlayerId,
          });
        }

        const captureCost = Math.ceil(state.unitStats[unit.type].maxHp * 0.1);
        unit.hp -= captureCost;
        if (unit.hp <= 0) {
          state.pendingEvents.push({
            type: 'capture-death',
            actingPlayer: unit.owner,
            phase: 'capture',
            unitId: unit.id,
            unitType: unit.type,
            cityKey,
            captureCost,
          });
          removeUnit(state, unit);
        } else {
          state.pendingEvents.push({
            type: 'capture-damage',
            actingPlayer: unit.owner,
            phase: 'capture',
            unitId: unit.id,
            unitType: unit.type,
            cityKey,
            captureCost,
            hpAfter: unit.hp,
          });
        }
      }
      // Auto-hold after capture
      if (unit.directiveTarget.type === 'city' && unit.directiveTarget.cityId === cityKey) {
        unit.movementDirective = 'hold';
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Phase 10 — Round End Check
// -----------------------------------------------------------------------------

function resolveRoundEnd(state: GameState): void {
  // Update objective tracking
  const objectiveKey = hexToKey(state.map.centralObjective);
  const allUnits = [...state.players.player1.units, ...state.players.player2.units];

  const unitOnObjective = allUnits.find(u => hexToKey(u.position) === objectiveKey);
  const previousOccupier = state.round.objective.occupiedBy;

  if (!unitOnObjective) {
    if (previousOccupier !== null) {
      state.pendingEvents.push({
        type: 'objective-change',
        actingPlayer: previousOccupier,
        phase: 'objective',
        objectiveHex: state.map.centralObjective,
        previousOccupier,
        newOccupier: null,
      });
    }
    state.round.objective = { occupiedBy: null, turnsHeld: 0 };
  } else {
    const occupier = unitOnObjective.owner;
    const citiesHeld = countCitiesHeld(state, occupier);

    if (state.round.objective.occupiedBy === occupier) {
      if (citiesHeld >= 2) {
        state.round.objective.turnsHeld += 1;
        state.pendingEvents.push({
          type: 'koth-progress',
          actingPlayer: occupier,
          phase: 'objective',
          occupier,
          turnsHeld: state.round.objective.turnsHeld,
          citiesHeld,
        });
      } else {
        state.round.objective.turnsHeld = 0;
      }
    } else {
      state.pendingEvents.push({
        type: 'objective-change',
        actingPlayer: occupier,
        phase: 'objective',
        objectiveHex: state.map.centralObjective,
        previousOccupier,
        newOccupier: occupier,
        unitId: unitOnObjective.id,
        unitType: unitOnObjective.type,
      });
      state.round.objective = { occupiedBy: occupier, turnsHeld: citiesHeld >= 2 ? 1 : 0 };
      if (citiesHeld >= 2) {
        state.pendingEvents.push({
          type: 'koth-progress',
          actingPlayer: occupier,
          phase: 'objective',
          occupier,
          turnsHeld: 1,
          citiesHeld,
        });
      }
    }
  }

  // Increment turn counters
  state.round.turnsPlayed += 1;
  state.round.turnNumber += 1;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getAllUnits(state: GameState): Unit[] {
  return [...state.players.player1.units, ...state.players.player2.units];
}

function removeUnit(state: GameState, unit: Unit): void {
  const units = state.players[unit.owner].units;
  const idx = units.findIndex(u => u.id === unit.id);
  if (idx !== -1) units.splice(idx, 1);
}

function countCitiesHeld(state: GameState, playerId: PlayerId): number {
  let count = 0;
  for (const owner of state.cityOwnership.values()) {
    if (owner === playerId) count += 1;
  }
  return count;
}

/**
 * Clear hunt lock-on for any unit whose target was killed this tick.
 */
function cleanupHuntLockOns(state: GameState): void {
  const allLiving = new Set<string>();
  for (const player of Object.values(state.players)) {
    for (const unit of player.units) {
      allLiving.add(unit.id);
    }
  }

  for (const player of Object.values(state.players)) {
    for (const unit of player.units) {
      if (unit.huntTargetId && !allLiving.has(unit.huntTargetId)) {
        unit.huntTargetId = undefined;
        unit.huntLockTurns = 0;
      }
    }
  }
}

// -----------------------------------------------------------------------------
// resolveTurn — Public API
// -----------------------------------------------------------------------------

/**
 * Process both players' commands through the 10-phase combat timeline.
 * Mutates state in place. Events accumulate in state.pendingEvents.
 *
 * Replaces the old pattern of calling executeTurn() twice (once per player).
 */
export function resolveTurn(
  state: GameState,
  p1Commands: Command[],
  p2Commands: Command[],
  randomFn: () => number,
): void {
  state.pendingEvents = [];

  // Phase 1: Snapshot
  const snapshot = takeSnapshot(state);

  // Phase 2: Intent Collection
  const intents = collectIntents(state, p1Commands, p2Commands);

  // Phase 3: Movement
  const movementResult = resolveMovement(state, intents, snapshot, randomFn);

  // Phase 4: Engagement Detection
  const engagements = detectEngagements(state, intents, movementResult.interceptEngagements);

  // Phase 5: Initiative Fire
  resolveInitiativeFire(state, engagements, randomFn);

  // Phase 6: Counter Fire
  resolveCounterFire(state, engagements, randomFn);

  // Post-combat: clear hunt lock-on for dead targets
  cleanupHuntLockOns(state);

  // Phase 7: Melee (deferred)
  resolveMelee(state, engagements);

  // Phase 8: Directive Effects
  resolveDirectiveEffects(state, intents);

  // Phase 9: Territory
  resolveTerritoryPhase(state);

  // Phase 10: Round End
  resolveRoundEnd(state);
}
