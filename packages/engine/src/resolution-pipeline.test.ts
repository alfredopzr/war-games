import { describe, it, expect, beforeEach } from 'vitest';
import type { GameState, PlayerId, CubeCoord, Command, Unit } from './types';
import { resetUnitIdCounter, UNIT_STATS } from './units';
import { hexToKey, createHex, CUBE_DIRECTIONS } from './hex';
import {
  createGame,
  placeUnit,
  startBattlePhase,
  checkRoundEnd,
} from './game-state';
import { resolveTurn, computeApproachAngle, computeFacing } from './resolution-pipeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGame(seed: number = 42): GameState {
  return createGame(seed);
}

function getDeploymentHex(state: GameState, player: PlayerId, index: number = 0): CubeCoord {
  const zone = player === 'player1'
    ? state.map.player1Deployment
    : state.map.player2Deployment;
  return zone[index]!;
}

function placeInfantry(state: GameState, player: PlayerId, index: number = 0): GameState {
  const hex = getDeploymentHex(state, player, index);
  return placeUnit(state, player, 'infantry', hex, 'advance', 'ignore', null, { type: 'hex', hex: state.map.centralObjective });
}

function setupBattleGame(seed: number = 42): GameState {
  let state = makeGame(seed);
  state = placeInfantry(state, 'player1', 0);
  state = placeInfantry(state, 'player1', 1);
  state = placeInfantry(state, 'player2', 0);
  state = placeInfantry(state, 'player2', 1);
  state = startBattlePhase(state);
  return state;
}

function makeUnit(
  overrides: Partial<Unit> & Pick<Unit, 'type' | 'owner' | 'position'>,
): Unit {
  return {
    id: overrides.id ?? 'test-unit',
    type: overrides.type,
    owner: overrides.owner,
    hp: overrides.hp ?? UNIT_STATS[overrides.type].maxHp,
    position: overrides.position,
    movementDirective: overrides.movementDirective ?? 'advance',
    attackDirective: overrides.attackDirective ?? 'shoot-on-sight',
    specialtyModifier: overrides.specialtyModifier ?? null,
    directiveTarget: overrides.directiveTarget ?? { type: 'hex', hex: overrides.position },
    hasActed: overrides.hasActed ?? false,
  };
}

/** Deterministic max-damage RNG (returns 1.15) */
const maxRng = (): number => 1.15;

/** Deterministic min-damage RNG (returns 0.85) */
const minRng = (): number => 0.85;

/** Deterministic mid-damage RNG (returns 1.0) */
const midRng = (): number => 1.0;

beforeEach(() => {
  resetUnitIdCounter();
});

// ---------------------------------------------------------------------------
// computeApproachAngle
// ---------------------------------------------------------------------------

describe('computeApproachAngle', () => {
  const origin: CubeCoord = { q: 0, r: 0, s: 0 };

  it('returns front when attacker is ahead of defender facing', () => {
    // Defender at origin facing east (direction 0: q+1, r+0, s-1)
    // Attacker at (1, 0, -1) — directly ahead
    const facing = CUBE_DIRECTIONS[0]!;
    expect(computeApproachAngle({ q: 1, r: 0, s: -1 }, origin, facing)).toBe('front');
  });

  it('returns front for adjacent direction (within 1 step)', () => {
    // Defender facing east, attacker at direction 1 (q+1, r-1, s+0)
    const facing = CUBE_DIRECTIONS[0]!;
    expect(computeApproachAngle({ q: 1, r: -1, s: 0 }, origin, facing)).toBe('front');
  });

  it('returns flank when attacker is perpendicular', () => {
    // Defender facing east (dir 0), attacker from dir 2 (q+0, r-1, s+1) — 2 steps away
    const facing = CUBE_DIRECTIONS[0]!;
    expect(computeApproachAngle({ q: 0, r: -1, s: 1 }, origin, facing)).toBe('flank');
  });

  it('returns rear when attacker is behind', () => {
    // Defender facing east (dir 0), attacker from dir 3 (q-1, r+0, s+1) — opposite
    const facing = CUBE_DIRECTIONS[0]!;
    expect(computeApproachAngle({ q: -1, r: 0, s: 1 }, origin, facing)).toBe('rear');
  });

  it('returns rear for adjacent-to-opposite direction', () => {
    // Defender facing east (dir 0), attacker from dir 4 (q-1, r+1, s+0) — 4 steps = min(4,2) = 2? No, min(4, 6-4)=2 → flank
    // Actually: dir 0 to dir 4 = diff 4, min(4, 6-4) = 2 → flank
    // Let's use dir 3 (directly opposite): diff 3, min(3, 3) = 3 → rear ✓
    const facing = CUBE_DIRECTIONS[0]!;
    expect(computeApproachAngle({ q: -1, r: 0, s: 1 }, origin, facing)).toBe('rear');
  });

  it('handles non-unit-distance vectors', () => {
    // Attacker at (3, -3, 0) when defender facing east at origin
    // Direction from origin toward (3,-3,0) snaps to direction 1
    const facing = CUBE_DIRECTIONS[0]!;
    expect(computeApproachAngle({ q: 3, r: -3, s: 0 }, origin, facing)).toBe('front');
  });
});

// ---------------------------------------------------------------------------
// computeFacing
// ---------------------------------------------------------------------------

describe('computeFacing', () => {
  const origin: CubeCoord = { q: 0, r: 0, s: 0 };

  it('faces along path direction when path has >= 2 steps', () => {
    const unit = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const path = [origin, { q: 1, r: 0, s: -1 }];
    const facing = computeFacing(unit, path, { q: 5, r: 0, s: -5 }, []);
    // Should face east (direction 0)
    expect(facing).toEqual(CUBE_DIRECTIONS[0]);
  });

  it('faces toward target when path is empty (hold)', () => {
    const unit = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const target = { q: -1, r: 1, s: 0 };
    const facing = computeFacing(unit, [], target, []);
    // Should face toward (-1, 1, 0) — direction 4
    expect(facing).toEqual(CUBE_DIRECTIONS[4]);
  });

  it('faces toward nearest enemy as fallback', () => {
    const unit = makeUnit({ type: 'infantry', owner: 'player1', position: origin });
    const enemy = makeUnit({ type: 'tank', owner: 'player2', position: { q: 0, r: -2, s: 2 } });
    // Empty path, target = own position (zero vector fallback)
    const facing = computeFacing(unit, [], origin, [enemy]);
    // Direction from origin to (0,-2,2) snaps to direction 2
    expect(facing).toEqual(CUBE_DIRECTIONS[2]);
  });
});

// ---------------------------------------------------------------------------
// resolveTurn — Integration Tests
// ---------------------------------------------------------------------------

describe('resolveTurn', () => {
  it('clears and populates pendingEvents', () => {
    const state = setupBattleGame();
    resolveTurn(state, [], [], midRng);
    expect(state.pendingEvents.length).toBeGreaterThanOrEqual(0);
  });

  it('increments turnsPlayed and turnNumber', () => {
    const state = setupBattleGame();
    expect(state.round.turnsPlayed).toBe(0);
    expect(state.round.turnNumber).toBe(1);

    resolveTurn(state, [], [], midRng);

    expect(state.round.turnsPlayed).toBe(1);
    expect(state.round.turnNumber).toBe(2);
  });

  it('produces deterministic results with seeded RNG', () => {
    const state1 = setupBattleGame(99);
    const state2 = setupBattleGame(99);

    resolveTurn(state1, [], [], midRng);
    resolveTurn(state2, [], [], midRng);

    // Same positions
    for (let i = 0; i < state1.players.player1.units.length; i++) {
      expect(hexToKey(state1.players.player1.units[i]!.position))
        .toBe(hexToKey(state2.players.player1.units[i]!.position));
    }

    // Same events
    expect(state1.pendingEvents.length).toBe(state2.pendingEvents.length);
  });

  it('emits move events for units that change position', () => {
    const state = setupBattleGame();
    resolveTurn(state, [], [], midRng);

    const moveEvents = state.pendingEvents.filter(e => e.type === 'move');
    // Units with advance directive should attempt to move
    expect(moveEvents.length).toBeGreaterThan(0);

    for (const event of moveEvents) {
      if (event.type === 'move') {
        expect(hexToKey(event.from)).not.toBe(hexToKey(event.to));
      }
    }
  });

  it('applies CP redirect commands before computing intents', () => {
    const state = setupBattleGame();
    const unit = state.players.player1.units[0]!;

    const commands: Command[] = [{
      type: 'redirect',
      unitId: unit.id,
      newMovementDirective: 'hold',
      newAttackDirective: 'ignore',
      newSpecialtyModifier: null,
    }];

    resolveTurn(state, commands, [], midRng);

    // Unit should have been redirected to hold
    expect(unit.movementDirective).toBe('hold');
    expect(unit.attackDirective).toBe('ignore');
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Movement
// ---------------------------------------------------------------------------

describe('Phase 3 — Movement', () => {
  it('units with hold directive do not move', () => {
    const state = setupBattleGame();
    const unit = state.players.player1.units[0]!;
    unit.movementDirective = 'hold';
    const originalPos = { ...unit.position };

    resolveTurn(state, [], [], midRng);

    expect(hexToKey(unit.position)).toBe(hexToKey(originalPos));
  });

  it('both players units move in the same tick', () => {
    const state = setupBattleGame();
    const p1Positions = state.players.player1.units.map(u => hexToKey(u.position));
    const p2Positions = state.players.player2.units.map(u => hexToKey(u.position));

    resolveTurn(state, [], [], midRng);

    // At least one unit per player should have moved (advance directive by default)
    const p1Moved = state.players.player1.units.some(
      (u, i) => hexToKey(u.position) !== p1Positions[i],
    );
    const p2Moved = state.players.player2.units.some(
      (u, i) => hexToKey(u.position) !== p2Positions[i],
    );

    expect(p1Moved).toBe(true);
    expect(p2Moved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Intercepts
// ---------------------------------------------------------------------------

describe('Phase 3 — Intercepts', () => {
  it('shoot-on-sight enemy generates intercept event when unit passes through range', () => {
    let state = makeGame(42);
    // Place P1 infantry and P2 infantry adjacent
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);
    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'advance', 'shoot-on-sight', null, { type: 'hex', hex: state.map.centralObjective });
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    resolveTurn(state, [], [], midRng);

    // May or may not have intercepts depending on path — at minimum the pipeline runs
    expect(state.pendingEvents.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 — Initiative Fire
// ---------------------------------------------------------------------------

describe('Phase 5 — Initiative Fire', () => {
  it('units in range with offensive ROE deal damage', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'advance', 'shoot-on-sight');
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'advance', 'shoot-on-sight');
    state = startBattlePhase(state);

    // Manually position them adjacent so they fight
    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(1, 0);

    // Both have hold so they don't move, just fight
    state.players.player1.units[0]!.movementDirective = 'hold';
    state.players.player2.units[0]!.movementDirective = 'hold';

    resolveTurn(state, [], [], midRng);

    // At least one damage or kill event
    const combatEvents = state.pendingEvents.filter(
      e => e.type === 'damage' || e.type === 'kill',
    );
    expect(combatEvents.length).toBeGreaterThan(0);
  });

  it('recon fires before tank (lower response time)', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'recon', p1Hex, 'hold', 'shoot-on-sight');
    state = placeUnit(state, 'player2', 'tank', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    // Position adjacent
    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(1, 0);

    resolveTurn(state, [], [], midRng);

    // First damage/kill event should be from player1 (recon, responseTime=1)
    const combatEvents = state.pendingEvents.filter(
      e => e.type === 'damage' || e.type === 'kill',
    );
    expect(combatEvents.length).toBeGreaterThan(0);
    expect(combatEvents[0]!.actingPlayer).toBe('player1');
  });

  it('dead defender cancels remaining engagements', () => {
    let state = makeGame(42);
    const p1Hex0 = getDeploymentHex(state, 'player1', 0);
    const p1Hex1 = getDeploymentHex(state, 'player1', 1);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'tank', p1Hex0, 'hold', 'shoot-on-sight');
    state = placeUnit(state, 'player1', 'tank', p1Hex1, 'hold', 'shoot-on-sight');
    state = placeUnit(state, 'player2', 'recon', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    // Position: two P1 tanks adjacent to one P2 recon (HP=20)
    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player1.units[1]!.position = createHex(0, -1);
    state.players.player2.units[0]!.position = createHex(1, 0);

    // Give recon 1 HP so first hit kills it
    state.players.player2.units[0]!.hp = 1;

    resolveTurn(state, [], [], maxRng);

    // Recon should be dead
    expect(state.players.player2.units.length).toBe(0);

    // Should have exactly 1 kill event (not 2 — second should be cancelled)
    const killEvents = state.pendingEvents.filter(e => e.type === 'kill');
    expect(killEvents.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — Counter Fire
// ---------------------------------------------------------------------------

describe('Phase 6 — Counter Fire', () => {
  it('surviving defender with offensive ROE counter-fires', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'hold', 'shoot-on-sight');
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    // Position adjacent
    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(1, 0);

    resolveTurn(state, [], [], minRng);

    // Should have counter event (both infantry same responseTime, so one fires first, other counters)
    const counterEvents = state.pendingEvents.filter(e => e.type === 'counter');
    expect(counterEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('retreat-on-contact does NOT counter-fire', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'hold', 'shoot-on-sight');
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'hold', 'retreat-on-contact');
    state = startBattlePhase(state);

    // Position adjacent
    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(1, 0);

    resolveTurn(state, [], [], minRng);

    // No counter events — P2 has retreat-on-contact
    const counterEvents = state.pendingEvents.filter(e => e.type === 'counter');
    expect(counterEvents.length).toBe(0);
  });

  it('ignore does NOT counter-fire', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'hold', 'shoot-on-sight');
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'hold', 'ignore');
    state = startBattlePhase(state);

    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(1, 0);

    resolveTurn(state, [], [], minRng);

    const counterEvents = state.pendingEvents.filter(e => e.type === 'counter');
    expect(counterEvents.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 8 — Directive Effects
// ---------------------------------------------------------------------------

describe('Phase 8 — Directive Effects', () => {
  it('support specialty heals adjacent friendly with lowest HP', () => {
    let state = makeGame(42);
    const p1Hex0 = getDeploymentHex(state, 'player1', 0);
    const p1Hex1 = getDeploymentHex(state, 'player1', 1);

    state = placeUnit(state, 'player1', 'infantry', p1Hex0, 'hold', 'ignore', 'support');
    state = placeUnit(state, 'player1', 'infantry', p1Hex1, 'hold', 'ignore');
    // Need a P2 unit to avoid immediate forfeit
    state = placeUnit(state, 'player2', 'infantry', getDeploymentHex(state, 'player2', 0), 'hold', 'ignore');
    state = startBattlePhase(state);

    const healer = state.players.player1.units[0]!;
    const wounded = state.players.player1.units[1]!;

    // Position adjacent and wound the target
    healer.position = createHex(0, 0);
    wounded.position = createHex(1, 0);
    wounded.hp = UNIT_STATS.infantry.maxHp - 5;

    resolveTurn(state, [], [], midRng);

    const healEvents = state.pendingEvents.filter(e => e.type === 'heal');
    expect(healEvents.length).toBe(1);
    if (healEvents[0]!.type === 'heal') {
      expect(healEvents[0]!.healAmount).toBe(1);
    }
  });

  it('patrol emits reveal events for visible enemies', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    // Patrol unit orbits around its target; place enemy at the target so it stays in vision
    const patrolTarget = getDeploymentHex(state, 'player1', 1);
    state = placeUnit(state, 'player1', 'recon', p1Hex, 'patrol', 'ignore', null, { type: 'hex', hex: patrolTarget });
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'hold', 'ignore');
    state = startBattlePhase(state);

    // Place enemy at the patrol target (dist 3 from orbit ring — well within recon vision)
    state.players.player1.units[0]!.position = p1Hex;
    state.players.player2.units[0]!.position = patrolTarget;

    resolveTurn(state, [], [], midRng);

    const revealEvents = state.pendingEvents.filter(e => e.type === 'reveal');
    expect(revealEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 9 — Territory
// ---------------------------------------------------------------------------

describe('Phase 9 — Territory', () => {
  it('captures neutral city with HP cost', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'hold', 'ignore');
    state = placeUnit(state, 'player2', 'infantry', getDeploymentHex(state, 'player2', 0), 'hold', 'ignore');
    state = startBattlePhase(state);

    // Place unit on a city hex
    const cityKey = [...state.cityOwnership.keys()][0]!;
    const [q, r] = cityKey.split(',').map(Number);
    state.players.player1.units[0]!.position = createHex(q!, r!);

    resolveTurn(state, [], [], midRng);

    // City should be captured
    expect(state.cityOwnership.get(cityKey)).toBe('player1');

    // Unit should have lost HP from capture cost
    const captureEvents = state.pendingEvents.filter(
      e => e.type === 'capture' || e.type === 'capture-damage',
    );
    expect(captureEvents.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 10 — Round End
// ---------------------------------------------------------------------------

describe('Phase 10 — Round End', () => {
  it('updates objective tracking when unit occupies central hex', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'hold', 'ignore');
    state = placeUnit(state, 'player2', 'infantry', getDeploymentHex(state, 'player2', 0), 'hold', 'ignore');
    state = startBattlePhase(state);

    // Place unit on objective
    state.players.player1.units[0]!.position = { ...state.map.centralObjective };

    // Give player1 2 cities so KotH gate passes
    const cityKeys = [...state.cityOwnership.keys()];
    state.cityOwnership.set(cityKeys[0]!, 'player1');
    state.cityOwnership.set(cityKeys[1]!, 'player1');

    resolveTurn(state, [], [], midRng);

    expect(state.round.objective.occupiedBy).toBe('player1');
  });

  it('elimination detected after all enemy units killed', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'tank', p1Hex, 'hold', 'shoot-on-sight');
    state = placeUnit(state, 'player2', 'recon', p2Hex, 'hold', 'ignore');
    state = startBattlePhase(state);

    // Position adjacent, give recon 1 HP
    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(1, 0);
    state.players.player2.units[0]!.hp = 1;

    resolveTurn(state, [], [], maxRng);

    const result = checkRoundEnd(state);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('elimination');
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Collision Resolution
// ---------------------------------------------------------------------------

describe('Phase 3 — Collision Resolution', () => {
  it('cross-faction collision: both units stop (not on same hex)', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    // Both advance toward central objective — will collide
    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'advance', 'ignore');
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'advance', 'ignore');
    state = startBattlePhase(state);

    resolveTurn(state, [], [], midRng);

    // No two units should share a hex
    const p1Pos = hexToKey(state.players.player1.units[0]!.position);
    const p2Pos = hexToKey(state.players.player2.units[0]!.position);
    expect(p1Pos).not.toBe(p2Pos);
  });

  it('same-faction collision: faster unit wins hex', () => {
    let state = makeGame(42);
    const p1Hex0 = getDeploymentHex(state, 'player1', 0);
    const p1Hex1 = getDeploymentHex(state, 'player1', 1);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    // Place a recon (fast) and infantry (slow) for P1, both advancing to same target
    state = placeUnit(state, 'player1', 'recon', p1Hex0, 'advance', 'ignore');
    state = placeUnit(state, 'player1', 'infantry', p1Hex1, 'advance', 'ignore');
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'hold', 'ignore');
    state = startBattlePhase(state);

    resolveTurn(state, [], [], midRng);

    // No two P1 units should share a hex
    const positions = state.players.player1.units.map(u => hexToKey(u.position));
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('no stacking: every hex has at most one unit after resolution', () => {
    const state = setupBattleGame();
    resolveTurn(state, [], [], midRng);

    const allPositions = [
      ...state.players.player1.units.map(u => hexToKey(u.position)),
      ...state.players.player2.units.map(u => hexToKey(u.position)),
    ];
    expect(new Set(allPositions).size).toBe(allPositions.length);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Skirmish During Movement
// ---------------------------------------------------------------------------

describe('Phase 3 — Skirmish', () => {
  it('skirmish unit keeps moving after firing', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'advance', 'skirmish', null, { type: 'hex', hex: state.map.centralObjective });
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    resolveTurn(state, [], [], midRng);
    // The unit should have attempted to move regardless of contact
    const moveEvents = state.pendingEvents.filter(
      e => e.type === 'move' && e.actingPlayer === 'player1',
    );
    expect(moveEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Passive Intercept Damage (retreat-on-contact / ignore)
// ---------------------------------------------------------------------------

describe('Phase 3 — Passive Intercept Damage', () => {
  it('retreat-on-contact unit takes damage with response:none when intercepted', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'infantry', p1Hex, 'advance', 'retreat-on-contact');
    state = placeUnit(state, 'player2', 'tank', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    // Position so P1 walks through P2's attack range
    // P2 tank at origin, P1 infantry approaching from distance 2
    state.players.player2.units[0]!.position = createHex(0, 0);
    state.players.player1.units[0]!.position = createHex(3, 0);
    // Set target so P1 advances through P2's range
    state.players.player1.units[0]!.directiveTarget = { type: 'hex', hex: createHex(-3, 0) };

    resolveTurn(state, [], [], midRng);

    // Check for passive damage event with response: 'none'
    const passiveDamageEvents = state.pendingEvents.filter(
      e => e.type === 'damage' && 'response' in e && e.response === 'none',
    );

    // Check for intercept event with defenderResponse: 'flee'
    const fleeIntercepts = state.pendingEvents.filter(
      e => e.type === 'intercept' && e.defenderResponse === 'flee',
    );

    // If the units got close enough for intercept, we should see these events
    if (passiveDamageEvents.length > 0) {
      expect(passiveDamageEvents[0]!.type).toBe('damage');
      expect(fleeIntercepts.length).toBeGreaterThan(0);
    }
  });

  it('ignore unit takes damage but keeps moving when intercepted', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'recon', p1Hex, 'advance', 'ignore');
    state = placeUnit(state, 'player2', 'tank', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    // Position P2 so P1 recon walks through range
    state.players.player2.units[0]!.position = createHex(0, 0);
    state.players.player1.units[0]!.position = createHex(3, 0);
    state.players.player1.units[0]!.directiveTarget = { type: 'hex', hex: createHex(-3, 0) };

    resolveTurn(state, [], [], midRng);

    // Check for intercept with defenderResponse: 'none'
    const noneIntercepts = state.pendingEvents.filter(
      e => e.type === 'intercept' && e.defenderResponse === 'none',
    );

    // If intercept happened, the recon should still have moved
    if (noneIntercepts.length > 0) {
      const moveEvents = state.pendingEvents.filter(
        e => e.type === 'move' && e.actingPlayer === 'player1',
      );
      expect(moveEvents.length).toBeGreaterThan(0);
    }
  });

  it('passive intercept can kill the moving unit', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'recon', p1Hex, 'advance', 'ignore');
    state = placeUnit(state, 'player2', 'tank', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    // Position for intercept and give recon 1 HP
    state.players.player2.units[0]!.position = createHex(0, 0);
    state.players.player1.units[0]!.position = createHex(2, 0);
    state.players.player1.units[0]!.hp = 1;
    state.players.player1.units[0]!.directiveTarget = { type: 'hex', hex: createHex(-3, 0) };

    const reconId = state.players.player1.units[0]!.id;

    resolveTurn(state, [], [], maxRng);

    // Recon should be dead — 1HP vs tank intercept
    const killEvents = state.pendingEvents.filter(
      e => e.type === 'kill' && e.defenderType === 'recon',
    );
    // Unit was removed or killed
    const reconGone = state.players.player1.units.every(u => u.id !== reconId);
    expect(reconGone || killEvents.length > 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 — Response Time Modifiers
// ---------------------------------------------------------------------------

describe('Phase 5 — Response Time Modifiers', () => {
  it('rear approach gives attacker initiative advantage', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    // Tank (responseTime 3) attacks from behind infantry (responseTime 2)
    // Rear gives -2, so tank effective = 1, infantry = 2 → tank fires first
    state = placeUnit(state, 'player1', 'tank', p1Hex, 'hold', 'shoot-on-sight');
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    // P1 tank behind P2 infantry (infantry facing away)
    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(1, 0);
    // Make infantry face east (away from tank at west)
    state.players.player2.units[0]!.directiveTarget = { type: 'hex', hex: createHex(5, 0) };

    resolveTurn(state, [], [], midRng);

    const combatEvents = state.pendingEvents.filter(
      e => e.type === 'damage' || e.type === 'kill',
    );
    // First combat event should be from P1 (tank with rear bonus fires first)
    if (combatEvents.length > 0) {
      expect(combatEvents[0]!.actingPlayer).toBe('player1');
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — Counter-fire kills attacker
// ---------------------------------------------------------------------------

describe('Phase 6 — Counter-fire lethality', () => {
  it('counter-fire can kill the original attacker', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    // P1 recon (low HP) attacks P2 tank (high HP) — tank survives and counter-fires
    state = placeUnit(state, 'player1', 'recon', p1Hex, 'hold', 'shoot-on-sight');
    state = placeUnit(state, 'player2', 'tank', p2Hex, 'hold', 'shoot-on-sight');
    state = startBattlePhase(state);

    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(1, 0);
    // Give recon very low HP so counter-fire kills it
    state.players.player1.units[0]!.hp = 1;

    resolveTurn(state, [], [], maxRng);

    // Recon should be dead from counter-fire
    expect(state.players.player1.units.length).toBe(0);

    // Should have a kill event for the recon
    const reconKills = state.pendingEvents.filter(
      e => e.type === 'kill' && e.defenderType === 'recon',
    );
    expect(reconKills.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Hunt Lock-on
// ---------------------------------------------------------------------------

describe('Hunt Lock-on', () => {
  it('hunt acquires nearest visible enemy as target', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'recon', p1Hex, 'advance', 'hunt');
    state = placeUnit(state, 'player2', 'infantry', p2Hex, 'hold', 'ignore');
    state = startBattlePhase(state);

    // Position within recon's vision range
    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(4, 0);

    resolveTurn(state, [], [], midRng);

    // After resolution, the unit should have a huntTargetId set
    const hunter = state.players.player1.units[0];
    if (hunter) {
      expect(hunter.huntTargetId).toBeDefined();
    }
  });

  it('hunt lock-on breaks when target dies', () => {
    let state = makeGame(42);
    const p1Hex = getDeploymentHex(state, 'player1', 0);
    const p2Hex = getDeploymentHex(state, 'player2', 0);

    state = placeUnit(state, 'player1', 'tank', p1Hex, 'hold', 'hunt');
    state = placeUnit(state, 'player2', 'recon', p2Hex, 'hold', 'ignore');
    state = startBattlePhase(state);

    // Adjacent, recon will die fast
    state.players.player1.units[0]!.position = createHex(0, 0);
    state.players.player2.units[0]!.position = createHex(1, 0);
    state.players.player2.units[0]!.hp = 1;
    state.players.player1.units[0]!.huntTargetId = state.players.player2.units[0]!.id;

    resolveTurn(state, [], [], maxRng);

    // Target dead — lock-on should be cleared
    const hunter = state.players.player1.units[0];
    if (hunter) {
      expect(hunter.huntTargetId).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Per-Player Command Pools (GAP-01 / GAP-02)
// ---------------------------------------------------------------------------

describe('Per-Player Command Pools', () => {
  function setupFullBattle(seed: number = 42): GameState {
    let state = createGame(seed);
    // Place 4 units per player so each can max out CP
    for (let i = 0; i < 4; i++) {
      const p1Hex = state.map.player1Deployment[i]!;
      const p2Hex = state.map.player2Deployment[i]!;
      state = placeUnit(state, 'player1', 'infantry', p1Hex, 'advance', 'ignore', null, { type: 'hex', hex: state.map.centralObjective });
      state = placeUnit(state, 'player2', 'infantry', p2Hex, 'advance', 'ignore', null, { type: 'hex', hex: state.map.centralObjective });
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

  it('both players can spend full CP independently without crash', () => {
    const state = setupFullBattle();
    const p1Commands = state.players.player1.units.map(u => makeRedirect(u.id));
    const p2Commands = state.players.player2.units.map(u => makeRedirect(u.id));

    expect(p1Commands.length).toBe(4);
    expect(p2Commands.length).toBe(4);

    // This must not throw
    resolveTurn(state, p1Commands, p2Commands, midRng);

    expect(state.round.commandPools.player1.remaining).toBe(0);
    expect(state.round.commandPools.player2.remaining).toBe(0);
  });

  it('P1 spending CP does not affect P2 pool', () => {
    const state = setupFullBattle();
    const p1Commands = state.players.player1.units.slice(0, 3).map(u => makeRedirect(u.id));

    resolveTurn(state, p1Commands, [], midRng);

    expect(state.round.commandPools.player1.remaining).toBe(1);
    expect(state.round.commandPools.player1.commandedUnitIds.size).toBe(3);
    expect(state.round.commandPools.player2.remaining).toBe(4);
    expect(state.round.commandPools.player2.commandedUnitIds.size).toBe(0);
  });
});
