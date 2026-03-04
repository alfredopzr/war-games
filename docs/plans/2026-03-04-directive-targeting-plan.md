# Directive Targeting System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend directives with parameterized targets (city, enemy unit, friendly unit, hex) and add `hunt` + `capture` directive types.

**Architecture:** All directives gain an optional `directiveTarget` field (defaults to `central-objective`). A new `resolveTarget()` function in `directives.ts` maps targets to hex coordinates with automatic fallback when targets become invalid. Two new directives (`hunt`, `capture`) join the existing six. Engine changes are purely additive — existing behavior preserved when target is `central-objective`.

**Tech Stack:** TypeScript, Vitest, Zustand, Socket.io

---

### Task 1: Add new types to `types.ts`

**Files:**
- Modify: `packages/engine/src/types.ts:67-94` (DirectiveType, Unit, Command, DirectiveContext)
- Modify: `packages/engine/src/index.ts:6-23` (add new type exports)

**Step 1: Add DirectiveTarget types**

In `packages/engine/src/types.ts`, after the `DirectiveType` line (67), add:

```typescript
export type DirectiveTargetType = 'central-objective' | 'city' | 'enemy-unit' | 'friendly-unit' | 'hex';

export interface DirectiveTarget {
  readonly type: DirectiveTargetType;
  readonly cityId?: string;
  readonly unitId?: string;
  readonly hex?: CubeCoord;
}
```

**Step 2: Expand DirectiveType**

Change line 67 from:
```typescript
export type DirectiveType = 'advance' | 'hold' | 'flank-left' | 'flank-right' | 'scout' | 'support';
```
to:
```typescript
export type DirectiveType = 'advance' | 'hold' | 'flank-left' | 'flank-right' | 'scout' | 'support' | 'hunt' | 'capture';
```

**Step 3: Add `directiveTarget` to Unit**

Change the Unit interface (lines 71-79) to include:
```typescript
export interface Unit {
  readonly id: string;
  readonly type: UnitType;
  readonly owner: PlayerId;
  hp: number;
  position: CubeCoord;
  directive: DirectiveType;
  directiveTarget: DirectiveTarget;
  hasActed: boolean;
}
```

**Step 4: Add `ResolvedTarget` interface**

After the `DirectiveContext` interface (lines 183-189), add:
```typescript
export interface ResolvedTarget {
  readonly hex: CubeCoord;
  readonly isValid: boolean;
}
```

**Step 5: Update `DirectiveContext` to include cities**

Change `DirectiveContext` (lines 183-189):
```typescript
export interface DirectiveContext {
  friendlyUnits: Unit[];
  enemyUnits: Unit[];
  terrain: Map<string, TerrainType>;
  centralObjective: CubeCoord;
  gridSize: GridSize;
  cities: Map<string, PlayerId | null>;
}
```

**Step 6: Update `Command` type**

Change the `redirect` variant (line 91):
```typescript
export type Command =
  | { type: 'redirect'; unitId: string; newDirective: DirectiveType; target?: DirectiveTarget }
  | { type: 'direct-move'; unitId: string; targetHex: CubeCoord }
  | { type: 'direct-attack'; unitId: string; targetUnitId: string }
  | { type: 'retreat'; unitId: string };
```

**Step 7: Update client/server message types**

Update `ClientPlaceUnit` (lines 233-238):
```typescript
export interface ClientPlaceUnit {
  readonly type: 'place-unit';
  readonly unitType: UnitType;
  readonly position: CubeCoord;
  readonly directive: DirectiveType;
  readonly target?: DirectiveTarget;
}
```

Update `ClientSetDirective` (lines 245-249):
```typescript
export interface ClientSetDirective {
  readonly type: 'set-directive';
  readonly unitId: string;
  readonly directive: DirectiveType;
  readonly target?: DirectiveTarget;
}
```

**Step 8: Update index.ts exports**

Add `DirectiveTarget`, `DirectiveTargetType`, `ResolvedTarget` to the type exports in `packages/engine/src/index.ts`.

**Step 9: Run type check**

Run: `cd packages/engine && npx tsc --noEmit`
Expected: Type errors in files that consume the updated types (units.ts, directives.ts, game-state.ts, etc.) — this is expected. We'll fix these in subsequent tasks.

**Step 10: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/index.ts
git commit -m "feat(engine): add DirectiveTarget types, expand DirectiveType with hunt/capture"
```

---

### Task 2: Update `createUnit` to include `directiveTarget`

**Files:**
- Modify: `packages/engine/src/units.ts:60-76` (createUnit function)
- Test: `packages/engine/src/units.test.ts`

**Step 1: Write the failing test**

Add to `packages/engine/src/units.test.ts`:

```typescript
import type { DirectiveTarget } from './types';

it('creates unit with default directiveTarget of central-objective', () => {
  const unit = createUnit('infantry', 'player1', createHex(0, 0));
  expect(unit.directiveTarget).toEqual({ type: 'central-objective' });
});

it('creates unit with custom directiveTarget', () => {
  const target: DirectiveTarget = { type: 'city', cityId: 'city-1' };
  const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance', target);
  expect(unit.directiveTarget).toEqual(target);
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/engine && npx vitest run src/units.test.ts`
Expected: FAIL — `directiveTarget` not on unit / param not accepted

**Step 3: Update `createUnit`**

In `packages/engine/src/units.ts`, update `createUnit` (lines 60-76):

```typescript
export function createUnit(
  type: UnitType,
  owner: PlayerId,
  position: CubeCoord,
  directive: DirectiveType = 'advance',
  directiveTarget: DirectiveTarget = { type: 'central-objective' },
): Unit {
  unitIdCounter += 1;
  return {
    id: `${owner}-${type}-${unitIdCounter}`,
    type,
    owner,
    hp: UNIT_STATS[type].maxHp,
    position,
    directive,
    directiveTarget,
    hasActed: false,
  };
}
```

Add `DirectiveTarget` to the import on line 1.

**Step 4: Run tests to verify they pass**

Run: `cd packages/engine && npx vitest run src/units.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/units.ts packages/engine/src/units.test.ts
git commit -m "feat(engine): add directiveTarget to createUnit"
```

---

### Task 3: Implement `resolveTarget` and update directives

**Files:**
- Modify: `packages/engine/src/directives.ts`
- Modify: `packages/engine/src/index.ts` (export resolveTarget)
- Test: `packages/engine/src/directives.test.ts`

**Step 1: Write failing tests for `resolveTarget`**

Add to `packages/engine/src/directives.test.ts`:

```typescript
import { resolveTarget } from './directives';
import type { DirectiveContext, DirectiveTarget, TerrainType } from './types';

// Update the makeContext helper to include cities:
// Add `cities: new Map<string, PlayerId | null>()` to the return object

describe('resolveTarget', () => {
  it('returns central objective for central-objective target', () => {
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance');
    const ctx = makeContext();
    const result = resolveTarget(unit, ctx);
    expect(result.hex).toEqual(ctx.centralObjective);
    expect(result.isValid).toBe(true);
  });

  it('resolves hex target directly', () => {
    const target: DirectiveTarget = { type: 'hex', hex: createHex(5, 3) };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance', target);
    const ctx = makeContext();
    const result = resolveTarget(unit, ctx);
    expect(result.hex).toEqual(createHex(5, 3));
    expect(result.isValid).toBe(true);
  });

  it('resolves enemy-unit target to enemy position', () => {
    const enemy = createUnit('infantry', 'player2', createHex(5, 3), 'advance');
    const target: DirectiveTarget = { type: 'enemy-unit', unitId: enemy.id };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance', target);
    const ctx = makeContext({ enemyUnits: [enemy], friendlyUnits: [unit] });
    const result = resolveTarget(unit, ctx);
    expect(result.hex).toEqual(enemy.position);
    expect(result.isValid).toBe(true);
  });

  it('falls back to nearest enemy when target enemy is dead', () => {
    const nearEnemy = createUnit('infantry', 'player2', createHex(3, 1), 'advance');
    const target: DirectiveTarget = { type: 'enemy-unit', unitId: 'dead-unit-id' };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance', target);
    const ctx = makeContext({ enemyUnits: [nearEnemy], friendlyUnits: [unit] });
    const result = resolveTarget(unit, ctx);
    expect(result.hex).toEqual(nearEnemy.position);
    expect(result.isValid).toBe(false);
    // directiveTarget should be mutated to the new target
    expect(unit.directiveTarget.unitId).toBe(nearEnemy.id);
  });

  it('falls back to central objective when no enemies remain', () => {
    const target: DirectiveTarget = { type: 'enemy-unit', unitId: 'dead-unit-id' };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance', target);
    const ctx = makeContext({ enemyUnits: [], friendlyUnits: [unit] });
    const result = resolveTarget(unit, ctx);
    expect(result.hex).toEqual(ctx.centralObjective);
    expect(result.isValid).toBe(false);
  });

  it('resolves friendly-unit target to friendly position', () => {
    const friendly = createUnit('infantry', 'player1', createHex(5, 3), 'advance');
    const target: DirectiveTarget = { type: 'friendly-unit', unitId: friendly.id };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'support', target);
    const ctx = makeContext({ friendlyUnits: [unit, friendly] });
    const result = resolveTarget(unit, ctx);
    expect(result.hex).toEqual(friendly.position);
    expect(result.isValid).toBe(true);
  });

  it('resolves city target to city hex', () => {
    const cityHex = createHex(4, 2);
    const cityKey = `${cityHex.q},${cityHex.r}`;
    const cities = new Map<string, PlayerId | null>([[cityKey, null]]);
    const target: DirectiveTarget = { type: 'city', cityId: cityKey };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'capture', target);
    const ctx = makeContext({ cities });
    const result = resolveTarget(unit, ctx);
    expect(result.hex).toEqual(cityHex);
    expect(result.isValid).toBe(true);
  });

  it('falls back to nearest uncaptured enemy city when target city is invalid', () => {
    const cityHex = createHex(6, 2);
    const cityKey = `${cityHex.q},${cityHex.r}`;
    const cities = new Map<string, PlayerId | null>([[cityKey, null]]);
    const target: DirectiveTarget = { type: 'city', cityId: 'nonexistent-city' };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'capture', target);
    const ctx = makeContext({ cities, friendlyUnits: [unit] });
    const result = resolveTarget(unit, ctx);
    expect(result.hex).toEqual(cityHex);
    expect(result.isValid).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/engine && npx vitest run src/directives.test.ts`
Expected: FAIL — `resolveTarget` not exported

**Step 3: Implement `resolveTarget`**

In `packages/engine/src/directives.ts`, add the import for `ResolvedTarget` and `DirectiveTarget` from `./types`, then add:

```typescript
export function resolveTarget(unit: Unit, context: DirectiveContext): ResolvedTarget {
  const target = unit.directiveTarget;

  switch (target.type) {
    case 'central-objective':
      return { hex: context.centralObjective, isValid: true };

    case 'hex':
      return { hex: target.hex!, isValid: true };

    case 'enemy-unit': {
      const enemy = context.enemyUnits.find((e) => e.id === target.unitId);
      if (enemy) return { hex: enemy.position, isValid: true };
      // Fallback: nearest enemy
      const nearest = findNearestEnemy(unit, context);
      if (nearest) {
        unit.directiveTarget = { type: 'enemy-unit', unitId: nearest.id };
        return { hex: nearest.position, isValid: false };
      }
      // No enemies left — fall back to objective
      unit.directiveTarget = { type: 'central-objective' };
      return { hex: context.centralObjective, isValid: false };
    }

    case 'friendly-unit': {
      const friendly = context.friendlyUnits.find(
        (f) => f.id === target.unitId && f.id !== unit.id,
      );
      if (friendly) return { hex: friendly.position, isValid: true };
      // Fallback: nearest friendly
      const nearestFriendly = findNearestFriendly(unit, context, Infinity);
      if (nearestFriendly) {
        unit.directiveTarget = { type: 'friendly-unit', unitId: nearestFriendly.id };
        return { hex: nearestFriendly.position, isValid: false };
      }
      // No friendlies — hold position
      return { hex: unit.position, isValid: false };
    }

    case 'city': {
      const cityId = target.cityId!;
      if (context.cities.has(cityId)) {
        const [qStr, rStr] = cityId.split(',');
        return { hex: createHex(Number(qStr), Number(rStr)), isValid: true };
      }
      // Fallback: nearest uncaptured enemy city (not owned by unit's owner)
      const fallbackCity = findNearestEnemyCity(unit, context);
      if (fallbackCity) {
        unit.directiveTarget = { type: 'city', cityId: fallbackCity.key };
        return { hex: fallbackCity.hex, isValid: false };
      }
      // No cities — fall back to objective
      unit.directiveTarget = { type: 'central-objective' };
      return { hex: context.centralObjective, isValid: false };
    }
  }
}
```

And add the helper:

```typescript
function findNearestEnemyCity(
  unit: Unit,
  context: DirectiveContext,
): { key: string; hex: CubeCoord } | null {
  let nearest: { key: string; hex: CubeCoord } | null = null;
  let nearestDist = Infinity;

  for (const [key, owner] of context.cities) {
    if (owner === unit.owner) continue; // skip own cities
    const [qStr, rStr] = key.split(',');
    const hex = createHex(Number(qStr), Number(rStr));
    const dist = cubeDistance(unit.position, hex);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = { key, hex };
    }
  }

  return nearest;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/engine && npx vitest run src/directives.test.ts`
Expected: PASS for resolveTarget tests

**Step 5: Update existing directive functions to use resolved target**

Update `executeAdvance`:
```typescript
function executeAdvance(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  const resolved = resolveTarget(unit, context);
  return moveToward(unit, context, resolved.hex);
}
```

Update `executeHold`:
```typescript
function executeHold(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  const resolved = resolveTarget(unit, context);
  // If we have a non-default target and haven't reached it, move toward it
  if (unit.directiveTarget.type !== 'central-objective') {
    const dist = cubeDistance(unit.position, resolved.hex);
    if (dist > 1) {
      return moveToward(unit, context, resolved.hex);
    }
  }

  return { type: 'hold' };
}
```

Update `executeFlank` — change `objective` references to use `resolveTarget`:
```typescript
function executeFlank(
  unit: Unit,
  context: DirectiveContext,
  side: 'left' | 'right',
): UnitAction {
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  const resolved = resolveTarget(unit, context);
  const objective = resolved.hex;
  const offsets = side === 'left' ? [-5, -4, -3] : [5, 4, 3];

  let intermediateTarget: CubeCoord = objective;
  for (const offset of offsets) {
    const candidate = createHex(objective.q + offset, objective.r);
    const key = hexToKey(candidate);
    if (
      context.terrain.has(key) &&
      !(candidate.q === unit.position.q && candidate.r === unit.position.r)
    ) {
      intermediateTarget = candidate;
      break;
    }
  }

  if (
    intermediateTarget.q === unit.position.q &&
    intermediateTarget.r === unit.position.r
  ) {
    intermediateTarget = objective;
  }

  return moveToward(unit, context, intermediateTarget);
}
```

Update `executeScout`:
```typescript
function executeScout(unit: Unit, context: DirectiveContext): UnitAction {
  const nearestEnemy = findNearestEnemy(unit, context);
  if (nearestEnemy && cubeDistance(unit.position, nearestEnemy.position) === 1) {
    return retreatFrom(unit, context, nearestEnemy);
  }

  // If targeting something, shadow it from 2-3 hex distance
  if (unit.directiveTarget.type !== 'central-objective') {
    const resolved = resolveTarget(unit, context);
    const dist = cubeDistance(unit.position, resolved.hex);
    if (dist <= 2) return { type: 'hold' };
    return moveToward(unit, context, resolved.hex);
  }

  return scoutExplore(unit, context);
}
```

Update `executeSupport`:
```typescript
function executeSupport(unit: Unit, context: DirectiveContext): UnitAction {
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  // If targeting a specific friendly unit, follow that unit
  if (unit.directiveTarget.type === 'friendly-unit') {
    const resolved = resolveTarget(unit, context);
    const dist = cubeDistance(unit.position, resolved.hex);
    if (dist <= 2) return { type: 'hold' };
    return moveToward(unit, context, resolved.hex);
  }

  // If targeting a city/hex, move there and heal nearby
  if (unit.directiveTarget.type !== 'central-objective') {
    const resolved = resolveTarget(unit, context);
    const dist = cubeDistance(unit.position, resolved.hex);
    if (dist <= 1) return { type: 'hold' };
    return moveToward(unit, context, resolved.hex);
  }

  // Default: follow nearest friendly (original behavior)
  const nearbyFriendly = findNearestFriendly(unit, context, 3);
  if (!nearbyFriendly) {
    const anyFriendly = findNearestFriendly(unit, context, Infinity);
    if (!anyFriendly) return { type: 'hold' };
    return moveToward(unit, context, anyFriendly.position);
  }

  const dist = cubeDistance(unit.position, nearbyFriendly.position);
  if (dist <= 2) return { type: 'hold' };

  return moveToward(unit, context, nearbyFriendly.position);
}
```

**Step 6: Add `executeHunt`**

```typescript
function executeHunt(unit: Unit, context: DirectiveContext): UnitAction {
  // Resolve target — must be enemy-unit
  const resolved = resolveTarget(unit, context);

  // Attack target if in range
  const targetEnemy = context.enemyUnits.find((e) => e.id === unit.directiveTarget.unitId);
  if (targetEnemy && canAttack(unit, targetEnemy)) {
    return { type: 'attack', targetUnitId: targetEnemy.id };
  }

  // Attack any enemy in range as opportunistic action
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  // Close distance to target
  return moveToward(unit, context, resolved.hex);
}
```

**Step 7: Add `executeCapture`**

```typescript
function executeCapture(unit: Unit, context: DirectiveContext): UnitAction {
  const resolved = resolveTarget(unit, context);

  // If we're on the target city hex, hold (capture happens in game-state)
  const dist = cubeDistance(unit.position, resolved.hex);
  if (dist === 0) {
    // Check if city is already owned by us — if so, retarget
    const cityKey = `${resolved.hex.q},${resolved.hex.r}`;
    const owner = context.cities.get(cityKey);
    if (owner === unit.owner) {
      // City captured — find next uncaptured enemy city
      const nextCity = findNearestEnemyCity(unit, context);
      if (nextCity) {
        unit.directiveTarget = { type: 'city', cityId: nextCity.key };
        return moveToward(unit, context, nextCity.hex);
      }
      // No more cities to capture — hold
      return { type: 'hold' };
    }
    return { type: 'hold' };
  }

  // Attack enemies blocking the path
  const attackAction = tryAttackClosest(unit, context);
  if (attackAction) return attackAction;

  // Move toward the city
  return moveToward(unit, context, resolved.hex);
}
```

**Step 8: Update the `executeDirective` switch**

Add cases for `hunt` and `capture`:
```typescript
export function executeDirective(unit: Unit, context: DirectiveContext): UnitAction {
  switch (unit.directive) {
    case 'advance':
      return executeAdvance(unit, context);
    case 'hold':
      return executeHold(unit, context);
    case 'flank-left':
      return executeFlank(unit, context, 'left');
    case 'flank-right':
      return executeFlank(unit, context, 'right');
    case 'scout':
      return executeScout(unit, context);
    case 'support':
      return executeSupport(unit, context);
    case 'hunt':
      return executeHunt(unit, context);
    case 'capture':
      return executeCapture(unit, context);
  }
}
```

**Step 9: Export resolveTarget from index.ts**

Add `resolveTarget` to the Directives section in `packages/engine/src/index.ts`.

**Step 10: Write tests for hunt and capture directives**

Add to `packages/engine/src/directives.test.ts`:

```typescript
describe('hunt directive', () => {
  it('attacks target enemy when in range', () => {
    const enemy = createUnit('infantry', 'player2', createHex(4, 1), 'advance');
    const target: DirectiveTarget = { type: 'enemy-unit', unitId: enemy.id };
    const unit = createUnit('infantry', 'player1', createHex(3, 1), 'hunt', target);
    const ctx = makeContext({ friendlyUnits: [unit], enemyUnits: [enemy] });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('attack');
    if (action.type === 'attack') {
      expect(action.targetUnitId).toBe(enemy.id);
    }
  });

  it('moves toward target enemy when out of range', () => {
    const enemy = createUnit('infantry', 'player2', createHex(8, 2), 'advance');
    const target: DirectiveTarget = { type: 'enemy-unit', unitId: enemy.id };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'hunt', target);
    const ctx = makeContext({ friendlyUnits: [unit], enemyUnits: [enemy] });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const startDist = cubeDistance(unit.position, enemy.position);
      const newDist = cubeDistance(action.targetHex, enemy.position);
      expect(newDist).toBeLessThan(startDist);
    }
  });

  it('retargets nearest enemy when target dies', () => {
    const aliveEnemy = createUnit('infantry', 'player2', createHex(5, 2), 'advance');
    const target: DirectiveTarget = { type: 'enemy-unit', unitId: 'dead-unit' };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'hunt', target);
    const ctx = makeContext({ friendlyUnits: [unit], enemyUnits: [aliveEnemy] });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
    // Should have retargeted to the alive enemy
    expect(unit.directiveTarget.unitId).toBe(aliveEnemy.id);
  });
});

describe('capture directive', () => {
  it('moves toward target city', () => {
    const cityHex = createHex(8, 2);
    const cityKey = `${cityHex.q},${cityHex.r}`;
    const cities = new Map<string, PlayerId | null>([[cityKey, null]]);
    const target: DirectiveTarget = { type: 'city', cityId: cityKey };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'capture', target);
    const ctx = makeContext({ friendlyUnits: [unit], cities });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const startDist = cubeDistance(unit.position, cityHex);
      const newDist = cubeDistance(action.targetHex, cityHex);
      expect(newDist).toBeLessThan(startDist);
    }
  });

  it('holds when on target city hex', () => {
    const cityHex = createHex(5, 2);
    const cityKey = `${cityHex.q},${cityHex.r}`;
    const cities = new Map<string, PlayerId | null>([[cityKey, null]]);
    const target: DirectiveTarget = { type: 'city', cityId: cityKey };
    const unit = createUnit('infantry', 'player1', cityHex, 'capture', target);
    const ctx = makeContext({ friendlyUnits: [unit], cities });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('hold');
  });

  it('retargets to next enemy city after capturing current', () => {
    const ownedCity = createHex(5, 2);
    const ownedKey = `${ownedCity.q},${ownedCity.r}`;
    const nextCity = createHex(10, 3);
    const nextKey = `${nextCity.q},${nextCity.r}`;
    const cities = new Map<string, PlayerId | null>([
      [ownedKey, 'player1'],
      [nextKey, null],
    ]);
    const target: DirectiveTarget = { type: 'city', cityId: ownedKey };
    const unit = createUnit('infantry', 'player1', ownedCity, 'capture', target);
    const ctx = makeContext({ friendlyUnits: [unit], cities });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
    expect(unit.directiveTarget.cityId).toBe(nextKey);
  });
});
```

**Step 11: Write tests for enhanced existing directives with targets**

Add to `packages/engine/src/directives.test.ts`:

```typescript
describe('advance with target', () => {
  it('moves toward target hex instead of central objective', () => {
    const targetHex = createHex(2, 5);
    const target: DirectiveTarget = { type: 'hex', hex: targetHex };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'advance', target);
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const startDist = cubeDistance(unit.position, targetHex);
      const newDist = cubeDistance(action.targetHex, targetHex);
      expect(newDist).toBeLessThan(startDist);
    }
  });
});

describe('hold with target', () => {
  it('moves toward target when far away', () => {
    const targetHex = createHex(8, 2);
    const target: DirectiveTarget = { type: 'hex', hex: targetHex };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'hold', target);
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
    if (action.type === 'move') {
      const startDist = cubeDistance(unit.position, targetHex);
      const newDist = cubeDistance(action.targetHex, targetHex);
      expect(newDist).toBeLessThan(startDist);
    }
  });

  it('holds when adjacent to target', () => {
    const targetHex = createHex(1, 0);
    const target: DirectiveTarget = { type: 'hex', hex: targetHex };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'hold', target);
    const ctx = makeContext({ friendlyUnits: [unit] });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('hold');
  });
});

describe('support with friendly-unit target', () => {
  it('follows specific friendly unit instead of nearest', () => {
    const nearFriendly = createUnit('infantry', 'player1', createHex(2, 0), 'advance');
    const farFriendly = createUnit('tank', 'player1', createHex(10, 2), 'advance');
    const target: DirectiveTarget = { type: 'friendly-unit', unitId: farFriendly.id };
    const unit = createUnit('infantry', 'player1', createHex(0, 0), 'support', target);
    const ctx = makeContext({ friendlyUnits: [unit, nearFriendly, farFriendly] });

    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
    if (action.type === 'move') {
      // Should move toward far friendly, not near one
      const distToFar = cubeDistance(action.targetHex, farFriendly.position);
      const startDistToFar = cubeDistance(unit.position, farFriendly.position);
      expect(distToFar).toBeLessThan(startDistToFar);
    }
  });
});
```

**Step 12: Run all directive tests**

Run: `cd packages/engine && npx vitest run src/directives.test.ts`
Expected: ALL PASS

**Step 13: Commit**

```bash
git add packages/engine/src/directives.ts packages/engine/src/directives.test.ts packages/engine/src/index.ts
git commit -m "feat(engine): implement resolveTarget, hunt, capture directives + target-aware behaviors"
```

---

### Task 4: Update `commands.ts` with directive+target validation

**Files:**
- Modify: `packages/engine/src/commands.ts`
- Test: `packages/engine/src/commands.test.ts`

**Step 1: Write failing tests**

Add to `packages/engine/src/commands.test.ts`:

```typescript
import { validateDirectiveTarget } from './commands';
import type { DirectiveType, DirectiveTarget } from './types';

describe('validateDirectiveTarget', () => {
  it('rejects hunt without enemy-unit target', () => {
    const target: DirectiveTarget = { type: 'city', cityId: 'city-1' };
    expect(() => validateDirectiveTarget('hunt', target)).toThrow();
  });

  it('accepts hunt with enemy-unit target', () => {
    const target: DirectiveTarget = { type: 'enemy-unit', unitId: 'unit-1' };
    expect(() => validateDirectiveTarget('hunt', target)).not.toThrow();
  });

  it('rejects capture without city target', () => {
    const target: DirectiveTarget = { type: 'hex', hex: { q: 0, r: 0, s: 0 } };
    expect(() => validateDirectiveTarget('capture', target)).toThrow();
  });

  it('accepts capture with city target', () => {
    const target: DirectiveTarget = { type: 'city', cityId: 'city-1' };
    expect(() => validateDirectiveTarget('capture', target)).not.toThrow();
  });

  it('accepts advance with any target type', () => {
    const target: DirectiveTarget = { type: 'hex', hex: { q: 0, r: 0, s: 0 } };
    expect(() => validateDirectiveTarget('advance', target)).not.toThrow();
  });

  it('accepts any directive with central-objective', () => {
    const target: DirectiveTarget = { type: 'central-objective' };
    expect(() => validateDirectiveTarget('advance', target)).not.toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/engine && npx vitest run src/commands.test.ts`
Expected: FAIL — `validateDirectiveTarget` not exported

**Step 3: Implement `validateDirectiveTarget`**

In `packages/engine/src/commands.ts`, add:

```typescript
import type { Command, CommandPool, DirectiveType, DirectiveTarget } from './types';

export function validateDirectiveTarget(
  directive: DirectiveType,
  target: DirectiveTarget,
): void {
  if (directive === 'hunt' && target.type !== 'enemy-unit') {
    throw new Error('Hunt directive requires an enemy-unit target');
  }
  if (directive === 'capture' && target.type !== 'city') {
    throw new Error('Capture directive requires a city target');
  }
}
```

**Step 4: Run tests**

Run: `cd packages/engine && npx vitest run src/commands.test.ts`
Expected: PASS

**Step 5: Export from index.ts**

Add `validateDirectiveTarget` to the Commands exports in `packages/engine/src/index.ts`.

**Step 6: Commit**

```bash
git add packages/engine/src/commands.ts packages/engine/src/commands.test.ts packages/engine/src/index.ts
git commit -m "feat(engine): add validateDirectiveTarget for hunt/capture constraints"
```

---

### Task 5: Update `game-state.ts` to pass cities to context and handle redirect targets

**Files:**
- Modify: `packages/engine/src/game-state.ts:220-268` (executeUnitDirective, applyCommand)
- Test: `packages/engine/src/game-state.test.ts`

**Step 1: Update `executeUnitDirective` to pass cities to context**

In `game-state.ts`, update the `DirectiveContext` construction (lines 234-240):

```typescript
const context: DirectiveContext = {
  friendlyUnits: [...friendlyUnits],
  enemyUnits: [...state.players[enemyPlayer].units],
  terrain: state.map.terrain,
  centralObjective: state.map.centralObjective,
  gridSize: state.map.gridSize,
  cities: state.cityOwnership,
};
```

**Step 2: Update `applyCommand` for redirect with target**

In the `'redirect'` case (lines 339-344), update to:

```typescript
case 'redirect': {
  const unit = findUnitById(friendlyUnits, command.unitId);
  if (!unit) throw new Error(`Unit ${command.unitId} not found`);
  unit.directive = command.newDirective;
  if (command.target) {
    unit.directiveTarget = command.target;
  }
  unit.hasActed = true;
  break;
}
```

**Step 3: Update `placeUnit` to accept optional target**

Update `placeUnit` signature (line 81-87):

```typescript
export function placeUnit(
  state: GameState,
  playerId: PlayerId,
  unitType: UnitType,
  position: CubeCoord,
  directive: DirectiveType = 'advance',
  directiveTarget?: DirectiveTarget,
): GameState {
```

And update the `createUnit` call (line 114):

```typescript
const unit = createUnit(unitType, playerId, position, directive, directiveTarget);
```

Add `DirectiveTarget` to the imports from `./types`.

**Step 4: Write tests for target-aware game state**

Add to `packages/engine/src/game-state.test.ts` (find appropriate location):

```typescript
it('redirect command updates directiveTarget when target provided', () => {
  // setup a game in battle phase with units, then issue a redirect with target
  // verify unit.directiveTarget is updated
});

it('redirect command preserves directiveTarget when no target provided', () => {
  // setup unit with custom target, redirect without target
  // verify directiveTarget unchanged
});
```

(Note: Adapt these tests to match the existing test patterns in the file — create game, place units, start battle, execute turn with commands.)

**Step 5: Run tests**

Run: `cd packages/engine && npx vitest run src/game-state.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/engine/src/game-state.ts packages/engine/src/game-state.test.ts
git commit -m "feat(engine): pass cities to DirectiveContext, handle redirect targets in game-state"
```

---

### Task 6: Update serialization for `directiveTarget`

**Files:**
- Modify: `packages/engine/src/serialization.ts`
- Test: `packages/engine/src/serialization.test.ts`

**Step 1: Write failing test**

Add to `packages/engine/src/serialization.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && npx vitest run src/serialization.test.ts`
Expected: Likely PASS because units are spread with `{ ...u }` which copies all fields including `directiveTarget`. If it passes, that's fine — the test confirms correctness. If it fails, fix the serialization.

**Step 3: Verify the spread captures `directiveTarget`**

The existing serialization in `serializeGameState` (line 107-108) uses `{ ...u, position: { ...u.position } }`. Since `directiveTarget` is a plain object with readonly fields and no Maps/Sets, the spread should work. However, we should deep-copy the target to avoid shared references:

Update lines 107-108 to:
```typescript
player1: { ...state.players.player1, units: state.players.player1.units.map((u) => ({
  ...u,
  position: { ...u.position },
  directiveTarget: { ...u.directiveTarget, hex: u.directiveTarget.hex ? { ...u.directiveTarget.hex } : undefined },
})) },
player2: { ...state.players.player2, units: state.players.player2.units.map((u) => ({
  ...u,
  position: { ...u.position },
  directiveTarget: { ...u.directiveTarget, hex: u.directiveTarget.hex ? { ...u.directiveTarget.hex } : undefined },
})) },
```

And the same pattern in `deserializeGameState` (lines 171-172).

**Step 4: Run serialization tests**

Run: `cd packages/engine && npx vitest run src/serialization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/serialization.ts packages/engine/src/serialization.test.ts
git commit -m "feat(engine): ensure directiveTarget survives serialization round-trip"
```

---

### Task 7: Fix remaining engine compilation errors and run full test suite

**Files:**
- Potentially: `packages/engine/src/ai.ts` (needs to pass `directiveTarget` or it may error)
- Potentially: any other file that creates units or builds DirectiveContext

**Step 1: Run type check**

Run: `cd packages/engine && npx tsc --noEmit`
Expected: Fix any remaining type errors (likely in `ai.ts` which calls `createUnit` without `directiveTarget`, but the default parameter should handle it).

**Step 2: Run full engine test suite**

Run: `cd packages/engine && npx vitest run`
Expected: ALL PASS

**Step 3: Commit any fixes**

```bash
git add -A packages/engine/
git commit -m "fix(engine): resolve remaining type errors from directiveTarget addition"
```

---

### Task 8: Update client — DirectiveSelector with target selection

**Files:**
- Modify: `packages/client/src/components/DirectiveSelector.tsx`
- Modify: `packages/client/src/store/game-store.ts`

**Step 1: Update the DIRECTIVES array**

Add `hunt` and `capture` to the directive list:

```typescript
const DIRECTIVES: readonly DirectiveInfo[] = [
  { type: 'advance', name: 'Advance', desc: 'Push toward objective or target' },
  { type: 'hold', name: 'Hold', desc: '+1 DEF — move to target, then dig in' },
  { type: 'flank-left', name: 'Flank Left', desc: 'Arc left around target' },
  { type: 'flank-right', name: 'Flank Right', desc: 'Arc right around target' },
  { type: 'scout', name: 'Scout', desc: 'Acts first — reconnoiter target area' },
  { type: 'support', name: 'Support', desc: 'Follow and heal target friendly' },
  { type: 'hunt', name: 'Hunt', desc: 'Pursue and destroy target enemy' },
  { type: 'capture', name: 'Capture', desc: 'Move to city, occupy, then hold' },
] as const;
```

**Step 2: Add target selection state to store**

In `packages/client/src/store/game-store.ts`, add to the interface and state:

```typescript
// In the interface:
targetSelectionMode: boolean;
targetSelectionDirective: DirectiveType | null;
setTargetSelectionMode: (active: boolean, directive?: DirectiveType) => void;
setUnitDirectiveTarget: (unitId: string, directive: DirectiveType, target: DirectiveTarget) => void;
```

Implement:
```typescript
targetSelectionMode: false,
targetSelectionDirective: null,

setTargetSelectionMode: (active: boolean, directive?: DirectiveType): void =>
  set({
    targetSelectionMode: active,
    targetSelectionDirective: directive ?? null,
  }),

setUnitDirectiveTarget: (unitId: string, directive: DirectiveType, target: DirectiveTarget): void =>
  set((prev) => {
    if (!prev.gameState) return {};
    const player = prev.gameState.players[prev.currentPlayerView];
    const unit = player.units.find((u) => u.id === unitId);
    if (!unit) return {};
    unit.directive = directive;
    unit.directiveTarget = target;
    const updatedSelected = prev.selectedUnit?.id === unitId
      ? { ...prev.selectedUnit, directive, directiveTarget: target }
      : prev.selectedUnit;
    return {
      gameState: { ...prev.gameState },
      selectedUnit: updatedSelected,
      targetSelectionMode: false,
      targetSelectionDirective: null,
    };
  }),
```

**Step 3: Update DirectiveSelector to handle target-requiring directives**

When user clicks `hunt` or `capture`, enter target selection mode instead of immediately setting the directive. For other directives, add a "Set Target" button that optionally enters target selection mode.

```typescript
const handleSelect = useCallback(
  (directive: DirectiveType): void => {
    if (!selectedUnit) return;
    if (directive === 'hunt' || directive === 'capture') {
      // Requires target — enter selection mode
      setTargetSelectionMode(true, directive);
      return;
    }
    setUnitDirective(selectedUnit.id, directive);
  },
  [selectedUnit, setUnitDirective, setTargetSelectionMode],
);
```

**Step 4: Add `DirectiveTarget` import**

```typescript
import type { DirectiveType, DirectiveTarget } from '@hexwar/engine';
```

**Step 5: Commit**

```bash
git add packages/client/src/components/DirectiveSelector.tsx packages/client/src/store/game-store.ts
git commit -m "feat(client): add hunt/capture to DirectiveSelector, target selection state in store"
```

---

### Task 9: Update client — CommandMenu with target-aware redirect

**Files:**
- Modify: `packages/client/src/components/CommandMenu.tsx`

**Step 1: Add hunt and capture to DIRECTIVES array and directiveLabel**

```typescript
const DIRECTIVES: readonly DirectiveType[] = [
  'advance', 'hold', 'flank-left', 'flank-right', 'scout', 'support', 'hunt', 'capture',
] as const;

function directiveLabel(d: DirectiveType): string {
  switch (d) {
    case 'advance': return 'Advance';
    case 'hold': return 'Hold';
    case 'flank-left': return 'Flank L';
    case 'flank-right': return 'Flank R';
    case 'scout': return 'Scout';
    case 'support': return 'Support';
    case 'hunt': return 'Hunt';
    case 'capture': return 'Capture';
  }
}
```

**Step 2: Update handleRedirect for hunt/capture**

When hunt or capture is selected via redirect, enter target selection mode. Otherwise, issue redirect command as before.

```typescript
const handleRedirect = useCallback((directive: DirectiveType): void => {
  if (!selectedUnit) return;
  if (directive === 'hunt' || directive === 'capture') {
    // Need target selection — enter mode
    const store = useGameStore.getState();
    store.setTargetSelectionMode(true, directive);
    setShowDirectives(false);
    return;
  }
  addPendingCommand({ type: 'redirect', unitId: selectedUnit.id, newDirective: directive });
  setShowDirectives(false);
  selectUnit(null);
}, [selectedUnit, addPendingCommand, selectUnit]);
```

**Step 3: Commit**

```bash
git add packages/client/src/components/CommandMenu.tsx
git commit -m "feat(client): add hunt/capture to CommandMenu redirect options"
```

---

### Task 10: Update server — game-loop handlers for target

**Files:**
- Modify: `packages/server/src/game-loop.ts`

**Step 1: Update `handlePlaceUnit` to accept target**

```typescript
export function handlePlaceUnit(
  room: Room,
  playerId: PlayerId,
  unitType: UnitType,
  position: CubeCoord,
  directive: DirectiveType,
  io: Server,
  target?: DirectiveTarget,
): void {
  // ...
  placeUnit(room.gameState, playerId, unitType, position, directive, target);
  // ...
}
```

Add `DirectiveTarget` to the imports.

**Step 2: Update `handleSetDirective` to accept target**

```typescript
export function handleSetDirective(
  room: Room,
  playerId: PlayerId,
  unitId: string,
  directive: DirectiveType,
  io: Server,
  target?: DirectiveTarget,
): void {
  // ...
  unit.directive = directive;
  if (target) {
    unit.directiveTarget = target;
  }
  // ...
}
```

**Step 3: Update socket message handlers**

Find where `ClientPlaceUnit` and `ClientSetDirective` messages are handled (likely in the main server file or connection handler) and pass through the `target` field.

**Step 4: Commit**

```bash
git add packages/server/
git commit -m "feat(server): pass directiveTarget through server handlers"
```

---

### Task 11: Full integration test and build

**Step 1: Run full engine test suite**

Run: `cd packages/engine && npx vitest run`
Expected: ALL PASS

**Step 2: Run type check on all packages**

Run: `pnpm build`
Expected: Clean build

**Step 3: Run the dev server to smoke test**

Run: `pnpm dev`
Expected: App loads, can place units with all 8 directives

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: directive targeting system — hunt, capture, and parameterized targets"
```
