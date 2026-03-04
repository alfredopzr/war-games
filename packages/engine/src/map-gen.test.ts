import { describe, it, expect } from 'vitest';
import type { GameMap, TerrainType } from './types';
import { hexToKey, createHex } from './hex';
import { generateMap, validateMap } from './map-gen';

describe('generateMap', () => {
  it('generates 280 hexes for a 20x14 grid', () => {
    const map = generateMap(42);
    expect(map.terrain.size).toBe(280);
  });

  it('has gridSize 20x14', () => {
    const map = generateMap(42);
    expect(map.gridSize).toEqual({ width: 20, height: 14 });
  });

  it('central hex is always city terrain', () => {
    const map = generateMap(42);
    const centralKey = hexToKey(map.centralObjective);
    expect(map.terrain.get(centralKey)).toBe('city');
  });

  it('central hex is at q=10, r=2', () => {
    const map = generateMap(42);
    expect(map.centralObjective).toEqual(createHex(10, 2));
  });

  it('has exactly 7 city hexes (1 central + 6 sectored)', () => {
    for (const seed of [1, 42, 100, 999, 12345]) {
      const map = generateMap(seed);
      const cityCount = [...map.terrain.values()].filter((t) => t === 'city').length;
      expect(cityCount).toBe(7);
    }
  });

  it('deployment zones contain only plains and forest', () => {
    const map = generateMap(42);
    const allowedTerrain = new Set(['plains', 'forest']);

    for (const coord of map.player1Deployment) {
      const terrain = map.terrain.get(hexToKey(coord));
      expect(allowedTerrain.has(terrain!)).toBe(true);
    }

    for (const coord of map.player2Deployment) {
      const terrain = map.terrain.get(hexToKey(coord));
      expect(allowedTerrain.has(terrain!)).toBe(true);
    }
  });

  it('map is symmetric (cities can be asymmetric)', () => {
    const map = generateMap(42);
    const validation = validateMap(map);
    // Non-city terrain should be symmetric, cities can be asymmetric
    expect(validation.isSymmetric).toBe(true);
  });

  it('same seed produces same map', () => {
    const map1 = generateMap(42);
    const map2 = generateMap(42);

    expect(map1.terrain.size).toBe(map2.terrain.size);
    for (const [key, terrain] of map1.terrain) {
      expect(map2.terrain.get(key)).toBe(terrain);
    }
    expect(map1.centralObjective).toEqual(map2.centralObjective);
    expect(map1.player1Deployment).toEqual(map2.player1Deployment);
    expect(map1.player2Deployment).toEqual(map2.player2Deployment);
  });

  it('different seeds produce different maps', () => {
    const map1 = generateMap(1);
    const map2 = generateMap(9999);

    let differences = 0;
    for (const [key, terrain] of map1.terrain) {
      if (map2.terrain.get(key) !== terrain) {
        differences++;
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it('player1Deployment has 60 hexes (20 cols x 3 rows)', () => {
    const map = generateMap(42);
    expect(map.player1Deployment.length).toBe(60);
  });

  it('player2Deployment has 60 hexes (20 cols x 3 rows)', () => {
    const map = generateMap(42);
    expect(map.player2Deployment.length).toBe(60);
  });

  it('cities are spread across both halves of neutral zone', () => {
    for (const seed of [1, 42, 100, 999]) {
      const map = generateMap(seed);
      const cityKeys = new Set(
        [...map.terrain.entries()]
          .filter(([, t]) => t === 'city')
          .map(([k]) => k),
      );
      const deployKeys = new Set([
        ...map.player1Deployment.map(hexToKey),
        ...map.player2Deployment.map(hexToKey),
      ]);
      const sideCities = [...cityKeys].filter((k) => k !== hexToKey(map.centralObjective) && !deployKeys.has(k));
      expect(sideCities.length).toBe(6);
    }
  });

  it('no two cities are within 2 hexes of each other', () => {
    const map = generateMap(42);
    const cityCoords = [...map.terrain.entries()]
      .filter(([, t]) => t === 'city')
      .map(([k]) => {
        const [q, r] = k.split(',').map(Number);
        return { q: q!, r: r!, s: (-q! - r!) || 0 };
      });

    for (let i = 0; i < cityCoords.length; i++) {
      for (let j = i + 1; j < cityCoords.length; j++) {
        const a = cityCoords[i]!;
        const b = cityCoords[j]!;
        const dist = Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
        expect(dist).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('validateMap', () => {
  it('returns valid=true for generated maps', () => {
    for (const seed of [1, 42, 100, 999]) {
      const map = generateMap(seed);
      const validation = validateMap(map);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    }
  });

  it('detects incorrect grid size', () => {
    const map = generateMap(42);
    // Remove a hex to break size
    const badTerrain = new Map(map.terrain);
    const firstKey = badTerrain.keys().next().value!;
    badTerrain.delete(firstKey);

    const badMap: GameMap = { ...map, terrain: badTerrain };
    const validation = validateMap(badMap);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('detects non-city central objective', () => {
    const map = generateMap(42);
    const badTerrain = new Map(map.terrain);
    badTerrain.set(hexToKey(map.centralObjective), 'plains');

    const badMap: GameMap = { ...map, terrain: badTerrain };
    const validation = validateMap(badMap);
    expect(validation.valid).toBe(false);
  });

  it('detects asymmetric maps', () => {
    const map = generateMap(42);
    const badTerrain = new Map(map.terrain);
    // Set a hex in the neutral zone to a terrain different from its current value
    const hex = createHex(3, 1); // offset row 2 (neutral)
    const current = badTerrain.get(hexToKey(hex));
    const forced: TerrainType = current === 'mountain' ? 'forest' : 'mountain';
    badTerrain.set(hexToKey(hex), forced);

    const badMap: GameMap = { ...map, terrain: badTerrain };
    const validation = validateMap(badMap);
    expect(validation.isSymmetric).toBe(false);
  });

  it('detects invalid deployment zone terrain', () => {
    const map = generateMap(42);
    const badTerrain = new Map(map.terrain);
    // Put a mountain in player1 deployment zone (row 0)
    const deployHex = map.player1Deployment[0]!;
    badTerrain.set(hexToKey(deployHex), 'mountain');

    const badMap: GameMap = { ...map, terrain: badTerrain };
    const validation = validateMap(badMap);
    expect(validation.valid).toBe(false);
  });
});
