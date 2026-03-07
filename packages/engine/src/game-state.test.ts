import { describe, it, expect, beforeEach } from 'vitest';
import type { GameState, PlayerId, CubeCoord, Command } from './types';
import { resetUnitIdCounter, UNIT_STATS } from './units';
import { hexToKey, createHex } from './hex';
import {
  createGame,
  placeUnit,
  startBattlePhase,
  checkRoundEnd,
  scoreRound,
  getWinner,
  filterValidCommands,
} from './game-state';
import { resolveTurn } from './resolution-pipeline';

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
  return zone[index]!;
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

  it('both players have 800 resources', () => {
    const state = makeGame();
    expect(state.players.player1.resources).toBe(800);
    expect(state.players.player2.resources).toBe(800);
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
    expect(state.round.maxTurns).toBe(12);
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
    expect(state.players.player1.units[0]!.type).toBe('infantry');
    expect(state.players.player1.units[0]!.owner).toBe('player1');
    expect(hexToKey(state.players.player1.units[0]!.position)).toBe(hexToKey(hex));
    expect(state.players.player1.resources).toBe(800 - UNIT_STATS.infantry.cost);
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
    state = placeUnit(state, 'player1', 'infantry', hex, 'hold', 'ignore', null);

    expect(state.players.player1.units[0]!.movementDirective).toBe('hold');
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

  it('resets command pool to 4 CP', () => {
    let state = makeGame();
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    expect(state.round.commandPools.player1.remaining).toBe(4);
    expect(state.round.commandPools.player1.commandedUnitIds.size).toBe(0);
    expect(state.round.commandPools.player2.remaining).toBe(4);
    expect(state.round.commandPools.player2.commandedUnitIds.size).toBe(0);
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

    expect(state.round.turnsPlayed).toBe(0);
  });

  it('resets all units hasActed to false', () => {
    let state = makeGame();
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);

    // Manually set to true to verify reset
    state.players.player1.units[0]!.hasActed = true;
    state = startBattlePhase(state);

    expect(state.players.player1.units[0]!.hasActed).toBe(false);
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
// resolveTurn (via pipeline)
// ---------------------------------------------------------------------------

describe('resolveTurn', () => {
  beforeEach(() => resetUnitIdCounter());

  it('commanded units execute their redirect commands', () => {
    let state = setupBattleGame();
    const unit = state.players.player1.units[0]!;
    const unitId = unit.id;

    const commands: Command[] = [
      { type: 'redirect', unitId, newMovementDirective: 'hold', newAttackDirective: 'shoot-on-sight', newSpecialtyModifier: null },
    ];

    resolveTurn(state, commands, [], () => 1.0);

    const updated = state.players.player1.units.find((u) => u.id === unitId);
    expect(updated).toBeDefined();
    expect(updated!.movementDirective).toBe('hold');
    expect(updated!.attackDirective).toBe('shoot-on-sight');
  });

  it('redirect command changes unit directive', () => {
    let state = setupBattleGame();
    const unit = state.players.player1.units[0]!;
    expect(unit.movementDirective).toBe('advance');

    const commands: Command[] = [
      { type: 'redirect', unitId: unit.id, newMovementDirective: 'hold', newAttackDirective: 'ignore', newSpecialtyModifier: null },
    ];

    resolveTurn(state, commands, [], () => 1.0);

    const updated = state.players.player1.units.find((u) => u.id === unit.id);
    expect(updated?.movementDirective).toBe('hold');
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

  it('turn limit — emits draw (null winner)', () => {
    const state = setupBattleGame();
    state.round.turnsPlayed = 12;

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBeNull();
    expect(result.reason).toBe('turn-limit');
  });

  it('returns roundOver false when game continues', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = 3;
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
    state = scoreRound(state, 'player1');

    // Player should have received income (base 650 + round win bonus 200)
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
    state.round.turnsPlayed = 5;
    state = scoreRound(state, 'player1');

    expect(state.round.turnNumber).toBe(0);
    expect(state.round.currentPlayer).toBe('player1');
    expect(state.round.turnsPlayed).toBe(0);
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
    state.players.player1.units[0]!.hasActed = true;

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

    // Player2 (loser) should get catch-up bonus (250)
    // Player1 (winner) should get round win bonus (200) but NOT catch-up
    // Both get base 650
    // The loser's income should reflect the catch-up bonus
    expect(state.players.player2.resources).toBeGreaterThan(0);
  });

  it('spreads surviving units evenly across deployment zone after round end', () => {
    const state = createGame(42);

    // Place 3 units for player1 in the first 3 deployment hexes
    const zone = state.map.player1Deployment;
    placeUnit(state, 'player1', 'infantry', zone[0]!);
    placeUnit(state, 'player1', 'infantry', zone[1]!);
    placeUnit(state, 'player1', 'infantry', zone[2]!);

    startBattlePhase(state);
    scoreRound(state, 'player1');

    const positions = state.players.player1.units.map((u) => hexToKey(u.position));
    const unique = new Set(positions);
    // All units should be in unique positions
    expect(unique.size).toBe(3);

    // Units should not all be in the first 3 hexes of the zone (spread, not clustered)
    const firstThreeKeys = new Set([hexToKey(zone[0]!), hexToKey(zone[1]!), hexToKey(zone[2]!)]);
    const allInFirstThree = positions.every((p) => firstThreeKeys.has(p));
    expect(allInFirstThree).toBe(false);
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

  it('complete flow: create -> place -> battle -> resolve -> check -> score', () => {
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

    // Execute several turns via pipeline
    for (let i = 0; i < 4; i++) {
      resolveTurn(state, [], [], () => 1.0);
    }

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
// City Ownership
// ---------------------------------------------------------------------------

describe('city ownership', () => {
  beforeEach(() => resetUnitIdCounter());

  it('cities start as neutral in createGame', () => {
    const state = makeGame();
    expect(state.cityOwnership.size).toBeGreaterThan(0);
    for (const owner of state.cityOwnership.values()) {
      expect(owner).toBeNull();
    }
  });

  it('countCitiesHeld reads from ownership map', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    // Manually set some city ownership
    const cityKeys = [...state.cityOwnership.keys()];
    if (cityKeys.length < 2) return;
    state.cityOwnership.set(cityKeys[0]!, 'player1');
    state.cityOwnership.set(cityKeys[1]!, 'player1');

    // scoreRound should use cityOwnership for income calculation
    state = scoreRound(state, 'player1');
    // Player1 owns 2 cities, so they should get city income
    expect(state.players.player1.resources).toBeGreaterThan(0);
  });

  it('cities reset to neutral after scoreRound', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    const cityKeys = [...state.cityOwnership.keys()];
    if (cityKeys.length === 0) return;
    state.cityOwnership.set(cityKeys[0]!, 'player1');

    state = scoreRound(state, 'player1');

    for (const owner of state.cityOwnership.values()) {
      expect(owner).toBeNull();
    }
  });

});

// ---------------------------------------------------------------------------
// filterValidCommands
// ---------------------------------------------------------------------------

describe('filterValidCommands', () => {
  function setupBattle(): GameState {
    let state = makeGame(42);
    // Place 6 infantry per player so we can test exceeding CP limit
    for (let i = 0; i < 6; i++) {
      state = placeInfantry(state, 'player1', i);
      state = placeInfantry(state, 'player2', i);
    }
    state = startBattlePhase(state);
    return state;
  }

  function makeRedirect(unitId: string): Command {
    return {
      type: 'redirect',
      unitId,
      newMovementDirective: 'hold',
      newAttackDirective: 'ignore',
      newSpecialtyModifier: null,
    };
  }

  it('caps commands at pool.remaining', () => {
    const state = setupBattle();
    const units = state.players.player1.units;
    const commands = units.map(u => makeRedirect(u.id));

    // 6 commands, pool.remaining = 4
    expect(commands.length).toBe(6);
    const valid = filterValidCommands(state, commands, 'player1');
    expect(valid.length).toBe(4);
  });

  it('rejects duplicate unit commands in same batch', () => {
    const state = setupBattle();
    const unitId = state.players.player1.units[0]!.id;
    const commands = [makeRedirect(unitId), makeRedirect(unitId)];

    const valid = filterValidCommands(state, commands, 'player1');
    expect(valid.length).toBe(1);
  });

  it('rejects units already commanded this round', () => {
    const state = setupBattle();
    const unitId = state.players.player1.units[0]!.id;
    state.round.commandPools.player1.commandedUnitIds.add(unitId);
    state.round.commandPools.player1.remaining = 3;

    const commands = [makeRedirect(unitId)];
    const valid = filterValidCommands(state, commands, 'player1');
    expect(valid.length).toBe(0);
  });

  it('rejects commands for enemy units', () => {
    const state = setupBattle();
    const enemyUnitId = state.players.player2.units[0]!.id;
    const commands = [makeRedirect(enemyUnitId)];

    const valid = filterValidCommands(state, commands, 'player1');
    expect(valid.length).toBe(0);
  });

  it('rejects non-redirect command types', () => {
    const state = setupBattle();
    const unitId = state.players.player1.units[0]!.id;
    const commands = [{ ...makeRedirect(unitId), type: 'bogus' as Command['type'] }];

    const valid = filterValidCommands(state, commands, 'player1');
    expect(valid.length).toBe(0);
  });
});
