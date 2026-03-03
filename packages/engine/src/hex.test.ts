import { describe, it, expect } from 'vitest';
import type { CubeCoord, GridSize } from './types';
import {
  createHex,
  cubeDistance,
  hexNeighbors,
  hexAdd,
  hexSubtract,
  hexToKey,
  isValidHex,
  getAllHexes,
  hexLineDraw,
  cubeRound,
  CUBE_DIRECTIONS,
} from './hex';

describe('createHex', () => {
  it('creates a valid cube coordinate with s = -q - r', () => {
    const hex = createHex(2, 3);
    expect(hex).toEqual({ q: 2, r: 3, s: -5 });
  });

  it('satisfies q + r + s === 0', () => {
    const hex = createHex(-1, 4);
    expect(hex.q + hex.r + hex.s).toBe(0);
  });

  it('handles origin', () => {
    const hex = createHex(0, 0);
    expect(hex).toEqual({ q: 0, r: 0, s: 0 });
  });
});

describe('cubeDistance', () => {
  it('returns 0 for same hex', () => {
    const hex = createHex(3, -1);
    expect(cubeDistance(hex, hex)).toBe(0);
  });

  it('returns 1 for adjacent hexes', () => {
    const a = createHex(0, 0);
    const b = createHex(1, 0);
    expect(cubeDistance(a, b)).toBe(1);
  });

  it('returns correct distance for far hexes', () => {
    const a = createHex(0, 0);
    const b = createHex(3, -3);
    expect(cubeDistance(a, b)).toBe(3);
  });

  it('is symmetric', () => {
    const a = createHex(1, 2);
    const b = createHex(-2, 4);
    expect(cubeDistance(a, b)).toBe(cubeDistance(b, a));
  });
});

describe('hexNeighbors', () => {
  it('returns exactly 6 neighbors', () => {
    const hex = createHex(0, 0);
    const neighbors = hexNeighbors(hex);
    expect(neighbors).toHaveLength(6);
  });

  it('all neighbors are distance 1 from the hex', () => {
    const hex = createHex(2, -1);
    const neighbors = hexNeighbors(hex);
    for (const n of neighbors) {
      expect(cubeDistance(hex, n)).toBe(1);
    }
  });

  it('all neighbors satisfy cube constraint', () => {
    const hex = createHex(1, 1);
    const neighbors = hexNeighbors(hex);
    for (const n of neighbors) {
      expect(n.q + n.r + n.s).toBe(0);
    }
  });
});

describe('hexAdd', () => {
  it('adds components', () => {
    const a = createHex(1, 2);
    const b = createHex(3, -1);
    const result = hexAdd(a, b);
    expect(result).toEqual({ q: 4, r: 1, s: -5 });
  });

  it('adding origin is identity', () => {
    const a = createHex(3, -2);
    const zero = createHex(0, 0);
    expect(hexAdd(a, zero)).toEqual(a);
  });
});

describe('hexSubtract', () => {
  it('subtracts components', () => {
    const a = createHex(4, 1);
    const b = createHex(1, 3);
    const result = hexSubtract(a, b);
    expect(result).toEqual({ q: 3, r: -2, s: -1 });
  });

  it('subtracting self yields origin', () => {
    const a = createHex(2, -3);
    const result = hexSubtract(a, a);
    expect(result).toEqual({ q: 0, r: 0, s: 0 });
  });
});

describe('hexToKey', () => {
  it('returns "q,r" format', () => {
    const hex = createHex(3, -2);
    expect(hexToKey(hex)).toBe('3,-2');
  });

  it('handles origin', () => {
    expect(hexToKey(createHex(0, 0))).toBe('0,0');
  });
});

describe('isValidHex', () => {
  const grid: GridSize = { width: 10, height: 8 };

  it('returns true for in-bounds hex', () => {
    const hex = createHex(0, 0);
    expect(isValidHex(hex, grid)).toBe(true);
  });

  it('returns true for last valid hex', () => {
    // col=9, row=7: q=9, r=7 - floor(9/2) = 7 - 4 = 3
    const hex = createHex(9, 3);
    // offset: col=9, row=3+floor(9/2)=3+4=7 => valid
    expect(isValidHex(hex, grid)).toBe(true);
  });

  it('returns false for negative col', () => {
    const hex = createHex(-1, 0);
    expect(isValidHex(hex, grid)).toBe(false);
  });

  it('returns false for col >= width', () => {
    const hex = createHex(10, 0);
    expect(isValidHex(hex, grid)).toBe(false);
  });

  it('returns false for negative row', () => {
    // col=0, row needs to be negative: q=0, r such that r + floor(0/2) < 0 => r < 0
    const hex = createHex(0, -1);
    expect(isValidHex(hex, grid)).toBe(false);
  });

  it('returns false for row >= height', () => {
    // col=0, row = r + floor(0/2) = r, so r >= 8
    const hex = createHex(0, 8);
    expect(isValidHex(hex, grid)).toBe(false);
  });
});

describe('getAllHexes', () => {
  it('returns correct count for 10x8 grid', () => {
    const grid: GridSize = { width: 10, height: 8 };
    const hexes = getAllHexes(grid);
    expect(hexes).toHaveLength(80);
  });

  it('all hexes satisfy cube constraint', () => {
    const grid: GridSize = { width: 4, height: 4 };
    const hexes = getAllHexes(grid);
    for (const h of hexes) {
      expect(h.q + h.r + h.s).toBe(0);
    }
  });

  it('all hexes are valid within the grid', () => {
    const grid: GridSize = { width: 10, height: 8 };
    const hexes = getAllHexes(grid);
    for (const h of hexes) {
      expect(isValidHex(h, grid)).toBe(true);
    }
  });
});

describe('hexLineDraw', () => {
  it('returns single hex when start equals end', () => {
    const hex = createHex(0, 0);
    const line = hexLineDraw(hex, hex);
    expect(line).toHaveLength(1);
    expect(line[0]).toEqual(hex);
  });

  it('returns 2 hexes for adjacent hexes', () => {
    const a = createHex(0, 0);
    const b = createHex(1, 0);
    const line = hexLineDraw(a, b);
    expect(line).toHaveLength(2);
    expect(line[0]).toEqual(a);
    expect(line[1]).toEqual(b);
  });

  it('returns distance+1 hexes for longer line', () => {
    const a = createHex(0, 0);
    const b = createHex(4, -4);
    const dist = cubeDistance(a, b);
    const line = hexLineDraw(a, b);
    expect(line).toHaveLength(dist + 1);
  });

  it('consecutive pairs are adjacent (distance 1)', () => {
    const a = createHex(0, 0);
    const b = createHex(3, -1);
    const line = hexLineDraw(a, b);
    for (let i = 0; i < line.length - 1; i++) {
      expect(cubeDistance(line[i], line[i + 1])).toBe(1);
    }
  });

  it('all hexes in line satisfy cube constraint', () => {
    const a = createHex(1, 2);
    const b = createHex(-2, 4);
    const line = hexLineDraw(a, b);
    for (const h of line) {
      expect(h.q + h.r + h.s).toBe(0);
    }
  });
});

describe('cubeRound', () => {
  it('rounds to nearest integer hex', () => {
    const result = cubeRound(0.1, -0.4, 0.3);
    expect(result).toEqual({ q: 0, r: 0, s: 0 });
  });

  it('satisfies cube constraint', () => {
    const result = cubeRound(1.6, -0.8, -0.8);
    expect(result.q + result.r + result.s).toBe(0);
  });
});

describe('CUBE_DIRECTIONS', () => {
  it('has 6 directions', () => {
    expect(CUBE_DIRECTIONS).toHaveLength(6);
  });

  it('all directions satisfy cube constraint', () => {
    for (const d of CUBE_DIRECTIONS) {
      expect(d.q + d.r + d.s).toBe(0);
    }
  });
});
