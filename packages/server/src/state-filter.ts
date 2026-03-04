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
  PlayerState,
  RoundState,
  GameMap,
  TerrainType,
} from '@hexwar/engine';

import {
  calculateVisibility,
  hexToKey,
  serializeGameState,
} from '@hexwar/engine';

import type { SerializableGameState } from '@hexwar/engine';

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
  );

  // Build a new GameState with filtered data (no mutation of original)
  const filtered: GameState = {
    phase: state.phase,
    players: {
      [playerId]: clonePlayerState(state.players[playerId]),
      [enemyId]: {
        id: enemyId,
        resources: state.players[enemyId].resources,
        units: filteredEnemyUnits,
        roundsWon: state.players[enemyId].roundsWon,
      },
    } as Record<PlayerId, PlayerState>,
    round: cloneRoundState(state.round),
    map: cloneMap(state.map),
    maxRounds: state.maxRounds,
    winner: state.winner,
    cityOwnership: new Map(state.cityOwnership),
  };

  return serializeGameState(filtered);
}

// -----------------------------------------------------------------------------
// Enemy Unit Filtering
// -----------------------------------------------------------------------------

function filterEnemyUnits(
  phase: GameState['phase'],
  ownUnits: Unit[],
  enemyUnits: Unit[],
  terrain: Map<string, TerrainType>,
): Unit[] {
  // Build phase: blind deployment — no enemy units visible
  if (phase === 'build') {
    return [];
  }

  // Battle phase: only include enemies on visible hexes
  const visibleKeys = calculateVisibility(ownUnits, terrain);

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
    directive: 'advance',
    directiveTarget: { type: 'central-objective' },
    hasActed: unit.hasActed,
  };
}

// -----------------------------------------------------------------------------
// Deep-clone helpers (avoid structuredClone — Maps/Sets don't survive it)
// -----------------------------------------------------------------------------

function cloneUnit(unit: Unit): Unit {
  return {
    id: unit.id,
    type: unit.type,
    owner: unit.owner,
    hp: unit.hp,
    position: { q: unit.position.q, r: unit.position.r, s: unit.position.s },
    directive: unit.directive,
    directiveTarget: { ...unit.directiveTarget },
    hasActed: unit.hasActed,
  };
}

function clonePlayerState(player: PlayerState): PlayerState {
  return {
    id: player.id,
    resources: player.resources,
    units: player.units.map(cloneUnit),
    roundsWon: player.roundsWon,
  };
}

function cloneRoundState(round: RoundState): RoundState {
  return {
    roundNumber: round.roundNumber,
    turnNumber: round.turnNumber,
    currentPlayer: round.currentPlayer,
    maxTurnsPerSide: round.maxTurnsPerSide,
    turnsPlayed: { ...round.turnsPlayed },
    commandPool: {
      remaining: round.commandPool.remaining,
      commandedUnitIds: new Set(round.commandPool.commandedUnitIds),
    },
    objective: { ...round.objective },
    unitsKilledThisRound: { ...round.unitsKilledThisRound },
  };
}

function cloneMap(map: GameMap): GameMap {
  return {
    terrain: new Map(map.terrain),
    centralObjective: map.centralObjective,
    player1Deployment: [...map.player1Deployment],
    player2Deployment: [...map.player2Deployment],
    gridSize: map.gridSize,
  };
}
