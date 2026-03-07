// Neon palette
// Cyber tactical — digital war room. Dark terrain, glowing overlays,
// cyan/magenta accents, minimal fog. Inspired by TRON/cyberpunk HUD
// aesthetics. Maximum overlay visibility at the cost of terrain subtlety.

import { ASH_EMBER, type Palette } from './palette';

export const NEON: Palette = {
  ...ASH_EMBER,
  terrain: { plains: 0x181820, forest: 0x102018, mountain: 0x202028, city: 0x282830 },
  modifier: { river: 0x0a1828, lake: 0x081420, bridge: 0x202020, highway: 0x141418 },
  map: { grid: 0x282838, objective: 0xff00ff },
  topo: { major: 0x3040a0, minor: 0x202060 },
  fog: { unseen: 0x060608, border: 0x00ccff },
  overlay: {
    moveRange: 0x00ccff,
    attackRange: 0xff0088,
    selectedUnit: 0x00ffcc,
    directiveTarget: 0x00ccff,
    hoverNeutral: 0x00ffcc,
    hoverMove: 0x00ccff,
    hoverAttack: 0xff0088,
  },
  effect: {
    ...ASH_EMBER.effect,
    tracer: 0x00ffcc,
    tracerCounter: 0xff8800,
    death: 0xff0044,
    revealRing: 0x00ccff,
    damageText: '#ff0088',
    healText: '#00ffcc',
    revealedText: '#00ccff',
  },
  unit: {
    ...ASH_EMBER.unit,
    ghost: 0x404060,
    ghostLabel: '#6666aa',
    hpHealthy: '#00ffcc',
    hpWarning: '#ffcc00',
    hpCritical: '#ff0088',
    hpTrack: '#1a1a2a',
  },
  scene: {
    clear: 0x060608,
    ambient: 0x8080c0,
    ambientIntensity: 1.6,
    directional: 0x8080ff,
    directionalIntensity: 0.4,
  },
};
