// =============================================================================
// HexWar — Serialization Utilities
// =============================================================================
// Converts GameState (which uses Map and Set internally) to/from plain objects
// that survive JSON serialization (e.g. over Socket.io).
// =============================================================================

import type {
  GameState,
  GameMap,
  GamePhase,
  RoundState,
  CommandPool,
  PlayerState,
  PlayerId,
  TerrainType,
  CubeCoord,
  GridSize,
  ObjectiveState,
} from './types';

// -----------------------------------------------------------------------------
// Serializable Interfaces (Map → Record, Set → string[])
// -----------------------------------------------------------------------------

interface SerializableCommandPool {
  remaining: number;
  commandedUnitIds: string[];
}

interface SerializableRoundState {
  roundNumber: number;
  turnNumber: number;
  currentPlayer: PlayerId;
  maxTurnsPerSide: number;
  turnsPlayed: Record<PlayerId, number>;
  commandPool: SerializableCommandPool;
  objective: ObjectiveState;
  unitsKilledThisRound: Record<PlayerId, number>;
}

interface SerializableGameMap {
  readonly terrain: Record<string, TerrainType>;
  readonly centralObjective: CubeCoord;
  readonly player1Deployment: CubeCoord[];
  readonly player2Deployment: CubeCoord[];
  readonly gridSize: GridSize;
}

export interface SerializableGameState {
  phase: GamePhase;
  players: Record<PlayerId, PlayerState>;
  round: SerializableRoundState;
  map: SerializableGameMap;
  maxRounds: number;
  winner: PlayerId | null;
  cityOwnership: Record<string, PlayerId | null>;
}

// -----------------------------------------------------------------------------
// Serialize
// -----------------------------------------------------------------------------

function serializeCommandPool(pool: CommandPool): SerializableCommandPool {
  return {
    remaining: pool.remaining,
    commandedUnitIds: [...pool.commandedUnitIds],
  };
}

function serializeRoundState(round: RoundState): SerializableRoundState {
  return {
    roundNumber: round.roundNumber,
    turnNumber: round.turnNumber,
    currentPlayer: round.currentPlayer,
    maxTurnsPerSide: round.maxTurnsPerSide,
    turnsPlayed: { ...round.turnsPlayed },
    commandPool: serializeCommandPool(round.commandPool),
    objective: { ...round.objective },
    unitsKilledThisRound: { ...round.unitsKilledThisRound },
  };
}

function serializeGameMap(map: GameMap): SerializableGameMap {
  const terrain: Record<string, TerrainType> = {};
  for (const [key, value] of map.terrain) {
    terrain[key] = value;
  }
  return {
    terrain,
    centralObjective: map.centralObjective,
    player1Deployment: map.player1Deployment,
    player2Deployment: map.player2Deployment,
    gridSize: map.gridSize,
  };
}

export function serializeGameState(state: GameState): SerializableGameState {
  const cityOwnership: Record<string, PlayerId | null> = {};
  for (const [key, value] of state.cityOwnership) {
    cityOwnership[key] = value;
  }

  return {
    phase: state.phase,
    players: {
      player1: { ...state.players.player1, units: state.players.player1.units.map((u) => ({ ...u, position: { ...u.position } })) },
      player2: { ...state.players.player2, units: state.players.player2.units.map((u) => ({ ...u, position: { ...u.position } })) },
    },
    round: serializeRoundState(state.round),
    map: serializeGameMap(state.map),
    maxRounds: state.maxRounds,
    winner: state.winner,
    cityOwnership,
  };
}

// -----------------------------------------------------------------------------
// Deserialize
// -----------------------------------------------------------------------------

function deserializeCommandPool(data: SerializableCommandPool): CommandPool {
  return {
    remaining: data.remaining,
    commandedUnitIds: new Set(data.commandedUnitIds),
  };
}

function deserializeRoundState(data: SerializableRoundState): RoundState {
  return {
    roundNumber: data.roundNumber,
    turnNumber: data.turnNumber,
    currentPlayer: data.currentPlayer,
    maxTurnsPerSide: data.maxTurnsPerSide,
    turnsPlayed: { ...data.turnsPlayed },
    commandPool: deserializeCommandPool(data.commandPool),
    objective: { ...data.objective },
    unitsKilledThisRound: { ...data.unitsKilledThisRound },
  };
}

function deserializeGameMap(data: SerializableGameMap): GameMap {
  const terrain = new Map<string, TerrainType>();
  for (const key of Object.keys(data.terrain)) {
    const value = data.terrain[key];
    if (value !== undefined) {
      terrain.set(key, value);
    }
  }
  return {
    terrain,
    centralObjective: data.centralObjective,
    player1Deployment: data.player1Deployment,
    player2Deployment: data.player2Deployment,
    gridSize: data.gridSize,
  };
}

export function deserializeGameState(data: SerializableGameState): GameState {
  const cityOwnership = new Map<string, PlayerId | null>();
  for (const key of Object.keys(data.cityOwnership)) {
    const value = data.cityOwnership[key];
    if (value !== undefined) {
      cityOwnership.set(key, value);
    }
  }

  return {
    phase: data.phase,
    players: {
      player1: { ...data.players.player1, units: data.players.player1.units.map((u) => ({ ...u, position: { ...u.position } })) },
      player2: { ...data.players.player2, units: data.players.player2.units.map((u) => ({ ...u, position: { ...u.position } })) },
    },
    round: deserializeRoundState(data.round),
    map: deserializeGameMap(data.map),
    maxRounds: data.maxRounds,
    winner: data.winner,
    cityOwnership,
  };
}
