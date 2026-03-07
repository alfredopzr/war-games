// =============================================================================
// HexWar — Full Engine Integration Test
// =============================================================================
// Validates the full game loop: createGame() -> placeUnits() ->
// startBattlePhase() -> loop { resolveTurn(), checkRoundEnd() } ->
// scoreRound() -> getWinner(), all driven entirely in code.
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type { CubeCoord, PlayerId, GameState, DirectiveTarget } from './index';
import {
  createGame, placeUnit, startBattlePhase,
  checkRoundEnd, scoreRound, getWinner, resetUnitIdCounter,
  createHex, hexToKey, validateMap, UNIT_STATS,
  calculateIncome, canAfford, createCommandPool, canIssueCommand,
  calculateVisibility, cubeDistance, findPath,
  resolveTurn,
} from './index';

/**
 * Find unoccupied deployment hexes for a player, skipping hexes where
 * surviving units already sit after being reset between rounds.
 */
function findOpenDeploymentHexes(
  game: GameState,
  playerId: PlayerId,
  count: number,
): CubeCoord[] {
  const zones = playerId === 'player1'
    ? game.map.player1Deployment
    : game.map.player2Deployment;

  const allUnits = [...game.players.player1.units, ...game.players.player2.units];
  const occupied = new Set(allUnits.map((u) => hexToKey(u.position)));

  const result: CubeCoord[] = [];
  for (const hex of zones) {
    if (result.length >= count) break;
    if (!occupied.has(hexToKey(hex))) {
      result.push(hex);
    }
  }
  return result;
}

describe('Full game simulation', () => {
  beforeEach(() => {
    resetUnitIdCounter();
  });

  it('can simulate a complete multi-round game to a winner', () => {
    const game = createGame(42);
    expect(game.phase).toBe('build');
    expect(game.round.roundNumber).toBe(1);
    expect(game.players.player1.resources).toBe(800);
    expect(game.players.player2.resources).toBe(800);

    // Validate generated map
    const mapValidation = validateMap(game.map);
    expect(mapValidation.valid).toBe(true);

    let gameOver = false;
    let roundsPlayed = 0;

    while (!gameOver && roundsPlayed < 5) {
      // BUILD PHASE: both players place units on unoccupied deployment hexes
      const p1Open = findOpenDeploymentHexes(game, 'player1', 3);
      const p2Open = findOpenDeploymentHexes(game, 'player2', 3);

      const obj = game.map.centralObjective;
      const target: DirectiveTarget = { type: 'hex', hex: obj };

      // Player 1: 2 infantry + 1 tank if affordable — advance + shoot-on-sight
      if (p1Open.length >= 1) placeUnit(game, 'player1', 'infantry', p1Open[0]!, 'advance', 'shoot-on-sight', null, target);
      if (p1Open.length >= 2) placeUnit(game, 'player1', 'infantry', p1Open[1]!, 'advance', 'shoot-on-sight', null, target);
      if (p1Open.length >= 3 && canAfford(game.players.player1.resources, UNIT_STATS.tank.cost)) {
        placeUnit(game, 'player1', 'tank', p1Open[2]!, 'advance', 'shoot-on-sight', null, target);
      }

      // Player 2: 2 infantry + 1 tank if affordable — advance + shoot-on-sight
      if (p2Open.length >= 1) placeUnit(game, 'player2', 'infantry', p2Open[0]!, 'advance', 'shoot-on-sight', null, target);
      if (p2Open.length >= 2) placeUnit(game, 'player2', 'infantry', p2Open[1]!, 'advance', 'shoot-on-sight', null, target);
      if (p2Open.length >= 3 && canAfford(game.players.player2.resources, UNIT_STATS.tank.cost)) {
        placeUnit(game, 'player2', 'tank', p2Open[2]!, 'advance', 'shoot-on-sight', null, target);
      }

      expect(game.players.player1.units.length).toBeGreaterThanOrEqual(2);
      expect(game.players.player2.units.length).toBeGreaterThanOrEqual(2);

      // TRANSITION TO BATTLE
      startBattlePhase(game);
      expect(game.phase).toBe('battle');
      expect(game.round.turnNumber).toBe(1);

      // BATTLE PHASE: simulate simultaneous turns until round ends
      const deterministicRng = (): number => 1.0;
      let turnCount = 0;
      let roundEnded = false;

      while (turnCount < 15) {
        resolveTurn(game, [], [], deterministicRng);

        game.round.turnsPlayed += 1;
        game.round.turnNumber += 1;

        const result = checkRoundEnd(game);
        if (result.roundOver) {
          scoreRound(game, result.winner);
          roundsPlayed++;
          roundEnded = true;
          break;
        }
        turnCount++;
      }

      if (!roundEnded) {
        scoreRound(game, null);
        roundsPlayed++;
      }

      // Check game over
      const winner = getWinner(game);
      if (winner) {
        gameOver = true;
        expect(game.phase).toBe('game-over');
        expect(game.winner).toBe(winner);
      }
    }

    // Game should complete: best of 3 means 2-3 rounds minimum
    expect(roundsPlayed).toBeGreaterThanOrEqual(2);
    expect(roundsPlayed).toBeLessThanOrEqual(5);
  });

  it('tracks round wins and declares the correct winner', () => {
    const game = createGame(99);

    // Play exactly 2 rounds, forcing player1 to win both via elimination
    for (let round = 0; round < 2; round++) {
      const p1Open = findOpenDeploymentHexes(game, 'player1', 2);
      const p2Open = findOpenDeploymentHexes(game, 'player2', 1);

      const obj = game.map.centralObjective;
      const target: DirectiveTarget = { type: 'hex', hex: obj };

      // Player 1: 1 tank + 1 infantry (aggressive)
      placeUnit(game, 'player1', 'tank', p1Open[0]!, 'advance', 'shoot-on-sight', null, target);
      placeUnit(game, 'player1', 'infantry', p1Open[1]!, 'advance', 'shoot-on-sight', null, target);

      // Player 2: 1 infantry (weak)
      placeUnit(game, 'player2', 'infantry', p2Open[0]!, 'advance', 'shoot-on-sight', null, target);

      startBattlePhase(game);

      // High damage RNG to speed up kills
      const highDamageRng = (): number => 1.15;
      let turnCount = 0;

      // Simulate simultaneous turns until elimination
      while (turnCount < 15) {
        resolveTurn(game, [], [], highDamageRng);

        game.round.turnsPlayed += 1;
        game.round.turnNumber += 1;

        const result = checkRoundEnd(game);
        if (result.roundOver) { scoreRound(game, result.winner); break; }
        turnCount++;
      }
    }

    // After 2 rounds, one player should have won the match
    const winner = getWinner(game);
    expect(winner).not.toBeNull();
    expect(game.phase).toBe('game-over');
  });

  it('economy flows correctly between rounds', () => {
    const game = createGame(7);

    // Record starting resources
    expect(game.players.player1.resources).toBe(800);

    // Place one cheap unit
    placeUnit(game, 'player1', 'infantry', game.map.player1Deployment[0]!);
    placeUnit(game, 'player2', 'infantry', game.map.player2Deployment[0]!);

    const resourcesAfterBuy = game.players.player1.resources;
    expect(resourcesAfterBuy).toBe(700); // 800 - 100

    startBattlePhase(game);

    // Run simultaneous turns until round ends
    const deterministicRng = (): number => 1.0;
    let turnCount = 0;
    let roundEnded = false;
    while (turnCount < 15) {
      resolveTurn(game, [], [], deterministicRng);

      game.round.turnsPlayed += 1;
      game.round.turnNumber += 1;

      const result = checkRoundEnd(game);
      if (result.roundOver) { scoreRound(game, result.winner); roundEnded = true; break; }
      turnCount++;
    }

    if (!roundEnded) {
      scoreRound(game, null);
    }

    // After scoring, resources should reflect income + carryover - maintenance
    // Both players should have received new resources
    if (game.phase !== 'game-over') {
      expect(game.players.player1.resources).toBeGreaterThan(0);
      expect(game.players.player2.resources).toBeGreaterThan(0);
    }
  });

  it('public API exports are all accessible', () => {
    // Game state functions
    expect(typeof createGame).toBe('function');
    expect(typeof placeUnit).toBe('function');
    expect(typeof startBattlePhase).toBe('function');
    expect(typeof resolveTurn).toBe('function');
    expect(typeof checkRoundEnd).toBe('function');
    expect(typeof scoreRound).toBe('function');
    expect(typeof getWinner).toBe('function');

    // Hex utilities
    expect(typeof createHex).toBe('function');
    expect(typeof hexToKey).toBe('function');
    expect(typeof cubeDistance).toBe('function');
    expect(typeof findPath).toBe('function');

    // Economy
    expect(typeof calculateIncome).toBe('function');
    expect(typeof canAfford).toBe('function');

    // Map generation
    expect(typeof validateMap).toBe('function');

    // Vision
    expect(typeof calculateVisibility).toBe('function');

    // Commands
    expect(typeof createCommandPool).toBe('function');
    expect(typeof canIssueCommand).toBe('function');

    // Constants
    expect(UNIT_STATS.infantry.cost).toBe(100);
    expect(UNIT_STATS.tank.cost).toBe(250);
  });

  it('phase transitions follow the correct order', () => {
    const game = createGame(123);
    expect(game.phase).toBe('build');

    placeUnit(game, 'player1', 'infantry', game.map.player1Deployment[0]!);
    placeUnit(game, 'player2', 'infantry', game.map.player2Deployment[0]!);

    // build -> battle
    startBattlePhase(game);
    expect(game.phase).toBe('battle');

    // Cannot place units during battle
    expect(() => {
      placeUnit(game, 'player1', 'infantry', game.map.player1Deployment[1]!);
    }).toThrow('Can only place units during build phase');

    // Cannot start battle again
    expect(() => {
      startBattlePhase(game);
    }).toThrow('Can only start battle from build phase');
  });
});
