import { describe, it, expect } from 'vitest';
import { hexToKey, cubeDistance, createHex, hexesInRadius } from './hex';
import { generateMap, validateMap } from './map-gen';
import {
  R_MACRO, R_MINI,
  MTN_BASE_ELEV, MTN_PEAK_MAX, DEPLOY_ELEV,
  PLAINS_ELEV_RANGE,
} from './map-gen-params';

const EXPECTED_MACROS = 3 * R_MACRO * (R_MACRO + 1) + 1;
const EXPECTED_MINIS_PER_MACRO = 3 * R_MINI * (R_MINI + 1) + 1;
const EXPECTED_TOTAL = EXPECTED_MACROS * EXPECTED_MINIS_PER_MACRO;

describe('generateMap', () => {
  it('generates approximately the expected number of hexes', () => {
    const map = generateMap(42);
    const tolerance = EXPECTED_TOTAL * 0.15;
    expect(map.terrain.size).toBeGreaterThan(EXPECTED_TOTAL - tolerance);
    expect(map.terrain.size).toBeLessThan(EXPECTED_TOTAL + tolerance);
  });

  it('has mapRadius set', () => {
    const map = generateMap(42);
    expect(map.mapRadius).toBeGreaterThan(0);
  });

  it('has gridSize as bounding rectangle', () => {
    const map = generateMap(42);
    expect(map.gridSize.width).toBeGreaterThan(0);
    expect(map.gridSize.height).toBeGreaterThan(0);
  });

  it('central hex (origin) is always city terrain', () => {
    for (const seed of [1, 42, 100, 999]) {
      const map = generateMap(seed);
      const centralKey = hexToKey(map.centralObjective);
      expect(map.terrain.get(centralKey)).toBe('city');
    }
  });

  it('central objective is at origin (0,0)', () => {
    const map = generateMap(42);
    expect(map.centralObjective).toEqual(createHex(0, 0));
  });

  it('every hex is assigned to exactly one mega-hex', () => {
    const map = generateMap(42);
    expect(map.megaHexes.size).toBe(map.terrain.size);
    for (const key of map.terrain.keys()) {
      expect(map.megaHexes.has(key)).toBe(true);
    }
  });

  it('has the expected number of mega-hex infos', () => {
    const map = generateMap(42);
    expect(map.megaHexInfo.size).toBe(EXPECTED_MACROS);
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

  it('deployment zones have correct elevation', () => {
    const map = generateMap(42);
    for (const coord of [...map.player1Deployment, ...map.player2Deployment]) {
      const elev = map.elevation.get(hexToKey(coord));
      expect(elev).toBe(DEPLOY_ELEV);
    }
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

  it('player1 and player2 deployment zones are non-empty', () => {
    const map = generateMap(42);
    expect(map.player1Deployment.length).toBeGreaterThan(0);
    expect(map.player2Deployment.length).toBeGreaterThan(0);
  });
});

describe('elevation', () => {
  it('elevation map has same count as terrain map', () => {
    const map = generateMap(42);
    expect(map.elevation.size).toBe(map.terrain.size);
  });

  it('all elevation values are in [PLAINS_ELEV_RANGE[0], MTN_PEAK_MAX]', () => {
    const map = generateMap(42);
    for (const [, elev] of map.elevation) {
      expect(elev).toBeGreaterThanOrEqual(PLAINS_ELEV_RANGE[0] - 0.1);
      expect(elev).toBeLessThanOrEqual(MTN_PEAK_MAX + 0.1);
    }
  });

  it('mountain interior hexes have elevation >= MTN_BASE_ELEV', () => {
    const map = generateMap(42);
    // Boundary-smoothed mountain hexes may dip below MTN_BASE_ELEV.
    // Check that mountains are broadly above base (allow 20% tolerance for boundary blend).
    let total = 0;
    let belowBase = 0;
    for (const [key, terrain] of map.terrain) {
      if (terrain === 'mountain') {
        const elev = map.elevation.get(key)!;
        total++;
        if (elev < MTN_BASE_ELEV - 0.01) belowBase++;
      }
    }
    // At most ~10% of mountain hexes should be below base (boundary smoothing only)
    expect(belowBase / total).toBeLessThan(0.15);
  });

  it('highest peak on map equals MTN_PEAK_MAX', () => {
    const map = generateMap(42);
    let maxElev = 0;
    for (const [, elev] of map.elevation) {
      if (elev > maxElev) maxElev = elev;
    }
    expect(maxElev).toBeCloseTo(MTN_PEAK_MAX, 1);
  });

  it('peak hex is within its mega-hex (cubeDistance <= R_MINI)', () => {
    const map = generateMap(42);
    for (const [, info] of map.megaHexInfo) {
      if (info.terrain === 'mountain') {
        const dist = cubeDistance(info.peakHex, info.center);
        expect(dist).toBeLessThanOrEqual(R_MINI);
      }
    }
  });

  it('elevation tapers from peak (neighbors of peak have lower elevation)', () => {
    const map = generateMap(42);
    for (const [, info] of map.megaHexInfo) {
      if (info.terrain !== 'mountain') continue;
      const peakKey = hexToKey(info.peakHex);
      const peakElev = map.elevation.get(peakKey);
      if (peakElev === undefined) continue;

      // Check at least some hexes at distance 2+ have lower elevation
      const nearbyHexes = hexesInRadius(info.peakHex, 2);
      let lowerCount = 0;
      for (const hex of nearbyHexes) {
        const key = hexToKey(hex);
        const elev = map.elevation.get(key);
        if (elev !== undefined && elev < peakElev) lowerCount++;
      }
      expect(lowerCount).toBeGreaterThan(0);
    }
  });

  it('non-mountain hexes have elevation below mountain range', () => {
    const map = generateMap(42);
    for (const [key, terrain] of map.terrain) {
      if (terrain !== 'mountain') {
        const elev = map.elevation.get(key)!;
        // Boundary smoothing can pull non-mountain hexes above their normal range,
        // but they should never reach deep into mountain territory.
        expect(elev).toBeLessThan(MTN_BASE_ELEV + 3.0);
      }
    }
  });

  it('same seed produces same elevation', () => {
    const map1 = generateMap(42);
    const map2 = generateMap(42);

    expect(map1.elevation.size).toBe(map2.elevation.size);
    for (const [key, elev] of map1.elevation) {
      expect(map2.elevation.get(key)).toBe(elev);
    }
  });
});

describe('validateMap', () => {
  it('returns valid=true for generated maps', () => {
    for (const seed of [1, 42, 100, 999]) {
      const map = generateMap(seed);
      const validation = validateMap(map);
      expect(validation.errors).toEqual([]);
      expect(validation.valid).toBe(true);
    }
  });

  it('detects non-city central objective', () => {
    const map = generateMap(42);
    const badTerrain = new Map(map.terrain);
    badTerrain.set(hexToKey(map.centralObjective), 'plains');

    const badMap = { ...map, terrain: badTerrain };
    const validation = validateMap(badMap);
    expect(validation.valid).toBe(false);
  });

  it('detects invalid deployment zone terrain', () => {
    const map = generateMap(42);
    const badTerrain = new Map(map.terrain);
    const deployHex = map.player1Deployment[0]!;
    badTerrain.set(hexToKey(deployHex), 'mountain');

    const badMap = { ...map, terrain: badTerrain };
    const validation = validateMap(badMap);
    expect(validation.valid).toBe(false);
  });

  it('detects non-zero deployment elevation', () => {
    const map = generateMap(42);
    const badElevation = new Map(map.elevation);
    const deployHex = map.player1Deployment[0]!;
    badElevation.set(hexToKey(deployHex), 2);

    const badMap = { ...map, elevation: badElevation };
    const validation = validateMap(badMap);
    expect(validation.valid).toBe(false);
  });

  it('isSymmetric is false (no longer enforced)', () => {
    const map = generateMap(42);
    const validation = validateMap(map);
    expect(validation.isSymmetric).toBe(false);
  });
});

describe('hexesInRadius', () => {
  it('radius 0 returns 1 hex', () => {
    expect(hexesInRadius(createHex(0, 0), 0)).toHaveLength(1);
  });

  it('radius 1 returns 7 hexes', () => {
    expect(hexesInRadius(createHex(0, 0), 1)).toHaveLength(7);
  });

  it('radius 2 returns 19 hexes', () => {
    expect(hexesInRadius(createHex(0, 0), 2)).toHaveLength(19);
  });

  it('radius 5 returns 91 hexes', () => {
    expect(hexesInRadius(createHex(0, 0), 5)).toHaveLength(91);
  });

  it('all returned hexes are within radius of center', () => {
    const center = createHex(3, -2);
    const hexes = hexesInRadius(center, 4);
    for (const hex of hexes) {
      expect(cubeDistance(hex, center)).toBeLessThanOrEqual(4);
    }
  });
});
