import { describe, it, expect } from 'vitest';
import { TERRAIN, getMoveCost, getDefenseModifier, getVisionBonus } from './terrain';
import type { TerrainType, UnitType } from './types';

describe('TERRAIN definitions', () => {
  it('plains has correct values', () => {
    expect(TERRAIN.plains).toEqual({
      type: 'plains',
      moveCost: 1,
      defenseModifier: 0,
      blocksLoS: false,
      infantryOnly: false,
    });
  });

  it('forest has correct values', () => {
    expect(TERRAIN.forest).toEqual({
      type: 'forest',
      moveCost: 2,
      defenseModifier: 0.25,
      blocksLoS: true,
      infantryOnly: false,
    });
  });

  it('mountain has correct values', () => {
    expect(TERRAIN.mountain).toEqual({
      type: 'mountain',
      moveCost: 3,
      defenseModifier: 0.4,
      blocksLoS: false,
      infantryOnly: true,
    });
  });

  it('city has correct values', () => {
    expect(TERRAIN.city).toEqual({
      type: 'city',
      moveCost: 1,
      defenseModifier: 0.3,
      blocksLoS: false,
      infantryOnly: false,
    });
  });
});

describe('getMoveCost', () => {
  it('returns Infinity for tank on mountain', () => {
    expect(getMoveCost('mountain', 'tank')).toBe(Infinity);
  });

  it('returns Infinity for artillery on mountain', () => {
    expect(getMoveCost('mountain', 'artillery')).toBe(Infinity);
  });

  it('returns Infinity for recon on mountain', () => {
    expect(getMoveCost('mountain', 'recon')).toBe(Infinity);
  });

  it('returns normal cost for infantry on mountain', () => {
    expect(getMoveCost('mountain', 'infantry')).toBe(3);
  });

  it('returns correct cost for all terrain/unit combos on non-infantry-only terrain', () => {
    const nonRestrictedTerrains: TerrainType[] = ['plains', 'forest', 'city'];
    const allUnits: UnitType[] = ['infantry', 'tank', 'artillery', 'recon'];

    for (const terrain of nonRestrictedTerrains) {
      for (const unit of allUnits) {
        expect(getMoveCost(terrain, unit)).toBe(TERRAIN[terrain].moveCost);
      }
    }
  });
});

describe('flank directive forest cost', () => {
  it('flank-left reduces forest cost to 1', () => {
    expect(getMoveCost('forest', 'infantry', 'flank-left')).toBe(1);
  });

  it('flank-right reduces forest cost to 1', () => {
    expect(getMoveCost('forest', 'tank', 'flank-right')).toBe(1);
  });

  it('non-flank directives keep forest cost at 2', () => {
    expect(getMoveCost('forest', 'infantry', 'advance')).toBe(2);
    expect(getMoveCost('forest', 'infantry', 'hold')).toBe(2);
    expect(getMoveCost('forest', 'infantry', 'scout')).toBe(2);
    expect(getMoveCost('forest', 'infantry', 'support')).toBe(2);
    expect(getMoveCost('forest', 'infantry')).toBe(2);
  });

  it('flank does not affect non-forest terrain', () => {
    expect(getMoveCost('plains', 'infantry', 'flank-left')).toBe(1);
    expect(getMoveCost('city', 'infantry', 'flank-right')).toBe(1);
    expect(getMoveCost('mountain', 'infantry', 'flank-left')).toBe(3);
  });
});

describe('getDefenseModifier', () => {
  it('plains gives 0 defense', () => {
    expect(getDefenseModifier('plains')).toBe(0);
  });

  it('forest gives 0.25 defense', () => {
    expect(getDefenseModifier('forest')).toBe(0.25);
  });

  it('mountain gives 0.4 defense', () => {
    expect(getDefenseModifier('mountain')).toBe(0.4);
  });

  it('city gives 0.3 defense', () => {
    expect(getDefenseModifier('city')).toBe(0.3);
  });
});

describe('getVisionBonus', () => {
  it('elevation 0 gives 0 bonus', () => {
    expect(getVisionBonus(0)).toBe(0);
  });

  it('elevation 1 gives +1 bonus', () => {
    expect(getVisionBonus(1)).toBe(1);
  });

  it('elevation 4 gives +2 bonus', () => {
    expect(getVisionBonus(4)).toBe(2);
  });

  it('elevation 9 gives +3 bonus', () => {
    expect(getVisionBonus(9)).toBe(3);
  });

  it('elevation 16 gives +4 bonus', () => {
    expect(getVisionBonus(16)).toBe(4);
  });

  it('elevation 20 gives +4 bonus', () => {
    expect(getVisionBonus(20)).toBe(4);
  });
});
