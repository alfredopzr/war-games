// =============================================================================
// @hexwar/engine — Public API Surface
// =============================================================================

// Types
export type {
  CubeCoord, AxialCoord, GridSize,
  TerrainType, TerrainDefinition, HexTile,
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

// Noise
export { createNoiseGenerator } from './noise';

// RNG
export { mulberry32 } from './rng';

// Directives
export { executeDirective, resolveTarget } from './directives';

// Commands
export { createCommandPool, spendCommand, canIssueCommand, CP_PER_ROUND, validateDirectiveTarget } from './commands';

// Game state
export {
  createGame, placeUnit, startBattlePhase, executeTurn,
  checkRoundEnd, scoreRound, getWinner,
} from './game-state';

// AI
export { aiBuildPhase, aiBattlePhase } from './ai';
export type { AiBuildAction } from './ai';

// Serialization
export { serializeGameState, deserializeGameState } from './serialization';
export type { SerializableGameState } from './serialization';
