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

beforeEach(() => {
  resetUnitIdCounter();
});

// ---------------------------------------------------------------------------
// calculateVisibility
// ---------------------------------------------------------------------------

describe('calculateVisibility', () => {
  it('infantry (vision 3) sees hexes within range 3 but not range 4', () => {
    const terrain = makePlainsTerrain();
    const unit = createUnit('infantry', 'player1', createHex(3, 0));
    const visible = calculateVisibility([unit], terrain);

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
    const recon = createUnit('recon', 'player1', createHex(5, -2));
    const visible = calculateVisibility([recon], terrain);

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
    // Place forest at (4,0)
    terrain.set(hexToKey(createHex(4, 0)), 'forest');

    const observer = createUnit('recon', 'player1', createHex(3, 0));
    const visible = calculateVisibility([observer], terrain);

    // The forest hex itself should be visible
    expect(visible.has(hexToKey(createHex(4, 0)))).toBe(true);

    // Hex behind the forest (5,0) should be blocked
    expect(visible.has(hexToKey(createHex(5, 0)))).toBe(false);
  });

  it('mountain grants +2 vision: infantry on mountain sees range 5', () => {
    const terrain = makePlainsTerrain(16, 12);
    const mountPos = createHex(3, 0);
    terrain.set(hexToKey(mountPos), 'mountain');

    const unit = createUnit('infantry', 'player1', mountPos);
    const visible = calculateVisibility([unit], terrain);

    // Infantry base vision = 3, mountain +2 = 5
    // Hex at distance 5 should be visible
    const hexDist5 = createHex(8, -3); // cubeDistance from (3,0) = max(5,3,2) = 5
    expect(cubeDistance(unit.position, hexDist5)).toBe(5);
    expect(visible.has(hexToKey(hexDist5))).toBe(true);

    // Hex at distance 6 should NOT be visible
    const hexDist6 = createHex(9, -4); // cubeDistance from (3,0) = max(6,4,2) = 6
    expect(cubeDistance(unit.position, hexDist6)).toBe(6);
    expect(visible.has(hexToKey(hexDist6))).toBe(false);
  });

  it('multiple units combine their visibility', () => {
    const terrain = makePlainsTerrain();
    const unit1 = createUnit('infantry', 'player1', createHex(1, 0));
    const unit2 = createUnit('infantry', 'player1', createHex(8, 0));
    const visible = calculateVisibility([unit1, unit2], terrain);

    // unit1 at (1,0) sees (1,0) area, unit2 at (8,0) sees (8,0) area
    // Each should contribute their own visible hexes
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
    const forestPos = createHex(4, 0);
    terrain.set(hexToKey(forestPos), 'forest');

    const target = createUnit('infantry', 'player2', forestPos);
    const observer = createUnit('infantry', 'player1', createHex(3, 0)); // dist 1

    expect(cubeDistance(observer.position, target.position)).toBe(1);
    expect(isUnitVisible(target, [observer], terrain)).toBe(true);
  });

  it('unit in forest is NOT visible from distance 2+ even with vision range', () => {
    const terrain = makePlainsTerrain();
    const forestPos = createHex(4, 0);
    terrain.set(hexToKey(forestPos), 'forest');

    const target = createUnit('infantry', 'player2', forestPos);
    const observer = createUnit('recon', 'player1', createHex(2, 0)); // dist 2

    expect(cubeDistance(observer.position, target.position)).toBe(2);
    expect(isUnitVisible(target, [observer], terrain)).toBe(false);
  });

  it('unit on plains is visible if hex is in vision set', () => {
    const terrain = makePlainsTerrain();
    const target = createUnit('infantry', 'player2', createHex(4, 0));
    const observer = createUnit('recon', 'player1', createHex(2, 0)); // dist 2, recon vision 5

    expect(isUnitVisible(target, [observer], terrain)).toBe(true);
  });
});
