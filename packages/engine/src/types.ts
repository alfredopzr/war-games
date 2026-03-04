// =============================================================================
// HexWar — Comprehensive Type Definitions
// =============================================================================
// ALL shared types for Phase 1 live here. Other modules import from this file.
// Do NOT define types in other files unless they are purely module-internal.
// =============================================================================

// -----------------------------------------------------------------------------
// Coordinates & Grid
// -----------------------------------------------------------------------------

/** Cube coordinate for hex grid. Invariant: q + r + s === 0 */
export interface CubeCoord {
  readonly q: number;
  readonly r: number;
  readonly s: number;
}

export interface AxialCoord {
  readonly q: number;
  readonly r: number;
}

export interface GridSize {
  readonly width: number;
  readonly height: number;
}

// -----------------------------------------------------------------------------
// Terrain
// -----------------------------------------------------------------------------

export type TerrainType = 'plains' | 'forest' | 'mountain' | 'city';

export interface TerrainDefinition {
  readonly type: TerrainType;
  readonly moveCost: number;
  readonly defenseModifier: number;
  readonly visionModifier: number;
  readonly blocksLoS: boolean;
  readonly infantryOnly: boolean;
}

export interface HexTile {
  readonly coord: CubeCoord;
  readonly terrain: TerrainType;
}

// -----------------------------------------------------------------------------
// Units
// -----------------------------------------------------------------------------

export type UnitType = 'infantry' | 'tank' | 'artillery' | 'recon';

export interface UnitStats {
  readonly type: UnitType;
  readonly cost: number;
  readonly maxHp: number;
  readonly atk: number;
  readonly def: number;
  readonly moveRange: number;
  readonly attackRange: number;
  readonly minAttackRange: number;
  readonly visionRange: number;
}

export type DirectiveType = 'advance' | 'hold' | 'flank-left' | 'flank-right' | 'scout' | 'support';

export type PlayerId = 'player1' | 'player2';

export interface Unit {
  readonly id: string;
  readonly type: UnitType;
  readonly owner: PlayerId;
  hp: number;
  position: CubeCoord;
  directive: DirectiveType;
  hasActed: boolean;
}

// -----------------------------------------------------------------------------
// Actions & Commands
// -----------------------------------------------------------------------------

export type UnitAction =
  | { type: 'move'; targetHex: CubeCoord }
  | { type: 'attack'; targetUnitId: string }
  | { type: 'hold' };

export type Command =
  | { type: 'redirect'; unitId: string; newDirective: DirectiveType }
  | { type: 'direct-move'; unitId: string; targetHex: CubeCoord }
  | { type: 'direct-attack'; unitId: string; targetUnitId: string }
  | { type: 'retreat'; unitId: string };

export interface CommandPool {
  remaining: number;
  commandedUnitIds: Set<string>;
}

// -----------------------------------------------------------------------------
// Game State
// -----------------------------------------------------------------------------

export type GamePhase = 'build' | 'battle' | 'scoring' | 'game-over';

export interface ObjectiveState {
  occupiedBy: PlayerId | null;
  turnsHeld: number;
}

export interface PlayerState {
  readonly id: PlayerId;
  resources: number;
  units: Unit[];
  roundsWon: number;
}

export interface RoundState {
  roundNumber: number;
  turnNumber: number;
  currentPlayer: PlayerId;
  maxTurnsPerSide: number;
  turnsPlayed: Record<PlayerId, number>;
  commandPool: CommandPool;
  objective: ObjectiveState;
  unitsKilledThisRound: Record<PlayerId, number>;
}

export interface GameMap {
  readonly terrain: Map<string, TerrainType>;
  readonly centralObjective: CubeCoord;
  readonly player1Deployment: CubeCoord[];
  readonly player2Deployment: CubeCoord[];
  readonly gridSize: GridSize;
}

export interface GameState {
  phase: GamePhase;
  players: Record<PlayerId, PlayerState>;
  round: RoundState;
  map: GameMap;
  maxRounds: number;
  winner: PlayerId | null;
  cityOwnership: Map<string, PlayerId | null>;
}

// -----------------------------------------------------------------------------
// Economy
// -----------------------------------------------------------------------------

export interface IncomeParams {
  readonly citiesHeld: number;
  readonly unitsKilled: number;
  readonly wonRound: boolean;
  readonly lostRound: boolean;
}

// -----------------------------------------------------------------------------
// Map Validation
// -----------------------------------------------------------------------------

export interface MapValidation {
  valid: boolean;
  isSymmetric: boolean;
  errors: string[];
}

// -----------------------------------------------------------------------------
// Round Resolution
// -----------------------------------------------------------------------------

export interface RoundEndResult {
  roundOver: boolean;
  winner: PlayerId | null;
  reason: 'king-of-the-hill' | 'elimination' | 'turn-limit' | null;
}

// -----------------------------------------------------------------------------
// Directive AI Context
// -----------------------------------------------------------------------------

export interface DirectiveContext {
  friendlyUnits: Unit[];
  enemyUnits: Unit[];
  terrain: Map<string, TerrainType>;
  centralObjective: CubeCoord;
  gridSize: GridSize;
}
