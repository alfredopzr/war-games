import { describe, it, expect, beforeEach } from 'vitest';
import { serializeGameState, deserializeGameState } from './serialization';
import { createGame, placeUnit } from './game-state';
import { resetUnitIdCounter } from './units';
import { createBuilding, resetBuildingIdCounter } from './buildings';
import { createHex } from './hex';
import type { GameState } from './types';

describe('serialization', () => {
  let state: GameState;

  beforeEach(() => {
    resetUnitIdCounter();
    state = createGame(42);
  });

  describe('round-trip: deserialize(serialize(state))', () => {
    it('round-trips an empty game state', () => {
      const result = deserializeGameState(serializeGameState(state));

      expect(result.phase).toBe(state.phase);
      expect(result.maxRounds).toBe(state.maxRounds);
      expect(result.winner).toBe(state.winner);
    });

    it('preserves terrain Map correctly', () => {
      const result = deserializeGameState(serializeGameState(state));

      expect(result.map.terrain).toBeInstanceOf(Map);
      expect(result.map.terrain.size).toBe(state.map.terrain.size);

      for (const [key, value] of state.map.terrain) {
        expect(result.map.terrain.get(key)).toBe(value);
      }
    });

    it('preserves cityOwnership Map correctly', () => {
      const result = deserializeGameState(serializeGameState(state));

      expect(result.cityOwnership).toBeInstanceOf(Map);
      expect(result.cityOwnership.size).toBe(state.cityOwnership.size);

      for (const [key, value] of state.cityOwnership) {
        expect(result.cityOwnership.get(key)).toBe(value);
      }
    });

    it('preserves commandPool.commandedUnitIds as a Set', () => {
      // Add some ids to the Set before serializing
      state.round.commandPool.commandedUnitIds.add('unit-1');
      state.round.commandPool.commandedUnitIds.add('unit-2');

      const result = deserializeGameState(serializeGameState(state));

      expect(result.round.commandPool.commandedUnitIds).toBeInstanceOf(Set);
      expect(result.round.commandPool.commandedUnitIds.size).toBe(2);
      expect(result.round.commandPool.commandedUnitIds.has('unit-1')).toBe(true);
      expect(result.round.commandPool.commandedUnitIds.has('unit-2')).toBe(true);
    });

    it('preserves units and their positions after placement', () => {
      const p1Zone = state.map.player1Deployment[0]!;
      const p2Zone = state.map.player2Deployment[0]!;
      state = placeUnit(state, 'player1', 'infantry', p1Zone);
      state = placeUnit(state, 'player2', 'tank', p2Zone);

      const result = deserializeGameState(serializeGameState(state));

      expect(result.players.player1.units).toHaveLength(1);
      expect(result.players.player2.units).toHaveLength(1);

      const p1Unit = result.players.player1.units[0]!;
      expect(p1Unit.type).toBe('infantry');
      expect(p1Unit.owner).toBe('player1');
      expect(p1Unit.position).toEqual(p1Zone);

      const p2Unit = result.players.player2.units[0]!;
      expect(p2Unit.type).toBe('tank');
      expect(p2Unit.owner).toBe('player2');
      expect(p2Unit.position).toEqual(p2Zone);
    });

    it('preserves GameMap fields (centralObjective, deploymentZones, gridSize)', () => {
      const result = deserializeGameState(serializeGameState(state));

      expect(result.map.centralObjective).toEqual(state.map.centralObjective);
      expect(result.map.player1Deployment).toEqual(state.map.player1Deployment);
      expect(result.map.player2Deployment).toEqual(state.map.player2Deployment);
      expect(result.map.gridSize).toEqual(state.map.gridSize);
    });

    it('preserves round state fields', () => {
      state.round.roundNumber = 2;
      state.round.turnNumber = 5;
      state.round.currentPlayer = 'player2';
      state.round.turnsPlayed = { player1: 3, player2: 2 };
      state.round.commandPool.remaining = 1;
      state.round.objective = { occupiedBy: 'player1', turnsHeld: 3 };
      state.round.unitsKilledThisRound = { player1: 2, player2: 1 };

      const result = deserializeGameState(serializeGameState(state));

      expect(result.round.roundNumber).toBe(2);
      expect(result.round.turnNumber).toBe(5);
      expect(result.round.currentPlayer).toBe('player2');
      expect(result.round.turnsPlayed).toEqual({ player1: 3, player2: 2 });
      expect(result.round.commandPool.remaining).toBe(1);
      expect(result.round.objective).toEqual({ occupiedBy: 'player1', turnsHeld: 3 });
      expect(result.round.unitsKilledThisRound).toEqual({ player1: 2, player2: 1 });
    });

    it('preserves player resources and roundsWon', () => {
      state.players.player1.resources = 500;
      state.players.player1.roundsWon = 1;
      state.players.player2.resources = 650;
      state.players.player2.roundsWon = 2;

      const result = deserializeGameState(serializeGameState(state));

      expect(result.players.player1.resources).toBe(500);
      expect(result.players.player1.roundsWon).toBe(1);
      expect(result.players.player2.resources).toBe(650);
      expect(result.players.player2.roundsWon).toBe(2);
    });

    it('round-trips unit with directiveTarget', () => {
      const state = createGame();
      placeUnit(state, 'player1', 'infantry', state.map.player1Deployment[0]!, 'hunt', {
        type: 'enemy-unit',
        unitId: 'target-id',
      });

      const serialized = serializeGameState(state);
      const deserialized = deserializeGameState(serialized);

      const unit = deserialized.players.player1.units[0]!;
      expect(unit.directiveTarget).toEqual({ type: 'enemy-unit', unitId: 'target-id' });
    });

    it('survives JSON.stringify/parse round-trip (simulating Socket.io)', () => {
      const p1Zone = state.map.player1Deployment[0]!;
      state = placeUnit(state, 'player1', 'infantry', p1Zone);
      state.round.commandPool.commandedUnitIds.add('test-unit');

      const serialized = serializeGameState(state);
      const json = JSON.parse(JSON.stringify(serialized)) as typeof serialized;
      const result = deserializeGameState(json);

      // Maps and Sets should be restored
      expect(result.map.terrain).toBeInstanceOf(Map);
      expect(result.cityOwnership).toBeInstanceOf(Map);
      expect(result.round.commandPool.commandedUnitIds).toBeInstanceOf(Set);

      // Data should match
      expect(result.map.terrain.size).toBe(state.map.terrain.size);
      expect(result.cityOwnership.size).toBe(state.cityOwnership.size);
      expect(result.round.commandPool.commandedUnitIds.has('test-unit')).toBe(true);
      expect(result.players.player1.units).toHaveLength(1);
    });
  });

  describe('serializeGameState', () => {
    it('converts terrain Map to a plain object', () => {
      const serialized = serializeGameState(state);

      // Should be a plain object, not a Map
      expect(serialized.map.terrain).not.toBeInstanceOf(Map);
      expect(typeof serialized.map.terrain).toBe('object');

      // Should have the same number of entries
      const terrainKeys = Object.keys(serialized.map.terrain);
      expect(terrainKeys.length).toBe(state.map.terrain.size);
    });

    it('converts cityOwnership Map to a plain object', () => {
      const serialized = serializeGameState(state);

      expect(serialized.cityOwnership).not.toBeInstanceOf(Map);
      expect(typeof serialized.cityOwnership).toBe('object');

      const keys = Object.keys(serialized.cityOwnership);
      expect(keys.length).toBe(state.cityOwnership.size);
    });

    it('converts commandedUnitIds Set to an array', () => {
      state.round.commandPool.commandedUnitIds.add('a');
      state.round.commandPool.commandedUnitIds.add('b');

      const serialized = serializeGameState(state);

      expect(Array.isArray(serialized.round.commandPool.commandedUnitIds)).toBe(true);
      expect(serialized.round.commandPool.commandedUnitIds).toContain('a');
      expect(serialized.round.commandPool.commandedUnitIds).toContain('b');
    });
  });
});

describe('building serialization', () => {
  beforeEach(() => {
    resetBuildingIdCounter();
  });

  it('round-trips buildings through serialize/deserialize', () => {
    const state = createGame(42);
    state.buildings.push(
      createBuilding('recon-tower', 'player1', createHex(2, 3)),
      createBuilding('mines', 'player2', createHex(4, 1)),
    );

    const serialized = serializeGameState(state);
    const deserialized = deserializeGameState(serialized);

    expect(deserialized.buildings.length).toBe(2);
    expect(deserialized.buildings[0]!.type).toBe('recon-tower');
    expect(deserialized.buildings[0]!.owner).toBe('player1');
    expect(deserialized.buildings[0]!.isRevealed).toBe(true);
    expect(deserialized.buildings[1]!.type).toBe('mines');
    expect(deserialized.buildings[1]!.isRevealed).toBe(false);
    expect(deserialized.buildings[1]!.position).toEqual(createHex(4, 1));
  });
});
