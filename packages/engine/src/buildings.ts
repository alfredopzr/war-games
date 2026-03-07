import type {
  BuildingType,
  BuildingStats,
  Building,
  PlayerId,
  CubeCoord,
  GameState,
} from './types';
import { cubeDistance, hexToKey } from './hex';

// =============================================================================
// Building Stats
// =============================================================================

export const BUILDING_STATS: Record<BuildingType, BuildingStats> = {
  'recon-tower': {
    type: 'recon-tower',
    cost: 75,
    visionRange: 4,
  },
  mortar: {
    type: 'mortar',
    cost: 150,
    attackRange: 3,
    minAttackRange: 2,
    atk: 2,
  },
  mines: {
    type: 'mines',
    cost: 50,
    damage: 2,
  },
  'defensive-position': {
    type: 'defensive-position',
    cost: 100,
    defenseBonus: 0.5,
  },
} as const;

// =============================================================================
// Building Creation
// =============================================================================

let buildingIdCounter = 0;

export function createBuilding(type: BuildingType, owner: PlayerId, position: CubeCoord): Building {
  buildingIdCounter += 1;
  return {
    id: `building-${buildingIdCounter}`,
    type,
    owner,
    position,
    isRevealed: type !== 'mines',
  };
}

export function resetBuildingIdCounter(): void {
  buildingIdCounter = 0;
}

// =============================================================================
// Build Validation
// =============================================================================

export interface BuildValidation {
  valid: boolean;
  reason?: string;
}

export function validateBuild(
  state: GameState,
  unitId: string,
  playerId: PlayerId,
  buildingType: BuildingType,
  targetHex: CubeCoord,
): BuildValidation {
  const unit = state.players[playerId].units.find((u) => u.id === unitId);
  if (!unit) return { valid: false, reason: 'Unit not found' };
  if (unit.type !== 'engineer') return { valid: false, reason: 'Only engineers can build' };
  if (unit.hasActed) return { valid: false, reason: 'Engineer has already acted this turn' };

  const dist = cubeDistance(unit.position, targetHex);
  if (dist !== 1) return { valid: false, reason: 'Target hex must be adjacent to engineer' };

  const targetKey = hexToKey(targetHex);

  if (!state.map.terrain.has(targetKey)) {
    return { valid: false, reason: 'Target hex does not exist' };
  }

  if (state.map.terrain.get(targetKey) === 'mountain') {
    return { valid: false, reason: 'Cannot build on a mountain' };
  }

  const dzKeys = new Set([
    ...state.map.player1Deployment.map(hexToKey),
    ...state.map.player2Deployment.map(hexToKey),
  ]);
  if (dzKeys.has(targetKey)) {
    return { valid: false, reason: 'Cannot build on a deployment zone hex' };
  }

  const existingBuilding = state.buildings.some((b) => hexToKey(b.position) === targetKey);
  if (existingBuilding) {
    return { valid: false, reason: 'A building already exists on that hex' };
  }

  const cost = BUILDING_STATS[buildingType].cost;
  if (state.players[playerId].resources < cost) {
    return { valid: false, reason: 'Cannot afford this building' };
  }

  return { valid: true };
}
