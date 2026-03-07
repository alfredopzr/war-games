import { describe, it, expect, beforeEach } from 'vitest';
import type { UnitType, CubeCoord, DirectiveTarget } from './types';
import { UNIT_STATS, createUnit, getTypeAdvantage, resetUnitIdCounter } from './units';

describe('UNIT_STATS', () => {
  it('infantry stats match design spec', () => {
    const s = UNIT_STATS.infantry;
    expect(s).toEqual({
      type: 'infantry',
      cost: 100,
      maxHp: 3,
      atk: 2,
      def: 2,
      moveRange: 3,
      attackRange: 1,
      minAttackRange: 1,
      visionRange: 3,
    });
  });

  it('tank stats match design spec', () => {
    const s = UNIT_STATS.tank;
    expect(s).toEqual({
      type: 'tank',
      cost: 250,
      maxHp: 4,
      atk: 4,
      def: 3,
      moveRange: 4,
      attackRange: 1,
      minAttackRange: 1,
      visionRange: 3,
    });
  });

  it('artillery stats match design spec', () => {
    const s = UNIT_STATS.artillery;
    expect(s).toEqual({
      type: 'artillery',
      cost: 200,
      maxHp: 2,
      atk: 5,
      def: 1,
      moveRange: 2,
      attackRange: 3,
      minAttackRange: 2,
      visionRange: 3,
    });
  });

  it('recon stats match design spec', () => {
    const s = UNIT_STATS.recon;
    expect(s).toEqual({
      type: 'recon',
      cost: 100,
      maxHp: 2,
      atk: 1,
      def: 1,
      moveRange: 5,
      attackRange: 1,
      minAttackRange: 1,
      visionRange: 6,
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

  it('defaults directive to advance', () => {
    const unit = createUnit('recon', 'player1', pos);
    expect(unit.directive).toBe('advance');
  });

  it('accepts a custom directive', () => {
    const unit = createUnit('infantry', 'player1', pos, 'hold');
    expect(unit.directive).toBe('hold');
  });

  it('creates unit with default directiveTarget of central-objective', () => {
    const unit = createUnit('infantry', 'player1', pos);
    expect(unit.directiveTarget).toEqual({ type: 'central-objective' });
  });

  it('creates unit with custom directiveTarget', () => {
    const target: DirectiveTarget = { type: 'city', cityId: 'city-1' };
    const unit = createUnit('infantry', 'player1', pos, 'advance', target);
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
  it('tank vs infantry = 1.5', () => {
    expect(getTypeAdvantage('tank', 'infantry')).toBe(1.5);
  });

  it('infantry vs tank = 0.5', () => {
    expect(getTypeAdvantage('infantry', 'tank')).toBe(0.5);
  });

  it('recon vs artillery = 1.5', () => {
    expect(getTypeAdvantage('recon', 'artillery')).toBe(1.5);
  });

  it('same type returns 1.0', () => {
    const types: UnitType[] = ['infantry', 'tank', 'artillery', 'recon'];
    for (const t of types) {
      expect(getTypeAdvantage(t, t)).toBe(1.0);
    }
  });
});

describe('engineer', () => {
  it('has correct stats', () => {
    const stats = UNIT_STATS.engineer;
    expect(stats.cost).toBe(75);
    expect(stats.maxHp).toBe(2);
    expect(stats.atk).toBe(1);
    expect(stats.def).toBe(1);
    expect(stats.moveRange).toBe(3);
    expect(stats.attackRange).toBe(1);
    expect(stats.minAttackRange).toBe(1);
    expect(stats.visionRange).toBe(3);
  });

  it('is weak against all combat units', () => {
    expect(getTypeAdvantage('infantry', 'engineer')).toBe(1.5);
    expect(getTypeAdvantage('tank', 'engineer')).toBe(1.5);
    expect(getTypeAdvantage('artillery', 'engineer')).toBe(1.2);
    expect(getTypeAdvantage('recon', 'engineer')).toBe(1.2);
  });

  it('is weak when attacking combat units', () => {
    expect(getTypeAdvantage('engineer', 'infantry')).toBe(0.5);
    expect(getTypeAdvantage('engineer', 'tank')).toBe(0.3);
    expect(getTypeAdvantage('engineer', 'artillery')).toBe(0.8);
    expect(getTypeAdvantage('engineer', 'recon')).toBe(0.5);
    expect(getTypeAdvantage('engineer', 'engineer')).toBe(1.0);
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
