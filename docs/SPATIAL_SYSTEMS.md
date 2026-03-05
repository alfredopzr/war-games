# Spatial Systems

Everything about how HexWar represents, transforms, and renders positions.

---

## 1. Coordinate System

### Cube Coordinates (game logic)

All game logic operates on **cube coordinates** `(q, r, s)` where `q + r + s = 0`.

```
CubeCoord { q: number, r: number, s: number }
```

Defined in `engine/src/types.ts:13-17`. The `s` component is redundant but kept explicit for distance/direction math.

Grid layout is **flat-top hex, offset-column**:
- Column = `q`
- Row = `r + floor(q / 2)`
- Valid when `col ∈ [0, width)` and `row ∈ [0, height)`

Grid enumeration (`hex.ts:77-87`):
```
for col 0..width-1, row 0..height-1:
  q = col
  r = row - floor(col / 2)
```

Serialized as `"q,r"` string keys for `Map<string, T>` lookups (`hexToKey` at `hex.ts:54`).

### World Coordinates (spatial position)

`world.ts` is the **single source of truth** for converting hex grid positions to 3D space.

```
WorldCoord { x: number, y: number, z: number }
```

Layout: flat-top hexes in the **XZ plane**, **Y-up** for elevation.

```typescript
hexToWorld(hex, elevation = 0): WorldCoord
  x = WORLD_HEX_SIZE * 1.5 * q
  z = WORLD_HEX_SIZE * (√3/2 * q + √3 * r)
  y = elevation * WORLD_ELEV_STEP

worldToHex(x, z): CubeCoord
  q = (2/3) * x / WORLD_HEX_SIZE
  r = (-1/3 * x + √3/3 * z) / WORLD_HEX_SIZE
  cubeRound(q, r, -q - r)
```

Constants (`world.ts:18,21`):
- `WORLD_HEX_SIZE = 1.0` — circumradius (center to corner)
- `WORLD_ELEV_STEP = 0.5` — Y offset per elevation level

`hexWorldVertices(hex, elevation)` returns 6 vertex positions for flat-top hex geometry, starting at 0° going counter-clockwise in 60° increments (`world.ts:69-84`).

### Architectural Contract

**Engine owns all coordinate math.** Renderers consume `hexToWorld` / `worldToHex` and apply camera projection only. No renderer should compute hex-to-position formulas independently.

The old PixiJS renderer (`hex-render.ts`) violates this — it has its own `hexToPixel`, `pixelToHex`, `screenToHex` with `ISO_Y_SCALE` compression and `yFlip`. This is slated for deletion as part of the Three.js migration.

After migration:
- `hexToPixel` / `pixelToHex` / `screenToHex` → deleted
- `ISO_Y_SCALE`, `ELEVATION_PX` → deleted
- Click detection → Three.js raycaster to XZ ground plane → `worldToHex(x, z)`
- Map flip → `scene.scale.z = -1` (counter-flip unit rotations)

---

## 2. Hex Grid

### Topology

6-neighbor adjacency. Direction vectors (`hex.ts:11-18`):
```
(+1,  0, -1)   (+1, -1,  0)
( 0, -1, +1)   (-1,  0, +1)
(-1, +1,  0)   ( 0, +1, -1)
```

### Grid Size

20 columns × 14 rows = 280 hexes. Hardcoded in `map-gen.ts:14`:
```typescript
const GRID: GridSize = { width: 20, height: 14 };
```

### Distance

Manhattan distance in cube space (`hex.ts:30-36`):
```
cubeDistance(a, b) = max(|a.q - b.q|, |a.r - b.r|, |a.s - b.s|)
```

Used by: pathfinding heuristic, attack range checks, vision range, city placement spacing.

### Line Drawing

`hexLineDraw(a, b)` at `hex.ts:119-140`. Linear interpolation in cube space with `1e-6` nudge to break ties on hex edges. Returns `distance + 1` hexes from start to end inclusive. Used by vision/LoS system.

---

## 3. Terrain

4 terrain types defined in `terrain.ts:3-36`:

| Type     | Move Cost | Def Mod | Vision Mod | Blocks LoS | Infantry Only |
|----------|-----------|---------|------------|------------|---------------|
| plains   | 1         | 0       | 0          | no         | no            |
| forest   | 2         | +0.25   | 0          | yes        | no            |
| mountain | 3         | +0.4    | +2         | no         | yes           |
| city     | 1         | +0.3    | 0          | no         | no            |

Special rules:
- `flank-left` / `flank-right` directives reduce forest move cost to 1 (`terrain.ts:44`)
- Mountain impassable to non-infantry (returns `Infinity`)

### Elevation

Integer values 0–3 per hex. Stored in `GameMap.elevation: Map<string, number>` (`types.ts:143`).

Generation rules (`map-gen.ts`):
- Mountains clamped to elevation ≥ 2 (`map-gen.ts:166`)
- Cities clamped to elevation ≤ 1 (`map-gen.ts:108`)
- Deployment zones forced to elevation 0 (`map-gen.ts:154-155`)

**Current status: render-only.** Elevation has zero gameplay impact. Pathfinding, combat, and vision all ignore elevation values. They use terrain type properties only.

---

## 4. Pathfinding

A* implementation in `pathfinding.ts`.

```typescript
findPath(start, end, terrainMap, unitType, occupiedHexes, directive?): CubeCoord[] | null
```

- Heuristic: `cubeDistance` (admissible for hex grids)
- Edge cost: `getMoveCost(terrain, unitType, directive)` — terrain-type cost only
- Blocked: impassable terrain (`Infinity` cost), occupied hexes (except destination)
- No elevation/slope cost

`pathCost(path, terrainMap, unitType, directive)` sums terrain costs for each step excluding start hex (`pathfinding.ts:128-146`).

Open set uses a binary min-heap (`min-heap.ts`) for O(log n) extraction. Lazy deletion: duplicates allowed in the heap, stale entries discarded via `closedSet` check after pop. A separate `bestG: Map<string, number>` tracks best g-score per hex for neighbor pruning.

---

## 5. Vision / Line of Sight

`vision.ts` — fog-of-war visibility calculation.

```typescript
calculateVisibility(friendlyUnits, terrainMap): Set<string>
```

Per unit:
1. Effective vision = `UNIT_STATS[type].visionRange + TERRAIN[unitTerrain].visionModifier`
2. For each hex in range, draw `hexLineDraw` from unit to target
3. If any **intermediate** hex (not start, not end) has `blocksLoS = true` (forest), target is not visible
4. The blocking hex itself IS visible (`vision.ts:59-60`)

Special rule — forest concealment (`vision.ts:94-98`):
- Units on forest hexes are only visible to observers at distance ≤ 1 (adjacent)

Vision ranges (`units.ts:7-52`):
- Infantry: 3, Tank: 3, Artillery: 3, Recon: 6
- Mountain terrain grants +2 vision modifier

**Elevation is not used.** High ground does not extend vision. LoS does not check elevation differences.

---

## 6. Combat

`combat.ts` — damage resolution.

```
baseDamage = ATK * typeMultiplier * randomFactor
finalDamage = max(1, floor(baseDamage - DEF * terrainDefense))
```

- `randomFactor` ∈ [0.85, 1.15] — ±15% variance (`combat.ts:24`)
- `typeMultiplier` from `TYPE_ADVANTAGE` matrix (`units.ts:88-93`)
- `terrainDefense` = `TERRAIN[defenderTerrain].defenseModifier`
- Hold directive: +1 DEF (`combat.ts:32`)
- Minimum 1 damage always

Range check (`combat.ts:48-57`):
```typescript
canAttack(attacker, defender): boolean
  distance >= stats.minAttackRange && distance <= stats.attackRange
```

No elevation impact on range or damage.

---

## 7. Map Generation

`map-gen.ts` — noise-based terrain with symmetric mirroring.

### Pipeline

1. Seed → `mulberry32` PRNG (`rng.ts`)
2. Derive two sub-seeds for independent noise layers
3. `createNoiseGenerator(seed)` → 2D value noise with 256-entry permutation table, smoothstep interpolation (`noise.ts`)
4. Sample noise at hex positions scaled by frequency constants

Frequencies (`map-gen.ts:34-35`):
- Terrain noise: `TERRAIN_FREQ = 0.18` (~5-6 hex feature size)
- Elevation noise: `ELEVATION_FREQ = 0.14` (~7 hex feature size)

### Terrain Classification

Noise thresholds (`map-gen.ts:37-41`):
```
value < -0.2  → plains
value < 0.3   → forest
value >= 0.3  → mountain
```

### Zone Layout (offset rows)

- Rows 0–2: Player 1 deployment (60 hexes) — plains/forest only, elevation 0
- Rows 3–10: Neutral zone — full noise-based terrain + elevation
- Rows 11–13: Player 2 deployment — mirror of rows 0–2

### Symmetry

Top half (rows 0–6) is generated, then mirrored to bottom half (rows 13–7). Non-city terrain and elevation are symmetric. Cities can be asymmetric due to sectored placement (`map-gen.ts:139-174`).

### City Placement

`placeSectoredCities` at `map-gen.ts:53-112`:
- Central objective at offset `(10, 7)` — always city, elevation 0
- 3 column sectors: `[0-5]`, `[6-13]`, `[14-19]`
- Each sector places 1 city pair (top + mirrored bottom) — 6 + 1 central = 7 total
- Minimum spacing: `cubeDistance >= 3` between any two cities
- Prefer candidates with elevation ≤ 1

### Validation

`validateMap` at `map-gen.ts:193-307` checks:
- 280 terrain entries, 280 elevation entries
- Central objective is city
- Exactly 7 cities
- Deployment zones: plains/forest only, elevation 0
- All elevation values in [0, 3]
- City elevation ≤ 2
- Terrain + elevation symmetry (excluding cities)

---

## 8. Rendering Pipeline

### Current State (transitional)

Two renderers coexist:
- **PixiJS** (v8) — terrain hexes, fog, deploy zones, selection highlights, minimap
- **Three.js** — unit models (3D), HP bars (CSS2DRenderer)

PixiJS uses its own coordinate transform (`hex-render.ts`) with `ISO_Y_SCALE = 0.55` Y-compression and a `yFlip` toggle. Three.js syncs its orthographic camera to match the PixiJS stage transform (`three-scene.ts:68-94`).

This dual-renderer setup causes coordinate system duplication and camera sync complexity.

### Target State (Three.js sole renderer)

Three.js owns everything. PixiJS is removed entirely.

- OrthographicCamera tilted 30-35° for isometric perspective
- Terrain: hex meshes positioned via `hexToWorld`, camera tilt provides isometric look
- Units: GLB models loaded per `MODEL_MANIFEST` in `constants.ts:67-80`
- Fog: shader or geometry overlay
- Click detection: `Raycaster` → XZ ground plane intersection → `worldToHex(x, z)`
- Map flip: `scene.scale.z = -1`, counter-flip unit model rotations

No pixel-space hex math. No `ISO_Y_SCALE`. No `hexToPixel`.

### Model Manifest

Two factions (`constants.ts:54-80`):
- `engineer` (player 1): infantry, tank, artillery, scout GLBs
- `caravaner` (player 2): infantry, tank, artillery, scout GLBs

Paths: `/models/{type}_{faction}.glb`

---

## 9. Serialization

`serialization.ts` converts `GameState` (uses `Map` and `Set`) to/from plain objects for JSON transport.

Key conversions:
- `Map<string, TerrainType>` ↔ `Record<string, TerrainType>`
- `Map<string, number>` (elevation) ↔ `Record<string, number>`
- `Map<string, PlayerId | null>` (city ownership) ↔ `Record<string, PlayerId | null>`
- `Set<string>` (commanded unit IDs) ↔ `string[]`

Elevation is included in both `serializeGameMap` and `deserializeGameMap` (`serialization.ts:85-102`, `168-192`).

---

## 10. What Elevation Does Not Affect (Yet)

These systems currently ignore elevation entirely:

| System | What it uses instead |
|--------|---------------------|
| Pathfinding | `getMoveCost(terrain, unitType, directive)` — terrain type only |
| Combat | `getDefenseModifier(terrain)` — terrain type only |
| Vision range | `TERRAIN[type].visionModifier` — mountain type grants +2, not elevation |
| LoS blocking | `TERRAIN[type].blocksLoS` — forest blocks, not elevation difference |
| Attack range | `cubeDistance` — flat hex distance, no elevation penalty |

To make elevation meaningful, these systems would each need an `elevation: Map<string, number>` parameter and rules for how height differences affect costs, damage, vision, and range.

---

## 11. Math Engine Impact on Spatial Systems

Cross-reference between `GAME_MATH_ENGINE.md` and the systems documented above. What the math engine plans to change, what's settled, what's open, and what neither doc addresses.

---

### 11.1 Movement — SETTLED, needs implementation

The math engine identifies three bugs in the current movement model and specifies fixes for all of them.

**Bug 1: `direct-move` ignores terrain** (GAME_MATH_ENGINE Section 1.4A, risk 8.1)
Current `direct-move` uses `cubeDistance` only — no pathfinding, no terrain cost check. A tank can teleport across mountains. The math engine calls this out explicitly.

**Bug 2: moveRange counts steps, not cost** (Section 1.4B, risk 8.2)
`moveToward()` in `directives.ts:199` uses `min(moveRange, path.length - 1)`. A unit with moveRange 3 takes 3 steps along the A* path regardless of accumulated terrain cost. Forest (cost 2) costs the same as plains (cost 1) for movement budget purposes.

**Bug 3: retreat has the same step-counting issue** (Section 1.4C)

**The fix** (Layer 0.2): Unify all three movement systems into a single `moveUnit()` that:
- Computes A* path
- Walks the path spending a **cost budget** (not step count)
- Stops when budget exhausted or destination reached

**Movement ranges become parametric** (A5):
```
infantry  = floor(mapWidth / 8)
tank      = floor(mapWidth / 7)
recon     = floor(mapWidth / 5)
artillery = floor(mapWidth / 12)
```

**Combat timeline Phase 3** adds step-by-step movement with intercept checks and collision resolution (D4). Movement is no longer instant — each step along the path can trigger enemy intercept fire based on ROE.

**Collision resolution rules** (D4, settled):
- Hunt directive into enemy hex → immediate combat, no counter if flanking
- Two units claiming same empty hex → higher moveRange wins, slower stops one hex short
- Head-on collision → both stop one hex short, adjacent, no combat that tick

No open decisions. This is implementation work.

---

### 11.2 Pathfinding Performance — SETTLED, implemented

**Decision:** Replace linear-scan open set with binary min-heap. Implemented in `min-heap.ts`, consumed by `pathfinding.ts`.

- `MinHeap<PathNode>` with `(a, b) => a.f - b.f` comparator
- Lazy deletion: duplicates pushed to heap, stale entries skipped via `closedSet` after pop
- `bestG: Map<string, number>` replaces the old `openSet.get()` g-score lookup
- O(log n) extraction vs O(n) linear scan
- No `decreaseKey` — unnecessary complexity given lazy deletion
- Public API (`findPath`, `pathCost`) unchanged

At 2800 hexes (10× target) with 20 units: ~640k comparisons vs ~156M with linear scan.

**Additional scaling concern not addressed:** Combat timeline Phase 3 runs intercept checks at each movement step: "for each enemy unit with attackRange covering this hex." This is a spatial query per step per moving unit. At 40×28 with 30+ units, this is more frequent than pathfinding and may need spatial indexing (grid bucket, attack-range lookup table) before pathfinding does. The math engine's Section 4.6 mentions `scoutExplore` O(n²) (risk 8.9) but doesn't flag intercept check scaling.

---

### 11.3 Vision / LoS on Attacks — PARTIALLY SETTLED

**Settled: ground LoS fix** (Layer 2.5)
Add `hexLineDraw` LoS check to `canAttack()`. Artillery can no longer fire through forests and mountains. Currently `canAttack` at `combat.ts:48-57` only checks distance.

**Settled: initiative modifiers are terrain-type, not elevation**
Phase 5 modifiers: "Defender on mountain: −1 response time", "Forest target: attacker +1". These key off `TerrainType`, not elevation value. A unit on a mountain at elevation 2 gets the same modifier as one at elevation 3.

**Open: air domain LoS** (D11, post-MVP)
> "Do planes see through all terrain or are they blocked by elevation?"

This is an open question in D11. It's post-MVP but the answer affects whether `calculateVisibility` needs an elevation parameter or a domain parameter.

---

### 11.4 Map Generation — SETTLED, needs implementation

**Parametric constants** (D10, A6) — all hardcoded values derived from `GRID`:

| Current | Formula | At 40×28 |
|---------|---------|----------|
| Deployment rows 0-2 | `floor(height × 0.2)` | rows 0-5 |
| City sectors [0-5][6-13][14-19] | Derived from width/3 | [0-13][14-26][27-39] |
| City min distance 3 | `floor(width × 0.15)` | 6 |
| City count 7 | `floor(width × height / 40)` | 28 |
| Central objective (10, 7) | `(floor(width/2), floor(height/2))` | (20, 14) |
| maxTurnsPerSide 12 | `floor(width / 2)` | 20 |
| CP_PER_ROUND 4 | `4 + floor((width - 20) / 10)` | 6 |
| Victory cities — | `floor(cityCount × 0.6)` | 17 |

Flank offsets also parametric: `floor(width × 0.25)` replaces hardcoded [-5, -4, -3] / [5, 4, 3] in `directives.ts:69`.

**Noise frequencies** (`TERRAIN_FREQ = 0.18`, `ELEVATION_FREQ = 0.14`) — the math engine doesn't specify whether these should scale with map size. At 40×28, feature size stays the same in absolute hex terms (~5-7 hexes) but becomes proportionally smaller relative to the map. This may or may not be desirable. Not addressed.

---

### 11.5 Damage Formula — SETTLED, spatial implication

Current formula (`combat.ts:35-36`):
```
finalDamage = max(1, floor(baseDamage - effectiveDef * terrainDef))
```

Math engine target (A3):
```
finalDamage = max(1, floor((ATK × typeMultiplier × randomFactor) × (1 - terrainDefense) - DEF))
```

Terrain defense becomes a **percentage reduction** applied before DEF subtraction. This fixes risk 8.5 where DEF does nothing on plains (`terrainDef = 0` → `effectiveDef * 0 = 0`).

No elevation factor in the new formula. Elevation does not affect damage.

---

### 11.6 Win Condition — SETTLED

KotH (hold center hex 2 turns) replaced with multi-city majority capture (D7, A8):
```
victoryCities = floor(totalCities × 0.6)
```

Spatially: eliminates the single `centralObjective` hex as a special spatial entity. All cities are equal. The central objective in `GameMap` (`types.ts:144`) becomes vestigial — the win condition no longer checks it specifically.

---

## 12. Open Decisions That Block Spatial System Changes

### 12.1 Elevation Gameplay Rules — UNDECIDED

The elephant in the room. Both docs acknowledge the gap, neither resolves it.

- `GAME_MATH_ENGINE.md` risk 8.4: "Elevation is cosmetic"
- `SPATIAL_SYSTEMS.md` Section 10: "Elevation does not affect [anything]"
- Combat timeline initiative modifiers: "Mountain defender: −1" — but this is **terrain type**, not elevation height

Elevation data exists (0-3 per hex, generated, serialized, rendered). But no document specifies what elevation **should do** to gameplay. Candidate effects, all needing decisions:

| Effect | Question |
|--------|----------|
| Vision range | Does elevation +1 grant +N vision range? Or is mountain's +2 vision modifier sufficient? |
| LoS over terrain | Can a unit at elevation 3 see over a forest at elevation 1? Does elevation break `blocksLoS`? |
| Movement cost | Does climbing (moving to higher elevation) cost extra? Descending cost less? |
| Defense bonus | Does high ground grant defense beyond terrain type? Additive or multiplicative? |
| Attack range | Does elevation extend ranged attack distance? Artillery at elevation 3 fires farther? |
| Initiative | Does high ground grant response time modifier? (Currently only "mountain terrain" does, regardless of elevation value) |

The math engine's damage formula (A3) has no elevation term. The initiative system's modifiers are terrain-type-keyed. The pathfinding cost function takes terrain type only. None of these have slots for elevation.

**This decision gates:** whether `pathfinding.ts`, `combat.ts`, `vision.ts`, and `terrain.ts` need elevation parameters added to their function signatures. If elevation stays cosmetic, no changes. If any effect is added, multiple spatial systems need signature changes and the math model needs new terms.

### 12.2 Water — Terrain Type or Map Layer? — UNDECIDED

D11 asks explicitly:
> "Is water a terrain type or a separate map layer?"

**If terrain type:** add `'water'` to `TerrainType` union. Slots into existing `terrain: Map<string, TerrainType>`. Pathfinding, vision, combat all handle it through existing `TERRAIN[type]` lookups. Ground units get `Infinity` move cost. Simple.

**If separate map layer:** `GameMap` needs a new field (e.g., `waterMap: Map<string, boolean>` or `domain: Map<string, 'land' | 'water'>`). Every terrain lookup needs to check both layers. Map generation needs a water noise layer or geographic water placement. More complex but allows hexes to have both terrain and water properties (e.g., a forested coast).

This affects: `types.ts` (GameMap), `map-gen.ts` (generation), `terrain.ts` (cost/defense), `pathfinding.ts` (passability), `vision.ts` (LoS), `serialization.ts` (new field). Post-MVP but the architectural choice should be made before water is implemented so the terrain system isn't retrofitted.

### 12.3 Melee Rating Numeric Values — UNDECIDED

D6 defines melee ratings as letter grades (Scout S, Infantry A, Tank D, Artillery F). Layer 1.6 notes these "must be converted to numbers before implementation." No numeric values are specified anywhere.

This gates Phase 7 of the combat timeline. Melee damage needs a formula — is it `meleeRating × something`? Is it a separate damage calc or a multiplier on ATK? The math engine defines the existence of melee but not its math.

---

## 13. Gaps — Not Mentioned in Either Doc

### 13.1 Intercept Zone Spatial Queries at Scale

Combat timeline Phase 3 Step 2 checks "for each enemy unit with attackRange covering this hex" at every step of every moving unit's path. This is a brute-force spatial query: for each of ~30 moving units taking ~3-5 steps each, scan ~30 enemy units and check `cubeDistance ≤ attackRange`.

At 20×14 this is trivial (~4500 distance checks per tick). At 40×28 with more units it grows. The math engine flags `scoutExplore` as O(n²) (risk 8.9) and pathfinding open-set scan (Section 4.6) but never mentions intercept check scaling. If movement becomes step-by-step with intercept checks, this is the most frequently executed spatial query in the game loop.

Likely fine even at 40×28, but worth profiling first since it runs every tick, not just during pathfinding.

### 13.2 Fog of War During Simultaneous Reveal

The combat timeline specifies a reveal animation where both plans play out visibly (Layer 4.3: "Phase 3 → movement arrows animate"). But `calculateVisibility` computes per-player fog from the snapshot state.

Tension: during the reveal animation, do players see enemy movement through fog? The math engine implies full visibility of the tick resolution (the "show your hands" moment). But Phase 8 lists "scout → Reveal all enemy units within visionRange" as a specific directive effect, implying scouts explicitly reveal during the tick.

Two possible models:
- **Full reveal:** both players see everything during the animation playback. Fog only applies during the planning phase. This is the poker "show your hands" model.
- **Fog-gated reveal:** players only see enemy actions they had vision of. Creates information asymmetry in the replay. More realistic but less dramatic.

The math engine doesn't specify which. This affects what the event log contains (all events? or per-player filtered events?) and how the renderer plays it back.

### 13.3 Client-Side Path Preview During Planning

Players need to see projected movement paths for their units during the planning phase before submitting commands. This requires running A* client-side.

Currently the engine's `findPath` runs on the server during turn resolution. For planning UI, the client needs:
- The current terrain map and occupied hexes
- The engine's `findPath` function (already importable from `@hexwar/engine`)
- Movement cost budget (cost-based, not step-based, per the Layer 0.2 fix)

The math engine's Layer 4.1 mentions "CP spending overlay" for the planning UI but doesn't discuss path preview. The path preview is straightforward (just call `findPath` client-side) but the cost-based movement budget (Layer 0.2) must be implemented before the path preview can be accurate.

### 13.4 Map Flip in Simultaneous Resolution

Current map flip is `yFlip` in `hex-render.ts` — each player sees the board with their deployment zone at the bottom. After Three.js migration, this becomes `scene.scale.z = -1`.

With simultaneous resolution, both players plan on their own perspective of the board. During the reveal animation, whose perspective is shown? Options:
- Each player sees from their own perspective (current behavior). Each client flips independently.
- Both see a canonical view during reveal. Neither client flips.

The math engine doesn't discuss this. The Three.js `scene.scale.z = -1` approach supports per-player flip. But if a spectator mode (U5) is added, it needs a third perspective choice. Worth deciding before implementing the reveal animation.

### 13.5 Noise Frequency Scaling With Map Size

Map generation uses fixed noise frequencies (`TERRAIN_FREQ = 0.18`, `ELEVATION_FREQ = 0.14`). The math engine makes all other map constants parametric (A6) but doesn't mention noise frequency.

At 40×28, the same frequency produces features of the same absolute size (~5-7 hexes) on a map that is 4× larger. This means more features, smaller relative to the map. The map will look busier. Whether this is good or bad depends on whether the design wants "same biome size, more biomes" or "proportionally scaled biomes."

If frequencies should scale: `TERRAIN_FREQ = 0.18 * (20 / width)` keeps feature-to-map ratio constant. If they shouldn't scale, leave them fixed. Either way, this needs a conscious decision before scaling to 40×28.
