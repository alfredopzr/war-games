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
  UnitType,
  UnitStats,
  TerrainType,
  CubeCoord,
  GridSize,
  ObjectiveState,
  MegaHexInfo,
  HexModifier,
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
  maxTurns: number;
  turnsPlayed: number;
  commandPools: Record<PlayerId, SerializableCommandPool>;
  objective: ObjectiveState;
  unitsKilledThisRound: Record<PlayerId, number>;
}

interface SerializableGameMap {
  readonly terrain: Record<string, TerrainType>;
  readonly elevation: Record<string, number>;
  readonly modifiers: Record<string, HexModifier>;
  readonly megaHexes: Record<string, string>;
  readonly megaHexInfo: Record<string, MegaHexInfo>;
  readonly centralObjective: CubeCoord;
  readonly player1Deployment: CubeCoord[];
  readonly player2Deployment: CubeCoord[];
  readonly gridSize: GridSize;
  readonly mapRadius: number;
  readonly seed: number;
}

export interface SerializableGameState {
  phase: GamePhase;
  players: Record<PlayerId, PlayerState>;
  round: SerializableRoundState;
  map: SerializableGameMap;
  unitStats: Record<UnitType, UnitStats>;
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
    maxTurns: round.maxTurns,
    turnsPlayed: round.turnsPlayed,
    commandPools: {
      player1: serializeCommandPool(round.commandPools.player1),
      player2: serializeCommandPool(round.commandPools.player2),
    },
    objective: { ...round.objective },
    unitsKilledThisRound: { ...round.unitsKilledThisRound },
  };
}

function serializeGameMap(map: GameMap): SerializableGameMap {
  const terrain: Record<string, TerrainType> = {};
  for (const [key, value] of map.terrain) {
    terrain[key] = value;
  }
  const elevation: Record<string, number> = {};
  for (const [key, value] of map.elevation) {
    elevation[key] = value;
  }
  const modifiers: Record<string, HexModifier> = {};
  if (map.modifiers) {
    for (const [key, value] of map.modifiers) {
      modifiers[key] = value;
    }
  }
  const megaHexes: Record<string, string> = {};
  for (const [key, value] of map.megaHexes) {
    megaHexes[key] = value;
  }
  const megaHexInfo: Record<string, MegaHexInfo> = {};
  for (const [key, value] of map.megaHexInfo) {
    megaHexInfo[key] = value;
  }
  return {
    terrain,
    elevation,
    modifiers,
    megaHexes,
    megaHexInfo,
    centralObjective: map.centralObjective,
    player1Deployment: map.player1Deployment,
    player2Deployment: map.player2Deployment,
    gridSize: map.gridSize,
    mapRadius: map.mapRadius,
    seed: map.seed,
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
      player1: {
        ...state.players.player1,
        units: state.players.player1.units.map((u) => ({
          ...u,
          position: { ...u.position },
          directiveTarget: {
            ...u.directiveTarget,
            hex: u.directiveTarget.hex ? { ...u.directiveTarget.hex } : undefined,
          },
        })),
      },
      player2: {
        ...state.players.player2,
        units: state.players.player2.units.map((u) => ({
          ...u,
          position: { ...u.position },
          directiveTarget: {
            ...u.directiveTarget,
            hex: u.directiveTarget.hex ? { ...u.directiveTarget.hex } : undefined,
          },
        })),
      },
    },
    round: serializeRoundState(state.round),
    map: serializeGameMap(state.map),
    unitStats: state.unitStats,
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
    maxTurns: data.maxTurns,
    turnsPlayed: data.turnsPlayed,
    commandPools: {
      player1: deserializeCommandPool(data.commandPools.player1),
      player2: deserializeCommandPool(data.commandPools.player2),
    },
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
  const elevation = new Map<string, number>();
  if (data.elevation) {
    for (const key of Object.keys(data.elevation)) {
      const value = data.elevation[key];
      if (value !== undefined) {
        elevation.set(key, value);
      }
    }
  }
  const modifiers = new Map<string, HexModifier>();
  if (data.modifiers) {
    for (const key of Object.keys(data.modifiers)) {
      const value = data.modifiers[key];
      if (value !== undefined) {
        modifiers.set(key, value);
      }
    }
  }
  const megaHexes = new Map<string, string>();
  if (data.megaHexes) {
    for (const key of Object.keys(data.megaHexes)) {
      const value = data.megaHexes[key];
      if (value !== undefined) {
        megaHexes.set(key, value);
      }
    }
  }
  const megaHexInfo = new Map<string, MegaHexInfo>();
  if (data.megaHexInfo) {
    for (const key of Object.keys(data.megaHexInfo)) {
      const value = data.megaHexInfo[key];
      if (value !== undefined) {
        megaHexInfo.set(key, value);
      }
    }
  }
  return {
    terrain,
    elevation,
    modifiers,
    megaHexes,
    megaHexInfo,
    centralObjective: data.centralObjective,
    player1Deployment: data.player1Deployment,
    player2Deployment: data.player2Deployment,
    gridSize: data.gridSize,
    mapRadius: data.mapRadius,
    seed: data.seed ?? 0,
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
      player1: {
        ...data.players.player1,
        units: data.players.player1.units.map((u) => ({
          ...u,
          position: { ...u.position },
          directiveTarget: {
            ...u.directiveTarget,
            hex: u.directiveTarget.hex ? { ...u.directiveTarget.hex } : undefined,
          },
        })),
      },
      player2: {
        ...data.players.player2,
        units: data.players.player2.units.map((u) => ({
          ...u,
          position: { ...u.position },
          directiveTarget: {
            ...u.directiveTarget,
            hex: u.directiveTarget.hex ? { ...u.directiveTarget.hex } : undefined,
          },
        })),
      },
    },
    round: deserializeRoundState(data.round),
    map: deserializeGameMap(data.map),
    unitStats: data.unitStats,
    maxRounds: data.maxRounds,
    winner: data.winner,
    cityOwnership,
    pendingEvents: [],
  };
}
