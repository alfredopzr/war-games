import { describe, it, expect, beforeEach } from 'vitest';
import type { TerrainType } from './types';
import { createHex, cubeDistance, hexToKey } from './hex';
import { createUnit, resetUnitIdCounter } from './units';
import { calculateVisibility, isUnitVisible } from './vision';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlainsTerrain(width = 16, height = 12): Map<string, TerrainType> {
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

function makeFlatElevation(terrain: Map<string, TerrainType>, elev = 0): Map<string, number> {
  const elevation = new Map<string, number>();
  for (const key of terrain.keys()) {
    elevation.set(key, elev);
  }
  return elevation;
}

beforeEach(() => {
  resetUnitIdCounter();
});

// ---------------------------------------------------------------------------
// calculateVisibility
// ---------------------------------------------------------------------------

describe('calculateVisibility', () => {
  it('infantry (vision 3) sees hexes within range 3 but not range 4', () => {
    const terrain = makePlainsTerrain();
    const elevation = makeFlatElevation(terrain);
    const unit = createUnit('infantry', 'player1', createHex(3, 0));
    const visible = calculateVisibility([unit], terrain, elevation);

    // Hex at distance 3 should be visible
    const hexDist3 = createHex(6, -3); // cubeDistance from (3,0) = 3
    expect(cubeDistance(unit.position, hexDist3)).toBe(3);
    expect(visible.has(hexToKey(hexDist3))).toBe(true);

    // Hex at distance 4 should NOT be visible
    const hexDist4 = createHex(7, -4); // cubeDistance from (3,0) = 4
    expect(cubeDistance(unit.position, hexDist4)).toBe(4);
    expect(visible.has(hexToKey(hexDist4))).toBe(false);
  });

  it('recon (vision 6) sees farther than infantry', () => {
    const terrain = makePlainsTerrain(20, 14);
    const elevation = makeFlatElevation(terrain);
    const recon = createUnit('recon', 'player1', createHex(5, -2));
    const visible = calculateVisibility([recon], terrain, elevation);

    // Hex at distance 6 should be visible
    const hexDist6 = createHex(5, 4); // cubeDistance from (5,-2) = 6
    expect(cubeDistance(recon.position, hexDist6)).toBe(6);
    expect(visible.has(hexToKey(hexDist6))).toBe(true);

    // Hex at distance 7 should NOT be visible
    const hexDist7 = createHex(5, 5); // cubeDistance from (5,-2) = 7
    expect(cubeDistance(recon.position, hexDist7)).toBe(7);
    expect(visible.has(hexToKey(hexDist7))).toBe(false);
  });

  it('forest blocks LoS: observer sees forest but not hex behind it', () => {
    const terrain = makePlainsTerrain();
    const elevation = makeFlatElevation(terrain);
    // Place forest at (4,0)
    terrain.set(hexToKey(createHex(4, 0)), 'forest');

    const observer = createUnit('recon', 'player1', createHex(3, 0));
    const visible = calculateVisibility([observer], terrain, elevation);

    // The forest hex itself should be visible
    expect(visible.has(hexToKey(createHex(4, 0)))).toBe(true);

    // Hex behind the forest (5,0) should be blocked
    expect(visible.has(hexToKey(createHex(5, 0)))).toBe(false);
  });

  it('elevation grants vision bonus: infantry at elev 4 sees range 5', () => {
    const terrain = makePlainsTerrain(16, 12);
    const elevation = makeFlatElevation(terrain);
    const mountPos = createHex(3, 0);
    // Set elevation at unit position to 4 (floor(sqrt(4)) = 2 bonus)
    elevation.set(hexToKey(mountPos), 4);

    const unit = createUnit('infantry', 'player1', mountPos);
    const visible = calculateVisibility([unit], terrain, elevation);

    // Infantry base vision = 3, elevation bonus +2 = 5
    const hexDist5 = createHex(8, -3);
    expect(cubeDistance(unit.position, hexDist5)).toBe(5);
    expect(visible.has(hexToKey(hexDist5))).toBe(true);

    // Hex at distance 6 should NOT be visible
    const hexDist6 = createHex(9, -4);
    expect(cubeDistance(unit.position, hexDist6)).toBe(6);
    expect(visible.has(hexToKey(hexDist6))).toBe(false);
  });

  it('multiple units combine their visibility', () => {
    const terrain = makePlainsTerrain();
    const elevation = makeFlatElevation(terrain);
    const unit1 = createUnit('infantry', 'player1', createHex(1, 0));
    const unit2 = createUnit('infantry', 'player1', createHex(8, 0));
    const visible = calculateVisibility([unit1, unit2], terrain, elevation);

    // unit1 at (1,0) sees (1,0) area, unit2 at (8,0) sees (8,0) area
    expect(visible.has(hexToKey(createHex(1, 0)))).toBe(true);
    expect(visible.has(hexToKey(createHex(8, 0)))).toBe(true);
    expect(visible.has(hexToKey(createHex(1, 2)))).toBe(true); // dist 2 from unit1
    expect(visible.has(hexToKey(createHex(6, 0)))).toBe(true); // dist 2 from unit2
  });
});

// ---------------------------------------------------------------------------
// isUnitVisible
// ---------------------------------------------------------------------------

describe('isUnitVisible', () => {
  it('unit in forest is visible when observer is adjacent (distance 1)', () => {
    const terrain = makePlainsTerrain();
    const elevation = makeFlatElevation(terrain);
    const forestPos = createHex(4, 0);
    terrain.set(hexToKey(forestPos), 'forest');

    const target = createUnit('infantry', 'player2', forestPos);
    const observer = createUnit('infantry', 'player1', createHex(3, 0)); // dist 1

    expect(cubeDistance(observer.position, target.position)).toBe(1);
    expect(isUnitVisible(target, [observer], terrain, elevation)).toBe(true);
  });

  it('unit in forest is NOT visible from distance 2+ even with vision range', () => {
    const terrain = makePlainsTerrain();
    const elevation = makeFlatElevation(terrain);
    const forestPos = createHex(4, 0);
    terrain.set(hexToKey(forestPos), 'forest');

    const target = createUnit('infantry', 'player2', forestPos);
    const observer = createUnit('recon', 'player1', createHex(2, 0)); // dist 2

    expect(cubeDistance(observer.position, target.position)).toBe(2);
    expect(isUnitVisible(target, [observer], terrain, elevation)).toBe(false);
  });

  it('unit on plains is visible if hex is in vision set', () => {
    const terrain = makePlainsTerrain();
    const elevation = makeFlatElevation(terrain);
    const target = createUnit('infantry', 'player2', createHex(4, 0));
    const observer = createUnit('recon', 'player1', createHex(2, 0)); // dist 2, recon vision 5

    expect(isUnitVisible(target, [observer], terrain, elevation)).toBe(true);
  });
});
