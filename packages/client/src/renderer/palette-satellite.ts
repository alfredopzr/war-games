// Satellite palette
// Aerial reconnaissance — dark terrain as seen from orbit, minimal topo,
// dim fog, bright overlays. Simulates night-vision or IR surveillance feed.
// Units and tactical markers must stand out against near-black ground.

import { ASH_EMBER, type Palette } from './palette';

export const SATELLITE: Palette = {
  ...ASH_EMBER,
  terrain: { plains: 0x283028, forest: 0x1a2818, mountain: 0x383838, city: 0x404038 },
  modifier: { river: 0x182838, lake: 0x102030, bridge: 0x303028, highway: 0x1a1a1a },
  map: { grid: 0x1a1a18, objective: 0xc0a030 },
  topo: { major: 0x404840, minor: 0x2a322a },
  fog: { unseen: 0x0a0a08, border: 0x506050 },
  overlay: {
    moveRange: 0x40cc80,
    attackRange: 0xff4040,
    selectedUnit: 0x60ff90,
    directiveTarget: 0x40ccff,
    hoverNeutral: 0x60ff90,
    hoverMove: 0x40ccff,
    hoverAttack: 0xff4040,
  },
  effect: {
    ...ASH_EMBER.effect,
    tracer: 0x80ff80,
    death: 0xff4040,
    revealRing: 0x40cc80,
  },
  scene: {
    clear: 0x0a0a08,
    ambient: 0xc0d0c0,
    ambientIntensity: 1.4,
    directional: 0xd0e0d0,
    directionalIntensity: 0.3,
  },
};
