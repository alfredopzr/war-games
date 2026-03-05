import type { TerrainType, TerrainDefinition, UnitType, DirectiveType, HexModifier } from './types';

export const TERRAIN: Record<TerrainType, TerrainDefinition> = {
  plains: {
    type: 'plains',
    moveCost: 1,
    defenseModifier: 0,
    blocksLoS: false,
    infantryOnly: false,
  },
  forest: {
    type: 'forest',
    moveCost: 2,
    defenseModifier: 0.25,
    blocksLoS: true,
    infantryOnly: false,
  },
  mountain: {
    type: 'mountain',
    moveCost: 3,
    defenseModifier: 0.4,
    blocksLoS: false,
    infantryOnly: true,
  },
  city: {
    type: 'city',
    moveCost: 1,
    defenseModifier: 0.3,
    blocksLoS: false,
    infantryOnly: false,
  },
} as const;

export function getMoveCost(terrain: TerrainType, unitType: UnitType, directive?: DirectiveType, modifier?: HexModifier): number {
  // River and lake: impassable
  if (modifier === 'river' || modifier === 'lake') return Infinity;

  // Bridge: cost 1 for everyone
  if (modifier === 'bridge') return 1;

  // Highway: cost 0.5 for vehicles, no benefit for infantry
  if (modifier === 'highway' && unitType !== 'infantry') return 0.5;

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

export function getDefenseModifier(terrain: TerrainType, modifier?: HexModifier): number {
  // Highway and bridge: fully exposed
  if (modifier === 'highway' || modifier === 'bridge' || modifier === 'lake') return 0;
  return TERRAIN[terrain].defenseModifier;
}

export function getVisionBonus(elevation: number): number {
  return Math.floor(Math.sqrt(elevation));
}
