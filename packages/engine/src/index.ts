// =============================================================================
// @hexwar/engine — Public API Surface
// =============================================================================

// Types
export type {
  CubeCoord, AxialCoord, GridSize,
  TerrainType, TerrainDefinition, HexTile,
  UnitType, UnitStats, Unit, DirectiveType, PlayerId,
  UnitAction, Command, CommandPool,
  GamePhase, ObjectiveState, PlayerState, RoundState, GameState, GameMap,
  IncomeParams, MapValidation, RoundEndResult, DirectiveContext,
} from './types';

// Hex grid
export {
  createHex, cubeDistance, hexNeighbors, hexAdd, hexSubtract,
  hexToKey, hexLineDraw, isValidHex, getAllHexes, cubeRound,
  CUBE_DIRECTIONS,
} from './hex';

// Terrain
export { TERRAIN, getMoveCost, getDefenseModifier, getVisionModifier } from './terrain';

// Units
export { UNIT_STATS, createUnit, getTypeAdvantage, resetUnitIdCounter } from './units';

// Combat
export { calculateDamage, canAttack } from './combat';

// Pathfinding
export { findPath, pathCost } from './pathfinding';

// Vision
export { calculateVisibility, isUnitVisible } from './vision';

// Economy
export {
  calculateIncome, applyCarryover, applyMaintenance, canAfford,
  BASE_INCOME, CITY_INCOME, KILL_BONUS, ROUND_WIN_BONUS,
  CATCH_UP_BONUS, CARRYOVER_RATE, MAINTENANCE_RATE,
} from './economy';

// Map generation
export { generateMap, validateMap } from './map-gen';

// Directives
export { executeDirective } from './directives';

// Commands
export { createCommandPool, spendCommand, canIssueCommand, CP_PER_ROUND } from './commands';

// Game state
export {
  createGame, placeUnit, startBattlePhase, executeTurn,
  checkRoundEnd, scoreRound, getWinner,
} from './game-state';
