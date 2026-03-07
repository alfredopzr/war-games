import { describe, it, expect, beforeEach } from 'vitest';
import type { UnitType, CubeCoord, DirectiveTarget } from './types';
import { UNIT_STATS, createUnit, getTypeAdvantage, resetUnitIdCounter } from './units';

describe('UNIT_STATS', () => {
  it('infantry stats match design spec', () => {
    const s = UNIT_STATS.infantry;
    expect(s).toEqual({
      type: 'infantry',
      cost: 100,
      maxHp: 30,
      atk: 10,
      def: 2,
      moveRange: 3,
      attackRange: 1,
      minAttackRange: 1,
      visionRange: 3,
      canClimb: true,
      responseTime: 2,
    });
  });

  it('tank stats match design spec', () => {
    const s = UNIT_STATS.tank;
    expect(s).toEqual({
      type: 'tank',
      cost: 250,
      maxHp: 40,
      atk: 14,
      def: 2,
      moveRange: 4,
      attackRange: 1,
      minAttackRange: 1,
      visionRange: 3,
      canClimb: false,
      responseTime: 3,
    });
  });

  it('artillery stats match design spec', () => {
    const s = UNIT_STATS.artillery;
    expect(s).toEqual({
      type: 'artillery',
      cost: 200,
      maxHp: 20,
      atk: 10,
      def: 1,
      moveRange: 2,
      attackRange: 3,
      minAttackRange: 2,
      visionRange: 3,
      canClimb: false,
      responseTime: 4,
    });
  });

  it('recon stats match design spec', () => {
    const s = UNIT_STATS.recon;
    expect(s).toEqual({
      type: 'recon',
      cost: 100,
      maxHp: 20,
      atk: 7,
      def: 1,
      moveRange: 5,
      attackRange: 1,
      minAttackRange: 1,
      visionRange: 6,
      canClimb: true,
      responseTime: 1,
    });
  });
});

describe('createUnit', () => {
  const pos: CubeCoord = { q: 1, r: -1, s: 0 };

  beforeEach(() => {
    resetUnitIdCounter();
  });

  it('creates a unit with correct type, owner, and position', () => {
    const unit = createUnit('infantry', 'player1', pos);
    expect(unit.type).toBe('infantry');
    expect(unit.owner).toBe('player1');
    expect(unit.position).toEqual(pos);
  });

  it('sets hp to maxHp for the unit type', () => {
    const unit = createUnit('tank', 'player2', pos);
    expect(unit.hp).toBe(UNIT_STATS.tank.maxHp);
  });

  it('defaults movementDirective to advance', () => {
    const unit = createUnit('recon', 'player1', pos);
    expect(unit.movementDirective).toBe('advance');
  });

  it('defaults attackDirective to ignore', () => {
    const unit = createUnit('recon', 'player1', pos);
    expect(unit.attackDirective).toBe('ignore');
  });

  it('defaults specialtyModifier to null', () => {
    const unit = createUnit('recon', 'player1', pos);
    expect(unit.specialtyModifier).toBeNull();
  });

  it('accepts a custom movementDirective', () => {
    const unit = createUnit('infantry', 'player1', pos, 'hold');
    expect(unit.movementDirective).toBe('hold');
  });

  it('creates unit with default directiveTarget of own position', () => {
    const unit = createUnit('infantry', 'player1', pos);
    expect(unit.directiveTarget).toEqual({ type: 'hex', hex: pos });
  });

  it('creates unit with custom directiveTarget', () => {
    const target: DirectiveTarget = { type: 'hex', hex: { q: 5, r: 3, s: -8 } };
    const unit = createUnit('infantry', 'player1', pos, 'advance', 'ignore', null, target);
    expect(unit.directiveTarget).toEqual(target);
  });

  it('sets hasActed to false', () => {
    const unit = createUnit('artillery', 'player1', pos);
    expect(unit.hasActed).toBe(false);
  });

  it('generates unique IDs with incrementing counter', () => {
    const u1 = createUnit('infantry', 'player1', pos);
    const u2 = createUnit('infantry', 'player1', pos);
    const u3 = createUnit('tank', 'player2', pos);
    expect(u1.id).toBe('player1-infantry-1');
    expect(u2.id).toBe('player1-infantry-2');
    expect(u3.id).toBe('player2-tank-3');
  });
});

describe('getTypeAdvantage', () => {
  it('counter matchups are 2.0×', () => {
    expect(getTypeAdvantage('tank', 'infantry')).toBe(2.0);
    expect(getTypeAdvantage('infantry', 'recon')).toBe(2.0);
    expect(getTypeAdvantage('recon', 'artillery')).toBe(2.0);
    expect(getTypeAdvantage('artillery', 'tank')).toBe(2.0);
  });

  it('disadvantaged matchups are 0.6×', () => {
    expect(getTypeAdvantage('infantry', 'tank')).toBe(0.6);
    expect(getTypeAdvantage('recon', 'infantry')).toBe(0.6);
    expect(getTypeAdvantage('artillery', 'recon')).toBe(0.6);
    expect(getTypeAdvantage('tank', 'artillery')).toBe(0.6);
  });

  it('same type returns 1.0', () => {
    const types: UnitType[] = ['infantry', 'tank', 'artillery', 'recon'];
    for (const t of types) {
      expect(getTypeAdvantage(t, t)).toBe(1.0);
    }
  });

  it('non-cycle matchups are neutral 1.0×', () => {
    expect(getTypeAdvantage('infantry', 'artillery')).toBe(1.0);
    expect(getTypeAdvantage('artillery', 'infantry')).toBe(1.0);
    expect(getTypeAdvantage('tank', 'recon')).toBe(1.0);
    expect(getTypeAdvantage('recon', 'tank')).toBe(1.0);
  });
});

describe('resetUnitIdCounter', () => {
  it('resets IDs to start from 1 again', () => {
    const pos: CubeCoord = { q: 0, r: 0, s: 0 };
    createUnit('infantry', 'player1', pos);
    createUnit('infantry', 'player1', pos);
    resetUnitIdCounter();
    const unit = createUnit('infantry', 'player1', pos);
    expect(unit.id).toBe('player1-infantry-1');
  });
});
