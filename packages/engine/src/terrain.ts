import type { TerrainType, TerrainDefinition, UnitType, DirectiveType } from './types';

export const TERRAIN: Record<TerrainType, TerrainDefinition> = {
  plains: {
    type: 'plains',
    moveCost: 1,
    defenseModifier: 0,
    visionModifier: 0,
    blocksLoS: false,
    infantryOnly: false,
  },
  forest: {
    type: 'forest',
    moveCost: 2,
    defenseModifier: 0.25,
    visionModifier: 0,
    blocksLoS: true,
    infantryOnly: false,
  },
  mountain: {
    type: 'mountain',
    moveCost: 3,
    defenseModifier: 0.4,
    visionModifier: 2,
    blocksLoS: false,
    infantryOnly: true,
  },
  city: {
    type: 'city',
    moveCost: 1,
    defenseModifier: 0.3,
    visionModifier: 0,
    blocksLoS: false,
    infantryOnly: false,
  },
} as const;

export function getMoveCost(terrain: TerrainType, unitType: UnitType, directive?: DirectiveType): number {
  const def = TERRAIN[terrain];
  if (def.infantryOnly && unitType !== 'infantry') {
    return Infinity;
  }
  // Flank directives reduce forest cost to 1
  if (terrain === 'forest' && (directive === 'flank-left' || directive === 'flank-right')) {
    return 1;
  }
  return def.moveCost;
}

export function getDefenseModifier(terrain: TerrainType): number {
  return TERRAIN[terrain].defenseModifier;
}

export function getVisionModifier(terrain: TerrainType): number {
  return TERRAIN[terrain].visionModifier;
}
