// Desert palette
// Dusty warzone — heat, friction, attrition. Warm terrain tones,
// brown topo lines, orange-tinted fog edges, muted overlays.
// Evokes sandstorm visibility conditions and arid theatre.

import { ASH_EMBER, type Palette } from './palette';

export const DESERT: Palette = {
  ...ASH_EMBER,
  terrain: { plains: 0xb8a078, forest: 0x6a6838, mountain: 0x8a7860, city: 0x987850 },
  modifier: { river: 0x4a6858, lake: 0x3a5848, bridge: 0x7a6848, highway: 0x605040 },
  map: { grid: 0x302820, objective: 0xd0a030 },
  topo: { major: 0x8a7058, minor: 0x605040 },
  fog: { unseen: 0x1a1408, border: 0xc8a060 },
  overlay: {
    moveRange: 0xd0c8a0,
    attackRange: 0xc04030,
    selectedUnit: 0xf0e8c0,
    directiveTarget: 0x40a0d0,
    hoverNeutral: 0xf0e8c0,
    hoverMove: 0x40a0d0,
    hoverAttack: 0xc04030,
  },
  scene: {
    clear: 0x1a1408,
    ambient: 0xffe8c0,
    ambientIntensity: 2.0,
    directional: 0xffd8a0,
    directionalIntensity: 0.8,
  },
};
