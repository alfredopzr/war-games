# Spatial Contract Gap Audit

Audit date: 2026-03-05
Auditor: space-auditor
Branch: Chack-Atacc

Scope: All spatial systems in `packages/engine/src/` against design contracts in `docs/LAND_USE.md` and `docs/GAME_MATH_ENGINE.md`. Focus on gaps between the CURRENT rectangular-mirrored system and the PLANNED hex-of-hexes procedural system.

---

## 1. File-by-File Audit

---

### 1.1 `packages/engine/src/hex.ts`

#### Functions & Constants

| Symbol | Type | Current Contract (doc/test/type) | New System Contract |
|--------|------|----------------------------------|---------------------|
| `CUBE_DIRECTIONS` | const (6 directions) | Test: 6 entries, all satisfy q+r+s=0 (`hex.test.ts:242-252`) | Unchanged -- hex directions are universal |
| `createHex(q, r)` | fn | Test: s = -q-r, q+r+s=0 (`hex.test.ts:17-32`) | Unchanged |
| `cubeDistance(a, b)` | fn | Test: 0 for same, 1 for adjacent, symmetric (`hex.test.ts:34-57`) | Unchanged for flat distance. **GAP**: no contract for elevation-weighted distance |
| `hexAdd(a, b)` | fn | Test: component addition, identity (`hex.test.ts:83-96`) | Unchanged |
| `hexSubtract(a, b)` | fn | Test: component subtraction, self=origin (`hex.test.ts:98-111`) | Unchanged |
| `hexNeighbors(hex)` | fn | Test: 6 neighbors, all dist 1, all valid cube (`hex.test.ts:59-81`) | Unchanged |
| `hexToKey(hex)` | fn | Test: "q,r" format (`hex.test.ts:113-122`) | Unchanged |
| `isValidHex(hex, grid)` | fn | Test: offset-based bounds check for rectangular grid (`hex.test.ts:124-160`) | **GAP: STRUCTURAL** -- uses `GridSize {width, height}` rectangular bounds. Hex-of-hexes boundary is a hex radius check, not col/row bounds. This function is incompatible with the new system. |
| `getAllHexes(grid)` | fn | Test: returns width*height hexes, all valid (`hex.test.ts:162-184`) | **GAP: STRUCTURAL** -- enumerates rectangular grid. New system needs `hexesInRadius(center, radius)`. LAND_USE.md Phase 1 explicitly calls for adding this. |
| `cubeRound(q, r, s)` | fn | Test: rounds fractional coords, maintains constraint (`hex.test.ts:230-240`) | Unchanged |
| `hexLineDraw(a, b)` | fn | Test: correct length, consecutive adjacency, cube constraint (`hex.test.ts:186-228`) | **GAP: SEMANTIC** -- no elevation awareness. New LoS algorithm (LAND_USE.md "Elevation-Aware Line of Sight") requires interpolating elevation along the line. `hexLineDraw` returns 2D hex coords only. A new function or wrapper is needed. |

**Missing from hex.ts for new system:**
- `hexesInRadius(center, radius)` -- called out in LAND_USE.md Phase 1 implementation plan. No function, no contract, no test.
- `hexRing(center, radius)` -- needed for deploy zone edge calculation and mountain blend rings. No contract.

---

### 1.2 `packages/engine/src/world.ts`

#### Functions & Constants

| Symbol | Type | Current Contract | New System Contract |
|--------|------|------------------|---------------------|
| `WORLD_HEX_SIZE` | const = 1.0 | Test: used in vertex distance check (`world.test.ts:54-63`) | Unchanged |
| `WORLD_ELEV_STEP` | const = 0.5 | Test: elevation 3 -> y=1.5 (`world.test.ts:19-23`) | **GAP: STRUCTURAL** -- LAND_USE.md says "replace `WORLD_ELEV_STEP` with `WORLD_ELEV_SCALE`". Current integer elevation * 0.5 must become float elevation * `WORLD_ELEV_SCALE`. `WORLD_ELEV_SCALE` is listed as "Needs value" in LAND_USE.md (reference: 0.15). No contract for the new constant. |
| `hexToWorld(hex, elevation)` | fn | Test: origin mapping, q-axis, elevation y (`world.test.ts:5-23`) | Needs update: `y = elevation * WORLD_ELEV_SCALE` instead of `elevation * WORLD_ELEV_STEP`. Every consumer of `hexToWorld` that passes integer elevation will get different Y values. **GAP: SEMANTIC** -- no contract defining which callers need updating. |
| `worldToHex(x, z)` | fn | Test: round-trip for 11x11 grid (`world.test.ts:25-46`) | Unchanged (ignores Y) |
| `hexWorldVertices(hex, elevation)` | fn | Test: 6 verts, distance from center, elevation Y (`world.test.ts:48-72`) | Same issue as `hexToWorld` -- elevation scaling changes. |

---

### 1.3 `packages/engine/src/terrain.ts`

#### Functions & Constants

| Symbol | Type | Current Contract | New System Contract |
|--------|------|------------------|---------------------|
| `TERRAIN` | const record | Test: exact values for all 4 types (`terrain.test.ts:5-49`). Doc: LAND_USE.md table matches. | **GAP: SEMANTIC** -- `visionModifier` field. LAND_USE.md says "Vision is elevation-based, not terrain-based." Mountain currently has `visionModifier: 2`. The new system uses `floor(sqrt(elevation))`. The field should be removed or ignored, but no contract says so. The test (`terrain.test.ts:29`) asserts `visionModifier: 2` for mountain. |
| `getMoveCost(terrain, unitType, directive)` | fn | Test: Infinity for vehicles on mountain, flank reduces forest, all combos (`terrain.test.ts:51-102`) | **GAP: BALANCE** -- no elevation cost. GAME_MATH_ENGINE.md 8.4 flags "Elevation Is Cosmetic". LAND_USE.md mountain elevation goes 0-20. No contract says climbing costs more movement. With float elevation and real mountains, this is a design decision without a contract. |
| `getDefenseModifier(terrain)` | fn | Test: exact values (`terrain.test.ts:104-120`) | **GAP: BALANCE** -- no elevation defense bonus. No contract for high-ground advantage. |
| `getVisionModifier(terrain)` | fn | Test: mountain=2, others=0 (`terrain.test.ts:122-138`) | **GAP: STRUCTURAL** -- this function is obsolete under the new vision model. `floor(sqrt(elevation))` replaces terrain-based vision modifiers. No contract for removal. Currently consumed by `vision.ts:34`. |

---

### 1.4 `packages/engine/src/vision.ts`

#### Functions

| Symbol | Type | Current Contract | New System Contract |
|--------|------|------------------|---------------------|
| `calculateVisibility(friendlyUnits, terrainMap)` | fn | Test: range check, forest blocks LoS, mountain +2 vision, multi-unit merge (`vision.test.ts:31-112`) | **GAP: STRUCTURAL** -- function signature has no elevation map parameter. New system needs elevation for: (1) vision bonus = `floor(sqrt(elevation))`, (2) elevation-aware LoS blocking. The entire function must be rewritten. No contract exists for the new version. |
| `isUnitVisible(target, observingUnits, terrainMap)` | fn | Test: forest concealment (adjacent only), plains visibility (`vision.test.ts:118-150`) | **GAP: SEMANTIC** -- forest concealment rule says "only adjacent observers can see units in forest." LAND_USE.md says "you can see OVER forests from high ground." These two rules conflict. If a unit is on a peak (elev 20), can it see a unit in a forest at distance 5? The forest concealment check in `isUnitVisible` (`vision.ts:94-98`) short-circuits before any elevation LoS check. No contract resolves this. |

**Missing contracts for new vision system:**
- `visionBonus = floor(sqrt(elevation))` -- stated in LAND_USE.md, no test, no function.
- Elevation-aware LoS algorithm -- pseudocode in LAND_USE.md, no test, no function.
- Interaction between forest `blocksLoS` and elevation LoS -- LAND_USE.md says forest blocks, mountain doesn't. But at what effective height does a forest block? Is it `elevC + treeline_height`? No contract.

---

### 1.5 `packages/engine/src/map-gen.ts`

#### Functions & Constants

| Symbol | Type | Current Contract | New System Contract |
|--------|------|------------------|---------------------|
| `GRID` | const {width:20, height:14} | Test: 280 hexes (`map-gen.test.ts:7-10`) | **GAP: STRUCTURAL** -- entirely replaced. New system uses `R_MACRO` and `R_MINI`. Both listed as "Needs value" in LAND_USE.md. No contract for valid ranges. |
| `cubeToOffsetRow(hex)` | internal fn | Used by `validateMap` symmetry check | Obsolete -- no offset rows in hex-of-hexes. |
| `offsetToHex(col, row)` | internal fn | Used throughout map-gen | Obsolete. |
| `mirrorOffsetRow(row)` | internal fn | Mirror symmetry | **GAP: STRUCTURAL** -- explicitly removed. LAND_USE.md: "No mirroring." |
| `TERRAIN_FREQ` | const = 0.18 | No direct test | Replaced by `LAND_NOISE_FREQ` (needs value). |
| `ELEVATION_FREQ` | const = 0.14 | No direct test | Replaced by `ELEV_NOISE_FREQ` (needs value). |
| `noiseToTerrain(value)` | internal fn | No direct test, implicit via `generateMap` tests | **GAP: STRUCTURAL** -- new system assigns land use at macro-hex level, not per mini-hex. Noise thresholds and distribution targets (`LAND_PCT_*`) have no values assigned. |
| `noiseToElevation(value)` | internal fn | Implicit: values in [0,3], integers | **GAP: STRUCTURAL** -- new system uses float elevation `[0, MTN_PEAK_MAX]`. Integer clamping is removed. No contract for float range validation. |
| `placeSectoredCities(...)` | internal fn | Test: 7 cities, min dist 3, spread across halves (`map-gen.test.ts:28-127`) | **GAP: STRUCTURAL** -- sector-based placement assumes 20-col map with 3 sectors. New system uses `CITY_COUNT`, `CITY_MIN_DIST`, `CITY_MIN_DEPLOY_DIST` (all "needs value"). No contract for city placement on hex-of-hexes. |
| `generateMap(seed?)` | fn | Test: 280 hexes, city count, deploy zones, symmetry, determinism (`map-gen.test.ts:6-108`) | **GAP: STRUCTURAL** -- full rewrite per LAND_USE.md Phase 1. Every test is obsolete. No test contracts exist for the new system. |
| `validateMap(map)` | fn | Test: grid size, central objective, city count=7, deploy terrain, symmetry (`map-gen.test.ts:192-269`) | **GAP: STRUCTURAL** -- every validation rule changes. Symmetry check is removed. City count is parameterized. Grid size concept changes to hex radius. No new validation contracts. |

**Missing contracts for new map-gen:**
- Hex-of-hexes tiling: no contract ensures macro-hexes tile without gaps/overlaps.
- Macro-hex boundary assignment: no contract for which mini-hex belongs to which macro-hex when equidistant from two macro-hex centers.
- Mountain elevation algorithm: pseudocode in LAND_USE.md but no testable contract (input -> expected output).
- Mountain-to-mountain blend: described in LAND_USE.md but no contract for blend ring behavior.
- Mountain-to-non-mountain cliff: described as "drop to sheer face down to elevation 0" but no contract for what "outermost mini-hexes" means precisely.
- Deploy zone placement: LAND_USE.md describes "opposite edges" for 2 players. `DEPLOY_P1_DIR` is a hex direction index 0-5. No contract for N-player (2-5) corner placement.
- Fairness rejection: pseudocode in LAND_USE.md but no contract for thresholds (all "needs value"), no test.
- Land use adjacency rules: 5 rules listed in LAND_USE.md, all with "needs value" parameters.

---

### 1.6 `packages/engine/src/noise.ts`

#### Functions

| Symbol | Type | Current Contract | New System Contract |
|--------|------|------------------|---------------------|
| `createNoiseGenerator(seed)` | fn | No dedicated test file. Implicitly tested via map-gen determinism. | **GAP: OPERATIONAL** -- LAND_USE.md mountain algorithm requires directional noise with multiple octaves (`MTN_DIR_OCTAVES`). Current noise generator is single-octave value noise. No contract for multi-octave noise. No contract for noise quality (gradient noise vs value noise -- value noise has visible grid artifacts at low frequency). |

**Missing:**
- No test file for `noise.ts`.
- No contract for noise output distribution (is it uniform in [-1,1]? It is not -- value noise with smoothstep is not uniformly distributed).
- Mountain elevation algorithm uses `noise(cos(angle)*3, sin(angle)*3)` -- angular noise in polar coordinates. No contract that the noise generator handles this use case correctly.

---

### 1.7 `packages/engine/src/rng.ts`

#### Functions

| Symbol | Type | Current Contract | New System Contract |
|--------|------|------------------|---------------------|
| `mulberry32(seed)` | fn | No dedicated test. Implicitly tested via map-gen determinism. | **GAP: OPERATIONAL** -- no statistical quality test. Fairness rejection depends on RNG quality. If mulberry32 has correlation patterns at specific seed ranges, fairness metrics could be systematically biased. No contract for distribution uniformity or period length. |

---

### 1.8 `packages/engine/src/types.ts` (terrain/map/grid sections)

#### Types

| Symbol | Type | Current Contract | New System Contract |
|--------|------|------------------|---------------------|
| `GridSize` | interface {width, height} | Used by `isValidHex`, `getAllHexes`, map-gen | **GAP: STRUCTURAL** -- rectangular concept. Hex-of-hexes needs `{macroRadius: number, miniRadius: number}`. LAND_USE.md Phase 1 calls for new `MacroHex` type. |
| `TerrainDefinition` | interface | Has `visionModifier: number` | **GAP: SEMANTIC** -- `visionModifier` field is obsolete in new vision model. No contract for removal or deprecation. |
| `HexTile` | interface {coord, terrain, elevation} | `elevation: number` | **GAP: SEMANTIC** -- currently integer in practice. New system is float. Type is `number` so technically compatible, but all consumers assume integers (`validateMap` checks `Number.isInteger(elev)` at `map-gen.ts:254`). |
| `GameMap` | interface | Has `centralObjective`, `player1Deployment`, `player2Deployment`, `gridSize` | **GAP: STRUCTURAL** -- needs: macro-hex data, N-player deployment arrays, no `centralObjective` (multi-city win), hex boundary radius instead of `GridSize`. No `MacroHex` type exists. |
| `PlayerId` | type = 'player1' \| 'player2' | Hardcoded 2-player | **GAP: STRUCTURAL** -- N-player (2-5) deploy zones described in new system. `PlayerId` union must expand or become generic. |

---

### 1.9 `packages/engine/src/pathfinding.ts`

#### Functions & Types

| Symbol | Type | Current Contract | New System Contract |
|--------|------|------------------|---------------------|
| `PathNode` | internal interface {coord, g, f, parent} | No elevation field | **GAP: SEMANTIC** -- if elevation affects movement cost, `PathNode.g` must account for it. Currently no contract says it should. |
| `findPath(start, end, terrainMap, unitType, occupiedHexes, directive?)` | fn | Test: plains path, mountain avoidance, occupied avoidance, null cases (`pathfinding.test.ts:19-143`) | **GAP: SEMANTIC** -- no elevation parameter. If climbing costs more, `findPath` needs the elevation map. Heuristic uses `cubeDistance` which ignores elevation. With mountains (elevation 0-20), the heuristic underestimates actual cost if elevation is factored, making A* explore more nodes but still producing correct results. **No performance contract.** |
| `pathCost(path, terrainMap, unitType, directive?)` | fn | Test: correct sums, Infinity for impassable (`pathfinding.test.ts:145-179`) | Same gap: no elevation cost component. |
| `reconstructPath(node)` | internal fn | Implicit via `findPath` tests | Unchanged |

---

## 2. Gap Categories

### A. MISSING CONTRACTS FOR THE NEW SYSTEM

| # | Gap | Location | What Exists | What's Missing | Severity |
|---|-----|----------|-------------|----------------|----------|
| A1 | Hex-of-hexes tiling | LAND_USE.md "Hex-of-Hexes" | Prose description. Formula `3R^2+3R+1`. | No function. No test that all mini-hexes in a macro-hex of radius R form a valid, gap-free, overlap-free hex region. No contract for how macro-hex local coords map to global coords. | STRUCTURAL |
| A2 | Macro-hex boundary assignment | LAND_USE.md "Hex-of-Hexes" | "Each macro-hex has exactly ONE land use type. All mini-hexes inherit it." | No contract for equidistant mini-hexes. When a mini-hex is exactly equidistant from two macro-hex centers, which macro-hex owns it? Cube distance ties are common on hex grids. No tiebreaker rule. | STRUCTURAL |
| A3 | Mountain-to-mountain blending | LAND_USE.md "Edge behavior" | "Slopes from both peaks blend over `MTN_BLEND_RINGS` rings." | No blend algorithm. No contract for what "blend" means (max? average? weighted interpolation?). `MTN_BLEND_RINGS` has no value. | SEMANTIC |
| A4 | Deploy zone corner placement for N players | LAND_USE.md "Deploy Zones" | P1 edge direction 0-5, P2 = opposite. | Only 2-player described. No contract for 3, 4, or 5 player corner positions. No contract for what "corner" vs "edge" means for odd player counts. | STRUCTURAL |
| A5 | Fairness rejection thresholds | LAND_USE.md "Fairness Metrics" | 6 metrics listed with pseudocode. | ALL thresholds are "needs value". `MAX_REROLL` is "?". No test. No contract for what happens when `MAX_REROLL` is exhausted ("relaxing thresholds" -- to what?). | BALANCE |
| A6 | Float elevation consumer compatibility | LAND_USE.md "Elevation Scale" | Float range `[0, MTN_PEAK_MAX]`. | `validateMap` (`map-gen.ts:254`) asserts `Number.isInteger(elev)`. `noiseToElevation` floors to integer. `WORLD_ELEV_STEP` assumes integer levels. Every elevation consumer assumes integers. No contract for the float transition. | STRUCTURAL |
| A7 | Vision bonus formula | LAND_USE.md "Vision Range Bonus" | `visionBonus = floor(sqrt(elevation))`. Table of examples. | No function. No test. No code. The current system uses `terrain.visionModifier` (mountain=2). The formula exists only in prose. | SEMANTIC |
| A8 | Elevation-aware LoS | LAND_USE.md "Elevation-Aware Line of Sight" | Pseudocode for sight-line interpolation. | No function. No test. Current `calculateVisibility` has no elevation parameter. The pseudocode checks `elevC > sightHeight AND terrain(C).blocksLoS`. Mountains have `blocksLoS: false`. So a mountain ridge at elev 15 between two ground-level units would NOT block sight. The AND-gate means only forests ever block, regardless of physical obstruction by elevation. This needs explicit contract clarification. | SEMANTIC |
| A9 | `hexesInRadius` utility | LAND_USE.md Phase 1 impl plan | Explicitly listed as needed in `hex.ts`. | No function, no contract, no test. Required for macro-hex enumeration, deploy zones, mountain blend rings, vision range. | STRUCTURAL |
| A10 | `WORLD_ELEV_SCALE` constant | LAND_USE.md "Elevation Scale" | Listed as replacement for `WORLD_ELEV_STEP`. Reference value 0.15. | No constant. No contract. `WORLD_ELEV_STEP = 0.5` still in code. | STRUCTURAL |
| A11 | `MacroHex` type | LAND_USE.md Phase 1 impl plan | "add `MacroHex`, extend `GameMap`" | No type definition. No fields specified beyond prose. | STRUCTURAL |
| A12 | Land use distribution targets | LAND_USE.md "Land Use Distribution" | 4 target percentages + tolerance. | All "needs value". No contract for distribution enforcement algorithm. | BALANCE |
| A13 | Land use adjacency rules | LAND_USE.md "Land Use Adjacency Rules" | 5 rules listed. | All "needs value (boolean or weight)". No algorithm. No contract. | BALANCE |
| A14 | Non-mountain elevation ranges | LAND_USE.md "Non-Mountain Elevation" | 3 terrain-specific `[min, max]` ranges + noise freq. | All "needs value". No contract. Current system has plains/forest/city all using same noise-to-integer elevation. | SEMANTIC |

### C. TERRAIN/ELEVATION INTERACTIONS WITH OTHER SYSTEMS THAT HAVE NO CONTRACT

| # | Gap | What Exists | What's Missing | Severity |
|---|-----|-------------|----------------|----------|
| C1 | Elevation x movement cost | `getMoveCost` reads terrain type only. GAME_MATH_ENGINE.md 8.4: "Elevation Is Cosmetic." | No contract says climbing costs more. With mountains going to elev 20, a unit walking from elev 0 to elev 20 in one step pays the same as walking flat. Design decision is unresolved. | BALANCE |
| C2 | Elevation x combat (high ground bonus) | No code. No design doc section. | No contract for high-ground attack/defense bonus. Common in hex tactics games but explicitly absent here. | BALANCE |
| C3 | Elevation x city capture | Cities can have elevation per `CITY_ELEV_MAX` (needs value). `CITY_ELEV_RANGE` (needs value). | No contract for whether city elevation affects capture mechanics. | SEMANTIC |
| C4 | Forest LoS blocking x elevation | LAND_USE.md: "you can see OVER forests from high ground." `terrain.ts`: forest `blocksLoS: true`. `vision.ts:58`: blocks if `TERRAIN[intermediateTerrain].blocksLoS`. | Current code: forest ALWAYS blocks, regardless of observer elevation. New system: forest blocks only when sight-line height at that hex is below forest canopy. But there is no "forest canopy height" constant. Is it the hex's elevation? Is it `elevation + TREE_HEIGHT`? No contract. | SEMANTIC |
| C5 | Mountain LoS transparency x elevation | LAND_USE.md: "Mountain does NOT block LoS: bare rock doesn't obscure." | A mountain ridge at elev 15 between two ground-level units would be transparent under the pseudocode. The elevation check (`elevC > sightHeight`) is AND-gated with `blocksLoS`, not OR-gated. Contract is internally consistent but may be a design error -- physical mountain mass doesn't block sight. | SEMANTIC |
| C6 | Mountain infantry-only x deploy zones | `terrain.ts:40-42`: vehicles get `Infinity` move cost on mountain. LAND_USE.md Q3: "no mountain macro-hex adjacent to a deploy zone?" marked as open question. | If a deploy zone corner is adjacent to a mountain macro-hex, vehicles placed in that corner can only leave in non-mountain directions. No contract checks this. No adjacency rule prevents it. | BALANCE |
| C7 | A* heuristic accuracy with elevation | `pathfinding.ts:107`: `f = tentativeG + cubeDistance(neighbor, end)`. `cubeDistance` ignores elevation. | If elevation adds to movement cost (C1), the heuristic underestimates, making A* correct but slower. With 3000+ hexes and mountains, A* could explore significantly more nodes. No performance budget contract. GAME_MATH_ENGINE.md 4.6 notes this concern for 2400 hexes. | OPERATIONAL |
| C8 | Forest defense value with elevation-aware vision | `terrain.ts:14`: forest `defenseModifier: 0.25`. Forest concealment: only visible when adjacent (`vision.ts:94-98`). | LAND_USE.md: high ground sees over forests. If enemies on high ground can see into forests, the forest's tactical value (25% defense + concealment) is reduced. But the defense modifier stays 25%. No contract adjusts defense based on whether the attacker has elevation advantage over forest. The concealment rule in `isUnitVisible` short-circuits to "adjacent only" without checking attacker elevation. | BALANCE |
| C9 | Deploy zone terrain fairness | Current: mirrored, so identical. New: no mirror. | LAND_USE.md fairness metric `FAIR_TERRAIN_MIX` exists but threshold is "needs value". Deploy zone specific terrain (`DEPLOY_TERRAIN`) is "needs value". No contract forces deploy zones to have specific terrain composition. | BALANCE |

---

## 3. Summary Table

| ID | File(s) | Gap | Severity |
|----|---------|-----|----------|
| A1 | hex.ts, map-gen.ts | Hex-of-hexes tiling correctness | STRUCTURAL |
| A2 | map-gen.ts | Macro-hex boundary tiebreaker | STRUCTURAL |
| A3 | map-gen.ts | Mountain blend algorithm | SEMANTIC |
| A4 | map-gen.ts, types.ts | N-player deploy zone placement | STRUCTURAL |
| A5 | map-gen.ts | Fairness rejection thresholds (all blank) | BALANCE |
| A6 | map-gen.ts, world.ts, types.ts | Float elevation breaks integer consumers | STRUCTURAL |
| A7 | vision.ts, terrain.ts | Vision bonus formula unimplemented | SEMANTIC |
| A8 | vision.ts | Elevation-aware LoS unimplemented + ambiguity | SEMANTIC |
| A9 | hex.ts | `hexesInRadius` missing | STRUCTURAL |
| A10 | world.ts | `WORLD_ELEV_SCALE` missing | STRUCTURAL |
| A11 | types.ts | `MacroHex` type missing | STRUCTURAL |
| A12 | map-gen.ts | Land use distribution targets blank | BALANCE |
| A13 | map-gen.ts | Adjacency rules blank | BALANCE |
| A14 | map-gen.ts | Non-mountain elevation ranges blank | SEMANTIC |
| C1 | terrain.ts, pathfinding.ts | Elevation x movement cost unresolved | BALANCE |
| C2 | (none) | High ground combat bonus unresolved | BALANCE |
| C3 | map-gen.ts | City elevation effect on capture | SEMANTIC |
| C4 | vision.ts, terrain.ts | Forest LoS x elevation: no canopy height | SEMANTIC |
| C5 | vision.ts | Mountain LoS transparency despite elevation | SEMANTIC |
| C6 | map-gen.ts, terrain.ts | Mountain adjacency to deploy zones | BALANCE |
| C7 | pathfinding.ts | A* heuristic with elevation cost | OPERATIONAL |
| C8 | terrain.ts, vision.ts | Forest defense value under elevation vision | BALANCE |
| C9 | map-gen.ts | Deploy zone terrain fairness | BALANCE |

---

## 4. FAIRNESS RISK REGISTER

Every source of randomness that could create asymmetric advantage in the new system, whether it is instrumented, and what telemetry is needed.

| # | Source of Randomness | Current System | New System | Instrumented? | Bias Mechanism | Telemetry Needed |
|---|---------------------|----------------|------------|---------------|----------------|-----------------|
| F1 | Terrain noise -> land use distribution | Noise assigns terrain per-hex, then mirrored. Symmetric by construction. | Noise assigns land use per macro-hex. No mirror. Constrained by target % +/- tolerance. | NO -- `FAIR_TERRAIN_MIX` metric exists in doc but has no threshold, no code, no logging. | Noise spatial correlation means terrain clusters. One player could face a wall of mountains while the other approaches through plains. | Per-player: count of each terrain type within N macro-hexes of deploy zone. Delta. Logged per seed. |
| F2 | Mountain peak height RNG | N/A (mountains are flat elev 2-3). | Each mountain gets a peak height in `[MTN_PEAK_MIN, MTN_PEAK_MAX]`. "The tallest mountain on the map is forced to `MTN_PEAK_MAX`." | NO | Forcing the tallest peak to max means the first mountain generated that gets the highest random height becomes the forced maximum. If peak assignment is ordered (e.g., by macro-hex iteration order), the forced peak's location is biased toward a specific map region. | Log: which macro-hex gets the forced peak, its distance to each player's deploy zone. |
| F3 | Peak offset from macro-hex center | N/A | `MTN_PEAK_OFFSET`: max cube distance from center for peak placement. | NO | A peak near the edge of a macro-hex creates a lopsided mountain. The steep side faces one direction, the gentle side another. If the steep side faces one player's approach, that player faces a harder climb. | Log: for each mountain, peak offset direction relative to each player's deploy zone. |
| F4 | Directional noise on mountain slopes | N/A | `MTN_DIR_AMP` * noise varies slope steepness by direction. | NO | The noise is per-mountain (seeded from macro-hex coords). One mountain might have gentle slopes facing player 1 and cliffs facing player 2. Across all mountains, this could net out -- or not. | `FAIR_MTN_WALL` metric exists in doc (threshold blank). Log: count of cliff-wall edges facing each player's approach vector. |
| F5 | City placement without mirror | Sectored placement + mirror. 3 sectors ensure spread. Mirrored so equidistant. | Noise-based + constraints (`CITY_MIN_DIST`, `CITY_MIN_DEPLOY_DIST`). No mirror. | PARTIALLY -- `FAIR_CITY_DIST` and `FAIR_CITY_CLUSTER` metrics exist in doc (thresholds blank). | Cities could cluster toward one player's side despite constraints. `CITY_MIN_DEPLOY_DIST` prevents cities too close to deploy, but doesn't prevent all cities being slightly closer to one side. | `FAIR_CITY_DIST`: avg distance from each deploy zone to nearest N cities. `FAIR_PATH_COST`: A* cost from deploy center to each city. Both per player. |
| F6 | Deploy zone terrain composition | Mirrored. Both players get identical terrain. | Not mirrored. Each deploy zone gets terrain from its macro-hex land use. | NO -- `FAIR_TERRAIN_MIX` covers nearby terrain but not deploy zone interior specifically. | One player could deploy in a forest macro-hex (cover), the other in plains (exposed). `DEPLOY_TERRAIN` parameter exists but has no value. | Log: terrain type of each deploy zone macro-hex, per player. |
| F7 | Non-mountain elevation noise | Mirrored. Symmetric. | Noise-based float elevation per non-mountain terrain. `ELEV_NOISE_FREQ` + per-terrain `ELEV_RANGE`. | NO | One player's approach path could be all uphill (moving from low to high elevation toward cities) while the other's is flat or downhill. If elevation eventually costs movement (C1), this is a direct advantage. Even without movement cost, elevation grants vision (`floor(sqrt(elev))`), so the player at higher average elevation in mid-map has better vision. | Log: average elevation along shortest path from each deploy zone to map center and to each city. Per player. |
| F8 | Land use adjacency constraint satisfaction | Mirror eliminates this. | Adjacency rules (mountain clustering, city-city distance, etc.) applied post-generation. Depending on noise, one area may get favorable adjacency while another doesn't. | NO | If forest-plains transition weighting makes one side have smoother terrain gradients (easier pathing) and the other has abrupt mountain-forest borders, movement costs differ. | Log: for each player's approach corridor, count of terrain-type transitions (rough proxy for path cost variation). |
| F9 | Mountain cliff wall orientation | N/A | "Mountain-to-non-mountain border: cliff wall." Cliff walls are directional -- they face outward from the mountain macro-hex. | NO -- `FAIR_MTN_WALL` metric exists (threshold blank). | If mountains cluster on one side of the map, one player faces cliff walls blocking their approach while the other approaches from behind the mountains (gentle slope side). | Log: for each cliff-wall edge, which player's deploy zone it faces. Sum per player. |
| F10 | Macro-hex land use noise seed interaction | N/A | Land use noise frequency `LAND_NOISE_FREQ` + seed determines the entire land use map. | NO | Low-frequency noise can create continent-scale bias -- e.g., all mountains on one side, all plains on the other. The target % constraint corrects totals but not spatial distribution. | Spatial autocorrelation test: is terrain type spatially correlated with distance-to-player? Log correlation coefficient per seed. |
| F11 | City elevation variation | Cities clamped to `CITY_ELEV_MAX`. | `CITY_ELEV_RANGE` (needs value). Cities could be at varying elevations. | NO | A city at elev 5 grants vision bonus +2 to its defender. A city at elev 0 grants none. If cities near one player are elevated and cities near the other are flat, the elevated cities are easier to defend. | Log: elevation of each city, distance-weighted by proximity to each player. |
| F12 | RNG seed determinism + fairness correlation | Same seed -> same map (tested). | Same, but fairness metrics are computed post-generation. | NO -- LAND_USE.md describes Monte Carlo harness logging but no code exists. | Over many games, certain seed ranges might consistently produce maps favoring the player on a specific side. Without instrumentation, this is invisible. | Full fairness metric vector per seed. Correlate with win rate over N games. |

---

## 5. Critical Path Dependencies

The following gaps block implementation of the new system. They must be resolved (design decisions made, values assigned, contracts written) before code can be written:

1. **`R_MACRO` and `R_MINI` values** -- every derived constant depends on these (LAND_USE.md "Map Shape & Size").
2. **`WORLD_ELEV_SCALE` value** -- renderer, vision, and all elevation-consuming systems depend on this (LAND_USE.md "Elevation Scale").
3. **`MTN_PEAK_MAX` value** -- mountain elevation algorithm, vision bonus ceiling, and LoS depend on this (LAND_USE.md "Mountain Elevation").
4. **Elevation x movement cost decision** -- "does climbing cost more?" is a fundamental design choice that changes pathfinding, A* heuristic, movement resolution, and balance. Currently flagged as known risk 8.4 in GAME_MATH_ENGINE.md with no resolution.
5. **Forest canopy height for LoS** -- the elevation-aware LoS algorithm cannot be implemented without defining what height a forest blocks at.
6. **Mountain LoS transparency clarification** -- the pseudocode in LAND_USE.md says mountains don't block LoS. If intentional, a mountain ridge at elev 15 between two ground-level units does not block sight. This needs explicit confirmation because it contradicts physical intuition.
7. **All fairness thresholds** -- without values, the reject/accept system cannot be implemented.
8. **`PlayerId` expansion for N-player** -- or a decision that N-player is deferred.

---

## 6. Notes on Existing Test Coverage

The existing test suite is well-structured for the CURRENT system but provides zero coverage for the new system:

- **`map-gen.test.ts`**: 15 tests, all asserting 20x14, 280 hexes, 7 cities, mirror symmetry, integer elevation [0,3]. Every one becomes invalid.
- **`vision.test.ts`**: 6 tests, all using `terrain.visionModifier` for vision range. None test elevation-based vision.
- **`terrain.test.ts`**: asserts `visionModifier: 2` for mountain -- this value is obsolete in the new system.
- **`pathfinding.test.ts`**: no elevation in any test. No performance test.
- **`world.test.ts`**: asserts `WORLD_ELEV_STEP = 0.5` behavior. Must change to `WORLD_ELEV_SCALE`.
- **`noise.ts`**: no test file exists at all.
- **`rng.ts`**: no test file exists at all.

No test exists for: noise quality, RNG distribution, fairness metrics, hex-of-hexes enumeration, mountain elevation generation, deploy zone placement, or any parameter from LAND_USE.md.
