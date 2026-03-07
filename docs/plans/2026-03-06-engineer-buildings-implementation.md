# Engineer Unit & Building System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the Engineer unit type and a Building system (recon tower, mortar, mines, defensive position) to the HexWar engine per the design in `docs/plans/2026-03-05-engineer-buildings-design.md`.

**Architecture:** Extend existing types with `'engineer'` UnitType and new `Building`/`BuildingType` types. Add a `buildings.ts` module for building constants and factory. Thread buildings through game-state (creation, attack, round clearing), vision (recon tower), combat (defensive position bonus, mortar firing), and movement (mine triggering). Serialize buildings alongside existing state.

**Tech Stack:** TypeScript, Vitest, pnpm

---

### Task 1: Add Types

**Files:**
- Modify: `packages/engine/src/types.ts`

**Step 1: Write the type additions**

Add to `types.ts`:

1. Extend `UnitType` union to include `'engineer'`:
```typescript
export type UnitType = 'infantry' | 'tank' | 'artillery' | 'recon' | 'engineer';
```

2. Add building types after the Units section (~line 90):
```typescript
// -----------------------------------------------------------------------------
// Buildings
// -----------------------------------------------------------------------------

export type BuildingType = 'recon-tower' | 'mortar' | 'mines' | 'defensive-position';

export interface BuildingStats {
  readonly type: BuildingType;
  readonly cost: number;
  readonly visionRange?: number;
  readonly attackRange?: number;
  readonly minAttackRange?: number;
  readonly atk?: number;
  readonly damage?: number;
  readonly defenseBonus?: number;
}

export interface Building {
  readonly id: string;
  readonly type: BuildingType;
  readonly owner: PlayerId;
  readonly position: CubeCoord;
  isRevealed: boolean;
}
```

3. Add `build` to `UnitAction` union:
```typescript
export type UnitAction =
  | { type: 'move'; targetHex: CubeCoord }
  | { type: 'attack'; targetUnitId: string }
  | { type: 'hold' }
  | { type: 'build'; buildingType: BuildingType; targetHex: CubeCoord };
```

4. Add `direct-build` and `attack-building` to `Command` union:
```typescript
export type Command =
  | { type: 'redirect'; unitId: string; newDirective: DirectiveType; target?: DirectiveTarget }
  | { type: 'direct-move'; unitId: string; targetHex: CubeCoord }
  | { type: 'direct-attack'; unitId: string; targetUnitId: string }
  | { type: 'direct-build'; unitId: string; buildingType: BuildingType; targetHex: CubeCoord }
  | { type: 'attack-building'; unitId: string; targetBuildingId: string }
  | { type: 'retreat'; unitId: string };
```

5. Add `buildings` to `GameState`:
```typescript
export interface GameState {
  phase: GamePhase;
  players: Record<PlayerId, PlayerState>;
  round: RoundState;
  map: GameMap;
  maxRounds: number;
  winner: PlayerId | null;
  cityOwnership: Map<string, PlayerId | null>;
  pendingEvents: BattleEvent[];
  buildings: Building[];
}
```

6. Add building-related battle event types:
```typescript
export type BattleEventType =
  | 'kill' | 'damage' | 'capture' | 'recapture'
  | 'capture-damage' | 'capture-death'
  | 'objective-change' | 'koth-progress'
  | 'round-end' | 'game-end'
  | 'mine-triggered' | 'mortar-fire' | 'building-destroyed';
```

**Step 2: Fix compilation errors**

After adding `buildings: Building[]` to `GameState`, every `createGame` and `deserializeGameState` call needs to initialize `buildings: []`. Update:
- `packages/engine/src/game-state.ts` `createGame()`: add `buildings: []` to the returned object.
- `packages/engine/src/serialization.ts` `deserializeGameState()`: add `buildings: []` to the returned object.

**Step 3: Run tests to verify nothing broke**

Run: `cd packages/engine && pnpm test`
Expected: All existing tests pass (the new types are additive, engineer stats not used yet).

**Step 4: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/game-state.ts packages/engine/src/serialization.ts
git commit -m "feat: add engineer and building types to engine"
```

---

### Task 2: Engineer Unit Stats & Type Advantages

**Files:**
- Modify: `packages/engine/src/units.ts`
- Modify: `packages/engine/src/units.test.ts`

**Step 1: Write the failing test**

Add to `units.test.ts`:
```typescript
describe('engineer', () => {
  it('has correct stats', () => {
    const stats = UNIT_STATS.engineer;
    expect(stats.cost).toBe(75);
    expect(stats.maxHp).toBe(2);
    expect(stats.atk).toBe(1);
    expect(stats.def).toBe(1);
    expect(stats.moveRange).toBe(3);
    expect(stats.attackRange).toBe(1);
    expect(stats.minAttackRange).toBe(1);
    expect(stats.visionRange).toBe(3);
  });

  it('is weak against all combat units', () => {
    expect(getTypeAdvantage('infantry', 'engineer')).toBe(1.5);
    expect(getTypeAdvantage('tank', 'engineer')).toBe(1.5);
    expect(getTypeAdvantage('artillery', 'engineer')).toBe(1.2);
    expect(getTypeAdvantage('recon', 'engineer')).toBe(1.2);
  });

  it('is weak when attacking combat units', () => {
    expect(getTypeAdvantage('engineer', 'infantry')).toBe(0.5);
    expect(getTypeAdvantage('engineer', 'tank')).toBe(0.3);
    expect(getTypeAdvantage('engineer', 'artillery')).toBe(0.8);
    expect(getTypeAdvantage('engineer', 'recon')).toBe(0.5);
    expect(getTypeAdvantage('engineer', 'engineer')).toBe(1.0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run units.test.ts`
Expected: FAIL — `UNIT_STATS.engineer` is undefined.

**Step 3: Write minimal implementation**

In `units.ts`, add engineer to `UNIT_STATS`:
```typescript
engineer: {
  type: 'engineer',
  cost: 75,
  maxHp: 2,
  atk: 1,
  def: 1,
  moveRange: 3,
  attackRange: 1,
  minAttackRange: 1,
  visionRange: 3,
},
```

Add engineer row and column to `TYPE_ADVANTAGE`:
```typescript
const TYPE_ADVANTAGE: Record<UnitType, Record<UnitType, number>> = {
  infantry:  { infantry: 1.0, tank: 0.5, artillery: 1.2, recon: 1.0, engineer: 1.5 },
  tank:      { infantry: 1.5, tank: 1.0, artillery: 1.2, recon: 1.5, engineer: 1.5 },
  artillery: { infantry: 1.3, tank: 1.3, artillery: 1.0, recon: 1.3, engineer: 1.2 },
  recon:     { infantry: 0.8, tank: 0.3, artillery: 1.5, recon: 1.0, engineer: 1.2 },
  engineer:  { infantry: 0.5, tank: 0.3, artillery: 0.8, recon: 0.5, engineer: 1.0 },
};
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run units.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/units.ts packages/engine/src/units.test.ts
git commit -m "feat: add engineer unit stats and type advantages"
```

---

### Task 3: Building Constants & Factory

**Files:**
- Create: `packages/engine/src/buildings.ts`
- Create: `packages/engine/src/buildings.test.ts`

**Step 1: Write the failing test**

Create `buildings.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BUILDING_STATS, createBuilding, resetBuildingIdCounter } from './buildings';
import { createHex } from './hex';
import type { BuildingType } from './types';

beforeEach(() => {
  resetBuildingIdCounter();
});

describe('BUILDING_STATS', () => {
  it('recon-tower has vision range 4 and costs 75', () => {
    const stats = BUILDING_STATS['recon-tower'];
    expect(stats.cost).toBe(75);
    expect(stats.visionRange).toBe(4);
  });

  it('mortar has attack range 3, min 2, atk 2, costs 150', () => {
    const stats = BUILDING_STATS.mortar;
    expect(stats.cost).toBe(150);
    expect(stats.attackRange).toBe(3);
    expect(stats.minAttackRange).toBe(2);
    expect(stats.atk).toBe(2);
  });

  it('mines deal 2 damage and cost 50', () => {
    const stats = BUILDING_STATS.mines;
    expect(stats.cost).toBe(50);
    expect(stats.damage).toBe(2);
  });

  it('defensive-position has +0.5 defense bonus and costs 100', () => {
    const stats = BUILDING_STATS['defensive-position'];
    expect(stats.cost).toBe(100);
    expect(stats.defenseBonus).toBe(0.5);
  });
});

describe('createBuilding', () => {
  it('creates a building with correct fields', () => {
    const pos = createHex(2, 3);
    const building = createBuilding('recon-tower', 'player1', pos);
    expect(building.id).toBe('building-1');
    expect(building.type).toBe('recon-tower');
    expect(building.owner).toBe('player1');
    expect(building.position).toEqual(pos);
    expect(building.isRevealed).toBe(true);
  });

  it('mines are created hidden (isRevealed = false)', () => {
    const building = createBuilding('mines', 'player2', createHex(0, 0));
    expect(building.isRevealed).toBe(false);
  });

  it('increments building IDs', () => {
    const b1 = createBuilding('mortar', 'player1', createHex(0, 0));
    const b2 = createBuilding('mines', 'player1', createHex(1, 0));
    expect(b1.id).toBe('building-1');
    expect(b2.id).toBe('building-2');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run buildings.test.ts`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

Create `buildings.ts`:
```typescript
import type { BuildingType, BuildingStats, Building, PlayerId, CubeCoord } from './types';

export const BUILDING_STATS: Record<BuildingType, BuildingStats> = {
  'recon-tower': {
    type: 'recon-tower',
    cost: 75,
    visionRange: 4,
  },
  mortar: {
    type: 'mortar',
    cost: 150,
    attackRange: 3,
    minAttackRange: 2,
    atk: 2,
  },
  mines: {
    type: 'mines',
    cost: 50,
    damage: 2,
  },
  'defensive-position': {
    type: 'defensive-position',
    cost: 100,
    defenseBonus: 0.5,
  },
} as const;

let buildingIdCounter = 0;

export function createBuilding(
  type: BuildingType,
  owner: PlayerId,
  position: CubeCoord,
): Building {
  buildingIdCounter += 1;
  return {
    id: `building-${buildingIdCounter}`,
    type,
    owner,
    position,
    isRevealed: type !== 'mines',
  };
}

export function resetBuildingIdCounter(): void {
  buildingIdCounter = 0;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run buildings.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/buildings.ts packages/engine/src/buildings.test.ts
git commit -m "feat: add building stats and factory"
```

---

### Task 4: Build Validation

**Files:**
- Modify: `packages/engine/src/buildings.ts`
- Modify: `packages/engine/src/buildings.test.ts`

**Step 1: Write the failing test**

Add to `buildings.test.ts`:
```typescript
import type { GameState, Building } from './types';
import { createGame, placeUnit, startBattlePhase } from './game-state';
import { resetUnitIdCounter } from './units';
import { hexToKey, hexNeighbors } from './hex';
import { validateBuild } from './buildings';

describe('validateBuild', () => {
  let state: GameState;

  beforeEach(() => {
    resetUnitIdCounter();
    resetBuildingIdCounter();
    state = createGame(42);
    // Place an engineer for player1
    const deployHex = state.map.player1Deployment[0]!;
    placeUnit(state, 'player1', 'engineer', deployHex);
    state = startBattlePhase(state);
  });

  it('succeeds for valid build on adjacent hex', () => {
    const engineer = state.players.player1.units[0]!;
    const adjacent = hexNeighbors(engineer.position).find(
      (h) => state.map.terrain.has(hexToKey(h)) && state.map.terrain.get(hexToKey(h)) !== 'mountain',
    )!;
    const result = validateBuild(state, engineer.id, 'player1', 'recon-tower', adjacent);
    expect(result.valid).toBe(true);
  });

  it('fails if unit is not an engineer', () => {
    // Place an infantry
    const deployHex = state.map.player1Deployment[1]!;
    // Manually add an infantry to test
    const infantry = { id: 'test-inf', type: 'infantry' as const, owner: 'player1' as const, hp: 3, position: deployHex, directive: 'advance' as const, directiveTarget: { type: 'central-objective' as const }, hasActed: false };
    state.players.player1.units.push(infantry);
    const adjacent = hexNeighbors(deployHex).find(
      (h) => state.map.terrain.has(hexToKey(h)) && state.map.terrain.get(hexToKey(h)) !== 'mountain',
    )!;
    const result = validateBuild(state, 'test-inf', 'player1', 'mines', adjacent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('engineer');
  });

  it('fails if engineer has already acted', () => {
    const engineer = state.players.player1.units[0]!;
    engineer.hasActed = true;
    const adjacent = hexNeighbors(engineer.position).find(
      (h) => state.map.terrain.has(hexToKey(h)) && state.map.terrain.get(hexToKey(h)) !== 'mountain',
    )!;
    const result = validateBuild(state, engineer.id, 'player1', 'mines', adjacent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('acted');
  });

  it('fails if target hex is not adjacent', () => {
    const engineer = state.players.player1.units[0]!;
    // Use the engineer's own position (distance 0, not adjacent)
    const result = validateBuild(state, engineer.id, 'player1', 'mines', engineer.position);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('adjacent');
  });

  it('fails if building already exists on target hex', () => {
    const engineer = state.players.player1.units[0]!;
    const adjacent = hexNeighbors(engineer.position).find(
      (h) => state.map.terrain.has(hexToKey(h)) && state.map.terrain.get(hexToKey(h)) !== 'mountain',
    )!;
    state.buildings.push(createBuilding('mines', 'player1', adjacent));
    const result = validateBuild(state, engineer.id, 'player1', 'recon-tower', adjacent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('building');
  });

  it('fails if target is a mountain', () => {
    const engineer = state.players.player1.units[0]!;
    const mountainAdj = hexNeighbors(engineer.position).find(
      (h) => state.map.terrain.get(hexToKey(h)) === 'mountain',
    );
    if (!mountainAdj) return; // skip if no mountain adjacent in this seed
    const result = validateBuild(state, engineer.id, 'player1', 'mines', mountainAdj);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mountain');
  });

  it('fails if target is a deployment zone hex', () => {
    const engineer = state.players.player1.units[0]!;
    const dzKeys = new Set(state.map.player1Deployment.map(hexToKey));
    const dzAdj = hexNeighbors(engineer.position).find(
      (h) => dzKeys.has(hexToKey(h)) && state.map.terrain.has(hexToKey(h)),
    );
    if (!dzAdj) return; // skip if no DZ adjacent
    const result = validateBuild(state, engineer.id, 'player1', 'mines', dzAdj);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('deployment');
  });

  it('fails if player cannot afford the building', () => {
    const engineer = state.players.player1.units[0]!;
    state.players.player1.resources = 0;
    const adjacent = hexNeighbors(engineer.position).find(
      (h) => state.map.terrain.has(hexToKey(h)) && state.map.terrain.get(hexToKey(h)) !== 'mountain',
    )!;
    const result = validateBuild(state, engineer.id, 'player1', 'mortar', adjacent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('afford');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run buildings.test.ts`
Expected: FAIL — `validateBuild` not exported.

**Step 3: Write minimal implementation**

Add to `buildings.ts`:
```typescript
import type { GameState } from './types';
import { cubeDistance, hexToKey } from './hex';

export interface BuildValidation {
  valid: boolean;
  reason?: string;
}

export function validateBuild(
  state: GameState,
  unitId: string,
  playerId: PlayerId,
  buildingType: BuildingType,
  targetHex: CubeCoord,
): BuildValidation {
  const unit = state.players[playerId].units.find((u) => u.id === unitId);
  if (!unit) return { valid: false, reason: 'Unit not found' };
  if (unit.type !== 'engineer') return { valid: false, reason: 'Only engineers can build' };
  if (unit.hasActed) return { valid: false, reason: 'Engineer has already acted this turn' };

  const dist = cubeDistance(unit.position, targetHex);
  if (dist !== 1) return { valid: false, reason: 'Target hex must be adjacent to engineer' };

  const targetKey = hexToKey(targetHex);

  if (!state.map.terrain.has(targetKey)) {
    return { valid: false, reason: 'Target hex does not exist' };
  }

  if (state.map.terrain.get(targetKey) === 'mountain') {
    return { valid: false, reason: 'Cannot build on a mountain' };
  }

  const dzKeys = new Set([
    ...state.map.player1Deployment.map(hexToKey),
    ...state.map.player2Deployment.map(hexToKey),
  ]);
  if (dzKeys.has(targetKey)) {
    return { valid: false, reason: 'Cannot build on a deployment zone hex' };
  }

  const existingBuilding = state.buildings.some(
    (b) => hexToKey(b.position) === targetKey,
  );
  if (existingBuilding) {
    return { valid: false, reason: 'A building already exists on that hex' };
  }

  const cost = BUILDING_STATS[buildingType].cost;
  if (state.players[playerId].resources < cost) {
    return { valid: false, reason: 'Cannot afford this building' };
  }

  return { valid: true };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run buildings.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/buildings.ts packages/engine/src/buildings.test.ts
git commit -m "feat: add build validation for engineers"
```

---

### Task 5: Build Command Execution (direct-build)

**Files:**
- Modify: `packages/engine/src/game-state.ts`
- Modify: `packages/engine/src/game-state.test.ts`
- Modify: `packages/engine/src/commands.ts`

**Step 1: Write the failing test**

Add to `game-state.test.ts`:
```typescript
describe('direct-build command', () => {
  let state: GameState;

  beforeEach(() => {
    resetUnitIdCounter();
    state = createGame(42);
  });

  it('engineer builds a recon-tower on adjacent hex', () => {
    const deployHex = state.map.player1Deployment[0]!;
    placeUnit(state, 'player1', 'engineer', deployHex);
    state = startBattlePhase(state);

    const engineer = state.players.player1.units[0]!;
    const adjacent = hexNeighbors(engineer.position).find(
      (h) => {
        const key = hexToKey(h);
        return state.map.terrain.has(key)
          && state.map.terrain.get(key) !== 'mountain'
          && !state.map.player1Deployment.some((d) => hexToKey(d) === key)
          && !state.map.player2Deployment.some((d) => hexToKey(d) === key);
      },
    )!;

    const resourcesBefore = state.players.player1.resources;
    state = executeTurn(state, [
      { type: 'direct-build', unitId: engineer.id, buildingType: 'recon-tower', targetHex: adjacent },
    ]);

    // Building was created (on the player1 side — need to check after turn switches)
    expect(state.buildings.length).toBe(1);
    expect(state.buildings[0]!.type).toBe('recon-tower');
    expect(state.buildings[0]!.owner).toBe('player1');
    expect(hexToKey(state.buildings[0]!.position)).toBe(hexToKey(adjacent));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run game-state.test.ts`
Expected: FAIL — `direct-build` command type not handled.

**Step 3: Write minimal implementation**

1. In `commands.ts`, update `getUnitId` to handle `direct-build` and `attack-building` (it already works since all command variants have `unitId`).

2. In `game-state.ts`, add imports for building utilities:
```typescript
import { validateBuild, createBuilding, BUILDING_STATS } from './buildings';
```

3. Add `direct-build` case to `applyCommand`:
```typescript
case 'direct-build': {
  const unit = findUnitById(friendlyUnits, command.unitId);
  if (!unit) return;

  const validation = validateBuild(state, command.unitId, currentPlayer, command.buildingType, command.targetHex);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Invalid build');
  }

  const cost = BUILDING_STATS[command.buildingType].cost;
  state.players[currentPlayer].resources -= cost;
  state.buildings.push(createBuilding(command.buildingType, currentPlayer, command.targetHex));
  unit.hasActed = true;
  break;
}
```

4. Add `attack-building` case to `applyCommand`:
```typescript
case 'attack-building': {
  const attacker = findUnitById(friendlyUnits, command.unitId);
  if (!attacker) return;

  const buildingIdx = state.buildings.findIndex((b) => b.id === command.targetBuildingId);
  if (buildingIdx === -1) return;

  const building = state.buildings[buildingIdx]!;
  if (building.owner === currentPlayer) {
    throw new Error('Cannot attack own building');
  }

  const dist = cubeDistance(attacker.position, building.position);
  const stats = UNIT_STATS[attacker.type];
  if (dist < stats.minAttackRange || dist > stats.attackRange) {
    throw new Error('Building out of attack range');
  }

  state.buildings.splice(buildingIdx, 1);
  attacker.hasActed = true;

  state.pendingEvents.push({
    type: 'building-destroyed',
    actingPlayer: currentPlayer,
    message: `${currentPlayer === 'player1' ? 'P1' : 'P2'} destroyed a ${building.type}`,
  });
  break;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run game-state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/game-state.ts packages/engine/src/game-state.test.ts packages/engine/src/commands.ts
git commit -m "feat: add direct-build and attack-building command execution"
```

---

### Task 6: Attack Building Command Tests

**Files:**
- Modify: `packages/engine/src/game-state.test.ts`

**Step 1: Write the failing test**

Add to `game-state.test.ts`:
```typescript
describe('attack-building command', () => {
  let state: GameState;

  beforeEach(() => {
    resetUnitIdCounter();
    state = createGame(42);
  });

  it('unit destroys an enemy building', () => {
    const p1Hex = state.map.player1Deployment[0]!;
    placeUnit(state, 'player1', 'infantry', p1Hex);
    state = startBattlePhase(state);

    // Manually place an enemy building adjacent to the infantry
    const infantry = state.players.player1.units[0]!;
    const adjHex = hexNeighbors(infantry.position).find(
      (h) => state.map.terrain.has(hexToKey(h)),
    )!;

    const { createBuilding: cb, resetBuildingIdCounter: rbc } = await import('./buildings');
    rbc();
    state.buildings.push(cb('mortar', 'player2', adjHex));

    state = executeTurn(state, [
      { type: 'attack-building', unitId: infantry.id, targetBuildingId: state.buildings[0]!.id },
    ]);

    expect(state.buildings.length).toBe(0);
  });
});
```

Note: This test depends on Task 5's implementation. If Task 5's test passes, this should too if the `attack-building` case was added. Write this test as a separate `describe` block to confirm behavior.

**Step 2: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run game-state.test.ts`
Expected: PASS (implementation already done in Task 5)

**Step 3: Commit**

```bash
git add packages/engine/src/game-state.test.ts
git commit -m "test: add attack-building command tests"
```

---

### Task 7: Mine Triggering During Movement

**Files:**
- Modify: `packages/engine/src/game-state.ts`
- Modify: `packages/engine/src/game-state.test.ts`

**Step 1: Write the failing test**

Add to `game-state.test.ts`:
```typescript
describe('mine triggering', () => {
  it('mine deals damage when enemy moves onto hex', () => {
    resetUnitIdCounter();
    const state = createGame(42);

    const p1Deploy = state.map.player1Deployment[0]!;
    const p2Deploy = state.map.player2Deployment[0]!;
    placeUnit(state, 'player1', 'infantry', p1Deploy);
    placeUnit(state, 'player2', 'infantry', p2Deploy);

    startBattlePhase(state);

    const p1Infantry = state.players.player1.units[0]!;

    // Place a mine from player2 on a hex adjacent to p1Infantry's deploy hex
    // that the infantry will path through
    const mineHex = hexNeighbors(p1Infantry.position).find(
      (h) => {
        const key = hexToKey(h);
        return state.map.terrain.has(key) && state.map.terrain.get(key) !== 'mountain';
      },
    )!;

    const { createBuilding, resetBuildingIdCounter } = await import('./buildings');
    resetBuildingIdCounter();
    state.buildings.push(createBuilding('mines', 'player2', mineHex));

    // Command infantry to move to the mined hex
    executeTurn(state, [
      { type: 'direct-move', unitId: p1Infantry.id, targetHex: mineHex },
    ]);

    // Mine should be destroyed
    expect(state.buildings.length).toBe(0);
    // Infantry should have taken 2 damage (from 3 HP -> 1 HP)
    const inf = state.players.player1.units.find((u) => u.id === p1Infantry.id);
    expect(inf?.hp).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run game-state.test.ts`
Expected: FAIL — mine not triggered.

**Step 3: Write minimal implementation**

Add a helper function `checkMines` in `game-state.ts`:
```typescript
function checkMines(state: GameState, unit: Unit, owner: PlayerId): void {
  const posKey = hexToKey(unit.position);
  const mineIdx = state.buildings.findIndex(
    (b) => b.type === 'mines' && b.owner !== owner && hexToKey(b.position) === posKey,
  );
  if (mineIdx === -1) return;

  const mine = state.buildings[mineIdx]!;
  const damage = BUILDING_STATS.mines.damage ?? 2;
  unit.hp -= damage;

  state.buildings.splice(mineIdx, 1);

  const label = owner === 'player1' ? 'P1' : 'P2';
  state.pendingEvents.push({
    type: 'mine-triggered',
    actingPlayer: mine.owner,
    message: `${label} unit triggered a mine for ${damage} damage`,
  });

  if (unit.hp <= 0) {
    removeUnit(state.players[owner].units, unit.id);
    const enemy: PlayerId = owner === 'player1' ? 'player2' : 'player1';
    state.round.unitsKilledThisRound[enemy] += 1;
  }
}
```

Call `checkMines` after every movement:
- In `applyCommand` `direct-move` case, after `unit.position = command.targetHex`: add `checkMines(state, unit, currentPlayer);`
- In `applyDirectiveAction` `move` case, after `unit.position = action.targetHex`: add `checkMines(state, unit, currentPlayer);`
- In `applyCommand` `retreat` case, after position update: add `checkMines(state, unit, currentPlayer);`

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run game-state.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd packages/engine && pnpm test`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/engine/src/game-state.ts packages/engine/src/game-state.test.ts
git commit -m "feat: add mine triggering during unit movement"
```

---

### Task 8: Vision Integration (Recon Tower)

**Files:**
- Modify: `packages/engine/src/vision.ts`
- Modify: `packages/engine/src/vision.test.ts`

**Step 1: Write the failing test**

Add to `vision.test.ts`:
```typescript
import type { Building } from './types';
import { createHex, hexToKey } from './hex';

describe('recon tower vision', () => {
  it('adds recon tower as vision source with range 4', () => {
    const terrain = new Map<string, TerrainType>();
    // Create a small grid of plains
    for (let q = -5; q <= 5; q++) {
      for (let r = -5; r <= 5; r++) {
        terrain.set(`${q},${r}`, 'plains');
      }
    }

    const buildings: Building[] = [
      { id: 'b1', type: 'recon-tower', owner: 'player1', position: createHex(0, 0), isRevealed: true },
    ];

    const visible = calculateVisibility([], terrain, buildings);

    // Hex at distance 4 should be visible
    expect(visible.has(hexToKey(createHex(4, 0)))).toBe(true);
    // Hex at distance 5 should NOT be visible
    expect(visible.has(hexToKey(createHex(5, 0)))).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run vision.test.ts`
Expected: FAIL — `calculateVisibility` doesn't accept buildings parameter.

**Step 3: Write minimal implementation**

Update `calculateVisibility` signature to accept an optional `buildings` array:
```typescript
export function calculateVisibility(
  friendlyUnits: Unit[],
  terrainMap: Map<string, TerrainType>,
  buildings?: Building[],
): Set<string> {
```

Add building vision sources after the unit loop:
```typescript
// Add recon tower vision
if (buildings) {
  for (const building of buildings) {
    if (building.type !== 'recon-tower') continue;
    const range = BUILDING_STATS['recon-tower'].visionRange ?? 4;
    const bKey = hexToKey(building.position);
    visible.add(bKey);

    for (const key of terrainMap.keys()) {
      const [qStr, rStr] = key.split(',');
      const tq = Number(qStr);
      const tr = Number(rStr);
      const targetCoord = { q: tq, r: tr, s: -tq - tr };

      const dist = cubeDistance(building.position, targetCoord);
      if (dist > range || dist === 0) continue;

      const line = hexLineDraw(building.position, targetCoord);
      let blocked = false;
      for (let i = 1; i < line.length - 1; i++) {
        const intermediateKey = hexToKey(line[i]!);
        const intermediateTerrain = terrainMap.get(intermediateKey);
        if (intermediateTerrain && TERRAIN[intermediateTerrain].blocksLoS) {
          visible.add(intermediateKey);
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        visible.add(key);
      }
    }
  }
}
```

Import `Building` type and `BUILDING_STATS`:
```typescript
import type { Unit, TerrainType, Building } from './types';
import { BUILDING_STATS } from './buildings';
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run vision.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/vision.ts packages/engine/src/vision.test.ts
git commit -m "feat: add recon tower vision source"
```

---

### Task 9: Defensive Position Terrain Bonus

**Files:**
- Modify: `packages/engine/src/combat.ts`
- Modify: `packages/engine/src/combat.test.ts`

**Step 1: Write the failing test**

Add to `combat.test.ts`:
```typescript
import type { Building } from './types';
import { createHex } from './hex';

describe('defensive position bonus', () => {
  it('adds +0.5 to terrain defense modifier for unit on defensive-position hex', () => {
    const attacker: Unit = {
      id: 'a1', type: 'infantry', owner: 'player1', hp: 3,
      position: createHex(0, 0), directive: 'advance',
      directiveTarget: { type: 'central-objective' }, hasActed: false,
    };
    const defender: Unit = {
      id: 'd1', type: 'infantry', owner: 'player2', hp: 3,
      position: createHex(1, 0), directive: 'advance',
      directiveTarget: { type: 'central-objective' }, hasActed: false,
    };

    const buildings: Building[] = [
      { id: 'b1', type: 'defensive-position', owner: 'player2', position: createHex(1, 0), isRevealed: true },
    ];

    // Plains defense = 0, with defensive position = 0.5
    // Without DP: max(1, floor(2 * 1.0 * 1.0 - 2 * 0)) = 2
    // With DP: max(1, floor(2 * 1.0 * 1.0 - 2 * 0.5)) = 1
    const damageWithDP = calculateDamage(attacker, defender, 'plains', () => 1.0, buildings);
    expect(damageWithDP).toBe(1);

    // Without DP for comparison
    const damageWithoutDP = calculateDamage(attacker, defender, 'plains', () => 1.0, []);
    expect(damageWithoutDP).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run combat.test.ts`
Expected: FAIL — `calculateDamage` doesn't accept buildings parameter.

**Step 3: Write minimal implementation**

Update `calculateDamage` to accept optional buildings array:
```typescript
export function calculateDamage(
  attacker: Unit,
  defender: Unit,
  defenderTerrain: TerrainType,
  randomFn: () => number = (): number => 0.85 + Math.random() * 0.3,
  buildings?: Building[],
): number {
  const attackerStats = UNIT_STATS[attacker.type];
  const defenderStats = UNIT_STATS[defender.type];
  const typeMultiplier = getTypeAdvantage(attacker.type, defender.type);
  let terrainDef = getDefenseModifier(defenderTerrain);

  // Defensive position bonus
  if (buildings) {
    const defenderKey = hexToKey(defender.position);
    const hasDP = buildings.some(
      (b) => b.type === 'defensive-position' && b.owner === defender.owner && hexToKey(b.position) === defenderKey,
    );
    if (hasDP) {
      terrainDef += BUILDING_STATS['defensive-position'].defenseBonus ?? 0.5;
    }
  }

  const effectiveDef = defenderStats.def + (defender.directive === 'hold' ? 1 : 0);
  const randomFactor = randomFn();
  const baseDamage = attackerStats.atk * typeMultiplier * randomFactor;
  const finalDamage = Math.max(1, Math.floor(baseDamage - effectiveDef * terrainDef));

  return finalDamage;
}
```

Add imports:
```typescript
import type { Unit, TerrainType, Building } from './types';
import { hexToKey } from './hex';
import { BUILDING_STATS } from './buildings';
```

**Step 4: Update callers**

In `game-state.ts`, pass `state.buildings` to all `calculateDamage` calls:
- In `applyCommand` `direct-attack` case: `calculateDamage(attacker, defender, defenderTerrain, randomFn, state.buildings)`
- In `applyDirectiveAction` `attack` case: `calculateDamage(unit, defender, defenderTerrain, randomFn, state.buildings)`

**Step 5: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run combat.test.ts`
Expected: PASS

**Step 6: Run full suite**

Run: `cd packages/engine && pnpm test`
Expected: All pass.

**Step 7: Commit**

```bash
git add packages/engine/src/combat.ts packages/engine/src/combat.test.ts packages/engine/src/game-state.ts
git commit -m "feat: add defensive position terrain bonus to combat"
```

---

### Task 10: Mortar Firing Phase

**Files:**
- Modify: `packages/engine/src/game-state.ts`
- Modify: `packages/engine/src/game-state.test.ts`

**Step 1: Write the failing test**

Add to `game-state.test.ts`:
```typescript
describe('mortar firing', () => {
  it('mortar attacks nearest enemy in range after all units act', () => {
    resetUnitIdCounter();
    const state = createGame(42);

    // Place units far enough apart that mortars can fire
    const p1Deploy = state.map.player1Deployment[0]!;
    placeUnit(state, 'player1', 'infantry', p1Deploy);

    // Find a hex 2-3 away from a suitable mortar position
    const adjHexes = hexNeighbors(p1Deploy);
    const mortarHex = adjHexes.find((h) => {
      const key = hexToKey(h);
      if (!state.map.terrain.has(key)) return false;
      if (state.map.terrain.get(key) === 'mountain') return false;
      const dist = cubeDistance(h, p1Deploy);
      return dist >= 2 && dist <= 3;
    });

    // We need a mortar 2-3 hexes from an enemy.
    // Simpler: place a p2 infantry, then manually add a mortar in range.
    const p2Deploy = state.map.player2Deployment[0]!;
    placeUnit(state, 'player2', 'infantry', p2Deploy);
    startBattlePhase(state);

    // Manually place a mortar for player1 within range 2-3 of p2 infantry
    const p2Inf = state.players.player2.units[0]!;
    // Find a hex that is 2-3 hexes from p2 infantry and on the map
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

    if (!mortarPos) return; // skip if no valid position

    const { createBuilding, resetBuildingIdCounter } = await import('./buildings');
    resetBuildingIdCounter();
    state.buildings.push(createBuilding('mortar', 'player1', mortarPos));

    const hpBefore = p2Inf.hp;
    executeTurn(state, []); // empty commands, let directives run, then mortar fires

    // Mortar should have fired: either damage or kill
    // Mortar damage = max(1, floor(atk - DEF * terrainDefense))
    // atk=2, infantry DEF=2, terrain varies
    const p2InfAfter = state.players.player2.units.find((u) => u.id === p2Inf.id);
    if (p2InfAfter) {
      expect(p2InfAfter.hp).toBeLessThan(hpBefore);
    }
    // If killed, unit array is shorter
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run game-state.test.ts`
Expected: FAIL — mortar doesn't fire.

**Step 3: Write minimal implementation**

Add `fireMortars` function in `game-state.ts`:
```typescript
function fireMortars(state: GameState, firingPlayer: PlayerId): void {
  const enemyPlayer: PlayerId = firingPlayer === 'player1' ? 'player2' : 'player1';
  const mortars = state.buildings.filter(
    (b) => b.type === 'mortar' && b.owner === firingPlayer,
  );

  for (const mortar of mortars) {
    const stats = BUILDING_STATS.mortar;
    const atk = stats.atk ?? 2;
    const range = stats.attackRange ?? 3;
    const minRange = stats.minAttackRange ?? 2;

    // Find nearest enemy in range
    let nearestEnemy: Unit | null = null;
    let nearestDist = Infinity;

    for (const enemy of state.players[enemyPlayer].units) {
      const dist = cubeDistance(mortar.position, enemy.position);
      if (dist >= minRange && dist <= range && dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = enemy;
      }
    }

    if (!nearestEnemy) continue;

    // Simplified damage: max(1, floor(atk - DEF * terrainDefense))
    const defenderStats = UNIT_STATS[nearestEnemy.type];
    const terrainKey = hexToKey(nearestEnemy.position);
    const terrainType = state.map.terrain.get(terrainKey) ?? 'plains';
    let terrainDef = getDefenseModifier(terrainType);

    // Check defensive position bonus for the target
    const hasDP = state.buildings.some(
      (b) => b.type === 'defensive-position' && b.owner === nearestEnemy!.owner && hexToKey(b.position) === terrainKey,
    );
    if (hasDP) {
      terrainDef += BUILDING_STATS['defensive-position'].defenseBonus ?? 0.5;
    }

    const effectiveDef = defenderStats.def + (nearestEnemy.directive === 'hold' ? 1 : 0);
    const damage = Math.max(1, Math.floor(atk - effectiveDef * terrainDef));
    nearestEnemy.hp -= damage;

    const label = firingPlayer === 'player1' ? 'P1' : 'P2';
    state.pendingEvents.push({
      type: 'mortar-fire',
      actingPlayer: firingPlayer,
      message: `${label} mortar dealt ${damage} damage`,
    });

    if (nearestEnemy.hp <= 0) {
      removeUnit(state.players[enemyPlayer].units, nearestEnemy.id);
      state.round.unitsKilledThisRound[firingPlayer] += 1;
    }
  }
}
```

Call `fireMortars` in `executeTurn`, after directive execution and before city ownership update:
```typescript
// Mortar buildings fire (after all units have moved)
fireMortars(state, currentPlayer);
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run game-state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/game-state.ts packages/engine/src/game-state.test.ts
git commit -m "feat: add mortar firing phase after unit actions"
```

---

### Task 11: Round Lifecycle — Clear Buildings

**Files:**
- Modify: `packages/engine/src/game-state.ts`
- Modify: `packages/engine/src/game-state.test.ts`

**Step 1: Write the failing test**

Add to `game-state.test.ts`:
```typescript
describe('round lifecycle buildings', () => {
  it('clears all buildings when a new round starts', () => {
    resetUnitIdCounter();
    const state = createGame(42);
    placeUnit(state, 'player1', 'infantry', state.map.player1Deployment[0]!);
    placeUnit(state, 'player2', 'infantry', state.map.player2Deployment[0]!);
    startBattlePhase(state);

    // Manually add some buildings
    const { createBuilding, resetBuildingIdCounter } = await import('./buildings');
    resetBuildingIdCounter();
    state.buildings.push(
      createBuilding('recon-tower', 'player1', createHex(3, 3)),
      createBuilding('mines', 'player2', createHex(4, 4)),
    );

    expect(state.buildings.length).toBe(2);

    // Score the round (triggers next round transition)
    scoreRound(state, 'player1');

    expect(state.buildings.length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run game-state.test.ts`
Expected: FAIL — buildings not cleared.

**Step 3: Write minimal implementation**

In `scoreRound` in `game-state.ts`, add after `state.round.unitsKilledThisRound = { player1: 0, player2: 0 };`:
```typescript
// Clear all buildings for the new round
state.buildings = [];
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run game-state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/game-state.ts packages/engine/src/game-state.test.ts
git commit -m "feat: clear buildings between rounds"
```

---

### Task 12: Serialization

**Files:**
- Modify: `packages/engine/src/serialization.ts`
- Modify: `packages/engine/src/serialization.test.ts`

**Step 1: Write the failing test**

Add to `serialization.test.ts`:
```typescript
describe('building serialization', () => {
  it('round-trips buildings through serialize/deserialize', () => {
    const state = createGame(42);
    const { createBuilding, resetBuildingIdCounter } = await import('./buildings');
    resetBuildingIdCounter();
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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && pnpm test -- --run serialization.test.ts`
Expected: FAIL — buildings not serialized.

**Step 3: Write minimal implementation**

1. Add `SerializableBuilding` interface and `buildings` field to `SerializableGameState`:
```typescript
interface SerializableBuilding {
  readonly id: string;
  readonly type: BuildingType;
  readonly owner: PlayerId;
  readonly position: CubeCoord;
  readonly isRevealed: boolean;
}

export interface SerializableGameState {
  // ... existing fields ...
  buildings: SerializableBuilding[];
}
```

2. In `serializeGameState`, add:
```typescript
buildings: state.buildings.map((b) => ({
  id: b.id,
  type: b.type,
  owner: b.owner,
  position: { ...b.position },
  isRevealed: b.isRevealed,
})),
```

3. In `deserializeGameState`, add:
```typescript
buildings: (data.buildings ?? []).map((b) => ({
  id: b.id,
  type: b.type,
  owner: b.owner,
  position: { ...b.position },
  isRevealed: b.isRevealed,
})),
```

Import `BuildingType` in the type imports.

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && pnpm test -- --run serialization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/serialization.ts packages/engine/src/serialization.test.ts
git commit -m "feat: serialize and deserialize buildings"
```

---

### Task 13: Engineer in Terrain/Pathfinding

**Files:**
- Modify: `packages/engine/src/terrain.ts`

**Step 1: Verify engineer works with existing terrain rules**

Engineers should behave like other non-infantry units for terrain (cannot cross mountains). Check `getMoveCost` in `terrain.ts:38-48`. The `infantryOnly` check uses `unitType !== 'infantry'`, which already blocks engineers from mountains. No code change needed.

**Step 2: Run full test suite**

Run: `cd packages/engine && pnpm test`
Expected: All pass. Engineer pathfinding uses existing `findPath` which calls `getMoveCost`.

**Step 3: Commit (skip if no changes)**

No commit needed — this is a verification step.

---

### Task 14: Index Exports

**Files:**
- Modify: `packages/engine/src/index.ts`

**Step 1: Add building exports**

Add to `index.ts`:
```typescript
// Types (add to existing type export block)
export type { BuildingType, BuildingStats, Building } from './types';

// Buildings
export { BUILDING_STATS, createBuilding, validateBuild, resetBuildingIdCounter } from './buildings';
export type { BuildValidation } from './buildings';
```

**Step 2: Run full test suite**

Run: `cd packages/engine && pnpm test`
Expected: All pass.

**Step 3: Commit**

```bash
git add packages/engine/src/index.ts
git commit -m "feat: export building types and utilities from engine"
```

---

### Task 15: Final Integration Test

**Files:**
- Modify: `packages/engine/src/integration.test.ts`

**Step 1: Write integration test**

Add a test that exercises the full engineer + building lifecycle:
```typescript
describe('engineer building lifecycle', () => {
  it('engineer builds, building functions, cleared on round end', () => {
    resetUnitIdCounter();
    const state = createGame(42);

    // Place engineer
    placeUnit(state, 'player1', 'engineer', state.map.player1Deployment[0]!);
    placeUnit(state, 'player2', 'infantry', state.map.player2Deployment[0]!);
    startBattlePhase(state);

    const engineer = state.players.player1.units[0]!;

    // Find valid build hex
    const buildHex = hexNeighbors(engineer.position).find((h) => {
      const key = hexToKey(h);
      const dzKeys = new Set([
        ...state.map.player1Deployment.map(hexToKey),
        ...state.map.player2Deployment.map(hexToKey),
      ]);
      return state.map.terrain.has(key)
        && state.map.terrain.get(key) !== 'mountain'
        && !dzKeys.has(key);
    })!;

    // Build command
    executeTurn(state, [
      { type: 'direct-build', unitId: engineer.id, buildingType: 'recon-tower', targetHex: buildHex },
    ]);

    expect(state.buildings.length).toBe(1);
    expect(state.buildings[0]!.type).toBe('recon-tower');
  });
});
```

**Step 2: Run full test suite**

Run: `cd packages/engine && pnpm test`
Expected: All pass.

**Step 3: Commit**

```bash
git add packages/engine/src/integration.test.ts
git commit -m "test: add engineer building lifecycle integration test"
```

---

### Task 16: Final Verification

**Step 1: Run all tests**

Run: `cd packages/engine && pnpm test`
Expected: All pass, no regressions.

**Step 2: Build**

Run: `pnpm build`
Expected: Clean build, no type errors.

**Step 3: Format**

Run: `pnpm format`

**Step 4: Final commit if any formatting changes**

```bash
git add -A
git commit -m "chore: format"
```
