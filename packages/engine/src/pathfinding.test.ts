import { describe, it, expect } from 'vitest';
import type { TerrainType, HexModifier } from './types';
import { createHex, hexToKey, hexNeighbors } from './hex';
import { findPath, pathCost, getReachableHexes } from './pathfinding';

function makePlainsTerrain(width: number, height: number): Map<string, TerrainType> {
  const terrain = new Map<string, TerrainType>();
  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      const q = col;
      const r = row - Math.floor(col / 2);
      terrain.set(`${q},${r}`, 'plains');
    }
  }
  return terrain;
}

describe('findPath', () => {
  it('returns direct path on open plains (start and end in path)', () => {
    const terrain = makePlainsTerrain(5, 5);
    const start = createHex(0, 0);
    const end = createHex(2, 0);
    const path = findPath(start, end, terrain, 'infantry', new Set());

    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThanOrEqual(3);
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('returns null when no path exists (isolated hex)', () => {
    const terrain = new Map<string, TerrainType>();
    terrain.set('0,0', 'plains');
    terrain.set('5,5', 'plains');
    // No connecting hexes — they are isolated
    const start = createHex(0, 0);
    const end = createHex(5, 5);
    const path = findPath(start, end, terrain, 'infantry', new Set());

    expect(path).toBeNull();
  });

  it('avoids mountains for vehicles (tank cannot cross)', () => {
    // Create a narrow corridor with mountains blocking the direct path
    const terrain = makePlainsTerrain(5, 5);
    // Place mountains across the middle to block direct path
    // Row 2 in offset coords for cols 1..3 creates a wall
    for (let col = 1; col <= 3; col++) {
      const r = 2 - Math.floor(col / 2);
      terrain.set(`${col},${r}`, 'mountain');
    }

    const start = createHex(0, 0);
    const end = createHex(4, 0);
    const path = findPath(start, end, terrain, 'tank', new Set());

    if (path) {
      // Path should not contain any mountain hexes
      for (const coord of path) {
        const key = hexToKey(coord);
        expect(terrain.get(key)).not.toBe('mountain');
      }
    }
    // Path should exist (going around)
    expect(path).not.toBeNull();
  });

  it('infantry CAN cross mountains', () => {
    const terrain = makePlainsTerrain(5, 5);
    // Place mountains across the middle — infantry should be able to cross
    for (let col = 1; col <= 3; col++) {
      const r = 2 - Math.floor(col / 2);
      terrain.set(`${col},${r}`, 'mountain');
    }

    const start = createHex(0, 0);
    const end = createHex(4, 0);
    const path = findPath(start, end, terrain, 'infantry', new Set());

    expect(path).not.toBeNull();
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('avoids occupied hexes (path does not go through occupied, except destination)', () => {
    const terrain = makePlainsTerrain(5, 5);
    const start = createHex(0, 0);
    const end = createHex(3, 0);

    // Occupy a hex that would be on the direct path
    const blockedKey = hexToKey(createHex(1, 0));
    const occupied = new Set([blockedKey]);

    const path = findPath(start, end, terrain, 'infantry', occupied);

    expect(path).not.toBeNull();
    // Intermediate hexes should not include the occupied one
    for (let i = 1; i < path!.length - 1; i++) {
      expect(hexToKey(path![i]!)).not.toBe(blockedKey);
    }
  });

  it('allows moving TO an occupied destination hex', () => {
    const terrain = makePlainsTerrain(5, 5);
    const start = createHex(0, 0);
    const end = createHex(1, 0);
    const occupied = new Set([hexToKey(end)]);

    const path = findPath(start, end, terrain, 'infantry', occupied);

    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('returns null for start not in terrain map', () => {
    const terrain = makePlainsTerrain(3, 3);
    const start = createHex(99, 99);
    const end = createHex(0, 0);
    const path = findPath(start, end, terrain, 'infantry', new Set());

    expect(path).toBeNull();
  });

  it('returns null for end not in terrain map', () => {
    const terrain = makePlainsTerrain(3, 3);
    const start = createHex(0, 0);
    const end = createHex(99, 99);
    const path = findPath(start, end, terrain, 'infantry', new Set());

    expect(path).toBeNull();
  });

  it('returns single-element path when start equals end', () => {
    const terrain = makePlainsTerrain(3, 3);
    const hex = createHex(1, 0);
    const path = findPath(hex, hex, terrain, 'infantry', new Set());

    expect(path).not.toBeNull();
    expect(path).toHaveLength(1);
    expect(path![0]).toEqual(hex);
  });
});

describe('pathCost', () => {
  it('returns correct total movement cost for a path', () => {
    const terrain = new Map<string, TerrainType>();
    const p0 = createHex(0, 0);
    const p1 = createHex(1, 0);
    const p2 = createHex(2, -1);
    terrain.set(hexToKey(p0), 'plains');   // cost 1
    terrain.set(hexToKey(p1), 'forest');   // cost 2
    terrain.set(hexToKey(p2), 'plains');   // cost 1

    const cost = pathCost([p0, p1, p2], terrain, 'infantry');
    // Cost is sum of steps INTO each hex (excluding start): forest(2) + plains(1) = 3
    expect(cost).toBe(3);
  });

  it('returns 0 for single-hex path', () => {
    const terrain = new Map<string, TerrainType>();
    const p0 = createHex(0, 0);
    terrain.set(hexToKey(p0), 'plains');

    const cost = pathCost([p0], terrain, 'infantry');
    expect(cost).toBe(0);
  });

  it('returns Infinity when path crosses impassable elevation for unit type', () => {
    const terrain = new Map<string, TerrainType>();
    const p0 = createHex(0, 0);
    const p1 = createHex(1, 0);
    terrain.set(hexToKey(p0), 'plains');
    terrain.set(hexToKey(p1), 'plains');

    // Elevation delta 4 > CLIMB_THRESHOLD(3), tank canClimb=false → Infinity
    const elevation = new Map<string, number>();
    elevation.set(hexToKey(p0), 0);
    elevation.set(hexToKey(p1), 4);

    const cost = pathCost([p0, p1], terrain, 'tank', undefined, undefined, elevation);
    expect(cost).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// getReachableHexes
// ---------------------------------------------------------------------------

describe('getReachableHexes', () => {
  it('returns empty set when budget is 0', () => {
    const terrain = makePlainsTerrain(5, 5);
    const start = createHex(2, 0);
    const result = getReachableHexes(start, 0, terrain, 'infantry', new Set());
    expect(result.size).toBe(0);
  });

  it('returns immediate neighbors on flat plains with budget=1', () => {
    const terrain = makePlainsTerrain(8, 8);
    const start = createHex(3, 0);
    const result = getReachableHexes(start, 1, terrain, 'infantry', new Set());
    const neighbors = hexNeighbors(start);
    const inMap = neighbors.filter((n) => terrain.has(hexToKey(n)));
    for (const n of inMap) {
      expect(result.has(hexToKey(n))).toBe(true);
    }
  });

  it('does not include start hex in result', () => {
    const terrain = makePlainsTerrain(5, 5);
    const start = createHex(2, 0);
    const result = getReachableHexes(start, 3, terrain, 'infantry', new Set());
    expect(result.has(hexToKey(start))).toBe(false);
  });

  it('respects budget — infantry budget=2 reaches distance 2 but not 3', () => {
    const terrain = makePlainsTerrain(8, 8);
    const start = createHex(3, 0);
    const result = getReachableHexes(start, 2, terrain, 'infantry', new Set());

    // Distance 1 neighbor
    expect(result.has(hexToKey(createHex(4, 0)))).toBe(true);
    // Distance 2
    expect(result.has(hexToKey(createHex(5, 0)))).toBe(true);
    // Distance 3 — out of budget
    expect(result.has(hexToKey(createHex(6, 0)))).toBe(false);
  });

  it('forest costs 2 — budget=1 cannot enter, budget=2 can', () => {
    const terrain = makePlainsTerrain(8, 8);
    const forestHex = createHex(4, 0);
    terrain.set(hexToKey(forestHex), 'forest');
    const start = createHex(3, 0);

    const budget1 = getReachableHexes(start, 1, terrain, 'infantry', new Set());
    expect(budget1.has(hexToKey(forestHex))).toBe(false);

    const budget2 = getReachableHexes(start, 2, terrain, 'infantry', new Set());
    expect(budget2.has(hexToKey(forestHex))).toBe(true);
  });

  it('flank directive reduces forest cost to 1', () => {
    const terrain = makePlainsTerrain(8, 8);
    const forestHex = createHex(4, 0);
    terrain.set(hexToKey(forestHex), 'forest');
    const start = createHex(3, 0);

    const result = getReachableHexes(start, 1, terrain, 'infantry', new Set(), 'flank-left');
    expect(result.has(hexToKey(forestHex))).toBe(true);
  });

  it('occupied hexes are excluded from result', () => {
    const terrain = makePlainsTerrain(8, 8);
    const start = createHex(3, 0);
    const blocked = hexToKey(createHex(4, 0));
    const occupied = new Set([blocked]);

    const result = getReachableHexes(start, 3, terrain, 'infantry', occupied);
    expect(result.has(blocked)).toBe(false);
    // Other neighbors still reachable
    expect(result.has(hexToKey(createHex(3, 1)))).toBe(true);
  });

  it('elevation uphill consumes extra budget', () => {
    const terrain = makePlainsTerrain(8, 8);
    const start = createHex(3, 0);
    const uphillHex = createHex(4, 0);
    const elevation = new Map<string, number>();
    for (const key of terrain.keys()) elevation.set(key, 0);
    // Uphill cost = 1 (plains) + 2*0.5 = 2
    elevation.set(hexToKey(uphillHex), 2);

    const budget1 = getReachableHexes(start, 1, terrain, 'infantry', new Set(), undefined, undefined, elevation);
    expect(budget1.has(hexToKey(uphillHex))).toBe(false);

    const budget2 = getReachableHexes(start, 2, terrain, 'infantry', new Set(), undefined, undefined, elevation);
    expect(budget2.has(hexToKey(uphillHex))).toBe(true);
  });

  it('non-climbers blocked by CLIMB_THRESHOLD, climbers pass', () => {
    const terrain = makePlainsTerrain(8, 8);
    const start = createHex(3, 0);
    const cliffHex = createHex(4, 0);
    const elevation = new Map<string, number>();
    for (const key of terrain.keys()) elevation.set(key, 0);
    elevation.set(hexToKey(cliffHex), 4); // delta 4 > CLIMB_THRESHOLD=3

    const tankResult = getReachableHexes(start, 10, terrain, 'tank', new Set(), undefined, undefined, elevation);
    expect(tankResult.has(hexToKey(cliffHex))).toBe(false);

    const infResult = getReachableHexes(start, 10, terrain, 'infantry', new Set(), undefined, undefined, elevation);
    expect(infResult.has(hexToKey(cliffHex))).toBe(true);
  });

  it('river is impassable regardless of budget', () => {
    const terrain = makePlainsTerrain(8, 8);
    const start = createHex(3, 0);
    const riverHex = createHex(4, 0);
    const modifiers = new Map<string, HexModifier>();
    modifiers.set(hexToKey(riverHex), 'river');

    const result = getReachableHexes(start, 10, terrain, 'infantry', new Set(), undefined, modifiers);
    expect(result.has(hexToKey(riverHex))).toBe(false);
  });

  it('highway gives 0.5 cost for vehicles', () => {
    const terrain = makePlainsTerrain(8, 8);
    const start = createHex(3, 0);
    const hwHex = createHex(4, 0);
    const modifiers = new Map<string, HexModifier>();
    modifiers.set(hexToKey(hwHex), 'highway');

    // Budget 0.5 — just enough for highway
    const result = getReachableHexes(start, 0.5, terrain, 'tank', new Set(), undefined, modifiers);
    expect(result.has(hexToKey(hwHex))).toBe(true);
  });
});
