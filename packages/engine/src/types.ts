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
  readonly elevation: number;
}

// -----------------------------------------------------------------------------
// Units
// -----------------------------------------------------------------------------

export type UnitType = 'infantry' | 'tank' | 'artillery' | 'recon' | 'engineer';

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

export type DirectiveType =
  | 'advance'
  | 'hold'
  | 'flank-left'
  | 'flank-right'
  | 'scout'
  | 'support'
  | 'hunt'
  | 'capture';

export type DirectiveTargetType =
  | 'central-objective'
  | 'city'
  | 'enemy-unit'
  | 'friendly-unit'
  | 'hex';

export interface DirectiveTarget {
  readonly type: DirectiveTargetType;
  readonly cityId?: string;
  readonly unitId?: string;
  readonly hex?: CubeCoord;
}

export type PlayerId = 'player1' | 'player2';

export interface Unit {
  readonly id: string;
  readonly type: UnitType;
  readonly owner: PlayerId;
  hp: number;
  position: CubeCoord;
  directive: DirectiveType;
  directiveTarget: DirectiveTarget;
  hasActed: boolean;
}

// -----------------------------------------------------------------------------
// Buildings
// -----------------------------------------------------------------------------

export type BuildingType = 'recon-tower' | 'mortar' | 'mines' | 'defensive-position';

export interface BuildingStats {
  readonly type: BuildingType;
  readonly cost: number;
  readonly visionRange?: number;
  readonly attackRange?: number;
  readonly minAttackRange?: number;
  readonly atk?: number;
  readonly damage?: number;
  readonly defenseBonus?: number;
}

export interface Building {
  readonly id: string;
  readonly type: BuildingType;
  readonly owner: PlayerId;
  readonly position: CubeCoord;
  isRevealed: boolean;
}

// -----------------------------------------------------------------------------
// Actions & Commands
// -----------------------------------------------------------------------------

export type UnitAction =
  | { type: 'move'; targetHex: CubeCoord }
  | { type: 'attack'; targetUnitId: string }
  | { type: 'hold' }
  | { type: 'build'; buildingType: BuildingType; targetHex: CubeCoord };

export type Command =
  | { type: 'redirect'; unitId: string; newDirective: DirectiveType; target?: DirectiveTarget }
  | { type: 'direct-move'; unitId: string; targetHex: CubeCoord }
  | { type: 'direct-attack'; unitId: string; targetUnitId: string }
  | { type: 'direct-build'; unitId: string; buildingType: BuildingType; targetHex: CubeCoord }
  | { type: 'attack-building'; unitId: string; targetBuildingId: string }
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
  readonly elevation: Map<string, number>;
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
  pendingEvents: BattleEvent[];
  buildings: Building[];
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
  cities: Map<string, PlayerId | null>;
}

export interface ResolvedTarget {
  readonly hex: CubeCoord;
  readonly isValid: boolean;
}

// =============================================================================
// Network Protocol Types
// =============================================================================
// Client↔Server message types for WebSocket communication.
// `state` fields use Record<string, unknown> as a transport-level placeholder;
// actual serialization/deserialization uses SerializableGameState from
// serialization.ts at the boundaries.
// =============================================================================

// -----------------------------------------------------------------------------
// Battle Events
// -----------------------------------------------------------------------------

export type BattleEventType =
  | 'kill'
  | 'damage'
  | 'capture'
  | 'recapture'
  | 'capture-damage'
  | 'capture-death'
  | 'objective-change'
  | 'koth-progress'
  | 'round-end'
  | 'game-end'
  | 'mine-triggered'
  | 'mortar-fire'
  | 'building-destroyed';

export interface BattleEvent {
  readonly type: BattleEventType;
  readonly actingPlayer: PlayerId;
  readonly message: string;
}

// -----------------------------------------------------------------------------
// Client → Server Messages
// -----------------------------------------------------------------------------

export interface ClientCreateRoom {
  readonly type: 'create-room';
}

export interface ClientJoinRoom {
  readonly type: 'join-room';
  readonly roomId: string;
}

export interface ClientLeaveRoom {
  readonly type: 'leave-room';
}

export interface ClientReconnect {
  readonly type: 'reconnect';
  readonly roomId: string;
  readonly reconnectToken: string;
}

export interface ClientPlaceUnit {
  readonly type: 'place-unit';
  readonly unitType: UnitType;
  readonly position: CubeCoord;
  readonly directive: DirectiveType;
  readonly target?: DirectiveTarget;
}

export interface ClientRemoveUnit {
  readonly type: 'remove-unit';
  readonly unitId: string;
}

export interface ClientSetDirective {
  readonly type: 'set-directive';
  readonly unitId: string;
  readonly directive: DirectiveType;
  readonly target?: DirectiveTarget;
}

export interface ClientConfirmBuild {
  readonly type: 'confirm-build';
}

export interface ClientSubmitCommands {
  readonly type: 'submit-commands';
  readonly commands: Command[];
}

export type ClientMessage =
  | ClientCreateRoom
  | ClientJoinRoom
  | ClientLeaveRoom
  | ClientReconnect
  | ClientPlaceUnit
  | ClientRemoveUnit
  | ClientSetDirective
  | ClientConfirmBuild
  | ClientSubmitCommands;

// -----------------------------------------------------------------------------
// Server → Client Messages
// -----------------------------------------------------------------------------

export interface ServerRoomCreated {
  readonly type: 'room-created';
  readonly roomId: string;
  readonly playerId: PlayerId;
  readonly reconnectToken: string;
}

export interface ServerRoomJoined {
  readonly type: 'room-joined';
  readonly roomId: string;
  readonly playerId: PlayerId;
  readonly reconnectToken: string;
}

export interface ServerOpponentJoined {
  readonly type: 'opponent-joined';
}

export interface ServerOpponentLeft {
  readonly type: 'opponent-left';
}

export interface ServerRoomError {
  readonly type: 'room-error';
  readonly message: string;
}

export interface ServerGameStart {
  readonly type: 'game-start';
  readonly state: Record<string, unknown>;
  readonly playerId: PlayerId;
}

export interface ServerStateUpdate {
  readonly type: 'state-update';
  readonly state: Record<string, unknown>;
}

export interface ServerBuildConfirmed {
  readonly type: 'build-confirmed';
  readonly playerId: PlayerId;
}

export interface ServerBattleStart {
  readonly type: 'battle-start';
  readonly state: Record<string, unknown>;
}

export interface ServerTurnResult {
  readonly type: 'turn-result';
  readonly state: Record<string, unknown>;
  readonly events: BattleEvent[];
}

export interface ServerRoundEnd {
  readonly type: 'round-end';
  readonly winner: PlayerId | null;
  readonly reason: string;
  readonly state: Record<string, unknown>;
  readonly incomeBreakdown: Record<string, unknown>;
}

export interface ServerGameOver {
  readonly type: 'game-over';
  readonly winner: PlayerId;
  readonly state: Record<string, unknown>;
}

export interface ServerTimerSync {
  readonly type: 'timer-sync';
  readonly phase: 'build' | 'turn';
  readonly remaining: number;
}

export interface ServerOpponentDisconnected {
  readonly type: 'opponent-disconnected';
  readonly reconnectDeadline: number;
}

export interface ServerOpponentReconnected {
  readonly type: 'opponent-reconnected';
}

export interface ServerForfeit {
  readonly type: 'forfeit';
  readonly winner: PlayerId;
  readonly reason: 'disconnect' | 'leave';
}

export type ServerMessage =
  | ServerRoomCreated
  | ServerRoomJoined
  | ServerOpponentJoined
  | ServerOpponentLeft
  | ServerRoomError
  | ServerGameStart
  | ServerStateUpdate
  | ServerBuildConfirmed
  | ServerBattleStart
  | ServerTurnResult
  | ServerRoundEnd
  | ServerGameOver
  | ServerTimerSync
  | ServerOpponentDisconnected
  | ServerOpponentReconnected
  | ServerForfeit;
