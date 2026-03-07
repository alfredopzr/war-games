// Winter palette
// Sterile clarity — cold, quiet, strategic. High brightness terrain,
// low saturation, dark fog, thin grey topo lines. Snow-covered battlefield
// where unit overlays pop against bleached ground.

import { ASH_EMBER, type Palette } from './palette';

export const WINTER: Palette = {
  ...ASH_EMBER,
  terrain: { plains: 0xc8c4b8, forest: 0x8a9a8a, mountain: 0xa0a0aa, city: 0x9a9088 },
  modifier: { river: 0x4a6080, lake: 0x3a5070, bridge: 0x8a8078, highway: 0x707068 },
  map: { grid: 0x9a9890, objective: 0xc0a850 },
  topo: { major: 0x8888a0, minor: 0xaaaabc },
  fog: { unseen: 0x1a1a22, border: 0xd0ccc0 },
  overlay: {
    moveRange: 0x4488cc,
    attackRange: 0xcc4444,
    selectedUnit: 0xffffff,
    directiveTarget: 0x44aaff,
    hoverNeutral: 0xffffff,
    hoverMove: 0x44aaff,
    hoverAttack: 0xcc4444,
  },
  scene: {
    clear: 0x1a1a22,
    ambient: 0xd8dce8,
    ambientIntensity: 2.0,
    directional: 0xe8e4f0,
    directionalIntensity: 0.4,
  },
};
