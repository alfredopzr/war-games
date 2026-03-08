import { describe, it, expect } from 'vitest';
import { aiBuildPhase, aiBattlePhase } from './ai';
import { createGame, placeUnit, startBattlePhase } from './game-state';
import { createHex, cubeDistance, hexToKey } from './hex';
import { calculateVisibility } from './vision';

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
      expect(p.movementDirective).toBeTruthy();
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
  it('returns 0-4 commands', () => {
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
    expect(commands.length).toBeLessThanOrEqual(4);
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

  it('does not target enemies outside vision range', () => {
    const game = createGame(42);
    // Deployment zones are at opposite corners — far beyond any unit's vision range
    const p1Zone = game.map.player1Deployment;
    const p2Zone = game.map.player2Deployment;
    placeUnit(game, 'player1', 'infantry', p1Zone[0]!);
    placeUnit(game, 'player2', 'infantry', p2Zone[0]!);
    startBattlePhase(game);
    game.round.currentPlayer = 'player2';

    // Confirm units are beyond vision range
    const p2Units = game.players.player2.units;
    const p1Units = game.players.player1.units;
    const visibleHexes = calculateVisibility(
      p2Units,
      game.map.terrain,
      game.map.elevation,
      game.unitStats,
    );
    const enemyVisible = visibleHexes.has(hexToKey(p1Units[0]!.position));
    expect(enemyVisible).toBe(false);

    // AI should produce no attack-related redirects targeting the invisible enemy
    const commands = aiBattlePhase(game, 'player2');
    for (const cmd of commands) {
      if (cmd.target && cmd.target.type === 'unit') {
        expect(cmd.target.unitId).not.toBe(p1Units[0]!.id);
      }
      // No shoot-on-sight redirect (which would indicate the AI "saw" the enemy)
      expect(cmd.newAttackDirective).not.toBe('shoot-on-sight');
    }
  });

  it('targets visible enemies normally', () => {
    const game = createGame(42);
    const p1Zone = game.map.player1Deployment;
    const p2Zone = game.map.player2Deployment;
    placeUnit(game, 'player1', 'infantry', p1Zone[0]!);
    placeUnit(game, 'player2', 'infantry', p2Zone[0]!);
    startBattlePhase(game);
    game.round.currentPlayer = 'player2';

    // Move p1 unit adjacent to p2 unit so it's guaranteed visible
    const p2Pos = game.players.player2.units[0]!.position;
    const adjacentHex = createHex(p2Pos.q + 1, p2Pos.r);
    game.players.player1.units[0]!.position = adjacentHex;

    // Confirm visibility
    const visibleHexes = calculateVisibility(
      game.players.player2.units,
      game.map.terrain,
      game.map.elevation,
      game.unitStats,
    );
    expect(visibleHexes.has(hexToKey(adjacentHex))).toBe(true);

    // AI should see the enemy and produce attack-related commands
    const commands = aiBattlePhase(game, 'player2');
    const hasAttackRedirect = commands.some(
      (c) => c.newAttackDirective === 'shoot-on-sight',
    );
    expect(hasAttackRedirect).toBe(true);
  });
});
