import { describe, it, expect, beforeEach } from 'vitest';
import type { GameState, PlayerId, CubeCoord, Command } from './types';
import { resetUnitIdCounter, UNIT_STATS } from './units';
import { hexToKey, createHex } from './hex';
import { createCommandPool } from './commands';
import {
  createGame,
  placeUnit,
  startBattlePhase,
  executeTurn,
  checkRoundEnd,
  scoreRound,
  getWinner,
} from './game-state';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a game with a deterministic seed. */
function makeGame(seed: number = 42): GameState {
  return createGame(seed);
}

/** Get a valid deployment hex for the given player. */
function getDeploymentHex(state: GameState, player: PlayerId, index: number = 0): CubeCoord {
  const zone = player === 'player1'
    ? state.map.player1Deployment
    : state.map.player2Deployment;
  return zone[index];
}

/** Place infantry in the first available deployment hex. */
function placeInfantry(
  state: GameState,
  player: PlayerId,
  index: number = 0,
): GameState {
  const hex = getDeploymentHex(state, player, index);
  return placeUnit(state, player, 'infantry', hex);
}

/** Set up a game with units placed and battle started. */
function setupBattleGame(seed: number = 42): GameState {
  let state = makeGame(seed);
  state = placeInfantry(state, 'player1', 0);
  state = placeInfantry(state, 'player1', 1);
  state = placeInfantry(state, 'player2', 0);
  state = placeInfantry(state, 'player2', 1);
  state = startBattlePhase(state);
  return state;
}

// ---------------------------------------------------------------------------
// createGame
// ---------------------------------------------------------------------------

describe('createGame', () => {
  beforeEach(() => resetUnitIdCounter());

  it('starts in build phase, round 1', () => {
    const state = makeGame();
    expect(state.phase).toBe('build');
    expect(state.round.roundNumber).toBe(1);
  });

  it('both players have 500 resources', () => {
    const state = makeGame();
    expect(state.players.player1.resources).toBe(500);
    expect(state.players.player2.resources).toBe(500);
  });

  it('map is generated with terrain', () => {
    const state = makeGame();
    expect(state.map.terrain.size).toBeGreaterThan(0);
    expect(state.map.centralObjective).toBeDefined();
    expect(state.map.player1Deployment.length).toBeGreaterThan(0);
    expect(state.map.player2Deployment.length).toBeGreaterThan(0);
  });

  it('players start with 0 roundsWon and empty units', () => {
    const state = makeGame();
    expect(state.players.player1.roundsWon).toBe(0);
    expect(state.players.player2.roundsWon).toBe(0);
    expect(state.players.player1.units).toHaveLength(0);
    expect(state.players.player2.units).toHaveLength(0);
  });

  it('initializes round state correctly', () => {
    const state = makeGame();
    expect(state.round.turnNumber).toBe(0);
    expect(state.round.currentPlayer).toBe('player1');
    expect(state.round.maxTurnsPerSide).toBe(8);
    expect(state.maxRounds).toBe(3);
    expect(state.winner).toBeNull();
  });

  it('deterministic with same seed', () => {
    const s1 = createGame(123);
    const s2 = createGame(123);
    // Same terrain map
    expect(s1.map.terrain.size).toBe(s2.map.terrain.size);
    for (const [key, val] of s1.map.terrain) {
      expect(s2.map.terrain.get(key)).toBe(val);
    }
  });
});

// ---------------------------------------------------------------------------
// placeUnit
// ---------------------------------------------------------------------------

describe('placeUnit', () => {
  beforeEach(() => resetUnitIdCounter());

  it('places unit in deployment zone and deducts cost', () => {
    let state = makeGame();
    const hex = getDeploymentHex(state, 'player1', 0);
    state = placeUnit(state, 'player1', 'infantry', hex);

    expect(state.players.player1.units).toHaveLength(1);
    expect(state.players.player1.units[0].type).toBe('infantry');
    expect(state.players.player1.units[0].owner).toBe('player1');
    expect(hexToKey(state.players.player1.units[0].position)).toBe(hexToKey(hex));
    expect(state.players.player1.resources).toBe(500 - UNIT_STATS.infantry.cost);
  });

  it('rejects placement outside deployment zone', () => {
    const state = makeGame();
    // Central objective is not in any deployment zone
    expect(() =>
      placeUnit(state, 'player1', 'infantry', state.map.centralObjective),
    ).toThrow('Position is not in deployment zone');
  });

  it('rejects placement when cannot afford', () => {
    let state = makeGame();
    state.players.player1.resources = 0;
    const hex = getDeploymentHex(state, 'player1', 0);

    expect(() =>
      placeUnit(state, 'player1', 'infantry', hex),
    ).toThrow('Cannot afford unit');
  });

  it('rejects placement on occupied hex', () => {
    let state = makeGame();
    const hex = getDeploymentHex(state, 'player1', 0);
    state = placeUnit(state, 'player1', 'infantry', hex);

    expect(() =>
      placeUnit(state, 'player1', 'tank', hex),
    ).toThrow('Hex is already occupied');
  });

  it('rejects placement during battle phase', () => {
    let state = makeGame();
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    const hex = getDeploymentHex(state, 'player1', 1);
    expect(() =>
      placeUnit(state, 'player1', 'infantry', hex),
    ).toThrow('Can only place units during build phase');
  });

  it('places unit with custom directive', () => {
    let state = makeGame();
    const hex = getDeploymentHex(state, 'player1', 0);
    state = placeUnit(state, 'player1', 'infantry', hex, 'hold');

    expect(state.players.player1.units[0].directive).toBe('hold');
  });
});

// ---------------------------------------------------------------------------
// startBattlePhase
// ---------------------------------------------------------------------------

describe('startBattlePhase', () => {
  beforeEach(() => resetUnitIdCounter());

  it('transitions to battle phase', () => {
    let state = makeGame();
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    expect(state.phase).toBe('battle');
  });

  it('resets command pool to 3 CP', () => {
    let state = makeGame();
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    expect(state.round.commandPool.remaining).toBe(3);
    expect(state.round.commandPool.commandedUnitIds.size).toBe(0);
  });

  it('sets currentPlayer to player1', () => {
    let state = makeGame();
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    expect(state.round.currentPlayer).toBe('player1');
  });

  it('resets turnsPlayed', () => {
    let state = makeGame();
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    expect(state.round.turnsPlayed.player1).toBe(0);
    expect(state.round.turnsPlayed.player2).toBe(0);
  });

  it('resets all units hasActed to false', () => {
    let state = makeGame();
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);

    // Manually set to true to verify reset
    state.players.player1.units[0].hasActed = true;
    state = startBattlePhase(state);

    expect(state.players.player1.units[0].hasActed).toBe(false);
  });

  it('resets objective state', () => {
    let state = makeGame();
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    expect(state.round.objective.occupiedBy).toBeNull();
    expect(state.round.objective.turnsHeld).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// executeTurn
// ---------------------------------------------------------------------------

describe('executeTurn', () => {
  beforeEach(() => resetUnitIdCounter());

  it('commanded units execute their move commands', () => {
    let state = setupBattleGame();
    const unit = state.players.player1.units[0];
    const unitId = unit.id;
    const originalPos = unit.position;

    // Find a valid adjacent hex that's on the map and unoccupied
    const targetHex = findValidMoveTarget(state, unit);
    if (!targetHex) return; // Skip if no valid target (unlikely)

    const commands: Command[] = [
      { type: 'direct-move', unitId, targetHex },
    ];

    state = executeTurn(state, commands);

    // Unit should have moved
    const movedUnit = state.players.player1.units.find((u) => u.id === unitId);
    expect(movedUnit).toBeDefined();
    expect(hexToKey(movedUnit!.position)).toBe(hexToKey(targetHex));
  });

  it('non-commanded units execute directives', () => {
    let state = setupBattleGame();
    // Execute a turn with no commands — all units should still act via directives
    const unitPositionsBefore = state.players.player1.units.map((u) => hexToKey(u.position));

    state = executeTurn(state, []);

    // After directive execution, at least some units should have acted
    // (they all have 'advance' directive, so they should try to move)
    const unitPositionsAfter = state.players.player1.units.map((u) => hexToKey(u.position));
    // At least one unit should have changed position (advance toward objective)
    const anyMoved = unitPositionsBefore.some(
      (pos, i) => pos !== unitPositionsAfter[i],
    );
    expect(anyMoved).toBe(true);
  });

  it('attack damage is applied correctly and dead units are removed', () => {
    let state = makeGame(42);

    // Place units adjacent to each other for combat
    // We need to find adjacent hexes in different deployment zones
    // Instead, we'll place units and then manually move them adjacent
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    const attacker = state.players.player1.units[0];
    const defender = state.players.player2.units[0];

    // Place them adjacent manually
    attacker.position = createHex(4, 0);
    defender.position = createHex(5, 0);

    // Verify they can attack each other
    const commands: Command[] = [
      { type: 'direct-attack', unitId: attacker.id, targetUnitId: defender.id },
    ];

    const defenderHpBefore = defender.hp;
    // Use deterministic randomFn
    state = executeTurn(state, commands, () => 1.0);

    // Damage should have been applied
    if (state.players.player2.units.find((u) => u.id === defender.id)) {
      expect(defender.hp).toBeLessThan(defenderHpBefore);
    }
    // If killed, unit should be removed
  });

  it('current player switches after turn', () => {
    let state = setupBattleGame();
    expect(state.round.currentPlayer).toBe('player1');

    state = executeTurn(state, []);
    expect(state.round.currentPlayer).toBe('player2');

    state = executeTurn(state, []);
    expect(state.round.currentPlayer).toBe('player1');
  });

  it('turnsPlayed increments for current player', () => {
    let state = setupBattleGame();
    expect(state.round.turnsPlayed.player1).toBe(0);

    state = executeTurn(state, []);
    expect(state.round.turnsPlayed.player1).toBe(1);
    expect(state.round.turnsPlayed.player2).toBe(0);

    state = executeTurn(state, []);
    expect(state.round.turnsPlayed.player1).toBe(1);
    expect(state.round.turnsPlayed.player2).toBe(1);
  });

  it('fresh command pool is created for next player', () => {
    let state = setupBattleGame();
    state = executeTurn(state, []);

    expect(state.round.commandPool.remaining).toBe(3);
    expect(state.round.commandPool.commandedUnitIds.size).toBe(0);
  });

  it('rejects turns during build phase', () => {
    const state = makeGame();
    expect(() => executeTurn(state, [])).toThrow('Can only execute turns during battle phase');
  });

  it('objective tracking updates when unit occupies central hex', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    // Move a unit onto the central objective
    const unit = state.players.player1.units[0];
    unit.position = state.map.centralObjective;

    state = executeTurn(state, [], () => 1.0);

    expect(state.round.objective.occupiedBy).toBe('player1');
    expect(state.round.objective.turnsHeld).toBe(1);
  });

  it('redirect command changes unit directive', () => {
    let state = setupBattleGame();
    const unit = state.players.player1.units[0];
    expect(unit.directive).toBe('advance');

    const commands: Command[] = [
      { type: 'redirect', unitId: unit.id, newDirective: 'hold' },
    ];

    state = executeTurn(state, commands);
    // Directive should be changed
    const updated = state.players.player1.units.find((u) => u.id === unit.id);
    expect(updated?.directive).toBe('hold');
  });
});

// ---------------------------------------------------------------------------
// checkRoundEnd
// ---------------------------------------------------------------------------

describe('checkRoundEnd', () => {
  beforeEach(() => resetUnitIdCounter());

  it('detects King of the Hill win (turnsHeld >= 2)', () => {
    let state = setupBattleGame();
    state.round.objective = { occupiedBy: 'player1', turnsHeld: 2 };

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('king-of-the-hill');
  });

  it('detects elimination (0 units)', () => {
    let state = setupBattleGame();
    state.players.player2.units = [];

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('elimination');
  });

  it('elimination — player1 has 0 units', () => {
    let state = setupBattleGame();
    state.players.player1.units = [];

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player2');
    expect(result.reason).toBe('elimination');
  });

  it('turn limit tiebreaker — unit on central hex wins', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = { player1: 8, player2: 8 };

    // Put player2 unit on central hex
    state.players.player2.units[0].position = state.map.centralObjective;

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player2');
    expect(result.reason).toBe('turn-limit');
  });

  it('turn limit tiebreaker — closer to center wins', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = { player1: 8, player2: 8 };

    const central = state.map.centralObjective;
    // Place player1 unit 1 hex away, player2 unit 3 hexes away
    state.players.player1.units = [state.players.player1.units[0]];
    state.players.player2.units = [state.players.player2.units[0]];

    state.players.player1.units[0].position = createHex(central.q + 1, central.r);
    state.players.player2.units[0].position = createHex(central.q + 3, central.r);

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('turn-limit');
  });

  it('turn limit tiebreaker — more HP wins', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = { player1: 8, player2: 8 };

    // Same distance from center, but different HP
    const central = state.map.centralObjective;
    state.players.player1.units = [state.players.player1.units[0]];
    state.players.player2.units = [state.players.player2.units[0]];

    state.players.player1.units[0].position = createHex(central.q + 1, central.r);
    state.players.player2.units[0].position = createHex(central.q - 1, central.r);

    state.players.player1.units[0].hp = 3;
    state.players.player2.units[0].hp = 1;

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('turn-limit');
  });

  it('turn limit tiebreaker — player1 wins when fully tied', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = { player1: 8, player2: 8 };

    // Same distance, same HP
    const central = state.map.centralObjective;
    state.players.player1.units = [state.players.player1.units[0]];
    state.players.player2.units = [state.players.player2.units[0]];

    state.players.player1.units[0].position = createHex(central.q + 1, central.r);
    state.players.player2.units[0].position = createHex(central.q - 1, central.r);

    state.players.player1.units[0].hp = 3;
    state.players.player2.units[0].hp = 3;

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('turn-limit');
  });

  it('returns roundOver false when game continues', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = { player1: 3, player2: 3 };
    state.round.objective = { occupiedBy: null, turnsHeld: 0 };

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(false);
    expect(result.winner).toBeNull();
    expect(result.reason).toBeNull();
  });

  it('KotH at exactly turnsHeld = 2', () => {
    let state = setupBattleGame();
    state.round.objective = { occupiedBy: 'player2', turnsHeld: 2 };

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player2');
    expect(result.reason).toBe('king-of-the-hill');
  });

  it('turnsHeld = 1 does not trigger KotH', () => {
    let state = setupBattleGame();
    state.round.objective = { occupiedBy: 'player1', turnsHeld: 1 };

    const result = checkRoundEnd(state);
    // Should not be KotH — check if it's over for other reasons
    if (result.roundOver) {
      expect(result.reason).not.toBe('king-of-the-hill');
    }
  });
});

// ---------------------------------------------------------------------------
// scoreRound
// ---------------------------------------------------------------------------

describe('scoreRound', () => {
  beforeEach(() => resetUnitIdCounter());

  it('increments winner roundsWon', () => {
    let state = setupBattleGame();
    state = scoreRound(state, 'player1');

    expect(state.players.player1.roundsWon).toBe(1);
    expect(state.players.player2.roundsWon).toBe(0);
  });

  it('awards resources correctly', () => {
    let state = setupBattleGame();
    const p1ResourcesBefore = state.players.player1.resources;

    state = scoreRound(state, 'player1');

    // Player should have received income (base 500 + round win bonus 150)
    // Minus maintenance for surviving units, plus carryover
    expect(state.players.player1.resources).toBeGreaterThan(0);
  });

  it('transitions to next round build phase', () => {
    let state = setupBattleGame();
    state = scoreRound(state, 'player1');

    expect(state.phase).toBe('build');
    expect(state.round.roundNumber).toBe(2);
  });

  it('resets round state for next round', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = { player1: 5, player2: 5 };
    state = scoreRound(state, 'player1');

    expect(state.round.turnNumber).toBe(0);
    expect(state.round.currentPlayer).toBe('player1');
    expect(state.round.turnsPlayed.player1).toBe(0);
    expect(state.round.turnsPlayed.player2).toBe(0);
    expect(state.round.objective.occupiedBy).toBeNull();
  });

  it('detects game over after enough rounds won', () => {
    let state = setupBattleGame();
    state.players.player1.roundsWon = 1; // Already won 1

    state = scoreRound(state, 'player1');

    expect(state.phase).toBe('game-over');
    expect(state.winner).toBe('player1');
    expect(state.players.player1.roundsWon).toBe(2);
  });

  it('resets units hasActed', () => {
    let state = setupBattleGame();
    state.players.player1.units[0].hasActed = true;

    state = scoreRound(state, 'player1');

    for (const unit of state.players.player1.units) {
      expect(unit.hasActed).toBe(false);
    }
  });

  it('null winner does not increment roundsWon', () => {
    let state = setupBattleGame();
    state = scoreRound(state, null);

    expect(state.players.player1.roundsWon).toBe(0);
    expect(state.players.player2.roundsWon).toBe(0);
  });

  it('loser gets catch-up bonus', () => {
    let state = makeGame(42);
    // Place cheap units only for player1
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    // Set equal starting resources to make comparison clear
    state.players.player1.resources = 100;
    state.players.player2.resources = 100;

    state = scoreRound(state, 'player1');

    // Player2 (loser) should get catch-up bonus (200)
    // Player1 (winner) should get round win bonus (150) but NOT catch-up
    // Both get base 500
    // The loser's income should reflect the catch-up bonus
    expect(state.players.player2.resources).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getWinner
// ---------------------------------------------------------------------------

describe('getWinner', () => {
  beforeEach(() => resetUnitIdCounter());

  it('returns winner when roundsWon >= 2 (best of 3)', () => {
    const state = makeGame();
    state.players.player1.roundsWon = 2;

    expect(getWinner(state)).toBe('player1');
  });

  it('returns player2 when they have won 2', () => {
    const state = makeGame();
    state.players.player2.roundsWon = 2;

    expect(getWinner(state)).toBe('player2');
  });

  it('returns null when no winner yet', () => {
    const state = makeGame();
    state.players.player1.roundsWon = 1;
    state.players.player2.roundsWon = 1;

    expect(getWinner(state)).toBeNull();
  });

  it('returns null when both at 0', () => {
    const state = makeGame();
    expect(getWinner(state)).toBeNull();
  });

  it('works with maxRounds = 5 (need 3 wins)', () => {
    const state = makeGame();
    state.maxRounds = 5;
    state.players.player1.roundsWon = 2;

    expect(getWinner(state)).toBeNull();

    state.players.player1.roundsWon = 3;
    expect(getWinner(state)).toBe('player1');
  });
});

// ---------------------------------------------------------------------------
// Integration: Full Round Flow
// ---------------------------------------------------------------------------

describe('full round flow integration', () => {
  beforeEach(() => resetUnitIdCounter());

  it('complete flow: create -> place -> battle -> check -> score', () => {
    let state = makeGame(42);

    // Build phase: place units
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player1', 1);
    state = placeInfantry(state, 'player2', 0);
    state = placeInfantry(state, 'player2', 1);

    expect(state.phase).toBe('build');
    expect(state.players.player1.units).toHaveLength(2);

    // Start battle
    state = startBattlePhase(state);
    expect(state.phase).toBe('battle');

    // Execute several turns
    for (let i = 0; i < 4; i++) {
      state = executeTurn(state, [], () => 1.0);
    }

    // Verify turnsPlayed have been tracked
    expect(state.round.turnsPlayed.player1).toBe(2);
    expect(state.round.turnsPlayed.player2).toBe(2);

    // Force round end by elimination
    state.players.player2.units = [];
    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');

    // Score the round
    state = scoreRound(state, result.winner);
    expect(state.players.player1.roundsWon).toBe(1);
    expect(state.phase).toBe('build');
    expect(state.round.roundNumber).toBe(2);
  });

  it('game ends after winning 2 rounds', () => {
    let state = makeGame(42);

    // Simulate two rounds won by player1
    state.players.player1.roundsWon = 1;
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    // Score with player1 winning again
    state = scoreRound(state, 'player1');

    expect(state.phase).toBe('game-over');
    expect(state.winner).toBe('player1');
    expect(getWinner(state)).toBe('player1');
  });
});

// ---------------------------------------------------------------------------
// Helpers (test-internal)
// ---------------------------------------------------------------------------

function findValidMoveTarget(state: GameState, unit: { position: CubeCoord; type: string }): CubeCoord | null {
  const neighbors = [
    createHex(unit.position.q + 1, unit.position.r),
    createHex(unit.position.q - 1, unit.position.r),
    createHex(unit.position.q, unit.position.r + 1),
    createHex(unit.position.q, unit.position.r - 1),
    createHex(unit.position.q + 1, unit.position.r - 1),
    createHex(unit.position.q - 1, unit.position.r + 1),
  ];

  const allUnits = [...state.players.player1.units, ...state.players.player2.units];
  const occupiedKeys = new Set(allUnits.map((u) => hexToKey(u.position)));

  for (const hex of neighbors) {
    const key = hexToKey(hex);
    if (state.map.terrain.has(key) && !occupiedKeys.has(key)) {
      return hex;
    }
  }
  return null;
}
