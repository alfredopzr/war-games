import { describe, it, expect } from 'vitest';
import { TERRAIN, getMoveCost, getDefenseModifier, getVisionModifier } from './terrain';
import type { TerrainType, UnitType } from './types';

describe('TERRAIN definitions', () => {
  it('plains has correct values', () => {
    expect(TERRAIN.plains).toEqual({
      type: 'plains',
      moveCost: 1,
      defenseModifier: 0,
      visionModifier: 0,
      blocksLoS: false,
      infantryOnly: false,
    });
  });

  it('forest has correct values', () => {
    expect(TERRAIN.forest).toEqual({
      type: 'forest',
      moveCost: 2,
      defenseModifier: 0.25,
      visionModifier: 0,
      blocksLoS: true,
      infantryOnly: false,
    });
  });

  it('mountain has correct values', () => {
    expect(TERRAIN.mountain).toEqual({
      type: 'mountain',
      moveCost: 3,
      defenseModifier: 0.4,
      visionModifier: 2,
      blocksLoS: false,
      infantryOnly: true,
    });
  });

  it('city has correct values', () => {
    expect(TERRAIN.city).toEqual({
      type: 'city',
      moveCost: 1,
      defenseModifier: 0.3,
      visionModifier: 0,
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

describe('getVisionModifier', () => {
  it('mountain gives +2 vision', () => {
    expect(getVisionModifier('mountain')).toBe(2);
  });

  it('plains gives 0 vision', () => {
    expect(getVisionModifier('plains')).toBe(0);
  });

  it('forest gives 0 vision', () => {
    expect(getVisionModifier('forest')).toBe(0);
  });

  it('city gives 0 vision', () => {
    expect(getVisionModifier('city')).toBe(0);
  });
});
