// =============================================================================
// @hexwar/engine — Public API Surface
// =============================================================================

// Types
export type {
  CubeCoord, AxialCoord, GridSize,
  TerrainType, TerrainDefinition, HexTile, HexModifier, MegaHexInfo,
  UnitType, UnitStats, Unit, DirectiveType, DirectiveTarget, DirectiveTargetType, PlayerId,
  UnitAction, Command, CommandPool,
  GamePhase, ObjectiveState, PlayerState, RoundState, GameState, GameMap,
  IncomeParams, MapValidation, RoundEndResult, DirectiveContext, ResolvedTarget,
  // Network protocol
  BattleEvent, BattleEventType,
  ClientCreateRoom, ClientJoinRoom, ClientLeaveRoom, ClientReconnect,
  ClientPlaceUnit, ClientRemoveUnit, ClientSetDirective,
  ClientConfirmBuild, ClientSubmitCommands, ClientMessage,
  ServerRoomCreated, ServerRoomJoined, ServerOpponentJoined, ServerOpponentLeft,
  ServerRoomError, ServerGameStart, ServerStateUpdate, ServerBuildConfirmed,
  ServerBattleStart, ServerTurnResult, ServerRoundEnd, ServerGameOver,
  ServerTimerSync, ServerOpponentDisconnected, ServerOpponentReconnected,
  ServerForfeit, ServerMessage,
} from './types';

// Hex grid
export {
  createHex, cubeDistance, hexNeighbors, hexAdd, hexSubtract,
  hexToKey, hexLineDraw, isValidHex, getAllHexes, cubeRound,
  hexesInRadius, CUBE_DIRECTIONS,
} from './hex';

// Terrain
export { TERRAIN, getMoveCost, getDefenseModifier, getVisionBonus } from './terrain';

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

// Noise
export { createNoiseGenerator } from './noise';

// RNG
export { mulberry32 } from './rng';

// Data structures
export { MinHeap } from './min-heap';

// Directives
export { executeDirective, resolveTarget } from './directives';

// Commands
export { createCommandPool, spendCommand, canIssueCommand, CP_PER_ROUND, validateDirectiveTarget } from './commands';

// Game state
export {
  createGame, placeUnit, startBattlePhase, filterValidCommands, executeTurn,
  checkRoundEnd, scoreRound, getWinner,
} from './game-state';

// AI
export { aiBuildPhase, aiBattlePhase } from './ai';
export type { AiBuildAction } from './ai';

// World coordinates
export {
  hexToWorld, worldToHex, hexWorldVertices,
  WORLD_HEX_SIZE, WORLD_ELEV_STEP,
} from './world';
export type { WorldCoord } from './world';

// Serialization
export { serializeGameState, deserializeGameState } from './serialization';
export type { SerializableGameState } from './serialization';

// Map generation parameters
export {
  R_MACRO, R_MINI, MACRO_SPACING,
  LAND_PCT_PLAINS, LAND_PCT_FOREST, LAND_PCT_MOUNTAIN, LAND_PCT_CITY,
  LAND_PCT_TOLERANCE, LAND_NOISE_FREQ,
  MTN_CLUSTER_WEIGHT, CITY_MIN_MACRO_DIST, FOREST_PLAINS_WEIGHT,
  DEPLOY_CORNERS_2P, DEPLOY_TERRAIN, DEPLOY_ELEV,
  CITY_COUNT, CITY_MIN_DIST, CITY_MIN_DEPLOY_DIST, CITY_ELEV_MAX,
  MTN_PEAK_MIN, MTN_PEAK_MAX, MTN_PEAK_OFFSET, MTN_BASE_ELEV,
  MTN_FALLOFF_EXP, MTN_DIR_OCTAVES, MTN_DIR_AMP,
  MTN_SLOPE_ROUGHNESS, MTN_SLOPE_MOMENTUM, MTN_SLOPE_NOISE_FREQ,
  PLAINS_ELEV_RANGE, FOREST_ELEV_RANGE, CITY_ELEV_RANGE, ELEV_NOISE_FREQ,
  MAX_REROLL, FAIR_CITY_DIST_THRESHOLD, FAIR_TERRAIN_MIX_THRESHOLD,
  FAIR_PATH_COST_THRESHOLD, FAIR_MTN_WALL_THRESHOLD, FAIR_CITY_CLUSTER_THRESHOLD,
  RIVER_ENABLED, RIVER_COUNT, BRIDGES_PER_RIVER, BRIDGE_MIN_SPACING,
  RIVER_DEPLOY_BUFFER, RIVER_MIN_LENGTH,
  RIVER_DOWNHILL_WEIGHT, RIVER_MEANDER, RIVER_MIN_DROP,
  RIVER_LAKE_RADIUS, RIVER_DELTA_BRANCHES, RIVER_DELTA_MAX_LENGTH,
  RIVER_DELTA_ELEV_THRESHOLD,
  HIGHWAY_ENABLED, HIGHWAY_COUNT,
} from './map-gen-params';
