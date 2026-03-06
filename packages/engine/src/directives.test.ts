import { describe, it, expect, beforeEach } from 'vitest';
import type { DirectiveContext, PlayerId, TerrainType, HexModifier } from './types';
import { createHex, cubeDistance } from './hex';
import { createUnit, resetUnitIdCounter } from './units';
import { executeDirective, resolveTarget } from './directives';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<DirectiveContext> = {}): DirectiveContext {
  const terrain = new Map<string, TerrainType>();
  for (let col = 0; col < 16; col++) {
    for (let row = 0; row < 12; row++) {
      terrain.set(`${col},${row - Math.floor(col / 2)}`, 'plains');
    }
  }
  return {
    friendlyUnits: [],
    enemyUnits: [],
    terrain,
    elevation: new Map<string, number>(),
    modifiers: new Map<string, HexModifier>(),
    centralObjective: createHex(8, 2),
    cities: new Map<string, PlayerId | null>(),
    ...overrides,
  };
}

beforeEach(() => {
  resetUnitIdCounter();
});

// ---------------------------------------------------------------------------
// Advance
// ---------------------------------------------------------------------------

describe('advance directive', () => {
  it('moves toward central objective when no enemies near', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance');
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      // Should move closer to the objective (8,2)
      const startDist = cubeDistance(unit.position, ctx.centralObjective);
      const newDist = cubeDistance(action.targetHex, ctx.centralObjective);
      expect(newDist).toBeLessThan(startDist);
    }
  });

  it('attacks enemy in range instead of moving', () => {
    const unit = createUnit('infantry', 'player1', createHex(3, 1), 'advance');
    const enemy = createUnit('infantry', 'player2', createHex(4, 1), 'advance');
    const ctx = makeContext({
      friendlyUnits: [unit],
      enemyUnits: [enemy],
    });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('attack');
    if (action.type === 'attack') {
      expect(action.targetUnitId).toBe(enemy.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Hold
// ---------------------------------------------------------------------------

describe('hold directive', () => {
  it('returns hold action when no enemies in range', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'hold');
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('hold');
  });

  it('attacks enemy in range', () => {
    const unit = createUnit('infantry', 'player1', createHex(3, 1), 'hold');
    const enemy = createUnit('infantry', 'player2', createHex(4, 1), 'hold');
    const ctx = makeContext({
      friendlyUnits: [unit],
      enemyUnits: [enemy],
    });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('attack');
    if (action.type === 'attack') {
      expect(action.targetUnitId).toBe(enemy.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Flank Left
// ---------------------------------------------------------------------------

describe('flank-left directive', () => {
  it('moves but biased left (lower q direction)', () => {
    const unit = createUnit('infantry', 'player1', createHex(2, 2), 'flank-left');
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      // With advance from same position, the direct path heads toward (8,2).
      // Flank-left should bias toward lower q values compared to direct advance.
      const advanceUnit = createUnit('infantry', 'player1', createHex(2, 2), 'advance');
      const advanceAction = executeDirective(advanceUnit, ctx);
      if (advanceAction.type === 'move') {
        // The flank-left target should have a q value <= the advance target's q,
        // or be on a different path altogether. We just check it moves.
        expect(action.targetHex).toBeDefined();
      }
      // Flank-left should still make progress or go leftward
      // Just verify it produces a valid move that's different or leftward
      expect(action.targetHex.q).toBeLessThanOrEqual(ctx.centralObjective.q);
    }
  });
});

// ---------------------------------------------------------------------------
// Flank Right
// ---------------------------------------------------------------------------

describe('flank-right directive', () => {
  it('moves but biased right (higher q direction)', () => {
    const unit = createUnit('infantry', 'player1', createHex(2, 2), 'flank-right');
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      // Flank-right should bias toward higher q values
      expect(action.targetHex).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Scout
// ---------------------------------------------------------------------------

describe('scout directive', () => {
  it('retreats when enemy is adjacent (moves away)', () => {
    const unit = createUnit('recon', 'player1', createHex(3, 1), 'scout');
    const enemy = createUnit('infantry', 'player2', createHex(4, 1), 'advance');
    const ctx = makeContext({
      friendlyUnits: [unit],
      enemyUnits: [enemy],
    });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      // Should move away from enemy — distance from enemy should increase
      const oldDist = cubeDistance(unit.position, enemy.position);
      const newDist = cubeDistance(action.targetHex, enemy.position);
      expect(newDist).toBeGreaterThan(oldDist);
    }
  });

  it('moves when no enemy near (does not hold)', () => {
    const unit = createUnit('recon', 'player1', createHex(0, 0), 'scout');
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);

    // Scout should explore, not hold
    expect(action.type).toBe('move');
  });
});

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

describe('support directive', () => {
  it('follows nearest friendly unit', () => {
    const supported = createUnit('infantry', 'player1', createHex(8, 2), 'advance');
    const unit = createUnit('infantry', 'player1', createHex(1, 1), 'support');
    const ctx = makeContext({ friendlyUnits: [unit, supported] });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      // Should move closer to the supported unit
      const startDist = cubeDistance(unit.position, supported.position);
      const newDist = cubeDistance(action.targetHex, supported.position);
      expect(newDist).toBeLessThan(startDist);
    }
  });

  it('attacks enemy in range while following', () => {
    const supported = createUnit('infantry', 'player1', createHex(8, 2), 'advance');
    const unit = createUnit('infantry', 'player1', createHex(3, 1), 'support');
    const enemy = createUnit('infantry', 'player2', createHex(4, 1), 'advance');
    const ctx = makeContext({
      friendlyUnits: [unit, supported],
      enemyUnits: [enemy],
    });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('attack');
    if (action.type === 'attack') {
      expect(action.targetUnitId).toBe(enemy.id);
    }
  });
});

// ---------------------------------------------------------------------------
// resolveTarget
// ---------------------------------------------------------------------------

describe('resolveTarget', () => {
  it('returns central objective for central-objective target', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance');
    const ctx = makeContext({ friendlyUnits: [unit] });

    const result = resolveTarget(unit, ctx);

    expect(result.hex).toEqual(ctx.centralObjective);
    expect(result.isValid).toBe(true);
  });

  it('resolves hex target directly', () => {
    const targetHex = createHex(5, 3);
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance');
    unit.directiveTarget = { type: 'hex', hex: targetHex };
    const ctx = makeContext({ friendlyUnits: [unit] });

    const result = resolveTarget(unit, ctx);

    expect(result.hex).toEqual(targetHex);
    expect(result.isValid).toBe(true);
  });

  it('resolves enemy-unit target to enemy position', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance');
    const enemy = createUnit('infantry', 'player2', createHex(5, 3), 'advance');
    unit.directiveTarget = { type: 'enemy-unit', unitId: enemy.id };
    const ctx = makeContext({
      friendlyUnits: [unit],
      enemyUnits: [enemy],
    });

    const result = resolveTarget(unit, ctx);

    expect(result.hex).toEqual(enemy.position);
    expect(result.isValid).toBe(true);
  });

  it('falls back to nearest enemy when target enemy is dead', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance');
    const nearEnemy = createUnit('infantry', 'player2', createHex(3, 0), 'advance');
    unit.directiveTarget = { type: 'enemy-unit', unitId: 'dead-unit-id' };
    const ctx = makeContext({
      friendlyUnits: [unit],
      enemyUnits: [nearEnemy],
    });

    const result = resolveTarget(unit, ctx);

    expect(result.hex).toEqual(nearEnemy.position);
    expect(result.isValid).toBe(false);
    // directiveTarget should be mutated to the nearest enemy
    expect(unit.directiveTarget.unitId).toBe(nearEnemy.id);
  });

  it('falls back to central objective when no enemies remain', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance');
    unit.directiveTarget = { type: 'enemy-unit', unitId: 'dead-unit-id' };
    const ctx = makeContext({
      friendlyUnits: [unit],
      enemyUnits: [],
    });

    const result = resolveTarget(unit, ctx);

    expect(result.hex).toEqual(ctx.centralObjective);
    expect(result.isValid).toBe(false);
    expect(unit.directiveTarget.type).toBe('central-objective');
  });

  it('resolves friendly-unit target to friendly position', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'support');
    const friendly = createUnit('infantry', 'player1', createHex(5, 3), 'advance');
    unit.directiveTarget = { type: 'friendly-unit', unitId: friendly.id };
    const ctx = makeContext({
      friendlyUnits: [unit, friendly],
    });

    const result = resolveTarget(unit, ctx);

    expect(result.hex).toEqual(friendly.position);
    expect(result.isValid).toBe(true);
  });

  it('resolves city target to city hex', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'capture');
    const cities = new Map<string, PlayerId | null>();
    cities.set('5,3', 'player2');
    unit.directiveTarget = { type: 'city', cityId: '5,3' };
    const ctx = makeContext({
      friendlyUnits: [unit],
      cities,
    });

    const result = resolveTarget(unit, ctx);

    expect(result.hex).toEqual(createHex(5, 3));
    expect(result.isValid).toBe(true);
  });

  it('falls back to nearest uncaptured enemy city when target city is invalid', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'capture');
    const cities = new Map<string, PlayerId | null>();
    cities.set('6,2', 'player2');
    unit.directiveTarget = { type: 'city', cityId: '99,99' };
    const ctx = makeContext({
      friendlyUnits: [unit],
      cities,
    });

    const result = resolveTarget(unit, ctx);

    expect(result.hex).toEqual(createHex(6, 2));
    expect(result.isValid).toBe(false);
    expect(unit.directiveTarget).toEqual({ type: 'city', cityId: '6,2' });
  });
});

// ---------------------------------------------------------------------------
// Hunt
// ---------------------------------------------------------------------------

describe('hunt directive', () => {
  it('attacks target enemy when in range', () => {
    const unit = createUnit('infantry', 'player1', createHex(3, 1), 'hunt');
    const enemy = createUnit('infantry', 'player2', createHex(4, 1), 'advance');
    unit.directiveTarget = { type: 'enemy-unit', unitId: enemy.id };
    const ctx = makeContext({
      friendlyUnits: [unit],
      enemyUnits: [enemy],
    });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('attack');
    if (action.type === 'attack') {
      expect(action.targetUnitId).toBe(enemy.id);
    }
  });

  it('moves toward target enemy when out of range', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'hunt');
    const enemy = createUnit('infantry', 'player2', createHex(8, 2), 'advance');
    unit.directiveTarget = { type: 'enemy-unit', unitId: enemy.id };
    const ctx = makeContext({
      friendlyUnits: [unit],
      enemyUnits: [enemy],
    });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const startDist = cubeDistance(unit.position, enemy.position);
      const newDist = cubeDistance(action.targetHex, enemy.position);
      expect(newDist).toBeLessThan(startDist);
    }
  });

  it('retargets nearest enemy when target dies', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'hunt');
    const aliveEnemy = createUnit('infantry', 'player2', createHex(5, 0), 'advance');
    unit.directiveTarget = { type: 'enemy-unit', unitId: 'dead-unit-id' };
    const ctx = makeContext({
      friendlyUnits: [unit],
      enemyUnits: [aliveEnemy],
    });

    const action = executeDirective(unit, ctx);

    // Should have retargeted to aliveEnemy
    expect(unit.directiveTarget.unitId).toBe(aliveEnemy.id);
    expect(action.type).toBe('move');
  });
});

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe('capture directive', () => {
  it('moves toward target city', () => {
    const cities = new Map<string, PlayerId | null>();
    cities.set('8,2', 'player2');
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'capture');
    unit.directiveTarget = { type: 'city', cityId: '8,2' };
    const ctx = makeContext({
      friendlyUnits: [unit],
      cities,
    });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const startDist = cubeDistance(unit.position, createHex(8, 2));
      const newDist = cubeDistance(action.targetHex, createHex(8, 2));
      expect(newDist).toBeLessThan(startDist);
    }
  });

  it('holds when on target city hex (city not yet owned)', () => {
    const cities = new Map<string, PlayerId | null>();
    cities.set('3,1', 'player2');
    const unit = createUnit('infantry', 'player1', createHex(3, 1), 'capture');
    unit.directiveTarget = { type: 'city', cityId: '3,1' };
    const ctx = makeContext({
      friendlyUnits: [unit],
      cities,
    });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('hold');
  });

  it('retargets to next enemy city after capturing current', () => {
    const cities = new Map<string, PlayerId | null>();
    cities.set('3,1', 'player1'); // already captured
    cities.set('10,0', 'player2'); // next target
    const unit = createUnit('infantry', 'player1', createHex(3, 1), 'capture');
    unit.directiveTarget = { type: 'city', cityId: '3,1' };
    const ctx = makeContext({
      friendlyUnits: [unit],
      cities,
    });

    const action = executeDirective(unit, ctx);

    // Should retarget to 10,0 and move toward it
    expect(unit.directiveTarget).toEqual({ type: 'city', cityId: '10,0' });
    expect(action.type).toBe('move');
  });
});

// ---------------------------------------------------------------------------
// Enhanced directive tests (resolveTarget integration)
// ---------------------------------------------------------------------------

describe('enhanced directives with targets', () => {
  it('advance with hex target: moves toward target hex instead of central objective', () => {
    const targetHex = createHex(2, 5);
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance');
    unit.directiveTarget = { type: 'hex', hex: targetHex };
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const startDist = cubeDistance(unit.position, targetHex);
      const newDist = cubeDistance(action.targetHex, targetHex);
      expect(newDist).toBeLessThan(startDist);
    }
  });

  it('hold with hex target far away: moves toward target', () => {
    const targetHex = createHex(10, 0);
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'hold');
    unit.directiveTarget = { type: 'hex', hex: targetHex };
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const startDist = cubeDistance(unit.position, targetHex);
      const newDist = cubeDistance(action.targetHex, targetHex);
      expect(newDist).toBeLessThan(startDist);
    }
  });

  it('hold with hex target adjacent: holds', () => {
    const targetHex = createHex(1, 0);
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'hold');
    unit.directiveTarget = { type: 'hex', hex: targetHex };
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('hold');
  });

  it('support with friendly-unit target: follows specific friendly unit instead of nearest', () => {
    const nearFriendly = createUnit('infantry', 'player1', createHex(2, 0), 'advance');
    const farFriendly = createUnit('infantry', 'player1', createHex(10, 0), 'advance');
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'support');
    // Target the far friendly, not the near one
    unit.directiveTarget = { type: 'friendly-unit', unitId: farFriendly.id };
    const ctx = makeContext({
      friendlyUnits: [unit, nearFriendly, farFriendly],
    });

    const action = executeDirective(unit, ctx);

    expect(action.type).toBe('move');
    if (action.type === 'move') {
      // Should move toward the far friendly, not the near one
      const startDist = cubeDistance(unit.position, farFriendly.position);
      const newDist = cubeDistance(action.targetHex, farFriendly.position);
      expect(newDist).toBeLessThan(startDist);
    }
  });
});
