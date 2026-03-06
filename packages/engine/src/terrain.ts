import type { TerrainType, TerrainDefinition, UnitType, MovementDirective, HexModifier } from './types';
import { UNIT_STATS } from './units';
import { CLIMB_COST_PER_ELEV, CLIMB_THRESHOLD, DOWNHILL_COST_MULT, VISION_ELEV_DIVISOR } from './map-gen-params';

export const TERRAIN: Record<TerrainType, TerrainDefinition> = {
  plains: {
    type: 'plains',
    moveCost: 1,
    defenseModifier: 0,
  },
  forest: {
    type: 'forest',
    moveCost: 2,
    defenseModifier: 0.25,
  },
  mountain: {
    type: 'mountain',
    moveCost: 1,
    defenseModifier: 0,
  },
  city: {
    type: 'city',
    moveCost: 1,
    defenseModifier: 0,
  },
} as const;

export function getMoveCost(
  terrain: TerrainType,
  unitType: UnitType,
  movementDirective?: MovementDirective,
  modifier?: HexModifier,
  elevFrom?: number,
  elevTo?: number,
): number {
  // River and lake: impassable
  if (modifier === 'river' || modifier === 'lake') return Infinity;

  // Bridge: cost 1 for everyone
  if (modifier === 'bridge') return 1;

  // Highway: cost 0.5 for vehicles, no benefit for infantry
  if (modifier === 'highway' && unitType !== 'infantry') return 0.5;

  const def = TERRAIN[terrain];

  // Flank directives reduce forest cost to 1
  let baseCost = def.moveCost;
  if (terrain === 'forest' && (movementDirective === 'flank-left' || movementDirective === 'flank-right')) {
    baseCost = 1;
  }

  // Elevation cost
  if (elevFrom !== undefined && elevTo !== undefined) {
    const delta = elevTo - elevFrom;
    if (delta > 0) {
      // Uphill: check climb threshold
      if (delta > CLIMB_THRESHOLD && !UNIT_STATS[unitType].canClimb) {
        return Infinity;
      }
      baseCost += delta * CLIMB_COST_PER_ELEV;
    } else if (delta < 0) {
      // Downhill
      baseCost += Math.abs(delta) * CLIMB_COST_PER_ELEV * DOWNHILL_COST_MULT;
    }
  }

  return baseCost;
}

export function getDefenseModifier(terrain: TerrainType, modifier?: HexModifier): number {
  // Highway and bridge: fully exposed
  if (modifier === 'highway' || modifier === 'bridge' || modifier === 'lake') return 0;
  return TERRAIN[terrain].defenseModifier;
}

export function getVisionBonus(elevation: number): number {
  return Math.floor(elevation / VISION_ELEV_DIVISOR);
}
