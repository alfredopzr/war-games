// =============================================================================
// HexWar Server — State Filter Tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGame,
  placeUnit,
  startBattlePhase,
  hexToKey,
  calculateVisibility,
  deserializeGameState,
  resetUnitIdCounter,
} from '@hexwar/engine';
import type { GameState } from '@hexwar/engine';
import { filterStateForPlayer } from './state-filter';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Create a game and place units in both deployment zones.
 * Uses a fixed seed for deterministic map generation.
 */
function setupGameWithUnits(): GameState {
  const state = createGame(42);

  // Place some player1 units in player1's deployment zone
  const p1Zone = state.map.player1Deployment;
  const p2Zone = state.map.player2Deployment;

  placeUnit(state, 'player1', 'infantry', p1Zone[0]!, 'advance');
  placeUnit(state, 'player1', 'recon', p1Zone[1]!, 'scout');
  placeUnit(state, 'player1', 'tank', p1Zone[2]!, 'hold');

  placeUnit(state, 'player2', 'infantry', p2Zone[0]!, 'flank-left');
  placeUnit(state, 'player2', 'artillery', p2Zone[1]!, 'support');
  placeUnit(state, 'player2', 'recon', p2Zone[2]!, 'flank-right');

  return state;
}

beforeEach(() => {
  resetUnitIdCounter();
});

// -----------------------------------------------------------------------------
// Build Phase Tests
// -----------------------------------------------------------------------------

describe('filterStateForPlayer — build phase', () => {
  it('should exclude all enemy units during build phase', () => {
    const state = setupGameWithUnits();
    expect(state.phase).toBe('build');

    const filtered = filterStateForPlayer(state, 'player1');

    // Player1 should see zero player2 units
    expect(filtered.players.player2.units).toHaveLength(0);
    // But player2 actually has 3 units on the server
    expect(state.players.player2.units).toHaveLength(3);
  });

  it('should include all own units with full directives during build phase', () => {
    const state = setupGameWithUnits();

    const filtered = filterStateForPlayer(state, 'player1');

    expect(filtered.players.player1.units).toHaveLength(3);

    // Verify directives are preserved for own units
    const directives = filtered.players.player1.units.map((u) => u.directive);
    expect(directives).toContain('advance');
    expect(directives).toContain('scout');
    expect(directives).toContain('hold');
  });

  it('should also hide player1 units from player2 view during build phase', () => {
    const state = setupGameWithUnits();

    const filtered = filterStateForPlayer(state, 'player2');

    expect(filtered.players.player1.units).toHaveLength(0);
    expect(filtered.players.player2.units).toHaveLength(3);
  });
});

// -----------------------------------------------------------------------------
// Battle Phase Tests
// -----------------------------------------------------------------------------

describe('filterStateForPlayer — battle phase', () => {
  it('should only include visible enemy units', () => {
    const state = setupGameWithUnits();
    startBattlePhase(state);

    // Deployment zones are on opposite sides of the 20x14 map.
    // With infantry visionRange=3 and recon visionRange=6, player1 units
    // on the left side should NOT be able to see player2 units on the right side.
    const p1Filtered = filterStateForPlayer(state, 'player1');

    // Calculate what player1 should actually see
    const visibleKeys = calculateVisibility(state.players.player1.units, state.map.terrain);

    const expectedVisibleEnemies = state.players.player2.units.filter((u) =>
      visibleKeys.has(hexToKey(u.position)),
    );

    expect(p1Filtered.players.player2.units).toHaveLength(expectedVisibleEnemies.length);
  });

  it('should strip directives from all visible enemy units', () => {
    const state = setupGameWithUnits();
    startBattlePhase(state);

    // Move a player2 unit close to player1 so it's visible
    const p1Pos = state.players.player1.units[0]!.position;
    const enemyUnit = state.players.player2.units[0]!;
    enemyUnit.directive = 'flank-left';

    // Place enemy adjacent to player1's first unit
    enemyUnit.position = {
      q: p1Pos.q + 1,
      r: p1Pos.r,
      s: p1Pos.s - 1,
    };

    // Make sure the hex exists in terrain
    const enemyKey = hexToKey(enemyUnit.position);
    if (!state.map.terrain.has(enemyKey)) {
      state.map.terrain.set(enemyKey, 'plains');
    }

    const filtered = filterStateForPlayer(state, 'player1');

    // The enemy unit should be visible (adjacent to player1 unit)
    const visibleEnemies = filtered.players.player2.units;
    expect(visibleEnemies.length).toBeGreaterThanOrEqual(1);

    // ALL enemy unit directives must be 'advance' (stripped)
    for (const unit of visibleEnemies) {
      expect(unit.directive).toBe('advance');
    }

    // The actual server-side directive should still be 'flank-left'
    expect(state.players.player2.units[0]!.directive).toBe('flank-left');
  });

  it('should preserve own unit directives in battle phase', () => {
    const state = setupGameWithUnits();
    startBattlePhase(state);

    const filtered = filterStateForPlayer(state, 'player1');

    // Own units keep their real directives
    const ownDirectives = filtered.players.player1.units.map((u) => u.directive);
    expect(ownDirectives).toContain('advance');
    expect(ownDirectives).toContain('scout');
    expect(ownDirectives).toContain('hold');
  });

  it('should not include enemies that are out of vision range', () => {
    const state = setupGameWithUnits();
    startBattlePhase(state);

    // Deployment zones are far apart — units in their deployment zones
    // should generally not see each other (grid is 20x14)
    const p1Filtered = filterStateForPlayer(state, 'player1');
    const p2Filtered = filterStateForPlayer(state, 'player2');

    // Check that NOT all enemies are visible from the starting positions
    // (they start on opposite sides of the map)
    const p1VisibleKeys = calculateVisibility(state.players.player1.units, state.map.terrain);
    const p2VisibleKeys = calculateVisibility(state.players.player2.units, state.map.terrain);

    const p2UnitsVisibleToP1 = state.players.player2.units.filter((u) =>
      p1VisibleKeys.has(hexToKey(u.position)),
    );
    const p1UnitsVisibleToP2 = state.players.player1.units.filter((u) =>
      p2VisibleKeys.has(hexToKey(u.position)),
    );

    expect(p1Filtered.players.player2.units).toHaveLength(p2UnitsVisibleToP1.length);
    expect(p2Filtered.players.player1.units).toHaveLength(p1UnitsVisibleToP2.length);
  });
});

// -----------------------------------------------------------------------------
// Always-included data tests
// -----------------------------------------------------------------------------

describe('filterStateForPlayer — always-included data', () => {
  it('should include the full terrain map', () => {
    const state = setupGameWithUnits();

    const filtered = filterStateForPlayer(state, 'player1');

    // Terrain should be a Record with the same number of entries as the Map
    const terrainKeys = Object.keys(filtered.map.terrain);
    expect(terrainKeys.length).toBe(state.map.terrain.size);

    // Verify every key is preserved
    for (const key of state.map.terrain.keys()) {
      expect(filtered.map.terrain[key]).toBe(state.map.terrain.get(key));
    }
  });

  it('should include full city ownership', () => {
    const state = setupGameWithUnits();

    // Set some city ownership to verify it passes through
    const cityKeys = [...state.cityOwnership.keys()];
    if (cityKeys[0]) {
      state.cityOwnership.set(cityKeys[0], 'player1');
    }

    const filtered = filterStateForPlayer(state, 'player2');

    const filteredCityKeys = Object.keys(filtered.cityOwnership);
    expect(filteredCityKeys.length).toBe(state.cityOwnership.size);

    if (cityKeys[0]) {
      expect(filtered.cityOwnership[cityKeys[0]]).toBe('player1');
    }
  });

  it('should include full round info', () => {
    const state = setupGameWithUnits();
    state.round.roundNumber = 2;
    state.round.turnNumber = 5;

    const filtered = filterStateForPlayer(state, 'player1');

    expect(filtered.round.roundNumber).toBe(2);
    expect(filtered.round.turnNumber).toBe(5);
    expect(filtered.round.currentPlayer).toBe(state.round.currentPlayer);
    expect(filtered.round.maxTurnsPerSide).toBe(state.round.maxTurnsPerSide);
    expect(filtered.round.objective).toEqual(state.round.objective);
  });

  it('should hide enemy resources during build phase', () => {
    const state = setupGameWithUnits();
    state.players.player2.resources = 500;

    const filtered = filterStateForPlayer(state, 'player1');

    expect(filtered.players.player2.resources).toBe(0);
  });

  it('should include enemy resources during battle phase', () => {
    const state = setupGameWithUnits();
    startBattlePhase(state);
    state.players.player2.resources = 500;

    const filtered = filterStateForPlayer(state, 'player1');

    expect(filtered.players.player2.resources).toBe(500);
  });

  it('should include enemy roundsWon', () => {
    const state = setupGameWithUnits();
    state.players.player2.roundsWon = 1;

    const filtered = filterStateForPlayer(state, 'player1');

    expect(filtered.players.player2.roundsWon).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// Serialization & Correctness
// -----------------------------------------------------------------------------

describe('filterStateForPlayer — serialization', () => {
  it('should produce a valid SerializableGameState that can be deserialized', () => {
    const state = setupGameWithUnits();

    const filtered = filterStateForPlayer(state, 'player1');

    // Should be JSON-serializable (no Map/Set)
    const json = JSON.stringify(filtered);
    expect(() => JSON.parse(json)).not.toThrow();

    // Should deserialize back to a GameState
    const deserialized = deserializeGameState(filtered);
    expect(deserialized.phase).toBe(state.phase);
    expect(deserialized.map.terrain).toBeInstanceOf(Map);
    expect(deserialized.cityOwnership).toBeInstanceOf(Map);
    expect(deserialized.map.terrain.size).toBe(state.map.terrain.size);
  });

  it('should produce different results for player1 vs player2', () => {
    const state = setupGameWithUnits();

    const p1View = filterStateForPlayer(state, 'player1');
    const p2View = filterStateForPlayer(state, 'player2');

    // Player1 view: own units = player1's, enemy units = [] (build phase)
    expect(p1View.players.player1.units).toHaveLength(3);
    expect(p1View.players.player2.units).toHaveLength(0);

    // Player2 view: own units = player2's, enemy units = [] (build phase)
    expect(p2View.players.player2.units).toHaveLength(3);
    expect(p2View.players.player1.units).toHaveLength(0);

    // The own-unit directives should differ
    const p1Directives = p1View.players.player1.units.map((u) => u.directive);
    const p2Directives = p2View.players.player2.units.map((u) => u.directive);
    expect(p1Directives).not.toEqual(p2Directives);
  });
});

// -----------------------------------------------------------------------------
// Mutation Safety
// -----------------------------------------------------------------------------

describe('filterStateForPlayer — mutation safety', () => {
  it('should not mutate the original game state', () => {
    const state = setupGameWithUnits();
    const originalP2UnitCount = state.players.player2.units.length;
    const originalP2Directives = state.players.player2.units.map((u) => u.directive);

    filterStateForPlayer(state, 'player1');

    // Original state must be unchanged
    expect(state.players.player2.units).toHaveLength(originalP2UnitCount);
    const afterDirectives = state.players.player2.units.map((u) => u.directive);
    expect(afterDirectives).toEqual(originalP2Directives);
  });
});
