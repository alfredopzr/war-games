import { describe, it, expect } from 'vitest';
import type { Unit, CubeCoord } from './types';
import { calculateDamage, canAttack } from './combat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUnit(
  overrides: Partial<Unit> & Pick<Unit, 'type' | 'owner' | 'position'>,
): Unit {
  return {
    id: overrides.id ?? 'test-unit',
    type: overrides.type,
    owner: overrides.owner,
    hp: overrides.hp ?? 10,
    position: overrides.position,
    movementDirective: overrides.movementDirective ?? 'advance',
    attackDirective: overrides.attackDirective ?? 'ignore',
    specialtyModifier: overrides.specialtyModifier ?? null,
    directiveTarget: overrides.directiveTarget ?? { type: 'hex', hex: overrides.position },
    hasActed: overrides.hasActed ?? false,
  };
}

const origin: CubeCoord = { q: 0, r: 0, s: 0 };
const adjacent: CubeCoord = { q: 1, r: 0, s: -1 };
const dist2: CubeCoord = { q: 2, r: 0, s: -2 };
const dist3: CubeCoord = { q: 3, r: 0, s: -3 };

// ---------------------------------------------------------------------------
// calculateDamage
// ---------------------------------------------------------------------------

describe('calculateDamage', () => {
  it('always deals at least 1 damage (weak attacker vs strong defender)', () => {
    // recon (ATK=7) vs tank (DEF=2) with 0.6× disadvantage, low roll
    // 7 * 0.6 * 0.85 * (1-0) - 2 = 3.57 - 2 = 1.57 → floor = 1
    const attacker = makeUnit({ type: 'recon', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'tank', owner: 'player2', position: adjacent });
    const damage = calculateDamage(attacker, defender, 'plains', () => 0.85);
    expect(damage).toBeGreaterThanOrEqual(1);
  });

  it('tank vs infantry on plains, roll=1.0 => 26 damage', () => {
    // ATK=14, type mult tank->infantry=2.0, roll=1.0
    // base=14*2.0*1.0=28, plains defMod=0 => final=floor(28*(1-0) - 2)=26
    const attacker = makeUnit({ type: 'tank', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    const damage = calculateDamage(attacker, defender, 'plains', () => 1.0);
    expect(damage).toBe(26);
  });

  it('tank vs infantry in forest, roll=1.0 => 19 damage', () => {
    // base=28, forest defMod=0.25 => final=floor(28*0.75 - 2)=floor(21-2)=19
    const attacker = makeUnit({ type: 'tank', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    const damage = calculateDamage(attacker, defender, 'forest', () => 1.0);
    expect(damage).toBe(19);
  });

  it('hold directive gives +1 effective DEF', () => {
    // Infantry (ATK=10) vs infantry (DEF=2) on forest (0.25), rng=0.92
    // base = 10 * 1.0 * 0.92 = 9.2
    // Without hold: floor(9.2 * 0.75 - 2) = floor(6.9 - 2) = floor(4.9) = 4
    // With hold (DEF=3): floor(9.2 * 0.75 - 3) = floor(6.9 - 3) = floor(3.9) = 3
    const attacker = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const defenderNoHold = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent, movementDirective: 'advance' });
    const defenderHold = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent, movementDirective: 'hold' });

    const damageNoHold = calculateDamage(attacker, defenderNoHold, 'forest', () => 0.92);
    const damageHold = calculateDamage(attacker, defenderHold, 'forest', () => 0.92);

    expect(damageNoHold).toBe(4);
    expect(damageHold).toBe(3);
    expect(damageHold).toBeLessThan(damageNoHold);
  });

  it('low roll (0.85) produces less damage than high roll (1.15)', () => {
    const attacker = makeUnit({ type: 'tank', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    const lowDamage = calculateDamage(attacker, defender, 'plains', () => 0.85);
    const highDamage = calculateDamage(attacker, defender, 'plains', () => 1.15);
    expect(lowDamage).toBeLessThan(highDamage);
  });
});

// ---------------------------------------------------------------------------
// canAttack
// ---------------------------------------------------------------------------

describe('canAttack', () => {
  it('returns true when target is in range (infantry range 1, distance 1)', () => {
    const attacker = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    expect(canAttack(attacker, defender)).toBe(true);
  });

  it('returns false when target is out of range (infantry range 1, distance 3)', () => {
    const attacker = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: dist3 });
    expect(canAttack(attacker, defender)).toBe(false);
  });

  it('artillery cannot attack adjacent (minRange 2, distance 1)', () => {
    const attacker = makeUnit({ type: 'artillery', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    expect(canAttack(attacker, defender)).toBe(false);
  });

  it('artillery CAN attack at range 2', () => {
    const attacker = makeUnit({ type: 'artillery', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: dist2 });
    expect(canAttack(attacker, defender)).toBe(true);
  });

  it('artillery CAN attack at range 3', () => {
    const attacker = makeUnit({ type: 'artillery', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: dist3 });
    expect(canAttack(attacker, defender)).toBe(true);
  });

  it('cannot attack own units (same owner)', () => {
    const attacker = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player1', position: adjacent });
    expect(canAttack(attacker, defender)).toBe(false);
  });

  it('rejects when visibleHexes provided and target hex not in set', () => {
    const attacker = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    const visibleHexes = new Set<string>(); // empty — can't see anything
    expect(canAttack(attacker, defender, visibleHexes)).toBe(false);
  });

  it('allows attack when visibleHexes provided and target hex is in set', () => {
    const attacker = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    const visibleHexes = new Set<string>(['1,0']); // defender's hex
    expect(canAttack(attacker, defender, visibleHexes)).toBe(true);
  });

  it('skips LoS check when visibleHexes not provided', () => {
    const attacker = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    // No visibleHexes arg — range-only check, should pass
    expect(canAttack(attacker, defender)).toBe(true);
  });
});
