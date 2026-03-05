# Land Use & Map Generation

Single source of truth for terrain types, hex-of-hexes structure, procedural generation parameters, elevation model, vision, prop placement, and fairness instrumentation.

No mirroring. Fully seeded, fully deterministic. Every parameter is a knob the Monte Carlo harness can sweep.

---

## Map Architecture

### Hex-of-Hexes

The map uses a two-level hex grid:

- **Mini-hex** (game hex): the hex units walk on. Pathfinding, combat, LoS all operate here.
- **Macro-hex** (hex-of-hexes): a group of mini-hexes forming a larger hex. Each macro-hex has exactly ONE land use type. All mini-hexes inherit it.

The map boundary is a **hexagonal region** in the macro-grid. The macro-grid is itself a hex grid. The map is a hex of macro-hexes, each macro-hex is a hex of mini-hexes.

### Map Shape & Size

| Parameter | Symbol | Description | Needs value |
|-----------|--------|-------------|-------------|
| Macro-grid radius | `R_MACRO` | Radius of the map in macro-hexes. Total macro-hexes = `3R^2+3R+1`. | ? |
| Mini-hex radius per macro | `R_MINI` | Rings of mini-hexes per macro-hex. Total minis per macro = `3R^2+3R+1`. | ? |
| Total mini-hexes | derived | `(3*R_MACRO^2+3*R_MACRO+1) * (3*R_MINI^2+3*R_MINI+1)` | derived |

Example combos:

| R_MACRO | R_MINI | Macro-hexes | Minis/macro | Total minis |
|---------|--------|-------------|-------------|-------------|
| 2       | 5      | 19          | 91          | 1,729       |
| 3       | 4      | 37          | 61          | 2,257       |
| 3       | 5      | 37          | 91          | 3,367       |
| 4       | 3      | 61          | 37          | 2,257       |

### Elevation Scale

Float range `[0, MTN_PEAK_MAX]`. World height: `elevation * WORLD_ELEV_SCALE` world units.

| Parameter | Symbol | Description | Needs value |
|-----------|--------|-------------|-------------|
| World elevation scale | `WORLD_ELEV_SCALE` | World units per elevation unit | ? |

Reference points (assuming scale = 0.15):

| Elevation | World Y | Context |
|-----------|---------|---------|
| 0         | 0.0     | Deploy zones, flat ground |
| 1         | 0.15    | Gentle rolling plains |
| 3         | 0.45    | Forested hills |
| 10        | 1.50    | Mid-mountain slope |
| 20        | 3.00    | Highest peak on the map |

---

## Terrain Types

Four terrain types. Assigned at the macro-hex level, inherited by all mini-hexes in that macro-hex.

### Current mechanics (from `terrain.ts`)

| Terrain      | Move Cost | Defense | Blocks LoS | Infantry Only |
|--------------|-----------|---------|------------|---------------|
| **Plains**   | 1         | 0%      | No         | No            |
| **Forest**   | 2         | 25%     | Yes        | No            |
| **Mountain** | 3         | 40%     | No         | Yes           |
| **City**     | 1         | 30%     | No         | No            |

Vision is elevation-based, not terrain-based. See **Vision System** below.

Source: `packages/engine/src/terrain.ts`

### Descriptions

**Plains** -- Open ground. Dried earth, cracked asphalt remnants, scattered rubble. No cover. Fastest movement, worst defense.

**Forest** -- Dense overgrowth reclaiming collapsed structures. Blocks LoS. +25% defense. Cost 2 to enter (1 with flank directives). All unit types can enter. Hilly terrain, noise-based elevation.

**Mountain** -- Exposed bedrock and rubble ridges. Infantry only. +40% defense, best vision from elevation. Cost 3. Real elevation geometry (see Mountain Elevation below).

**City** -- Capturable urban hexes. Concrete shells, half-built structures. +30% defense, cost 1. Capture objectives.

---

## Land Use Distribution

Each macro-hex gets exactly one land use type. Distribution is noise-based but constrained by target percentages.

| Parameter | Symbol | Description | Needs value |
|-----------|--------|-------------|-------------|
| Plains target % | `LAND_PCT_PLAINS` | Target fraction of macro-hexes that are plains | ? |
| Forest target % | `LAND_PCT_FOREST` | Target fraction that are forest | ? |
| Mountain target % | `LAND_PCT_MOUNTAIN` | Target fraction that are mountain | ? |
| City target % | `LAND_PCT_CITY` | Target fraction that are city | ? |
| Distribution tolerance | `LAND_PCT_TOLERANCE` | Acceptable deviation from target (e.g., 0.1 = +/-10%) | ? |
| Land use noise frequency | `LAND_NOISE_FREQ` | Spatial frequency of the noise that assigns land use. Low = large biomes, high = checkerboard. | ? |

Sum of targets must equal 1.0. Generator assigns land use via noise, then adjusts outliers to hit target +/- tolerance.

---

## Land Use Adjacency Rules

Constraints on which terrain types can neighbor each other at the macro-hex level.

| Rule | Description | Needs value (boolean or weight) |
|------|-------------|----|
| Mountain-mountain clustering | Mountains prefer to clump (adjacent mountain bonus in noise) | ? (weight 0-1) |
| City-city minimum distance | Minimum macro-hex distance between city macro-hexes | ? |
| City-mountain adjacency | Can a city macro-hex be adjacent to a mountain macro-hex? | ? |
| Forest-plains transition | Do forests prefer to border plains? (smooth biome gradient) | ? (weight 0-1) |
| Deploy zone exclusions | Which land use types are forbidden in/adjacent to deploy zones? | ? |

---

## Deploy Zones

No mirror. Each player gets a deploy zone on opposite edges of the hex map. Fairness is measured, not forced.

| Parameter | Symbol | Description | Needs value |
|-----------|--------|-------------|-------------|
| Deploy zone depth | `DEPLOY_DEPTH` | How many rings of macro-hexes from the edge form the deploy zone | ? |
| Deploy zone land use | `DEPLOY_TERRAIN` | Allowed land use in deploy zones | ? |
| Deploy elevation | `DEPLOY_ELEV` | Forced elevation in deploy zones | ? |
| P1 edge direction | `DEPLOY_P1_DIR` | Which edge of the hex map is P1's deploy zone (0-5, hex direction index) | ? |
| P2 edge direction | `DEPLOY_P2_DIR` | P2's edge. Must be opposite P1: `(P1 + 3) % 6` | derived |

"Edge" of a hex map = all macro-hexes at maximum distance from center along a direction. For a radius-3 hex map, each edge has ~4 macro-hexes.

---

## City Placement

Cities are capturable objectives. Their placement is the single largest balance lever.

| Parameter | Symbol | Description | Needs value |
|-----------|--------|-------------|-------------|
| Total city macro-hexes | `CITY_COUNT` | Total number of macro-hexes assigned city terrain | ? |
| Min distance between cities | `CITY_MIN_DIST` | Minimum macro-hex distance between any two city centers | ? |
| Min distance from deploy edge | `CITY_MIN_DEPLOY_DIST` | Minimum macro-hex distance from any deploy zone macro-hex | ? |
| City elevation cap | `CITY_ELEV_MAX` | Maximum elevation for mini-hexes in a city macro-hex | ? |
| Victory cities | `VICTORY_CITIES` | Number of cities needed to win a round: `floor(CITY_COUNT * VICTORY_CITY_RATIO)` | derived |
| Victory city ratio | `VICTORY_CITY_RATIO` | Fraction of cities needed to win | ? |

---

## Mountain Elevation

Mountains are the only terrain with real 3D elevation. Each mountain macro-hex has one peak. All other terrains are flat or near-flat.

### Parameters

| Parameter | Symbol | Description | Needs value |
|-----------|--------|-------------|-------------|
| Peak height min | `MTN_PEAK_MIN` | Minimum peak height (elevation units) | ? |
| Peak height max | `MTN_PEAK_MAX` | Maximum peak height. The tallest mountain on the map is forced to this. | ? |
| Peak offset range | `MTN_PEAK_OFFSET` | Max cube distance from macro-hex center for peak placement | ? |
| Base elevation | `MTN_BASE_ELEV` | Minimum elevation for any mini-hex in a mountain macro-hex | ? |
| Slope falloff exponent | `MTN_FALLOFF_EXP` | Controls slope steepness: `(1-t)^exp`. 1=linear, 2=quadratic, 3=steep. | ? |
| Directional noise octaves | `MTN_DIR_OCTAVES` | Number of noise octaves for directional slope variation | ? |
| Directional noise amplitude | `MTN_DIR_AMP` | How much direction affects slope (0=uniform, 1=very directional) | ? |
| Cliff threshold | `MTN_CLIFF_DROP` | Elevation drop per mini-hex that triggers cliff wall rendering | ? |
| Mountain-mountain blend range | `MTN_BLEND_RINGS` | How many rings of overlap when two mountain macro-hexes are adjacent | ? |

### Algorithm

For each game hex in a mountain macro-hex:

```
dist = cubeDistance(hex, peakHex)
angle = atan2(worldDZ, worldDX)   // direction from peak to hex

// Directional modifier: noise makes some directions steeper than others
dirFactor = 0.6 + MTN_DIR_AMP * (
  0.5 * noise(cos(angle)*3, sin(angle)*3) +
  0.3 * noise(cos(angle)*7, sin(angle)*7) +
  0.2 * noise(cos(angle)*13, sin(angle)*13)
)

t = min(1.0, (dist * dirFactor) / R_MINI)
falloff = (1 - t) ^ MTN_FALLOFF_EXP

elevation = MTN_BASE_ELEV + (peakHeight - MTN_BASE_ELEV) * falloff
```

Each mountain macro-hex gets its own noise generator (seeded from macro-hex center coords), so every mountain has a unique shape.

### Edge behavior

- **Mountain-to-mountain border**: smooth transition. Slopes from both peaks blend over `MTN_BLEND_RINGS` rings.
- **Mountain-to-non-mountain border**: cliff wall. Outermost mountain mini-hexes drop to a sheer face down to elevation 0.

---

## Non-Mountain Elevation

| Parameter | Symbol | Description | Needs value |
|-----------|--------|-------------|-------------|
| Plains elevation range | `PLAINS_ELEV_RANGE` | `[min, max]` for plains mini-hex elevation | ? |
| Forest elevation range | `FOREST_ELEV_RANGE` | `[min, max]` for forest | ? |
| City elevation range | `CITY_ELEV_RANGE` | `[min, max]` for city | ? |
| Elevation noise frequency | `ELEV_NOISE_FREQ` | Spatial frequency for non-mountain elevation noise | ? |

---

## Vision System

Vision is physics-based, driven by elevation rather than arbitrary terrain modifiers.

### Vision Range Bonus

```
visionBonus = floor(sqrt(elevation))
```

| Elevation | Bonus | Total vision (base 3) |
|-----------|-------|-----------------------|
| 0         | 0     | 3                     |
| 1         | 1     | 4                     |
| 4         | 2     | 5                     |
| 9         | 3     | 6                     |
| 16        | 4     | 7                     |
| 20        | 4     | 7                     |

Scales naturally -- low hills give +1, mid-slopes +2-3, peaks +4. No terrain-specific vision modifier needed.

### Elevation-Aware Line of Sight

A unit at hex A can see hex B only if the sight line clears all intermediate hexes. The sight line is a straight line from A's surface to B's surface.

For each intermediate hex C along the hex line from A to B:

```
// Interpolated sight-line height at hex C's position
progress = stepIndex / totalSteps
sightHeight = elevA + (elevB - elevA) * progress

// Blocked if terrain rises above the sight line
blocked = elevC >= sightHeight AND terrain(C).blocksLoS
```

- **Forest** blocks LoS: trees at elevation 2 block a sight line passing at height 1.5
- **Mountain** does NOT block LoS: bare rock doesn't obscure -- you can see over a ridge if you're high enough
- A unit on a peak (elev 20) looking at a unit on flat ground (elev 0) can see over intermediate forests if the sight line passes above them

High ground gives two advantages: longer vision range AND the ability to see over obstacles.

### Visual Language

Three layered effects communicate altitude-vision to the player:

**1. Fog gradient by elevation**
- Low hexes (elev 0-2): thicker fog overlay, muted colors, reduced contrast
- High hexes (elev 10+): clear, sharper colors, no fog
- Gradient is continuous -- creates natural depth separation
- Applied as a post-process or per-hex material opacity

**2. Vision ring on selection**
- When a unit is selected, its vision radius is shown as a ring
- Ring is larger on elevated hexes (reflecting the bonus)
- Altitude indicators: small upward chevrons or radial tick marks on the ring showing the bonus range vs base range
- Makes the "I can see farther from up here" immediately obvious

**3. Atmospheric haze layers**
- Thin horizontal haze planes at low elevations (Y = 0.3, 0.6)
- Units and hexes below haze appear slightly washed out
- Units above haze appear crisp and dominant
- Haze fades at edges to avoid hard cutoffs
- Reinforces the feeling that high ground = clarity, low ground = obscured

---

## Fairness Metrics (Monte Carlo Instrumentation)

The map is NOT mirrored. Fairness is measured post-generation. Maps that fail fairness thresholds are rejected (re-roll with new seed) or flagged.

Each metric is computed per-player and compared. The delta must be within threshold.

| Metric | Symbol | What it measures | Threshold (needs value) |
|--------|--------|-----------------|------------------------|
| Deploy-to-nearest-city distance | `FAIR_CITY_DIST` | Average macro-hex distance from each player's deploy zone to the nearest N cities | ? |
| Deploy-to-center distance | `FAIR_CENTER_DIST` | Macro-hex distance from deploy zone center to map center | always equal (opposite edges) |
| Accessible terrain composition | `FAIR_TERRAIN_MIX` | Count of each terrain type within N macro-hexes of each deploy zone | ? |
| Average path cost to cities | `FAIR_PATH_COST` | A* cost from deploy center to each city, averaged | ? |
| Mountain wall exposure | `FAIR_MTN_WALL` | Number of cliff-wall edges facing each player's approach direction | ? |
| City clustering bias | `FAIR_CITY_CLUSTER` | Whether cities cluster toward one side of the map | ? |

### Reject-or-accept protocol

```
generate(seed) -> map
compute_fairness(map) -> metrics
for each metric:
  delta = abs(metric_p1 - metric_p2)
  if delta > threshold -> REJECT, try seed+1
if all pass -> ACCEPT
```

Max rejection attempts before relaxing thresholds: `MAX_REROLL` = ?

### Monte Carlo harness integration

Every fairness metric is logged per match alongside game outcome:

```
[MAP_AUDIT] SEED=83921 FAIR_CITY_DIST_P1=2.3 FAIR_CITY_DIST_P2=2.7 DELTA=0.4
[MAP_AUDIT] SEED=83921 FAIR_PATH_COST_P1=14.2 FAIR_PATH_COST_P2=16.1 DELTA=1.9
[MAP_AUDIT] SEED=83921 FAIR_TERRAIN_MIX_P1={plains:4,forest:3,mountain:1,city:2} ...
[MAP_AUDIT] SEED=83921 VERDICT=ACCEPT
```

After N matches on the same seed, correlate `FAIR_*` deltas with win rate delta. If a metric consistently predicts the winner, its threshold is too loose.

---

## Gameplay Constants Derived From Map

These come from GAME_MATH_ENGINE.md A6 but reference the hex-of-hexes structure.

| Parameter | Symbol | Formula | Needs value |
|-----------|--------|---------|-------------|
| Map "width" equivalent | `MAP_SPAN` | Diameter of hex map in mini-hexes: `(2*R_MACRO+1) * (2*R_MINI+1)` approx | derived |
| Infantry move range | | `floor(MAP_SPAN / 8)` | derived |
| Tank move range | | `floor(MAP_SPAN / 7)` | derived |
| Recon move range | | `floor(MAP_SPAN / 5)` | derived |
| Artillery move range | | `floor(MAP_SPAN / 12)` | derived |
| Deployment mini-hex count | | All mini-hexes in deploy-zone macro-hexes | derived |
| Flank offset | | `floor(MAP_SPAN * 0.25)` | derived |
| Max turns per side | | `floor(MAP_SPAN / 2)` | derived |
| CP per round | | `4 + floor((MAP_SPAN - 20) / 10)` | derived |
| Vision ranges | | May need scaling. Currently fixed per unit type. | ? |

---

## Props

Two tiers of static GLB props. All placement is deterministic from the map seed.

### Tier 1: Hex-of-Hex Props (Structural)

Placed at the macro-hex level. One per macro-hex max. These are large structures that affect gameplay: they block movement through their hex, may block LoS, and may serve as capture objectives or action triggers.

| Prop            | File                      | Terrain  | Gameplay Role                                    |
|-----------------|---------------------------|----------|--------------------------------------------------|
| Command Tower   | `prop_command_tower.glb`  | City     | Objective/capture point. Bunker with antenna.    |
| Tall Building   | `prop_building_tall.glb`  | City     | Structural landmark. Multi-story unfinished.     |
| Low Building    | `prop_building_low.glb`   | City     | Structural. Damaged warehouse, collapsed roof.   |
| Crane Arm       | `prop_crane_arm.glb`      | City     | Path blocker. Fallen construction crane.         |
| Boulders        | `prop_boulders.glb`       | Mountain | Path blocker. Massive rock formation with gears. |

Placement rules:
- City macro-hexes: 0-1 structural prop. Command Tower placed on objective cities only.
- Mountain macro-hexes: 0-1 Boulders, placed near peak hex.
- Plains/Forest macro-hexes: no structural props.

### Tier 2: Hex Props (Decorative)

Placed per mini-hex. Render only -- no gameplay effect. Each hex gets 0-N props depending on terrain density.

#### Density caps

| Parameter | Symbol | Description | Needs value |
|-----------|--------|-------------|-------------|
| Plains prop density | `PROP_DENSITY_PLAINS` | Max props per plains mini-hex | ? |
| Forest prop density | `PROP_DENSITY_FOREST` | Max props per forest mini-hex | ? |
| Mountain prop density | `PROP_DENSITY_MOUNTAIN` | Max props per mountain mini-hex | ? |
| City prop density | `PROP_DENSITY_CITY` | Max props per city mini-hex | ? |

#### Plains -- sparse, open ground
| Prop              | File                     | Probability | Max/hex | Scale     |
|-------------------|--------------------------|-------------|---------|-----------|
| Dead grass        | `prop_dead_grass.glb`    | 0.4         | 2       | 0.3--0.5  |
| Small rocks       | `prop_rocks_small.glb`   | 0.3         | 2       | 0.2--0.4  |
| Road stripe       | `prop_road_stripe.glb`   | 0.1         | 1       | 0.4--0.6  |
| Concrete pipe     | `prop_concrete_pipe.glb` | 0.08        | 1       | 0.3--0.5  |
| Survey stakes     | `prop_survey_stakes.glb` | 0.08        | 1       | 0.3--0.4  |
| Tire              | `prop_tire.glb`          | 0.06        | 1       | 0.2--0.3  |

#### Forest -- dense, vertical
| Prop              | File                          | Probability | Max/hex | Scale     |
|-------------------|-------------------------------|-------------|---------|-----------|
| Tree A            | `prop_tree_a.glb`             | 0.7         | 1       | 0.5--0.8  |
| Tree B            | `prop_tree_b.glb`             | 0.5         | 1       | 0.4--0.7  |
| Tree C            | `prop_tree_c.glb`             | 0.3         | 1       | 0.4--0.6  |
| Fallen log        | `prop_fallen_log.glb`         | 0.2         | 1       | 0.3--0.5  |
| Road sign         | `prop_road_sign.glb`          | 0.08        | 1       | 0.3--0.5  |
| Overgrown footing | `prop_overgrown_footing.glb`  | 0.1         | 1       | 0.3--0.5  |

Every forest hex gets at least 1 tree.

#### Mountain -- sparse, monolithic
| Prop              | File                        | Probability | Max/hex | Scale     |
|-------------------|-----------------------------|-------------|---------|-----------|
| Rock peak A       | `prop_rock_peak_a.glb`      | 0.6         | 1       | 0.6--1.0  |
| Rock peak B       | `prop_rock_peak_b.glb`      | 0.4         | 1       | 0.5--0.8  |
| Rock peak C       | `prop_rock_peak_c.glb`      | 0.2         | 1       | 0.4--0.7  |
| Retaining wall    | `prop_retaining_wall.glb`   | 0.1         | 1       | 0.4--0.6  |

Props placed at mini-hex elevation (on the slope).

#### City -- structured, urban
| Prop              | File                        | Probability | Max/hex | Scale     |
|-------------------|-----------------------------|-------------|---------|-----------|
| Jersey barrier    | `prop_jersey_barrier.glb`   | 0.3         | 2       | 0.2--0.3  |
| Utility pole      | `prop_utility_pole.glb`     | 0.2         | 1       | 0.4--0.6  |
| Scaffolding       | `prop_scaffolding.glb`      | 0.15        | 1       | 0.4--0.6  |
| Dumpster          | `prop_dumpster.glb`         | 0.1         | 1       | 0.2--0.3  |

---

## Pipeline: Preview to GLB

26 prop previews exist in `asset_gen_pipeline/previews/`. Pipeline stages 2-4 (multi-view, 3D reconstruction, retexture) convert them to GLB. No rigging or animation -- props are static.

```
previews/prop_*.png  ->  Stage 2 (multi-view)  ->  Stage 3 (3D)  ->  Stage 4 (retexture)  ->  final/prop_*.glb
```

---

## Hex Modifiers (Rivers, Bridges, Highways)

Linear hex-level overlays that modify movement and defense without replacing the underlying terrain. A hex is still plains/forest/mountain/city underneath -- the modifier changes the rules on top.

Source: `packages/engine/src/types.ts`, `packages/engine/src/terrain.ts`

### Data Model

```
type HexModifier = 'highway' | 'river' | 'bridge';
```

Single new field on `GameMap`:

| Field | Type | Description |
|-------|------|-------------|
| `modifiers` | `Map<string, HexModifier>` | Hex key → modifier. Most hexes have no entry. |

The `HexTile` interface carries an optional `modifier` field alongside `terrain` and `elevation`.

Terrain map is **not changed** -- the hex keeps its terrain type. The modifier overrides movement/defense behavior.

### Movement & Defense Rules

Source: `getMoveCost()` and `getDefenseModifier()` in `terrain.ts`

| Modifier | Move Cost | Defense | LoS | Notes |
|----------|-----------|---------|-----|-------|
| `river` | Infinity (impassable) | -- | No | Water. Nothing crosses. |
| `bridge` | 1 (all units) | 0% | No | Only way across a river. Fully exposed. |
| `highway` | 0.5 (vehicles), normal (infantry) | 0% | No | Fast but exposed. Artillery paradise. |
| *(none)* | Normal terrain cost | Normal terrain defense | Normal | Default behavior. |

Modifier checks happen **before** terrain checks in `getMoveCost()`. If a modifier is present it short-circuits the terrain logic. Infantry gets no highway speed benefit -- they move at normal terrain cost even on highway hexes.

### Tactical Implications

- **Highways**: Tanks blitz city-to-city at 0.5 cost. But highways are predictable routes and 0% defense. Artillery can shell a highway from adjacent forest. Infantry in forest next to a highway = ambush doctrine.
- **Rivers**: Impassable barrier. Forces all traffic through bridge chokepoints. Splits the map into zones of control.
- **Bridges**: The only river crossing. Cost 1, 0% defense. Attacking across a bridge = suicide unless you suppress the far bank first.
- **The trifecta**: Highway runs along a river, bridge at one point. Control the bridge, control the highway, control the map.

### Generation

Runs after terrain/elevation assignment (step 7.5 in `generateMapAttempt`). Both rivers and highways are **linear features** carved across the mini-hex grid.

#### Rivers

1. **Source**: Mountain macro-hex edge or high-elevation hex.
2. **Direction**: Flows roughly perpendicular to the deploy-zone axis (barrier between players). Noise-perturbed for natural curves.
3. **Path**: Walk hex-by-hex from source toward map edge, preferring low-elevation neighbors.
4. **Width**: 1 hex base, optionally +1 adjacent hex at noise-controlled points.
5. **Bridges**: 1-2 per river, placed near natural travel corridors. Not too close together, not at endpoints.

#### Highways

1. **Route**: Connect cities. A\* path between 2-3 city macro-hex centers using underlying terrain costs.
2. **Path**: The A\* result is the highway -- stamp `highway` modifier on every hex along the path.
3. **Intersections**: Where highways meet, the hex gets one `highway` modifier (no stacking needed).
4. **River crossings**: If a highway crosses a river, the crossing hex becomes a `bridge` (bridge implies highway connectivity).

#### Parameters

| Parameter | Symbol | Description | Default |
|-----------|--------|-------------|---------|
| Rivers enabled | `RIVER_ENABLED` | Feature flag | `true` |
| River count | `RIVER_COUNT` | Rivers per map | 1 |
| River width | `RIVER_WIDTH` | Base width in hexes | 1 |
| Bridges per river | `BRIDGES_PER_RIVER` | Crossing points per river | 2 |
| Min bridge spacing | `BRIDGE_MIN_SPACING` | Min hex distance between bridges on same river | 5 |
| River deploy buffer | `RIVER_DEPLOY_BUFFER` | Min hex distance from deploy zone hexes | 8 |
| Min river length | `RIVER_MIN_LENGTH` | Minimum hexes in river path | 15 |
| Highways enabled | `HIGHWAY_ENABLED` | Feature flag | `true` |
| Highway count | `HIGHWAY_COUNT` | Number of city-to-city highway routes | 2 |

### Fairness

**Hard constraint**: Both players must have a valid A\* path to every city (rivers cannot partition the map into unreachable zones).

**Soft constraint**: Asymmetric placement is acceptable. One player gets a highway to the central objective, the other gets a mountain flank with vision advantage. Different paths, different doctrine. This is interesting games, not unfair ones.

No strict fairness rerolling for linear features beyond path existence.

### Serialization

- `modifiers` serialized as `Record<string, HexModifier>` (same pattern as terrain map)
- Deserialization rebuilds the `Map<string, HexModifier>` from the record

### Rendering

- **River**: Dark water surface (`~0x2A3040`), flat at elevation 0. Adjacent terrain hexes get darker shoreline border.
- **Bridge**: Terrain-colored with bridge prop model. Elevation 0.
- **Highway**: Asphalt strip overlay on terrain surface. Darker than surrounding terrain. Lane markings as decal/texture.

### Files Changed

**Engine (implemented):**
- `types.ts` -- `HexModifier` type, `modifier?` on `HexTile`, `modifiers` on `GameMap`
- `terrain.ts` -- `getMoveCost()` and `getDefenseModifier()` accept optional `modifier` param, short-circuit on river/bridge/highway
- `combat.ts` -- passes modifier to `getDefenseModifier()`
- `pathfinding.ts` -- passes modifier to `getMoveCost()`

**Engine (implemented):**
- `map-gen-params.ts` -- §8 Hex Modifier Parameters (RIVER_*, BRIDGE_*, HIGHWAY_*)
- `map-gen.ts` -- `generateRivers()`, `generateHighways()`, `validatePathExistence()`, `placeBridges()`
- `serialization.ts` -- serialize/deserialize modifiers map

**Client (pending):**
- `constants.ts` -- river/bridge/highway colors
- `terrain-renderer.ts` -- render modifier overlays

---

## Open Questions

1. **Map shape**: Hexagonal boundary (sharp macro-hex edges) or circular (rounder, softer hex approximation)?

2. **Partial macro-hexes at boundary**: Complete macro-hexes only (cleaner) or allow partials at boundary (more organic)?

3. **Deploy zone generative constraints**: Should we also add hard rules beyond fairness metrics (e.g., "no mountain macro-hex adjacent to a deploy zone")?

4. **Side selection**: No mirror means one side might be objectively better. Options: coin flip, player pick after seeing map, or lean on fairness reject/re-roll hard enough that asymmetry stays within tolerance.

5. **Seed visibility**: Do players see the map seed? Visible seeds = meta knowledge about specific maps. Hidden = every map is a surprise.

---

## Implementation Plan

### Phase 1: Engine -- Hex-of-Hexes Map Generation

**Files to modify:**
- `packages/engine/src/types.ts` -- add `MacroHex`, extend `GameMap` with macro-hex data
- `packages/engine/src/hex.ts` -- add `hexesInRadius(center, radius)` utility
- `packages/engine/src/world.ts` -- replace `WORLD_ELEV_STEP` with `WORLD_ELEV_SCALE`
- `packages/engine/src/map-gen.ts` -- full rewrite: hexagonal boundary, macro-hex land use assignment, mountain elevation, deploy zones, city placement, fairness validation
- `packages/engine/src/serialization.ts` -- serialize new GameMap fields
- `packages/engine/src/map-gen.test.ts` -- rewrite tests for new structure
- `packages/engine/src/index.ts` -- export new utilities

### Phase 2: Renderer -- Batched Terrain + Cliff Walls

- `packages/client/src/renderer/terrain-renderer.ts` -- batch geometry, float elevation, per-edge wall heights, cliff rendering at mountain borders
- Performance: merge all top faces into one BufferGeometry, all walls into another
- Camera/viewport adjustments for larger map

### Phase 3: Hex Props (Decorative)

- Prop manifest in engine constants -- asset IDs, terrain mapping, probability, scale ranges
- Renderer loads GLBs, scatters on mini-hexes by terrain type per Tier 2 density tables
- Seeded from map RNG -- deterministic placement

### Phase 4: Hex-of-Hex Props (Structural)

- Engine: structural prop data in `MegaHexInfo` -- which macro-hex has which structural prop
- Engine: gameplay effects -- movement blocking, LoS blocking, objective triggers
- Renderer: load structural GLBs, position at macro-hex center, scale to macro-hex footprint
