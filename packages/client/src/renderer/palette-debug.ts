// Debug palette
// Contrast diagnostic — engineering tool. Extremely high contrast terrain,
// saturated colors, bright overlays. Each terrain type is a distinct hue
// to expose terrain classification bugs and boundary errors.

import { ASH_EMBER, type Palette } from './palette';

export const DEBUG: Palette = {
  ...ASH_EMBER,
  terrain: { plains: 0x44aa44, forest: 0x006600, mountain: 0x888888, city: 0xcc8800 },
  modifier: { river: 0x0044ff, lake: 0x0033cc, bridge: 0x884400, highway: 0x444444 },
  map: { grid: 0x333333, objective: 0xff00ff },
  topo: { major: 0xffffff, minor: 0xaaaaaa },
  fog: { unseen: 0x000000, border: 0xffffff },
  overlay: {
    moveRange: 0x0088ff,
    attackRange: 0xff0000,
    selectedUnit: 0xffffff,
    directiveTarget: 0x00ffff,
    hoverNeutral: 0xffffff,
    hoverMove: 0x00ffff,
    hoverAttack: 0xff0000,
  },
  effect: {
    ...ASH_EMBER.effect,
    tracer: 0xffff00,
    death: 0xff0000,
    revealRing: 0xffffff,
    damageText: '#ff0000',
    healText: '#00ff00',
    revealedText: '#ffffff',
  },
  unit: {
    ...ASH_EMBER.unit,
    ghost: 0xaaaaaa,
    ghostLabel: '#ffffff',
    hpHealthy: '#00ff00',
    hpWarning: '#ffff00',
    hpCritical: '#ff0000',
    hpTrack: '#222222',
  },
  scene: {
    clear: 0x000000,
    ambient: 0xffffff,
    ambientIntensity: 2.5,
    directional: 0xffffff,
    directionalIntensity: 1.0,
  },
};
