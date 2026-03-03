import { describe, it, expect } from 'vitest';
import { aiBuildPhase, aiBattlePhase } from './ai';
import { createGame, placeUnit, startBattlePhase } from './game-state';
import { hexToKey } from './hex';

describe('aiBuildPhase', () => {
  it('spends resources on units without exceeding budget', () => {
    const game = createGame(42);
    const placements = aiBuildPhase(game, 'player2');
    expect(placements.length).toBeGreaterThan(0);
    const totalCost = placements.reduce((sum, p) => sum + p.cost, 0);
    expect(totalCost).toBeLessThanOrEqual(game.players.player2.resources);
  });

  it('assigns directives to all placed units', () => {
    const game = createGame(42);
    const placements = aiBuildPhase(game, 'player2');
    for (const p of placements) {
      expect(p.directive).toBeTruthy();
    }
  });

  it('only places in valid deployment zone', () => {
    const game = createGame(42);
    const placements = aiBuildPhase(game, 'player2');
    const zoneKeys = new Set(game.map.player2Deployment.map((h) => hexToKey(h)));
    for (const p of placements) {
      expect(zoneKeys.has(hexToKey(p.position))).toBe(true);
    }
  });

  it('does not place on occupied hexes', () => {
    const game = createGame(42);
    const placements = aiBuildPhase(game, 'player2');
    const posKeys = placements.map((p) => hexToKey(p.position));
    const unique = new Set(posKeys);
    expect(unique.size).toBe(posKeys.length);
  });
});

describe('aiBattlePhase', () => {
  it('returns 0-3 commands', () => {
    const game = createGame(42);
    // Place some units for both sides
    const p1Zone = game.map.player1Deployment;
    const p2Zone = game.map.player2Deployment;
    placeUnit(game, 'player1', 'infantry', p1Zone[0]!);
    placeUnit(game, 'player2', 'infantry', p2Zone[0]!);
    startBattlePhase(game);
    // Switch to player2's turn context (commandPool starts fresh for current player)
    game.round.currentPlayer = 'player2';
    const commands = aiBattlePhase(game, 'player2');
    expect(commands.length).toBeLessThanOrEqual(3);
    expect(commands.length).toBeGreaterThanOrEqual(0);
  });

  it('all commands reference valid unit IDs', () => {
    const game = createGame(42);
    const p1Zone = game.map.player1Deployment;
    const p2Zone = game.map.player2Deployment;
    placeUnit(game, 'player1', 'tank', p1Zone[0]!);
    placeUnit(game, 'player2', 'tank', p2Zone[0]!);
    placeUnit(game, 'player2', 'infantry', p2Zone[1]!);
    startBattlePhase(game);
    game.round.currentPlayer = 'player2';
    const commands = aiBattlePhase(game, 'player2');
    const p2UnitIds = new Set(game.players.player2.units.map((u) => u.id));
    for (const cmd of commands) {
      expect(p2UnitIds.has(cmd.unitId)).toBe(true);
    }
  });
});
