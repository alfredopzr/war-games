import type { UnitType, UnitStats, Unit, PlayerId, CubeCoord, DirectiveType, DirectiveTarget } from './types';

// =============================================================================
// Unit Stats — design spec values for all 4 MVP unit types
// =============================================================================

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: {
    type: 'infantry',
    cost: 100,
    maxHp: 3,
    atk: 2,
    def: 2,
    moveRange: 3,
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 3,
  },
  tank: {
    type: 'tank',
    cost: 250,
    maxHp: 4,
    atk: 4,
    def: 3,
    moveRange: 4,
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 3,
  },
  artillery: {
    type: 'artillery',
    cost: 200,
    maxHp: 2,
    atk: 5,
    def: 1,
    moveRange: 2,
    attackRange: 3,
    minAttackRange: 2,
    visionRange: 3,
  },
  recon: {
    type: 'recon',
    cost: 100,
    maxHp: 2,
    atk: 1,
    def: 1,
    moveRange: 5,
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 6,
  },
  engineer: {
    type: 'engineer',
    cost: 75,
    maxHp: 2,
    atk: 1,
    def: 1,
    moveRange: 3,
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 3,
  },
} as const;

// =============================================================================
// Unit Creation
// =============================================================================

let unitIdCounter = 0;

export function createUnit(
  type: UnitType,
  owner: PlayerId,
  position: CubeCoord,
  directive: DirectiveType = 'advance',
  directiveTarget: DirectiveTarget = { type: 'central-objective' },
): Unit {
  unitIdCounter += 1;
  return {
    id: `${owner}-${type}-${unitIdCounter}`,
    type,
    owner,
    hp: UNIT_STATS[type].maxHp,
    position,
    directive,
    directiveTarget,
    hasActed: false,
  };
}

export function resetUnitIdCounter(): void {
  unitIdCounter = 0;
}

// =============================================================================
// Type Advantage Matrix
// =============================================================================

const TYPE_ADVANTAGE: Record<UnitType, Record<UnitType, number>> = {
  infantry:  { infantry: 1.0, tank: 0.5, artillery: 1.2, recon: 1.0, engineer: 1.5 },
  tank:      { infantry: 1.5, tank: 1.0, artillery: 1.2, recon: 1.5, engineer: 1.5 },
  artillery: { infantry: 1.3, tank: 1.3, artillery: 1.0, recon: 1.3, engineer: 1.2 },
  recon:     { infantry: 0.8, tank: 0.3, artillery: 1.5, recon: 1.0, engineer: 1.2 },
  engineer:  { infantry: 0.5, tank: 0.3, artillery: 0.8, recon: 0.5, engineer: 1.0 },
};

export function getTypeAdvantage(attacker: UnitType, defender: UnitType): number {
  return TYPE_ADVANTAGE[attacker][defender];
}
