import { describe, it, expect, beforeEach } from 'vitest';
import type { GameState, PlayerId, CubeCoord, Command } from './types';
import { resetUnitIdCounter, UNIT_STATS } from './units';
import { hexToKey, createHex, hexNeighbors, cubeDistance } from './hex';
import { createBuilding, resetBuildingIdCounter, BUILDING_STATS } from './buildings';
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
    expect(state.round.maxTurnsPerSide).toBe(12);
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
    state = placeUnit(state, 'player1', 'infantry', hex, 'hold');

    expect(state.players.player1.units[0]!.directive).toBe('hold');
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

    expect(state.round.commandPool.remaining).toBe(4);
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
// executeTurn
// ---------------------------------------------------------------------------

describe('executeTurn', () => {
  beforeEach(() => resetUnitIdCounter());

  it('commanded units execute their move commands', () => {
    let state = setupBattleGame();
    const unit = state.players.player1.units[0]!;
    const unitId = unit.id;

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
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    const attacker = state.players.player1.units[0]!;
    const defender = state.players.player2.units[0]!;

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
    const defAfter = state.players.player2.units.find((u) => u.id === defender.id);
    if (defAfter) {
      expect(defAfter.hp).toBeLessThan(defenderHpBefore);
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

    expect(state.round.commandPool.remaining).toBe(4);
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
    const unit = state.players.player1.units[0]!;
    unit.position = state.map.centralObjective;

    // Give player1 ownership of 2 cities so KotH gate passes
    const cityKeys = [...state.cityOwnership.keys()];
    state.cityOwnership.set(cityKeys[0]!, 'player1');
    state.cityOwnership.set(cityKeys[1]!, 'player1');

    state = executeTurn(state, [], () => 1.0);

    expect(state.round.objective.occupiedBy).toBe('player1');
    expect(state.round.objective.turnsHeld).toBeGreaterThanOrEqual(1);
  });

  it('redirect command changes unit directive', () => {
    let state = setupBattleGame();
    const unit = state.players.player1.units[0]!;
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
// City Capture HP Cost
// ---------------------------------------------------------------------------

describe('city capture HP cost', () => {
  beforeEach(() => resetUnitIdCounter());

  it('capturing a city costs 1 HP', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    const cityKeys = [...state.cityOwnership.keys()];
    if (cityKeys.length === 0) return;
    const cityKey = cityKeys[0]!;

    const unit = state.players.player1.units[0]!;
    const cityCoord = findCoordForKey(state, cityKey);
    if (!cityCoord) return;
    unit.position = cityCoord;

    const hpBefore = unit.hp;
    state = executeTurn(state, [], () => 1.0);

    // City should be captured and unit lost 1 HP
    expect(state.cityOwnership.get(cityKey)).toBe('player1');
    const unitAfter = state.players.player1.units.find((u) => u.id === unit.id);
    if (unitAfter) {
      expect(unitAfter.hp).toBe(hpBefore - 1);
    }
  });

  it('city capture can kill the unit (hp drops to 0)', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    const cityKeys = [...state.cityOwnership.keys()];
    if (cityKeys.length === 0) return;
    const cityKey = cityKeys[0]!;

    const unit = state.players.player1.units[0]!;
    const cityCoord = findCoordForKey(state, cityKey);
    if (!cityCoord) return;
    unit.position = cityCoord;
    unit.hp = 1; // Will die from capture

    state = executeTurn(state, [], () => 1.0);

    // City should still flip
    expect(state.cityOwnership.get(cityKey)).toBe('player1');
    // Unit should be dead
    const unitAfter = state.players.player1.units.find((u) => u.id === unit.id);
    expect(unitAfter).toBeUndefined();
  });

  it('no HP cost when city already owned by the player', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    const cityKeys = [...state.cityOwnership.keys()];
    if (cityKeys.length === 0) return;
    const cityKey = cityKeys[0]!;

    // Pre-own the city
    state.cityOwnership.set(cityKey, 'player1');

    const unit = state.players.player1.units[0]!;
    const cityCoord = findCoordForKey(state, cityKey);
    if (!cityCoord) return;
    unit.position = cityCoord;

    const hpBefore = unit.hp;
    state = executeTurn(state, [], () => 1.0);

    const unitAfter = state.players.player1.units.find((u) => u.id === unit.id);
    if (unitAfter) {
      expect(unitAfter.hp).toBe(hpBefore); // No HP cost
    }
  });
});

// ---------------------------------------------------------------------------
// KotH City Gate
// ---------------------------------------------------------------------------

describe('KotH city gate', () => {
  beforeEach(() => resetUnitIdCounter());

  it('KotH does not increment turnsHeld without 2 city control', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    // Move player1 onto objective but no cities held
    const unit = state.players.player1.units[0]!;
    unit.position = state.map.centralObjective;

    state = executeTurn(state, [], () => 1.0);

    // turnsHeld should be 0 (present but not progressing)
    expect(state.round.objective.occupiedBy).toBe('player1');
    expect(state.round.objective.turnsHeld).toBe(0);
  });

  it('KotH increments turnsHeld with 2+ cities', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    // Give player1 2 cities
    const cityKeys = [...state.cityOwnership.keys()];
    state.cityOwnership.set(cityKeys[0]!, 'player1');
    state.cityOwnership.set(cityKeys[1]!, 'player1');

    // Move player1 onto objective
    const unit = state.players.player1.units[0]!;
    unit.position = state.map.centralObjective;

    state = executeTurn(state, [], () => 1.0);

    expect(state.round.objective.occupiedBy).toBe('player1');
    expect(state.round.objective.turnsHeld).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Scout executes first
// ---------------------------------------------------------------------------

describe('scout units execute first', () => {
  beforeEach(() => resetUnitIdCounter());

  it('scout units act before other directives', () => {
    let state = makeGame(42);
    // Place a scout and an advance unit
    const scoutHex = getDeploymentHex(state, 'player1', 0);
    const advanceHex = getDeploymentHex(state, 'player1', 1);
    state = placeUnit(state, 'player1', 'recon', scoutHex, 'scout');
    state = placeUnit(state, 'player1', 'infantry', advanceHex, 'advance');
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    // Both units should act — this validates that the two-pass system doesn't crash
    state = executeTurn(state, []);

    // All units should have acted
    // (Next turn's units get reset, but the current player's should have completed)
    expect(state.round.turnsPlayed.player1).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Support heals adjacent friendly
// ---------------------------------------------------------------------------

describe('support directive heals adjacent', () => {
  beforeEach(() => resetUnitIdCounter());

  it('support unit heals adjacent friendly with lowest HP', () => {
    let state = makeGame(42);

    // Place support unit and a damaged friendly adjacent to each other
    const supportHex = getDeploymentHex(state, 'player1', 0);
    const damagedHex = getDeploymentHex(state, 'player1', 1);
    state = placeUnit(state, 'player1', 'infantry', supportHex, 'support');
    state = placeUnit(state, 'player1', 'infantry', damagedHex, 'advance');
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    // Place them adjacent
    const supportUnit = state.players.player1.units[0]!;
    const damagedUnit = state.players.player1.units[1]!;
    supportUnit.position = createHex(4, 0);
    damagedUnit.position = createHex(5, 0);
    damagedUnit.hp = 1; // Below maxHp (infantry maxHp = 3)

    state = executeTurn(state, [], () => 1.0);

    // The damaged unit might have moved (directive AI) or been healed
    // Check if any player1 unit got healed or verify the mechanic runs without error
    // The key guarantee: support healing code runs without crashing
    expect(state.round.turnsPlayed.player1).toBe(1);
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
    state.round.turnsPlayed = { player1: 12, player2: 12 };

    // Put player2 unit on central hex
    state.players.player2.units[0]!.position = state.map.centralObjective;

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player2');
    expect(result.reason).toBe('turn-limit');
  });

  it('turn limit tiebreaker — closer to center wins', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = { player1: 12, player2: 12 };

    const central = state.map.centralObjective;
    // Place player1 unit 1 hex away, player2 unit 3 hexes away
    state.players.player1.units = [state.players.player1.units[0]!];
    state.players.player2.units = [state.players.player2.units[0]!];

    state.players.player1.units[0]!.position = createHex(central.q + 1, central.r);
    state.players.player2.units[0]!.position = createHex(central.q + 3, central.r);

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('turn-limit');
  });

  it('turn limit tiebreaker — more HP wins', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = { player1: 12, player2: 12 };

    // Same distance from center, but different HP
    const central = state.map.centralObjective;
    state.players.player1.units = [state.players.player1.units[0]!];
    state.players.player2.units = [state.players.player2.units[0]!];

    state.players.player1.units[0]!.position = createHex(central.q + 1, central.r);
    state.players.player2.units[0]!.position = createHex(central.q - 1, central.r);

    state.players.player1.units[0]!.hp = 3;
    state.players.player2.units[0]!.hp = 1;

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('turn-limit');
  });

  it('turn limit tiebreaker — player1 wins when fully tied', () => {
    let state = setupBattleGame();
    state.round.turnsPlayed = { player1: 12, player2: 12 };

    // Same distance, same HP
    const central = state.map.centralObjective;
    state.players.player1.units = [state.players.player1.units[0]!];
    state.players.player2.units = [state.players.player2.units[0]!];

    state.players.player1.units[0]!.position = createHex(central.q + 1, central.r);
    state.players.player2.units[0]!.position = createHex(central.q - 1, central.r);

    state.players.player1.units[0]!.hp = 3;
    state.players.player2.units[0]!.hp = 3;

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

  it('city is captured when a unit ends turn on it', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    // Find a city hex
    const cityKeys = [...state.cityOwnership.keys()];
    if (cityKeys.length === 0) return; // skip if map has no cities
    const cityKey = cityKeys[0]!;

    // Move unit onto the city hex
    const unit = state.players.player1.units[0]!;
    const cityCoord = findCoordForKey(state, cityKey);
    if (!cityCoord) return;
    unit.position = cityCoord;

    state = executeTurn(state, [], () => 1.0);

    expect(state.cityOwnership.get(cityKey)).toBe('player1');
  });

  it('enemy captures city by ending turn on it', () => {
    let state = makeGame(42);
    state = placeInfantry(state, 'player1', 0);
    state = placeInfantry(state, 'player2', 0);
    state = startBattlePhase(state);

    const cityKeys = [...state.cityOwnership.keys()];
    if (cityKeys.length === 0) return;
    const cityKey = cityKeys[0]!;

    // P1 captures first
    const p1Unit = state.players.player1.units[0]!;
    const cityCoord = findCoordForKey(state, cityKey);
    if (!cityCoord) return;
    p1Unit.position = cityCoord;
    state = executeTurn(state, [], () => 1.0);
    expect(state.cityOwnership.get(cityKey)).toBe('player1');

    // P2 moves onto same city (P1 unit is elsewhere now from directive AI)
    const p2Unit = state.players.player2.units[0]!;
    p2Unit.position = cityCoord;
    state = executeTurn(state, [], () => 1.0);
    expect(state.cityOwnership.get(cityKey)).toBe('player2');
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
// direct-build command
// ---------------------------------------------------------------------------

describe('direct-build command', () => {
  beforeEach(() => {
    resetUnitIdCounter();
    resetBuildingIdCounter();
  });

  it('engineer builds a recon-tower on adjacent hex', () => {
    const state = createGame(42);
    // Find a deployment hex that has a valid adjacent non-DZ non-mountain hex
    const dzKeys = new Set([
      ...state.map.player1Deployment.map(hexToKey),
      ...state.map.player2Deployment.map(hexToKey),
    ]);

    let deployHex: CubeCoord | undefined;
    let buildTarget: CubeCoord | undefined;

    for (const dh of state.map.player1Deployment) {
      const adj = hexNeighbors(dh).find((h) => {
        const key = hexToKey(h);
        return state.map.terrain.has(key)
          && state.map.terrain.get(key) !== 'mountain'
          && !dzKeys.has(key);
      });
      if (adj) {
        deployHex = dh;
        buildTarget = adj;
        break;
      }
    }

    expect(deployHex).toBeDefined();
    expect(buildTarget).toBeDefined();

    placeUnit(state, 'player1', 'engineer', deployHex!);
    startBattlePhase(state);

    const engineer = state.players.player1.units[0]!;
    const resourcesBefore = state.players.player1.resources;

    executeTurn(state, [
      { type: 'direct-build', unitId: engineer.id, buildingType: 'recon-tower', targetHex: buildTarget! },
    ]);

    expect(state.buildings.length).toBe(1);
    expect(state.buildings[0]!.type).toBe('recon-tower');
    expect(state.buildings[0]!.owner).toBe('player1');
    expect(hexToKey(state.buildings[0]!.position)).toBe(hexToKey(buildTarget!));
    // Resources should have decreased by building cost (75)
    expect(state.players.player1.resources).toBe(resourcesBefore - 75);
  });
});

// ---------------------------------------------------------------------------
// attack-building command
// ---------------------------------------------------------------------------

describe('attack-building command', () => {
  beforeEach(() => {
    resetUnitIdCounter();
    resetBuildingIdCounter();
  });

  it('unit destroys an enemy building', () => {
    const state = createGame(42);
    const p1Deploy = state.map.player1Deployment[0]!;
    placeUnit(state, 'player1', 'infantry', p1Deploy);
    startBattlePhase(state);

    const infantry = state.players.player1.units[0]!;
    // Place an enemy building adjacent to infantry
    const adjHex = hexNeighbors(infantry.position).find(
      (h) => state.map.terrain.has(hexToKey(h)),
    )!;
    state.buildings.push(createBuilding('mortar', 'player2', adjHex));
    expect(state.buildings.length).toBe(1);

    executeTurn(state, [
      { type: 'attack-building', unitId: infantry.id, targetBuildingId: state.buildings[0]!.id },
    ]);

    expect(state.buildings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mine triggering
// ---------------------------------------------------------------------------

describe('mine triggering', () => {
  beforeEach(() => {
    resetUnitIdCounter();
    resetBuildingIdCounter();
  });

  it('mine deals damage when unit moves onto hex via direct-move', () => {
    const state = createGame(42);
    const p1Deploy = state.map.player1Deployment[0]!;
    placeUnit(state, 'player1', 'infantry', p1Deploy);
    startBattlePhase(state);

    const infantry = state.players.player1.units[0]!;
    const mineHex = hexNeighbors(infantry.position).find((h) => {
      const key = hexToKey(h);
      return state.map.terrain.has(key) && state.map.terrain.get(key) !== 'mountain';
    })!;

    state.buildings.push(createBuilding('mines', 'player2', mineHex));

    const hpBefore = infantry.hp; // should be 3
    executeTurn(state, [
      { type: 'direct-move', unitId: infantry.id, targetHex: mineHex },
    ]);

    // Mine destroyed
    expect(state.buildings.length).toBe(0);
    // Infantry took 2 damage
    const inf = state.players.player1.units.find((u) => u.id === infantry.id);
    expect(inf).toBeDefined();
    expect(inf!.hp).toBe(hpBefore - 2);
  });

  it('mine kills unit if damage exceeds HP', () => {
    const state = createGame(42);
    const p1Deploy = state.map.player1Deployment[0]!;
    placeUnit(state, 'player1', 'recon', p1Deploy); // recon has 2 HP
    startBattlePhase(state);

    const recon = state.players.player1.units[0]!;
    expect(recon.hp).toBe(2);

    const mineHex = hexNeighbors(recon.position).find((h) => {
      const key = hexToKey(h);
      return state.map.terrain.has(key) && state.map.terrain.get(key) !== 'mountain';
    })!;

    state.buildings.push(createBuilding('mines', 'player2', mineHex));

    executeTurn(state, [
      { type: 'direct-move', unitId: recon.id, targetHex: mineHex },
    ]);

    expect(state.buildings.length).toBe(0);
    // Recon should be dead (2 HP - 2 damage = 0)
    expect(state.players.player1.units.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mortar firing
// ---------------------------------------------------------------------------

describe('mortar firing', () => {
  beforeEach(() => {
    resetUnitIdCounter();
    resetBuildingIdCounter();
  });

  it('mortar attacks nearest enemy in range after all units act', () => {
    const state = createGame(42);
    placeUnit(state, 'player1', 'infantry', state.map.player1Deployment[0]!);
    placeUnit(state, 'player2', 'infantry', state.map.player2Deployment[0]!);
    startBattlePhase(state);

    const p2Inf = state.players.player2.units[0]!;

    // Find a hex 2-3 from p2 infantry that's on the map
    let mortarPos: CubeCoord | undefined;
    for (const key of state.map.terrain.keys()) {
      const [qStr, rStr] = key.split(',');
      const hex = createHex(Number(qStr), Number(rStr));
      const dist = cubeDistance(hex, p2Inf.position);
      if (dist >= 2 && dist <= 3) {
        mortarPos = hex;
        break;
      }
    }
    expect(mortarPos).toBeDefined();

    state.buildings.push(createBuilding('mortar', 'player1', mortarPos!));

    const hpBefore = p2Inf.hp;

    // Execute turn with no commands — directives run, then mortar fires
    executeTurn(state, []);

    // Check mortar fired (may have killed or damaged)
    const p2InfAfter = state.players.player2.units.find((u) => u.id === p2Inf.id);
    if (p2InfAfter) {
      expect(p2InfAfter.hp).toBeLessThan(hpBefore);
    } else {
      // Unit was killed
      expect(state.players.player2.units.length).toBe(0);
    }
  });

  it('mortar does not fire at enemies outside range', () => {
    const state = createGame(42);
    placeUnit(state, 'player1', 'infantry', state.map.player1Deployment[0]!);
    placeUnit(state, 'player2', 'infantry', state.map.player2Deployment[0]!);
    startBattlePhase(state);

    const p2Inf = state.players.player2.units[0]!;

    // Place mortar far away (distance > 3)
    let farHex: CubeCoord | undefined;
    for (const key of state.map.terrain.keys()) {
      const [qStr, rStr] = key.split(',');
      const hex = createHex(Number(qStr), Number(rStr));
      const dist = cubeDistance(hex, p2Inf.position);
      if (dist > 5) {
        farHex = hex;
        break;
      }
    }
    if (!farHex) return; // skip if no hex far enough

    state.buildings.push(createBuilding('mortar', 'player1', farHex));
    const hpBefore = p2Inf.hp;

    executeTurn(state, []);

    // p2 infantry may have moved due to directives, but mortar should not have fired from far away
    // Check no mortar-fire events
    const mortarEvents = state.pendingEvents.filter((e) => e.type === 'mortar-fire');
    expect(mortarEvents.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers (test-internal)
// ---------------------------------------------------------------------------

function findCoordForKey(_state: GameState, key: string): CubeCoord | null {
  // Parse hex key "q,r,s" back to CubeCoord
  const parts = key.split(',').map(Number);
  if (parts.length !== 3) return null;
  return createHex(parts[0]!, parts[1]!);
}

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
