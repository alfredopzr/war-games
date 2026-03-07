// NATO palette
// Military map aesthetic prioritizing maximum readability and terrain
// classification. Beige terrain, olive forest, brown topo, white fog border.
// Modeled after 1:50000 topographic military maps.

import { ASH_EMBER, type Palette } from './palette';

export const NATO: Palette = {
  ...ASH_EMBER,
  terrain: { plains: 0xd8d0b8, forest: 0x5a7040, mountain: 0xa09880, city: 0xc0a880 },
  modifier: { river: 0x4080c0, lake: 0x3070b0, bridge: 0x8a7860, highway: 0x606060 },
  map: { grid: 0xa09880, objective: 0xcc2020 },
  topo: { major: 0x8a6040, minor: 0xb09878 },
  fog: { unseen: 0x202018, border: 0xf0ece0 },
  overlay: {
    moveRange: 0x3070b0,
    attackRange: 0xcc2020,
    selectedUnit: 0xf0ece0,
    directiveTarget: 0x3070b0,
    hoverNeutral: 0xf0ece0,
    hoverMove: 0x3070b0,
    hoverAttack: 0xcc2020,
  },
  scene: {
    clear: 0x202018,
    ambient: 0xffffff,
    ambientIntensity: 1.8,
    directional: 0xfff8e8,
    directionalIntensity: 0.5,
  },
};
