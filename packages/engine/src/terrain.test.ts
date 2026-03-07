import { describe, it, expect } from 'vitest';
import { TERRAIN, getMoveCost, getDefenseModifier, getVisionBonus } from './terrain';
import type { TerrainType, UnitType } from './types';

describe('TERRAIN definitions', () => {
  it('plains has correct values', () => {
    expect(TERRAIN.plains).toEqual({
      type: 'plains',
      moveCost: 1,
      defenseModifier: 0,
    });
  });

  it('forest has correct values', () => {
    expect(TERRAIN.forest).toEqual({
      type: 'forest',
      moveCost: 2,
      defenseModifier: 0.25,
    });
  });

  it('mountain has correct values', () => {
    expect(TERRAIN.mountain).toEqual({
      type: 'mountain',
      moveCost: 1,
      defenseModifier: 0,
    });
  });

  it('city has correct values', () => {
    expect(TERRAIN.city).toEqual({
      type: 'city',
      moveCost: 1,
      defenseModifier: 0,
    });
  });
});

describe('getMoveCost', () => {
  it('returns base cost when no elevation provided', () => {
    expect(getMoveCost('mountain', 'infantry')).toBe(1);
    expect(getMoveCost('mountain', 'tank')).toBe(1);
    expect(getMoveCost('plains', 'infantry')).toBe(1);
  });

  it('adds climb cost for uphill movement', () => {
    // delta=2, cost = 1 (plains) + 2*0.5 = 2
    expect(getMoveCost('plains', 'infantry', undefined, undefined, 0, 2)).toBe(2);
  });

  it('blocks non-climbers above CLIMB_THRESHOLD', () => {
    // delta=4 > threshold=3, tank canClimb=false
    expect(getMoveCost('plains', 'tank', undefined, undefined, 0, 4)).toBe(Infinity);
    expect(getMoveCost('plains', 'artillery', undefined, undefined, 0, 4)).toBe(Infinity);
  });

  it('allows climbers above CLIMB_THRESHOLD', () => {
    // delta=4, infantry canClimb=true, cost = 1 + 4*0.5 = 3
    expect(getMoveCost('plains', 'infantry', undefined, undefined, 0, 4)).toBe(3);
    expect(getMoveCost('plains', 'recon', undefined, undefined, 0, 4)).toBe(3);
  });

  it('downhill is free by default (DOWNHILL_COST_MULT=0)', () => {
    // Going from elev 5 to elev 0 — only base terrain cost
    expect(getMoveCost('plains', 'tank', undefined, undefined, 5, 0)).toBe(1);
  });

  it('returns correct cost for all terrain/unit combos on flat ground', () => {
    const allTerrains: TerrainType[] = ['plains', 'forest', 'city', 'mountain'];
    const allUnits: UnitType[] = ['infantry', 'tank', 'artillery', 'recon'];

    for (const terrain of allTerrains) {
      for (const unit of allUnits) {
        // No elevation = base terrain cost
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
    expect(getMoveCost('forest', 'infantry', 'patrol')).toBe(2);
    expect(getMoveCost('forest', 'infantry')).toBe(2);
  });

  it('flank does not affect non-forest terrain', () => {
    expect(getMoveCost('plains', 'infantry', 'flank-left')).toBe(1);
    expect(getMoveCost('city', 'infantry', 'flank-right')).toBe(1);
    expect(getMoveCost('mountain', 'infantry', 'flank-left')).toBe(1);
  });
});

describe('elevation + terrain combined', () => {
  it('mountain terrain + steep uphill is expensive for climbers', () => {
    // mountain base cost 1 + delta 5 * 0.5 = 3.5
    expect(getMoveCost('mountain', 'infantry', undefined, undefined, 2, 7)).toBe(3.5);
  });

  it('highway bypasses elevation for vehicles (graded road)', () => {
    expect(getMoveCost('plains', 'tank', undefined, 'highway', 0, 4)).toBe(0.5);
    expect(getMoveCost('plains', 'tank', undefined, 'highway', 0, 0)).toBe(0.5);
  });

  it('bridge is always cost 1 regardless of elevation', () => {
    expect(getMoveCost('plains', 'tank', undefined, 'bridge', 0, 5)).toBe(1);
  });

  it('river is always impassable', () => {
    expect(getMoveCost('plains', 'infantry', undefined, 'river')).toBe(Infinity);
  });
});

describe('getDefenseModifier', () => {
  it('plains gives 0 defense', () => {
    expect(getDefenseModifier('plains')).toBe(0);
  });

  it('forest gives 0.25 defense', () => {
    expect(getDefenseModifier('forest')).toBe(0.25);
  });

  it('mountain gives 0 defense', () => {
    expect(getDefenseModifier('mountain')).toBe(0);
  });

  it('city gives 0 defense', () => {
    expect(getDefenseModifier('city')).toBe(0);
  });
});

describe('getVisionBonus', () => {
  // Formula: floor(baseVisionRange * elevation / MTN_PEAK_MAX)
  // MTN_PEAK_MAX = 20, using baseVisionRange = 10 for clean math

  it('elevation 0 gives 0 bonus', () => {
    expect(getVisionBonus(0, 10)).toBe(0);
  });

  it('elevation 2 gives +1 bonus', () => {
    expect(getVisionBonus(2, 10)).toBe(1);
  });

  it('elevation 5 gives +2 bonus', () => {
    expect(getVisionBonus(5, 10)).toBe(2);
  });

  it('elevation 10 gives +5 bonus (half peak = half base)', () => {
    expect(getVisionBonus(10, 10)).toBe(5);
  });

  it('elevation 20 gives +10 bonus (peak = 100% of base)', () => {
    expect(getVisionBonus(20, 10)).toBe(10);
  });

  it('scales with base vision range', () => {
    // Infantry (base 7) at elev 10: floor(7 * 10 / 20) = 3
    expect(getVisionBonus(10, 7)).toBe(3);
    // Recon (base 15) at elev 10: floor(15 * 10 / 20) = 7
    expect(getVisionBonus(10, 15)).toBe(7);
  });
});
