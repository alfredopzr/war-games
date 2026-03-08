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
  BattleEvent,
  CubeCoord,
  Building,
} from '@hexwar/engine';

import {
  calculateVisibility,
  hexToKey,
  CP_PER_ROUND,
  BUILDING_STATS,
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
    state.unitStats,
    state.buildings,
    playerId,
  );

  // Serialize cityOwnership (small — typically ~5 entries)
  const cityOwnership: Record<string, PlayerId | null> = {};
  for (const [key, value] of state.cityOwnership) {
    cityOwnership[key] = value;
  }

  // Build SerializableGameState directly (single-pass, no intermediate clone)
  // Filter buildings: own buildings always visible, enemy buildings only on visible hexes
  // Uses tower-aware visibility so recon towers extend building detection too
  const visibleKeys = state.phase === 'build'
    ? new Set<string>()
    : computeVisibilityWithTowers(ownUnits, state.buildings, playerId, state.map.terrain, state.map.elevation, state.unitStats);

  const filteredBuildings = state.buildings.filter(b => {
    if (b.owner === playerId) return true;
    if (!b.isRevealed) return false;
    return visibleKeys.has(`${b.position.q},${b.position.r}`);
  }).map(b => ({ ...b, position: { ...b.position } }));

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
      commandPools: {
        [playerId]: {
          remaining: state.round.commandPools[playerId].remaining,
          commandedUnitIds: [...state.round.commandPools[playerId].commandedUnitIds],
        },
        [enemyId]: {
          remaining: CP_PER_ROUND,
          commandedUnitIds: [],
        },
      },
      objective: { ...state.round.objective },
      unitsKilledThisRound: { ...state.round.unitsKilledThisRound },
    },
    map: getSerializedMap(state.map),
    unitStats: state.unitStats,
    maxRounds: state.maxRounds,
    winner: state.winner,
    cityOwnership,
    buildings: filteredBuildings,
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

/**
 * Compute visibility including recon tower vision sources.
 * Returns the union of unit LOS and tower LOS.
 */
function computeVisibilityWithTowers(
  ownUnits: Unit[],
  buildings: Building[],
  playerId: PlayerId,
  terrain: Map<string, TerrainType>,
  elevation: Map<string, number>,
  unitStats: Record<string, { visionRange: number }>,
): Set<string> {
  const visibleKeys = calculateVisibility(ownUnits, terrain, elevation, unitStats);

  const towers = buildings.filter(b => b.owner === playerId && b.type === 'recon-tower');
  if (towers.length === 0) return visibleKeys;

  const towerVision = BUILDING_STATS['recon-tower'].visionRange ?? 4;
  const virtualStats: Record<string, { visionRange: number }> = {
    engineer: { visionRange: towerVision },
  };

  for (const tower of towers) {
    const virtualUnit: Unit = {
      id: `tower-${tower.id}`,
      type: 'engineer',
      owner: playerId,
      hp: 1,
      position: tower.position,
      movementDirective: 'hold',
      attackDirective: 'ignore',
      specialtyModifier: null,
      directiveTarget: { type: 'hex', hex: tower.position },
      hasActed: false,
    };
    const towerVis = calculateVisibility([virtualUnit], terrain, elevation, virtualStats);
    for (const key of towerVis) {
      visibleKeys.add(key);
    }
  }

  return visibleKeys;
}

function filterEnemyUnits(
  phase: GameState['phase'],
  ownUnits: Unit[],
  enemyUnits: Unit[],
  terrain: Map<string, TerrainType>,
  elevation: Map<string, number>,
  unitStats: Record<string, { visionRange: number }>,
  buildings: Building[],
  playerId: PlayerId,
): Unit[] {
  // Build phase: blind deployment — no enemy units visible
  if (phase === 'build') {
    return [];
  }

  // Battle phase: only include enemies on visible hexes (including tower vision)
  const visibleKeys = computeVisibilityWithTowers(ownUnits, buildings, playerId, terrain, elevation, unitStats);

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
    directiveTarget: { type: 'hex', hex: { q: unit.position.q, r: unit.position.r, s: unit.position.s } },
    hasActed: unit.hasActed,
  };
}

// -----------------------------------------------------------------------------
// Event Filtering (Fog-gated reveal — D-VIS-5)
// -----------------------------------------------------------------------------

const STRUCTURAL_EVENT_TYPES = new Set([
  'round-end', 'game-end', 'koth-progress', 'objective-change',
  'building-built',
]);

function hexKeyFromCoord(c: CubeCoord): string {
  return hexToKey(c);
}

/**
 * Filter BattleEvent[] so a player only receives events they should see.
 *
 * Rules (EVENT_LOG_SPEC.md §Fog Filtering):
 *   1. Own-unit events (actingPlayer === playerId): always include.
 *   2. Structural events (round-end, game-end, etc.): always include.
 *   3. Enemy-only events: include only if at least one position in the
 *      event falls within the player's LOS set.
 */
export function filterEventsForPlayer(
  events: BattleEvent[],
  playerId: PlayerId,
  losSet: Set<string>,
): BattleEvent[] {
  const result: BattleEvent[] = [];

  for (const event of events) {
    if (event.actingPlayer === playerId) {
      result.push(event);
      continue;
    }

    if (STRUCTURAL_EVENT_TYPES.has(event.type)) {
      result.push(event);
      continue;
    }

    if (eventHasVisiblePosition(event, losSet)) {
      result.push(event);
    }
  }

  return result;
}

function eventHasVisiblePosition(event: BattleEvent, losSet: Set<string>): boolean {
  switch (event.type) {
    case 'move':
      return losSet.has(hexKeyFromCoord(event.from)) || losSet.has(hexKeyFromCoord(event.to));

    case 'damage':
    case 'kill':
      return losSet.has(hexKeyFromCoord(event.attackerPosition)) || losSet.has(hexKeyFromCoord(event.defenderPosition));

    case 'counter':
      return losSet.has(hexKeyFromCoord(event.attackerPosition)) || losSet.has(hexKeyFromCoord(event.defenderPosition));

    case 'intercept':
      return losSet.has(hexKeyFromCoord(event.attackerPosition)) || losSet.has(hexKeyFromCoord(event.hex));

    case 'melee':
      return losSet.has(hexKeyFromCoord(event.hex));

    case 'heal':
      return losSet.has(hexKeyFromCoord(event.targetPosition));

    case 'reveal':
      return event.hexes.some((h) => losSet.has(hexKeyFromCoord(h)));

    case 'capture':
    case 'recapture':
    case 'capture-damage':
    case 'capture-death':
      return losSet.has(event.cityKey);

    case 'round-end':
    case 'game-end':
    case 'koth-progress':
    case 'objective-change':
    case 'building-built':
      return true; // structural — already handled above, but exhaust the switch

    case 'mine-triggered':
      return losSet.has(hexKeyFromCoord(event.position));

    case 'mortar-fire':
      return losSet.has(hexKeyFromCoord(event.buildingPosition)) || losSet.has(hexKeyFromCoord(event.targetPosition));

    case 'building-destroyed':
      return losSet.has(hexKeyFromCoord(event.buildingPosition));
  }
}
