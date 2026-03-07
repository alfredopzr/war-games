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
}

export interface MegaHexInfo {
  readonly center: CubeCoord;
  readonly terrain: TerrainType;
  readonly peakHex: CubeCoord;    // meaningful for mountain only
  readonly peakHeight: number;     // meaningful for mountain only
}

export type HexModifier = 'highway' | 'river' | 'bridge' | 'lake';

export interface HexTile {
  readonly coord: CubeCoord;
  readonly terrain: TerrainType;
  readonly elevation: number;
  readonly modifier?: HexModifier;
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
  readonly canClimb: boolean;
  readonly responseTime: number;
}

export type MovementDirective = 'advance' | 'flank-left' | 'flank-right' | 'patrol' | 'hold';
export type AttackDirective = 'shoot-on-sight' | 'skirmish' | 'retreat-on-contact' | 'hunt' | 'ignore';
export type SpecialtyModifier = 'support' | 'engineer' | 'sniper';

export type DirectiveTargetType = 'enemy-unit' | 'friendly-unit' | 'hex' | 'deployment-zone';

export interface DirectiveTarget {
  readonly type: DirectiveTargetType;
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
  movementDirective: MovementDirective;
  attackDirective: AttackDirective;
  specialtyModifier: SpecialtyModifier | null;
  directiveTarget: DirectiveTarget;
  hasActed: boolean;
  huntTargetId?: string;
  huntLockTurns?: number;
  patrolRadius?: number;
  huntPriorityType?: UnitType;
}

// -----------------------------------------------------------------------------
// Actions & Commands
// -----------------------------------------------------------------------------

export type UnitAction =
  | { type: 'move'; targetHex: CubeCoord }
  | { type: 'attack'; targetUnitId: string }
  | { type: 'hold' };

export interface Command {
  type: 'redirect';
  unitId: string;
  newMovementDirective: MovementDirective;
  newAttackDirective: AttackDirective;
  newSpecialtyModifier: SpecialtyModifier | null;
  target?: DirectiveTarget;
  patrolRadius?: number;
  huntPriorityType?: UnitType;
}

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
  maxTurns: number;
  turnsPlayed: number;
  commandPools: Record<PlayerId, CommandPool>;
  objective: ObjectiveState;
  unitsKilledThisRound: Record<PlayerId, number>;
}

export interface GameMap {
  readonly terrain: Map<string, TerrainType>;
  readonly elevation: Map<string, number>;
  readonly modifiers: Map<string, HexModifier>;
  readonly megaHexes: Map<string, string>;
  readonly megaHexInfo: Map<string, MegaHexInfo>;
  readonly centralObjective: CubeCoord;
  readonly player1Deployment: CubeCoord[];
  readonly player2Deployment: CubeCoord[];
  readonly gridSize: GridSize;
  readonly mapRadius: number;
  readonly seed: number;
}

export interface GameState {
  phase: GamePhase;
  players: Record<PlayerId, PlayerState>;
  round: RoundState;
  map: GameMap;
  unitStats: Record<UnitType, UnitStats>;
  maxRounds: number;
  winner: PlayerId | null;
  cityOwnership: Map<string, PlayerId | null>;
  pendingEvents: BattleEvent[];
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
  elevation: Map<string, number>;
  modifiers: Map<string, HexModifier>;
  centralObjective: CubeCoord;
  cities: Map<string, PlayerId | null>;
  unitStats: Record<UnitType, UnitStats>;
  mapRadius: number;
  deploymentZone: CubeCoord[];
}

export interface ResolvedTarget {
  readonly hex: CubeCoord;
  readonly isValid: boolean;
}

// -----------------------------------------------------------------------------
// Resolution Pipeline
// -----------------------------------------------------------------------------

export type ApproachCategory = 'rear' | 'flank' | 'front';

export interface TurnIntent {
  readonly unitId: string;
  readonly owner: PlayerId;
  readonly movementDirective: MovementDirective;
  readonly attackDirective: AttackDirective;
  readonly specialtyModifier: SpecialtyModifier | null;
  readonly targetHex: CubeCoord;
  readonly path: CubeCoord[];
  readonly facing: CubeCoord;
  readonly huntTargetId?: string;
  readonly huntLockTurns?: number;
  readonly priorityType?: UnitType;
}

export interface Engagement {
  readonly attackerId: string;
  readonly defenderId: string;
  readonly distance: number;
  readonly approachCategory: ApproachCategory;
  readonly isIntercept: boolean;
  responseTime: number;
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
// Battle Events — Discriminated Union
// -----------------------------------------------------------------------------
// Canonical event schema. See docs/EVENT_LOG_SPEC.md for the full contract.
// Each variant maps to a phase in the 10-phase resolution pipeline.
// -----------------------------------------------------------------------------

export type BattleEventPhase = 'movement' | 'combat' | 'capture' | 'objective' | 'round';

interface BattleEventBase {
  readonly actingPlayer: PlayerId;
  readonly phase: BattleEventPhase;
  readonly pipelinePhase: number;
}

// --- Emitted now ---

export interface BattleEventMove extends BattleEventBase {
  readonly type: 'move';
  readonly unitId: string;
  readonly unitType: UnitType;
  readonly movementDirective: MovementDirective;
  readonly from: CubeCoord;
  readonly to: CubeCoord;
}

export interface BattleEventDamage extends BattleEventBase {
  readonly type: 'damage';
  readonly attackerId: string;
  readonly attackerType: UnitType;
  readonly attackerPosition: CubeCoord;
  readonly attackerAttackDirective: AttackDirective;
  readonly defenderId: string;
  readonly defenderType: UnitType;
  readonly defenderPosition: CubeCoord;
  readonly damage: number;
  readonly defenderHpAfter: number;
  readonly defenderTerrain: TerrainType;
  readonly approachCategory: ApproachCategory;
  readonly response?: 'none';
}

export interface BattleEventKill extends BattleEventBase {
  readonly type: 'kill';
  readonly attackerId: string;
  readonly attackerType: UnitType;
  readonly attackerPosition: CubeCoord;
  readonly attackerAttackDirective: AttackDirective;
  readonly defenderId: string;
  readonly defenderType: UnitType;
  readonly defenderPosition: CubeCoord;
  readonly damage: number;
  readonly defenderTerrain: TerrainType;
  readonly approachCategory: ApproachCategory;
}

export interface BattleEventCapture extends BattleEventBase {
  readonly type: 'capture';
  readonly unitId: string;
  readonly unitType: UnitType;
  readonly cityKey: string;
  readonly previousOwner: PlayerId | null;
}

export interface BattleEventRecapture extends BattleEventBase {
  readonly type: 'recapture';
  readonly unitId: string;
  readonly unitType: UnitType;
  readonly cityKey: string;
  readonly previousOwner: PlayerId;
}

export interface BattleEventCaptureDamage extends BattleEventBase {
  readonly type: 'capture-damage';
  readonly unitId: string;
  readonly unitType: UnitType;
  readonly cityKey: string;
  readonly captureCost: number;
  readonly hpAfter: number;
}

export interface BattleEventCaptureDeath extends BattleEventBase {
  readonly type: 'capture-death';
  readonly unitId: string;
  readonly unitType: UnitType;
  readonly cityKey: string;
  readonly captureCost: number;
}

export interface BattleEventObjectiveChange extends BattleEventBase {
  readonly type: 'objective-change';
  readonly objectiveHex: CubeCoord;
  readonly previousOccupier: PlayerId | null;
  readonly newOccupier: PlayerId | null;
  readonly unitId?: string;
  readonly unitType?: UnitType;
}

export interface BattleEventKothProgress extends BattleEventBase {
  readonly type: 'koth-progress';
  readonly occupier: PlayerId;
  readonly turnsHeld: number;
  readonly citiesHeld: number;
}

export interface BattleEventRoundEnd extends BattleEventBase {
  readonly type: 'round-end';
  readonly winner: PlayerId | null;
  readonly reason: 'king-of-the-hill' | 'elimination' | 'turn-limit';
}

export interface BattleEventGameEnd extends BattleEventBase {
  readonly type: 'game-end';
  readonly winner: PlayerId;
}

export interface BattleEventHeal extends BattleEventBase {
  readonly type: 'heal';
  readonly healerId: string;
  readonly healerType: UnitType;
  readonly targetId: string;
  readonly targetType: UnitType;
  readonly targetPosition: CubeCoord;
  readonly healAmount: number;
  readonly targetHpAfter: number;
}

// --- Defined now, emitted in Sprint 3/4 ---

export interface BattleEventIntercept extends BattleEventBase {
  readonly type: 'intercept';
  readonly attackerId: string;
  readonly attackerType: UnitType;
  readonly attackerPosition: CubeCoord;
  readonly defenderId: string;
  readonly defenderType: UnitType;
  readonly hex: CubeCoord;
  readonly damage: number;
  readonly defenderResponse: 'engage' | 'skirmish' | 'flee' | 'none';
}

export interface BattleEventCounter extends BattleEventBase {
  readonly type: 'counter';
  readonly attackerId: string;
  readonly attackerType: UnitType;
  readonly attackerPosition: CubeCoord;
  readonly attackerAttackDirective: AttackDirective;
  readonly defenderId: string;
  readonly defenderType: UnitType;
  readonly defenderPosition: CubeCoord;
  readonly damage: number;
  readonly defenderHpAfter: number;
  readonly defenderTerrain: TerrainType;
  readonly approachCategory: ApproachCategory;
}

export interface BattleEventMelee extends BattleEventBase {
  readonly type: 'melee';
  readonly unitAId: string;
  readonly unitAType: UnitType;
  readonly unitBId: string;
  readonly unitBType: UnitType;
  readonly hex: CubeCoord;
}

export interface BattleEventReveal extends BattleEventBase {
  readonly type: 'reveal';
  readonly unitId: string;
  readonly unitType: UnitType;
  readonly unitPosition: CubeCoord;
  readonly hexes: CubeCoord[];
}

export interface BattleEventTurnStart extends BattleEventBase {
  readonly type: 'turn-start';
  readonly turnNumber: number;
  readonly p1CommandsRemaining: number;
  readonly p2CommandsRemaining: number;
  readonly p1UnitsAlive: number;
  readonly p2UnitsAlive: number;
  readonly p1OutOfRangeUnits: number;
  readonly p2OutOfRangeUnits: number;
}

export type BattleEvent =
  | BattleEventTurnStart
  | BattleEventMove
  | BattleEventDamage
  | BattleEventKill
  | BattleEventCapture
  | BattleEventRecapture
  | BattleEventCaptureDamage
  | BattleEventCaptureDeath
  | BattleEventObjectiveChange
  | BattleEventKothProgress
  | BattleEventRoundEnd
  | BattleEventGameEnd
  | BattleEventHeal
  | BattleEventIntercept
  | BattleEventCounter
  | BattleEventMelee
  | BattleEventReveal;

export type BattleEventType = BattleEvent['type'];

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
  readonly movementDirective: MovementDirective;
  readonly attackDirective: AttackDirective;
  readonly specialtyModifier: SpecialtyModifier | null;
  readonly target?: DirectiveTarget;
}

export interface ClientRemoveUnit {
  readonly type: 'remove-unit';
  readonly unitId: string;
}

export interface ClientSetDirective {
  readonly type: 'set-directive';
  readonly unitId: string;
  readonly movementDirective: MovementDirective;
  readonly attackDirective: AttackDirective;
  readonly specialtyModifier: SpecialtyModifier | null;
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
  readonly events: BattleEvent[];
  readonly incomeBreakdown: Record<string, unknown>;
}

export interface ServerGameOver {
  readonly type: 'game-over';
  readonly winner: PlayerId;
  readonly state: Record<string, unknown>;
  readonly events: BattleEvent[];
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
