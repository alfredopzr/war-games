// =============================================================================
// HexWar Server — State Filter (Fog of War)
// =============================================================================
// Security-critical: filters GameState so each player only sees what they
// should see. The server MUST never leak hidden information to clients.
// =============================================================================

import type {
  GameState,
  PlayerId,
  Unit,
  GameMap,
  TerrainType,
  HexModifier,
  MegaHexInfo,
} from '@hexwar/engine';

import {
  calculateVisibility,
  hexToKey,
} from '@hexwar/engine';

import type { SerializableGameState } from '@hexwar/engine';

// -----------------------------------------------------------------------------
// Cached serialized map — computed once per game seed, never changes
// -----------------------------------------------------------------------------

let cachedMapSeed: number | null = null;
let cachedSerializedMap: {
  readonly terrain: Record<string, TerrainType>;
  readonly elevation: Record<string, number>;
  readonly modifiers: Record<string, HexModifier>;
  readonly megaHexes: Record<string, string>;
  readonly megaHexInfo: Record<string, MegaHexInfo>;
  readonly centralObjective: GameMap['centralObjective'];
  readonly player1Deployment: GameMap['player1Deployment'];
  readonly player2Deployment: GameMap['player2Deployment'];
  readonly gridSize: GameMap['gridSize'];
  readonly mapRadius: number;
  readonly seed: number;
} | null = null;

function getSerializedMap(map: GameMap): NonNullable<typeof cachedSerializedMap> {
  if (cachedSerializedMap && cachedMapSeed === map.seed) {
    return cachedSerializedMap;
  }

  const terrain: Record<string, TerrainType> = {};
  for (const [key, value] of map.terrain) terrain[key] = value;

  const elevation: Record<string, number> = {};
  for (const [key, value] of map.elevation) elevation[key] = value;

  const modifiers: Record<string, HexModifier> = {};
  if (map.modifiers) {
    for (const [key, value] of map.modifiers) modifiers[key] = value;
  }

  const megaHexes: Record<string, string> = {};
  for (const [key, value] of map.megaHexes) megaHexes[key] = value;

  const megaHexInfo: Record<string, MegaHexInfo> = {};
  for (const [key, value] of map.megaHexInfo) megaHexInfo[key] = value;

  cachedSerializedMap = {
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
  cachedMapSeed = map.seed;
  return cachedSerializedMap;
}

// -----------------------------------------------------------------------------
// filterStateForPlayer
// -----------------------------------------------------------------------------

/**
 * Produce a JSON-safe view of the game state for the given player.
 *
 * Build phase:  enemy units are completely hidden (blind deployment).
 * Battle phase: only enemy units on hexes visible to the player's units
 *               are included, and their directives are always stripped.
 *
 * The returned object is fully serialized (no Map/Set) and safe to send
 * over the wire.
 *
 * Optimized path: builds the SerializableGameState directly in one pass
 * instead of cloning into a GameState then re-serializing. The map is
 * cached since it never changes after game creation.
 */
export function filterStateForPlayer(
  state: GameState,
  playerId: PlayerId,
): SerializableGameState {
  const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';

  const ownUnits = state.players[playerId].units;
  const enemyUnits = state.players[enemyId].units;

  // Determine which enemy units to include
  const filteredEnemyUnits = filterEnemyUnits(
    state.phase,
    ownUnits,
    enemyUnits,
    state.map.terrain,
    state.map.elevation,
  );

  // Serialize cityOwnership (small — typically ~5 entries)
  const cityOwnership: Record<string, PlayerId | null> = {};
  for (const [key, value] of state.cityOwnership) {
    cityOwnership[key] = value;
  }

  // Build SerializableGameState directly (single-pass, no intermediate clone)
  return {
    phase: state.phase,
    players: {
      [playerId]: {
        id: playerId,
        resources: state.players[playerId].resources,
        units: ownUnits.map(serializeUnit),
        roundsWon: state.players[playerId].roundsWon,
      },
      [enemyId]: {
        id: enemyId,
        resources: state.phase === 'build' ? 0 : state.players[enemyId].resources,
        units: filteredEnemyUnits.map(serializeUnit),
        roundsWon: state.players[enemyId].roundsWon,
      },
    } as SerializableGameState['players'],
    round: {
      roundNumber: state.round.roundNumber,
      turnNumber: state.round.turnNumber,
      currentPlayer: state.round.currentPlayer,
      maxTurns: state.round.maxTurns,
      turnsPlayed: state.round.turnsPlayed,
      commandPool: {
        remaining: state.round.commandPool.remaining,
        commandedUnitIds: [...state.round.commandPool.commandedUnitIds],
      },
      objective: { ...state.round.objective },
      unitsKilledThisRound: { ...state.round.unitsKilledThisRound },
    },
    map: getSerializedMap(state.map),
    unitStats: state.unitStats,
    maxRounds: state.maxRounds,
    winner: state.winner,
    cityOwnership,
  } as SerializableGameState;
}

// -----------------------------------------------------------------------------
// Unit serialization (single clone — no double-copy)
// -----------------------------------------------------------------------------

function serializeUnit(unit: Unit): Unit {
  return {
    id: unit.id,
    type: unit.type,
    owner: unit.owner,
    hp: unit.hp,
    position: { q: unit.position.q, r: unit.position.r, s: unit.position.s },
    movementDirective: unit.movementDirective,
    attackDirective: unit.attackDirective,
    specialtyModifier: unit.specialtyModifier,
    directiveTarget: {
      ...unit.directiveTarget,
      hex: unit.directiveTarget.hex ? { ...unit.directiveTarget.hex } : undefined,
    },
    hasActed: unit.hasActed,
  };
}

// -----------------------------------------------------------------------------
// Enemy Unit Filtering
// -----------------------------------------------------------------------------

function filterEnemyUnits(
  phase: GameState['phase'],
  ownUnits: Unit[],
  enemyUnits: Unit[],
  terrain: Map<string, TerrainType>,
  elevation: Map<string, number>,
): Unit[] {
  // Build phase: blind deployment — no enemy units visible
  if (phase === 'build') {
    return [];
  }

  // Battle phase: only include enemies on visible hexes
  const visibleKeys = calculateVisibility(ownUnits, terrain, elevation);

  return enemyUnits
    .filter((unit) => visibleKeys.has(hexToKey(unit.position)))
    .map(stripDirective);
}

/**
 * Clone an enemy unit with its directive replaced by the neutral default.
 * NEVER reveal the real directive to the opponent.
 */
function stripDirective(unit: Unit): Unit {
  return {
    id: unit.id,
    type: unit.type,
    owner: unit.owner,
    hp: unit.hp,
    position: { q: unit.position.q, r: unit.position.r, s: unit.position.s },
    movementDirective: 'advance',
    attackDirective: 'ignore',
    specialtyModifier: null,
    directiveTarget: { type: 'central-objective' },
    hasActed: unit.hasActed,
  };
}
