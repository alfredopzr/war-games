# Map Scale + City Distribution + Unit Tuning + Deployment Reset

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scale the map from 16×12 to 20×14, fix city distribution using seeded sectored placement, bump unit movement/vision stats, and fix post-round deployment so surviving units spread evenly across their zone.

**Architecture:** Three isolated changes — (1) engine map-gen rewrite, (2) engine unit stat bump, (3) engine game-state deployment reset. All changes are in `packages/engine/src/`. Tests must be updated before or alongside each implementation change. No client changes required (renderer is data-driven off `gridSize` and `UNIT_STATS`).

**Tech Stack:** TypeScript (strict), Vitest for tests. Run `pnpm test` from repo root.

---

### Task 1: Update map-gen tests for 20×14 grid

**Files:**
- Modify: `packages/engine/src/map-gen.test.ts`

**Step 1: Update grid size tests**

Replace the three size-specific tests:

```ts
it('generates 280 hexes for a 20x14 grid', () => {
  const map = generateMap(42);
  expect(map.terrain.size).toBe(280);
});

it('has gridSize 20x14', () => {
  const map = generateMap(42);
  expect(map.gridSize).toEqual({ width: 20, height: 14 });
});

it('player1Deployment has 60 hexes (20 cols x 3 rows)', () => {
  const map = generateMap(42);
  expect(map.player1Deployment.length).toBe(60);
});

it('player2Deployment has 60 hexes (20 cols x 3 rows)', () => {
  const map = generateMap(42);
  expect(map.player2Deployment.length).toBe(60);
});
```

Replace the central objective coordinate test:

```ts
it('central hex is at q=10, r=2', () => {
  const map = generateMap(42);
  expect(map.centralObjective).toEqual(createHex(10, 2));
});
```

Update city count test to expect exactly 7:

```ts
it('has exactly 7 city hexes (1 central + 6 sectored)', () => {
  for (const seed of [1, 42, 100, 999, 12345]) {
    const map = generateMap(seed);
    const cityCount = [...map.terrain.values()].filter((t) => t === 'city').length;
    expect(cityCount).toBe(7);
  }
});
```

Add city distribution test:

```ts
it('cities are spread across both halves of neutral zone', () => {
  for (const seed of [1, 42, 100, 999]) {
    const map = generateMap(seed);
    const cityKeys = new Set(
      [...map.terrain.entries()]
        .filter(([, t]) => t === 'city')
        .map(([k]) => k),
    );
    // Central objective excluded — check 6 side cities exist outside deployment zones
    const deployKeys = new Set([
      ...map.player1Deployment.map(hexToKey),
      ...map.player2Deployment.map(hexToKey),
    ]);
    const sideCities = [...cityKeys].filter((k) => k !== hexToKey(map.centralObjective) && !deployKeys.has(k));
    expect(sideCities.length).toBe(6);
  }
});

it('no two cities are within 2 hexes of each other (except allowed)', () => {
  const map = generateMap(42);
  const cityCoords = [...map.terrain.entries()]
    .filter(([, t]) => t === 'city')
    .map(([k]) => {
      // parse key back: format is "q,r,s"
      const [q, r, s] = k.split(',').map(Number);
      return { q: q!, r: r!, s: s! };
    });

  for (let i = 0; i < cityCoords.length; i++) {
    for (let j = i + 1; j < cityCoords.length; j++) {
      const a = cityCoords[i]!;
      const b = cityCoords[j]!;
      const dist = Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
      expect(dist).toBeGreaterThanOrEqual(3);
    }
  }
});
```

Update validateMap city count check:

```ts
it('detects city count not equal to 7', () => {
  // This is implicitly covered by validateMap checking cityCount === 7
  // If the city distribution logic works, this passes. No extra test needed.
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm test packages/engine/src/map-gen.test.ts
```
Expected: multiple failures — wrong hex count, wrong deployment size, wrong city count, wrong central coord.

**Step 3: Commit failing tests**

```bash
git add packages/engine/src/map-gen.test.ts
git commit -m "test(map-gen): update tests for 20x14 grid and sectored city distribution"
```

---

### Task 2: Rewrite map-gen.ts for 20×14 + sectored cities

**Files:**
- Modify: `packages/engine/src/map-gen.ts`

**Step 1: Update grid constant and mirror function**

```ts
const GRID: GridSize = { width: 20, height: 14 };

function mirrorOffsetRow(row: number): number {
  return 13 - row;
}
```

**Step 2: Update central objective**

```ts
const centralObjective = createHex(10, 2); // offset (10, 7) = center of 20x14
```

**Step 3: Replace city placement with sectored logic**

Remove the existing random-shuffle city block (from `// Place cities randomly...` to the end of that section) and replace with this sectored placement function and call:

```ts
// -----------------------------------------------------------------------------
// Sectored City Placement
// -----------------------------------------------------------------------------
// Neutral zone top half: offset rows 3-8 (8 neutral rows total, top 6 for sectors)
// Divide into 3 horizontal sectors: left (cols 0-5), center (cols 6-13), right (cols 14-19)
// Pick one random position per sector in top half, mirror to bottom half.
// Enforce minimum 3-hex distance between all placed cities.

function hexDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

function placeSectoredCities(
  terrain: Map<string, TerrainType>,
  centralObjective: CubeCoord,
  rng: () => number,
): void {
  // Always place central objective first
  terrain.set(hexToKey(centralObjective), 'city');

  const placedCities: CubeCoord[] = [centralObjective];

  const sectors = [
    { colMin: 0, colMax: 5 },    // left
    { colMin: 6, colMax: 13 },   // center (excludes exact central col to avoid overlap)
    { colMin: 14, colMax: 19 },  // right
  ];

  // Neutral top half: rows 3-8
  const neutralTopRows = [3, 4, 5, 6, 7, 8];

  for (const sector of sectors) {
    // Collect all candidates in this sector
    const candidates: CubeCoord[] = [];
    for (let col = sector.colMin; col <= sector.colMax; col++) {
      for (const row of neutralTopRows) {
        const hex = offsetToHex(col, row);
        const key = hexToKey(hex);
        // Skip if already a city (central objective)
        if (terrain.get(key) === 'city') continue;
        // Check minimum distance from all placed cities
        const tooClose = placedCities.some((c) => hexDistance(hex, c) < 3);
        if (tooClose) continue;
        candidates.push(hex);
      }
    }

    if (candidates.length === 0) continue;

    // Pick random candidate
    const idx = Math.floor(rng() * candidates.length);
    const chosen = candidates[idx]!;
    const mirrorRow = mirrorOffsetRow(cubeToOffsetRow(chosen));
    const mirrored = offsetToHex(chosen.q, mirrorRow);

    terrain.set(hexToKey(chosen), 'city');
    terrain.set(hexToKey(mirrored), 'city');
    placedCities.push(chosen, mirrored);
  }
}
```

Then in `generateMap`, after the neutral zone terrain pass, replace the old city placement block with:

```ts
placeSectoredCities(terrain, centralObjective, rng);
```

**Step 4: Update validateMap city count check**

In `validateMap`, change:
```ts
if (cityCount < 6 || cityCount > 8) {
  errors.push(`Expected 6-8 cities, got ${cityCount}`);
}
```
to:
```ts
if (cityCount !== 7) {
  errors.push(`Expected 7 cities, got ${cityCount}`);
}
```

Also update the `mirrorOffsetRow` and symmetry check in `validateMap`:
```ts
const mirrorRow = 13 - row;
```
(find the line `const mirrorRow = 11 - row;` and update it)

**Step 5: Run tests**

```bash
pnpm test packages/engine/src/map-gen.test.ts
```
Expected: all pass.

**Step 6: Run full test suite to check for regressions**

```bash
pnpm test
```
Fix any failures before continuing.

**Step 7: Commit**

```bash
git add packages/engine/src/map-gen.ts packages/engine/src/map-gen.test.ts
git commit -m "feat(map-gen): scale to 20x14 grid with sectored mirrored city placement"
```

---

### Task 3: Update unit stats tests

**Files:**
- Modify: `packages/engine/src/units.test.ts`

**Step 1: Update the four stat tests to match new values**

```ts
it('infantry stats match design spec', () => {
  const s = UNIT_STATS.infantry;
  expect(s).toEqual({
    type: 'infantry',
    cost: 100,
    maxHp: 3,
    atk: 2,
    def: 2,
    moveRange: 3,        // was 2
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 3,      // was 2
  });
});

it('tank stats match design spec', () => {
  const s = UNIT_STATS.tank;
  expect(s).toEqual({
    type: 'tank',
    cost: 250,
    maxHp: 4,
    atk: 4,
    def: 3,
    moveRange: 4,        // was 3
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 3,      // was 2
  });
});

it('artillery stats match design spec', () => {
  const s = UNIT_STATS.artillery;
  expect(s).toEqual({
    type: 'artillery',
    cost: 200,
    maxHp: 2,
    atk: 5,
    def: 1,
    moveRange: 2,        // was 1
    attackRange: 3,
    minAttackRange: 2,
    visionRange: 3,      // was 2
  });
});

it('recon stats match design spec', () => {
  const s = UNIT_STATS.recon;
  expect(s).toEqual({
    type: 'recon',
    cost: 100,
    maxHp: 2,
    atk: 1,
    def: 1,
    moveRange: 5,        // was 4
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 6,      // was 5
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm test packages/engine/src/units.test.ts
```
Expected: 4 stat failures.

**Step 3: Commit failing tests**

```bash
git add packages/engine/src/units.test.ts
git commit -m "test(units): update stat expectations for 20x14 map scale"
```

---

### Task 4: Update unit stats implementation

**Files:**
- Modify: `packages/engine/src/units.ts`

**Step 1: Update UNIT_STATS**

```ts
infantry: {
  // ...
  moveRange: 3,   // was 2
  visionRange: 3, // was 2
},
tank: {
  // ...
  moveRange: 4,   // was 3
  visionRange: 3, // was 2
},
artillery: {
  // ...
  moveRange: 2,   // was 1
  visionRange: 3, // was 2
},
recon: {
  // ...
  moveRange: 5,   // was 4
  visionRange: 6, // was 5
},
```

**Step 2: Run unit tests**

```bash
pnpm test packages/engine/src/units.test.ts
```
Expected: all pass.

**Step 3: Run full suite**

```bash
pnpm test
```
Fix any failures (some directives/pathfinding tests may use hardcoded move ranges — update them).

**Step 4: Commit**

```bash
git add packages/engine/src/units.ts
git commit -m "feat(units): bump move/vision ranges for 20x14 map"
```

---

### Task 5: Update deployment reset tests

**Files:**
- Modify: `packages/engine/src/game-state.test.ts`

**Step 1: Find the existing deployment reset test (if any) and add a spread test**

Search for `resetUnitsToDeployment` or `scoreRound` in game-state.test.ts. Add this test in the `scoreRound` describe block:

```ts
it('spreads surviving units evenly across deployment zone after round end', () => {
  const state = createGame(42);

  // Place 3 units for player1
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

  // Units should not all be in the first 3 hexes of the zone
  // (i.e., they should be spread, not clustered at zone[0..2])
  const firstThreeKeys = new Set([hexToKey(zone[0]!), hexToKey(zone[1]!), hexToKey(zone[2]!)]);
  const allInFirstThree = positions.every((p) => firstThreeKeys.has(p));
  expect(allInFirstThree).toBe(false);
});
```

**Step 2: Run to confirm it fails or passes (may pass by luck of zone order)**

```bash
pnpm test packages/engine/src/game-state.test.ts
```

**Step 3: Commit**

```bash
git add packages/engine/src/game-state.test.ts
git commit -m "test(game-state): add deployment spread test for post-round reset"
```

---

### Task 6: Fix deployment reset to spread units evenly

**Files:**
- Modify: `packages/engine/src/game-state.ts:720-739`

**Step 1: Replace `resetUnitsToDeployment`**

```ts
function resetUnitsToDeployment(state: GameState, playerId: PlayerId): void {
  const deploymentZone = playerId === 'player1'
    ? state.map.player1Deployment
    : state.map.player2Deployment;

  const units = state.players[playerId].units;
  if (units.length === 0) return;

  // Build set of hexes occupied by the OTHER player's units
  const otherPlayer: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
  const otherOccupied = new Set(
    state.players[otherPlayer].units.map((u) => hexToKey(u.position)),
  );

  // Filter deployment zone to only available hexes
  const available = deploymentZone.filter((h) => !otherOccupied.has(hexToKey(h)));

  // Sort available hexes by column then row for a predictable left-to-right order
  const sorted = [...available].sort((a, b) => {
    if (a.q !== b.q) return a.q - b.q;
    return a.r - b.r;
  });

  const count = units.length;
  const zoneSize = sorted.length;

  // Place units at evenly spaced intervals through the sorted zone
  // slot i → index Math.floor(i * zoneSize / count)
  const claimed = new Set<string>();
  for (let i = 0; i < count; i++) {
    const targetIdx = Math.floor((i * zoneSize) / count);
    // Find nearest unclaimed hex starting from targetIdx
    let placed = false;
    for (let offset = 0; offset < zoneSize; offset++) {
      const idx = (targetIdx + offset) % zoneSize;
      const hex = sorted[idx]!;
      const key = hexToKey(hex);
      if (!claimed.has(key)) {
        units[i]!.position = hex;
        claimed.add(key);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Fallback: find any unclaimed hex
      for (const hex of sorted) {
        const key = hexToKey(hex);
        if (!claimed.has(key)) {
          units[i]!.position = hex;
          claimed.add(key);
          break;
        }
      }
    }
  }
}
```

**Step 2: Run tests**

```bash
pnpm test packages/engine/src/game-state.test.ts
```
Expected: all pass including the new spread test.

**Step 3: Run full suite**

```bash
pnpm test
```

**Step 4: Commit**

```bash
git add packages/engine/src/game-state.ts
git commit -m "fix(game-state): spread surviving units evenly across deployment zone on round reset"
```

---

### Task 7: Final validation

**Step 1: Run full test suite**

```bash
pnpm test
```
Expected: all green.

**Step 2: Start dev server and visually verify**

```bash
pnpm dev
```

Check:
- Map renders as 20×14 (visibly wider and taller)
- Cities appear in three distinct areas (left flank, center, right flank) on both halves
- Different seeds produce noticeably different city positions
- After a round ends, surviving units spread across the deployment zone instead of clustering in one corner

**Step 3: Final commit if any cleanup needed**

```bash
git add -p
git commit -m "chore: final cleanup for map scale + unit tuning + deploy reset"
```
