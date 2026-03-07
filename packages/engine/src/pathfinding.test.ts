import { describe, it, expect } from 'vitest';
import type { TerrainType } from './types';
import { createHex } from './hex';
import { hexToKey } from './hex';
import { findPath, pathCost } from './pathfinding';

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
    terrain.set(hexToKey(p0), 'plains'); // cost 1
    terrain.set(hexToKey(p1), 'forest'); // cost 2
    terrain.set(hexToKey(p2), 'plains'); // cost 1

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

  it('returns Infinity when path crosses impassable terrain for unit type', () => {
    const terrain = new Map<string, TerrainType>();
    const p0 = createHex(0, 0);
    const p1 = createHex(1, 0);
    terrain.set(hexToKey(p0), 'plains');
    terrain.set(hexToKey(p1), 'mountain');

    const cost = pathCost([p0, p1], terrain, 'tank');
    expect(cost).toBe(Infinity);
  });
});
