// ---------------------------------------------------------------------------
// Palette — data table mapping semantic roles to colors.
//
// Convention:
//   Three.js material colors -> number  (0xRRGGBB)
//   CSS / inline style colors -> string ('#rrggbb')
//
// Palette swaps do NOT automatically rebuild vertex-colored terrain.
// After setPalette(), call renderTerrain() manually.
// ---------------------------------------------------------------------------

import { injectCssPalette } from './css-palette';

export interface Palette {
  terrain: { plains: number; forest: number; mountain: number; city: number };
  modifier: { river: number; lake: number; bridge: number; highway: number };
  map: { grid: number; objective: number };
  topo: { major: number; minor: number };
  fog: { unseen: number; border: number };
  player: {
    p1: { primary: number; light: number; path: number; hud: string };
    p2: { primary: number; light: number; path: number; hud: string };
  };
  overlay: {
    moveRange: number;
    attackRange: number;
    selectedUnit: number;
    directiveTarget: number;
    hoverNeutral: number;
    hoverMove: number;
    hoverAttack: number;
  };
  effect: {
    tracer: number;
    tracerCounter: number;
    death: number;
    revealRing: number;
    damageText: string;
    healText: string;
    revealedText: string;
  };
  unit: {
    ghost: number;
    ghostLabel: string;
    hpHealthy: string;
    hpWarning: string;
    hpCritical: string;
    hpTrack: string;
  };
  scene: {
    clear: number;
    ambient: number;
    ambientIntensity: number;
    directional: number;
    directionalIntensity: number;
  };
}

// ---------------------------------------------------------------------------
// Faction Color Table — electric/neon palette per faction
// ---------------------------------------------------------------------------
// Canonical source. Palette player.p1/p2 are derived from the active faction
// assignment (PLAYER_FACTION in constants.ts). This table is for systems that
// need to look up any faction's color by name: city capture, deploy zones,
// future multi-player.

export interface FactionColors {
  readonly primary: number;
  readonly light: number;
  readonly dark: number;
  readonly css: string;
}

export type FactionId = 'engineer' | 'caravaner' | 'greaser' | 'pistolero' | 'warden';

export const FACTION_COLORS: Record<FactionId, FactionColors> = {
  engineer:  { primary: 0xffee00, light: 0xffff66, dark: 0xccbb00, css: '#ffee00' },
  caravaner: { primary: 0x00ffff, light: 0x66ffff, dark: 0x00cccc, css: '#00ffff' },
  greaser:   { primary: 0xcc44ff, light: 0xdd88ff, dark: 0x9922cc, css: '#cc44ff' },
  pistolero: { primary: 0x00ff66, light: 0x66ff99, dark: 0x00cc44, css: '#00ff66' },
  warden:    { primary: 0xff8800, light: 0xffaa44, dark: 0xcc6600, css: '#ff8800' },
};

export const ASH_EMBER: Palette = {
  // -- Terrain --
  terrain: { plains: 0x6A6A58, forest: 0x3A4030, mountain: 0x505058, city: 0x7A6048 },
  modifier: { river: 0x1A2A3A, lake: 0x1A2A3A, bridge: 0x5A4A3A, highway: 0x252525 },

  // -- Map symbology --
  map: { grid: 0x0a0a10, objective: 0xA08A40 },
  topo: { major: 0x8899aa, minor: 0x445566 },
  fog: { unseen: 0x16160E, border: 0xe8e4d8 },

  // -- Player identity --
  player: {
    p1: { primary: 0xffee00, light: 0xffff66, path: 0xffee00, hud: '#ffee00' },
    p2: { primary: 0x00ffff, light: 0x66ffff, path: 0x00ffff, hud: '#00ffff' },
  },

  // -- Tactical overlay --
  overlay: {
    moveRange: 0xe8e4d8,
    attackRange: 0x9a4a3a,
    selectedUnit: 0xe8e4d8,
    directiveTarget: 0x00ccff,
    hoverNeutral: 0xffffff,
    hoverMove: 0x00ccff,
    hoverAttack: 0x9a4a3a,
  },

  // -- Effects --
  effect: {
    tracer: 0xffff88,
    tracerCounter: 0xdd8833,
    death: 0xff2222,
    revealRing: 0xe8e4d8,
    damageText: '#9a4a3a',
    healText: '#6a8a48',
    revealedText: '#e8e4d8',
  },

  // -- Units --
  unit: {
    ghost: 0x888888,
    ghostLabel: '#aaa',
    hpHealthy: '#6a8a48',
    hpWarning: '#a08a40',
    hpCritical: '#9a4a3a',
    hpTrack: '#333',
  },

  // -- Scene --
  scene: {
    clear: 0x0a0a10,
    ambient: 0xffffff,
    ambientIntensity: 1.8,
    directional: 0xfff5e0,
    directionalIntensity: 0.6,
  },
};

let _palette: Palette = ASH_EMBER;

export function getPalette(): Palette {
  return _palette;
}

export function setPalette(p: Palette): void {
  _palette = p;
  injectCssPalette(p);
}

export function getHpColor(ratio: number): string {
  const p = _palette;
  if (ratio > 0.6) return p.unit.hpHealthy;
  if (ratio > 0.3) return p.unit.hpWarning;
  return p.unit.hpCritical;
}
