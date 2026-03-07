import type { UnitType, UnitStats, Unit, PlayerId, CubeCoord, MovementDirective, AttackDirective, SpecialtyModifier, DirectiveTarget } from './types';
import {
  MOVE_DIVISOR_INFANTRY, MOVE_DIVISOR_TANK,
  MOVE_DIVISOR_ARTILLERY, MOVE_DIVISOR_RECON,
  VISION_DIVISOR_INFANTRY, VISION_DIVISOR_TANK,
  VISION_DIVISOR_ARTILLERY, VISION_DIVISOR_RECON,
} from './map-gen-params';
import balanceData from './balance.json';

// =============================================================================
// Unit Stats — derived from balance.json (single source of truth)
// Invariant: ATK = HP × 0.35, DEF = max(1, round(HP × 0.05))
// =============================================================================

/** Default stats used when no map is available. Overridden by scaledUnitStats(). */
export const UNIT_STATS: Record<UnitType, UnitStats> = Object.fromEntries(
  (Object.keys(balanceData.units) as UnitType[]).map((type) => [
    type,
    { type, ...balanceData.units[type] },
  ]),
) as Record<UnitType, UnitStats>;

const MOVE_DIVISORS: Record<UnitType, number> = {
  infantry: MOVE_DIVISOR_INFANTRY,
  tank: MOVE_DIVISOR_TANK,
  artillery: MOVE_DIVISOR_ARTILLERY,
  recon: MOVE_DIVISOR_RECON,
};

const VISION_DIVISORS: Record<UnitType, number> = {
  infantry: VISION_DIVISOR_INFANTRY,
  tank: VISION_DIVISOR_TANK,
  artillery: VISION_DIVISOR_ARTILLERY,
  recon: VISION_DIVISOR_RECON,
};

/**
 * Return a copy of UNIT_STATS with moveRange and visionRange scaled to the map diameter.
 * mapDiameter = 2 * mapRadius.
 */
export function scaledUnitStats(mapDiameter: number): Record<UnitType, UnitStats> {
  const result = {} as Record<UnitType, UnitStats>;
  for (const key of Object.keys(UNIT_STATS) as UnitType[]) {
    const base = UNIT_STATS[key];
    result[key] = {
      ...base,
      moveRange: Math.max(1, Math.floor(mapDiameter / MOVE_DIVISORS[key])),
      visionRange: Math.max(1, Math.floor(mapDiameter / VISION_DIVISORS[key])),
    };
  }
  return result;
}

// =============================================================================
// Unit Creation
// =============================================================================

let unitIdCounter = 0;

export function createUnit(
  type: UnitType,
  owner: PlayerId,
  position: CubeCoord,
  movementDirective: MovementDirective = 'advance',
  attackDirective: AttackDirective = 'ignore',
  specialtyModifier: SpecialtyModifier | null = null,
  directiveTarget: DirectiveTarget = { type: 'hex', hex: position },
): Unit {
  unitIdCounter += 1;
  return {
    id: `${owner}-${type}-${unitIdCounter}`,
    type,
    owner,
    hp: UNIT_STATS[type].maxHp,
    position,
    movementDirective,
    attackDirective,
    specialtyModifier,
    directiveTarget,
    hasActed: false,
  };
}

export function resetUnitIdCounter(): void {
  unitIdCounter = 0;
}

// =============================================================================
// Type Advantage Matrix — clean 4-unit RPS cycle from balance.json
// Cycle: Tank→Infantry→Recon→Artillery→Tank
// Each unit: one 2.0× counter, one 0.6× disadvantage, rest 1.0×
//
// OPEN: hunt attack directive — initiative modifiers and counter-fire
// eligibility undefined. Behaves as shoot-on-sight for current
// directive AI (resolveAttackBehavior). Will be specced when combat
// timeline (S3) is built. See ROADMAP.md OD list.
// =============================================================================

const TYPE_ADVANTAGE = balanceData.typeAdvantage as Record<UnitType, Record<UnitType, number>>;

export function getTypeAdvantage(attacker: UnitType, defender: UnitType): number {
  return TYPE_ADVANTAGE[attacker][defender];
}
