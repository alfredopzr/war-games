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
    directiveTarget: overrides.directiveTarget ?? { type: 'central-objective' },
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
    // recon (ATK=1) vs tank (DEF=3) on mountain (defMod=0.4), low roll
    const attacker = makeUnit({ type: 'recon', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'tank', owner: 'player2', position: adjacent });
    const damage = calculateDamage(attacker, defender, 'mountain', () => 0.85);
    expect(damage).toBeGreaterThanOrEqual(1);
  });

  it('tank vs infantry on plains, roll=1.0 => 6 damage', () => {
    // ATK=4, type mult tank->infantry=1.5, roll=1.0 => base=4*1.5*1.0=6.0
    // DEF=2, plains defMod=0 => final=max(1, floor(6 - 2*0))=6
    const attacker = makeUnit({ type: 'tank', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    const damage = calculateDamage(attacker, defender, 'plains', () => 1.0);
    expect(damage).toBe(6);
  });

  it('tank vs infantry in forest, roll=1.0 => 5 damage', () => {
    // base=6.0, DEF=2, forest defMod=0.25 => final=max(1, floor(6 - 2*0.25))=max(1,5)=5
    const attacker = makeUnit({ type: 'tank', owner: 'player1', position: origin });
    const defender = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent });
    const damage = calculateDamage(attacker, defender, 'forest', () => 1.0);
    expect(damage).toBe(5);
  });

  it('hold directive gives +1 effective DEF', () => {
    // Tank vs infantry on forest: normally DEF=2, terrainDef=0.25
    // Without hold: base=6.0, final=max(1, floor(6 - 2*0.25))=5
    // With hold: effectiveDef=3, final=max(1, floor(6 - 3*0.25))=max(1,5)=5
    // Let's use plains (defMod=0) to see the difference clearly:
    // Without hold: base=6, final=max(1,floor(6 - 2*0))=6
    // With hold: base=6, final=max(1,floor(6 - 3*0))=6 — still 6 on plains since terrainDef=0
    // Use forest: without hold = 5, with hold: max(1, floor(6 - 3*0.25)) = max(1,5)=5
    // Use city (defMod=0.3): without hold = max(1,floor(6-2*0.3))=max(1,5)=5
    //                         with hold = max(1,floor(6-3*0.3))=max(1,5)=5
    // Use forest (defMod=0.25) with rng=0.92:
    //   baseDamage = 4 * 1.5 * 0.92 = 5.52
    //   without hold = max(1,floor(5.52 - 2*0.25)) = floor(5.02) = 5
    //   with hold    = max(1,floor(5.52 - 3*0.25)) = floor(4.77) = 4
    const attacker = makeUnit({ type: 'tank', owner: 'player1', position: origin });
    const defenderNoHold = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent, movementDirective: 'advance' });
    const defenderHold = makeUnit({ type: 'infantry', owner: 'player2', position: adjacent, movementDirective: 'hold' });

    const damageNoHold = calculateDamage(attacker, defenderNoHold, 'forest', () => 0.92);
    const damageHold = calculateDamage(attacker, defenderHold, 'forest', () => 0.92);

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
