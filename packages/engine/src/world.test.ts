import { describe, it, expect } from 'vitest';
import { hexToWorld, worldToHex, hexWorldVertices, WORLD_HEX_SIZE } from './world';
import { createHex } from './hex';

describe('hexToWorld', () => {
  it('maps origin hex to world origin', () => {
    const w = hexToWorld(createHex(0, 0));
    expect(w.x).toBe(0);
    expect(w.y).toBe(0);
    expect(w.z).toBe(0);
  });

  it('moves right along x for increasing q', () => {
    const w = hexToWorld(createHex(2, 0));
    expect(w.x).toBe(WORLD_HEX_SIZE * 1.5 * 2);
    expect(w.z).toBeCloseTo(WORLD_HEX_SIZE * Math.sqrt(3) / 2 * 2);
  });

  it('y is always 0 (flat grid)', () => {
    const w = hexToWorld(createHex(3, -2));
    expect(w.y).toBe(0);
  });
});

describe('worldToHex', () => {
  it('round-trips through hexToWorld for a grid of hexes', () => {
    for (let q = -5; q <= 5; q++) {
      for (let r = -5; r <= 5; r++) {
        const hex = createHex(q, r);
        const w = hexToWorld(hex);
        const back = worldToHex(w.x, w.z);
        expect(back.q).toBe(q);
        expect(back.r).toBe(r);
        expect(back.s).toBe((-q - r) || 0);
      }
    }
  });

  it('snaps near-center positions to the correct hex', () => {
    const w = hexToWorld(createHex(3, -1));
    const back = worldToHex(w.x + 0.1, w.z - 0.1);
    expect(back.q).toBe(3);
    expect(back.r).toBe(-1);
  });
});

describe('hexWorldVertices', () => {
  it('returns 6 vertices', () => {
    const verts = hexWorldVertices(createHex(0, 0));
    expect(verts).toHaveLength(6);
  });

  it('all vertices are at WORLD_HEX_SIZE distance from center', () => {
    const center = hexToWorld(createHex(0, 0));
    const verts = hexWorldVertices(createHex(0, 0));
    for (const v of verts) {
      const dx = v.x - center.x;
      const dz = v.z - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeCloseTo(WORLD_HEX_SIZE);
    }
  });

  it('all vertices have y=0', () => {
    const verts = hexWorldVertices(createHex(1, 2));
    for (const v of verts) {
      expect(v.y).toBe(0);
    }
  });
});
