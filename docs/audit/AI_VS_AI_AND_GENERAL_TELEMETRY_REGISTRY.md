# Telemetry Registry

Centralized list of every measurement the Monte Carlo AI vs AI harness must capture. Each entry identifies what to measure, why it matters for fairness/balance, and whether instrumentation exists today.

Status key: INSTRUMENTED = logging exists | UNINSTRUMENTED = no logging | PLANNED = defined in design doc but not coded

---

## 0. Harness Architecture Constraint

The AI vs AI harness (`ai-harness.ts`) is a **thin consumer**. It exists to call engine functions, read `state.pendingEvents`, and aggregate statistics. It does not contain game logic.

**Rules:**

1. The harness **never mutates game state**. No touching `turnsPlayed`, `turnNumber`, `hp`, `position`, or any field on `GameState`. The 10-phase resolution pipeline (`resolveTurn`) owns all state transitions.
2. The harness **never reimplements game logic**. No damage calculations, no win condition checks, no turn counting. If the harness needs a result, it calls the engine function that produces it.
3. The harness call chain is: `resolveTurn()` -> read `state.pendingEvents` -> `checkRoundEnd()` -> `scoreRound()`. No manual state manipulation between these calls.
4. Kill timing verdicts and fairness metrics are derived **from event log data**, not from re-running formulas on raw state.
5. If the harness needs data the event log doesn't provide, **fix the event log** (add the field to the relevant `BattleEvent` variant in `types.ts`). Do not compute it in the harness.

**Why this matters:** The harness validates the engine. If the harness contains its own game logic, it can mask engine bugs or introduce phantom bugs that don't exist in real games. Every data point the harness reports must trace back to an engine output, not a harness computation.

---

## 1. Map Generation Fairness

These measure whether the procedural map (no mirror symmetry) creates asymmetric advantage.

| ID | Metric | What it measures | Source of randomness | Status |
|----|--------|-----------------|---------------------|--------|
| MAP-01 | `FAIR_CITY_DIST` | Average macro-hex distance from each player's deploy corner to nearest N cities | City placement RNG + terrain noise | UNINSTRUMENTED |
| MAP-02 | `FAIR_PATH_COST` | A* cost from deploy center to each city, averaged per player | Terrain distribution + elevation | UNINSTRUMENTED |
| MAP-03 | `FAIR_TERRAIN_MIX` | Count of each terrain type within N macro-hexes of each deploy zone | Land use noise | UNINSTRUMENTED |
| MAP-04 | `FAIR_MTN_WALL` | Number of cliff-wall edges facing each player's approach direction | Mountain placement + directional slope noise | UNINSTRUMENTED |
| MAP-05 | `FAIR_CITY_CLUSTER` | Whether cities cluster toward one side | City placement RNG | UNINSTRUMENTED |
| MAP-06 | `FAIR_DEPLOY_TERRAIN` | Terrain composition of each player's deploy macro-hex | Deploy zone land use assignment | UNINSTRUMENTED |
| MAP-07 | `FAIR_ELEV_APPROACH` | Average elevation along shortest path from each deploy to map center | Elevation noise + mountain generation | UNINSTRUMENTED |
| MAP-08 | `FAIR_VISION_ACCESS` | Number of high-ground hexes (elev >= 4, giving vision bonus >= 2) accessible within N turns per player | Mountain placement + peak heights | UNINSTRUMENTED |
| MAP-09 | `FAIR_CHOKE_POINTS` | Number of narrow passages (1-2 hex wide gaps between mountains) per approach direction | Mountain clustering + adjacency | UNINSTRUMENTED |
| MAP-10 | `FAIR_RIVER_CROSSINGS` | Number of bridge hexes on shortest path from each deploy zone to map center | River + bridge placement RNG | UNINSTRUMENTED |
| MAP-11 | `FAIR_HIGHWAY_ACCESS` | Count of highway hexes within N macro-hexes of each deploy zone | Highway placement RNG | UNINSTRUMENTED |
| MAP-12 | `REROLL_COUNT` | Number of map generation attempts before acceptance (fairness + path validity) | All map RNG | UNINSTRUMENTED |
| MAP-13 | `REROLL_REASON` | Which validation failed per rejected attempt (city distance, path existence, terrain mix, etc.) | All map RNG | UNINSTRUMENTED |
| MAP-14 | `BRIDGE_COUNT_EFFECTIVE` | Actual bridge count per river (placed + auto-bridged by highways) vs BRIDGES_PER_RIVER target | River + highway interaction | UNINSTRUMENTED |

**Risk**: Without MAP-01 through MAP-14, we cannot distinguish "player lost because of bad strategy" from "player lost because the map was structurally unfair." Every AI vs AI match on a generated map must log these to correlate with win rates.

---

## 2. Combat Balance

These validate the math model's kill timing targets.

| ID | Metric | What it measures | Source of randomness | Status |
|----|--------|-----------------|---------------------|--------|
| CMB-01 | `HITS_TO_KILL` | Actual hits to kill per matchup (attacker type x defender type) | RNG factor [0.85, 1.15] | UNINSTRUMENTED (format defined in GAME_MATH_ENGINE.md `[MATH_AUDIT] KILL`) |
| CMB-02 | `DAMAGE_PER_HIT` | Expected vs actual damage per hit | RNG factor | UNINSTRUMENTED (format defined: `[MATH_AUDIT] HIT`) |
| CMB-03 | `KILL_VERDICT` | ON_TARGET / TOO_FAST / TOO_SLOW per kill event | Derived from CMB-01 vs math model targets | UNINSTRUMENTED (format defined: `[MATH_AUDIT] KILL verdict`) |
| CMB-04 | `DOMINANT_UNIT` | Which unit type appears in >40% of kills per match | All combat | UNINSTRUMENTED (format defined: `[MATH_AUDIT] MATCH_END dominant_unit`) |
| CMB-05 | `RNG_TIEBREAK_PCT` | % of engagements where initiative was decided by RNG (not modifiers) | Initiative tie RNG | UNINSTRUMENTED (format defined: `[MATH_AUDIT] rng_tiebreaks_pct`) |
| CMB-06 | `TERRAIN_DEFENSE_IMPACT` | How often terrain defense modifier changes the outcome (kill in N vs N+1 hits) | Map terrain distribution | UNINSTRUMENTED |
| CMB-07 | `ELEVATION_VISION_ADVANTAGE` | Correlation between first-strike and attacker's elevation advantage | Elevation + vision | UNINSTRUMENTED |

**Note**: CMB-01 through CMB-05 have log formats defined in `GAME_MATH_ENGINE.md` (`[MATH_AUDIT]` tags) but zero implementation exists in the engine. The logging spec is pure design doc.

---

## 3. Economy

| ID | Metric | What it measures | Source of randomness | Status |
|----|--------|-----------------|---------------------|--------|
| ECN-01 | `INCOME_PER_ROUND` | Income breakdown per player per round (base, city, kill, win/catchup) | City control (map-dependent) | UNINSTRUMENTED |
| ECN-02 | `RESOURCE_DELTA` | Resource difference between players at each round start | Cumulative economy | UNINSTRUMENTED |
| ECN-03 | `ARMY_VALUE` | Total unit cost on the board per player per round | Economy + combat attrition | UNINSTRUMENTED |
| ECN-04 | `KILL_BONUS_YIELD` | Total kill bonus earned vs total unit value destroyed | Kill bonus formula | UNINSTRUMENTED |
| ECN-05 | `CITY_INCOME_SHARE` | City income as % of total income per player | City count + ownership | UNINSTRUMENTED |
| ECN-06 | `MAINTENANCE_BURDEN` | Maintenance as % of income per player | Army size vs income | UNINSTRUMENTED |

**Risk**: Economy constants (GAME_MATH_ENGINE.md S5) were tuned for 7 cities on a 280-hex map. With ~30 macro-hexes and potentially more cities, city income may dominate. ECN-05 will detect this.

---

## 4. Movement & Pathfinding

| ID | Metric | What it measures | Source of randomness | Status |
|----|--------|-----------------|---------------------|--------|
| MOV-01 | `AVG_PATH_LENGTH` | Average A* path length per unit type per turn | Map terrain layout | UNINSTRUMENTED |
| MOV-02 | `BLOCKED_MOVES` | % of directive movement actions that result in hold (no valid path) | Terrain + unit congestion | UNINSTRUMENTED |
| MOV-03 | `MOUNTAIN_BLOCK_RATE` | % of non-infantry units whose path is blocked by mountain macro-hexes | Mountain placement | UNINSTRUMENTED |
| MOV-04 | `A_STAR_NODE_COUNT` | Nodes explored per A* call | Map size + terrain complexity | UNINSTRUMENTED |

| MOV-05 | `HIGHWAY_VEHICLE_SPEED` | Average path cost reduction for vehicles (tank/artillery/recon) on highway hexes vs underlying terrain | Highway modifier placement | UNINSTRUMENTED |
| MOV-06 | `RIVER_BLOCK_RATE` | % of unit-turns where a river modifier blocked a direct path, forcing a detour via bridge | River + bridge placement | UNINSTRUMENTED |
| MOV-07 | `BRIDGE_CONGESTION` | Average units routing through each bridge hex per turn | Bridge scarcity + terrain chokepoints | UNINSTRUMENTED |

**Risk**: At 2800 hexes (10x current), A* becomes a performance concern (`GAME_MATH_ENGINE.md` S4.6). MOV-04 detects pathfinding becoming a bottleneck. MOV-03 detects mountains creating unfair vehicle routing. MOV-06 and MOV-07 detect rivers/bridges creating asymmetric chokepoints — if one player's approach to the center requires crossing a river while the other's doesn't, that's a map fairness issue.

---

## 5. Vision & Information

| ID | Metric | What it measures | Source of randomness | Status |
|----|--------|-----------------|---------------------|--------|
| VIS-01 | `MAP_COVERAGE` | % of map visible to each player per turn | Unit positions + elevation + terrain | UNINSTRUMENTED |
| VIS-02 | `FIRST_CONTACT_TURN` | Turn number when each player first sees an enemy unit | Deploy distance + vision ranges + terrain | UNINSTRUMENTED |
| VIS-03 | `BLIND_SPOT_AREA` | Number of hexes never seen by a player across the entire match | Map layout + unit movement patterns | UNINSTRUMENTED |
| VIS-04 | `ELEVATION_VISION_BONUS` | Average vision bonus from elevation per player (floor(sqrt(elev))) | Mountain access + unit positioning | UNINSTRUMENTED |
| VIS-05 | `FOREST_CONCEALMENT_RATE` | % of engagements where forest concealment (adjacency-only visibility) affected the outcome | Forest distribution near combat zones | UNINSTRUMENTED |

**Risk**: Vision asymmetry is invisible to players but decisive. One player seeing the other's army composition 2 turns earlier fundamentally changes the game. VIS-02 and VIS-04 will detect this.

---

## 6. Win Condition

| ID | Metric | What it measures | Source of randomness | Status |
|----|--------|-----------------|---------------------|--------|
| WIN-01 | `WIN_CONDITION_TYPE` | Which win condition triggered (city majority, elimination, turn limit) | All systems | UNINSTRUMENTED |
| WIN-02 | `CITIES_AT_WIN` | Cities held by each player when the round ends | City control | UNINSTRUMENTED |
| WIN-03 | `TURNS_TO_WIN` | Turn count when the round-ending condition triggered | All systems | UNINSTRUMENTED |
| WIN-04 | `TIEBREAK_FREQUENCY` | % of rounds decided by tiebreaker (turn limit) rather than decisive victory | Game pacing | UNINSTRUMENTED |
| WIN-05 | `P1_WIN_RATE` | Player 1 win rate across N matches on same seed | All (tests for map bias) | UNINSTRUMENTED |
| WIN-06 | `SIDE_WIN_RATE` | Win rate by deploy corner position across all seeds | Map generation fairness | UNINSTRUMENTED |

**Risk**: WIN-05 is the single most important fairness metric. If P1 win rate deviates from 50% by more than a threshold on a given seed, the map is unfair. WIN-06 aggregates across seeds — if a corner position is structurally advantaged, the deploy system has a problem.

---

## 7. Directive AI

| ID | Metric | What it measures | Source of randomness | Status |
|----|--------|-----------------|---------------------|--------|
| DIR-01 | `DIRECTIVE_DISTRIBUTION` | % of units per directive type per player per match | AI build decisions | UNINSTRUMENTED |
| DIR-02 | `TARGET_RETARGET_RATE` | % of turns where a unit's directive target was retargeted (invalid target fallback) | Target death + city capture | UNINSTRUMENTED |
| DIR-03 | `SCOUT_COVERAGE_RATE` | % of map explored by scout units per player | Scout AI + terrain | UNINSTRUMENTED |
| DIR-04 | `IDLE_UNIT_RATE` | % of unit-turns where the unit held without attacking or moving (effectively idle) | Pathfinding failures + directive logic | UNINSTRUMENTED |

---

## 8. Cross-System Interactions (Uncontracted)

These are interactions between systems where no contract defines the combined behavior. Each is a fairness risk.

| ID | Interaction | Systems involved | What could go wrong | Contract exists? |
|----|-------------|-----------------|--------------------|----|
| XSI-01 | Elevation x movement cost | terrain.ts, pathfinding.ts | Mountains cost 3 to enter regardless of slope steepness. A gentle slope and a cliff wall cost the same. | NO — elevation is cosmetic for movement (known risk 8.4) |
| XSI-02 | Elevation x combat damage | terrain.ts, combat.ts | No high-ground attack bonus. Infantry on a peak (elev 20) deals same damage as infantry on flat ground. | NO |
| XSI-03 | Forest LoS x elevation | vision.ts, terrain.ts | LAND_USE.md says high ground lets you see OVER forests. But forest defense (+25%) doesn't change when the attacker can see you. Seeing through forest should arguably reduce its defense value. | NO |
| XSI-04 | Mountain infantry-only x deploy zone | terrain.ts, map-gen.ts | If a mountain macro-hex is adjacent to a deploy corner, vehicles can only leave in non-mountain directions. One player might be boxed in. | NO — adjacency rules in LAND_USE.md have `?` values |
| XSI-05 | City count x economy | economy.ts, map-gen.ts | CITY_INCOME=125 was tuned for 7 cities. With hex-of-hexes, city count is `CITY_COUNT` (tunable). If 15 cities, holding all = 1875g city income — nearly 3x BASE_INCOME. | NO — economy constants are not parametric to city count |
| XSI-06 | Map size x turn limit | game-state.ts, map-gen.ts | maxTurnsPerSide=12 was for 280 hexes. At 2800 hexes, units may never engage before time runs out. | PARTIALLY — GAME_MATH_ENGINE.md A6 defines `floor(MAP_SPAN/2)` but code is hardcoded 12 |
| XSI-07 | Map size x vision range | units.ts, map-gen.ts | visionRange=3 was 21% of map width on 20-wide map. On ~60-wide hex map, it's 5%. Fog of war dominance. | NO — GAME_MATH_ENGINE.md A6 mentions vision "may need scaling" but no formula |
| XSI-08 | Elevation x city capture | game-state.ts, terrain.ts | Cities at elevation > 0 (CITY_ELEV_RANGE in LAND_USE.md has `?`). Does elevation affect capture mechanics? Capture costs 1 HP regardless of elevation. | NO |
| XSI-09 | Deploy corner x map center distance | map-gen.ts | Hex boundary corners are equidistant from center IF the map is a regular hex. But if R_MACRO = 3, opposite corners are 6 macro-hexes apart — always symmetric. Non-opposite player placements (3+ players) may not be equidistant to all cities. | NO |
| XSI-10 | Mountain peak height x vision dominance | vision.ts, map-gen.ts | Tallest peak forced to MTN_PEAK_MAX (20). floor(sqrt(20))=4 vision bonus. Player closer to that peak gets persistent vision advantage for the entire match. | NO |
| XSI-11 | River placement x deploy access | map-gen.ts, terrain.ts | A river between one player's deploy zone and the map center forces bridge-dependent routing. If bridges are scarce or clustered, that player's army is funneled through predictable chokepoints. Other player may have unrestricted approach. `validatePathExistence()` rejects maps where infantry can't reach a city at all, but does NOT reject maps where the path cost is asymmetric — one player may have a 3-bridge detour while the other has open ground. | PARTIAL — existence checked, cost asymmetry not checked |
| XSI-12 | Highway placement x vehicle army composition | terrain.ts, economy.ts | Highway gives cost 0.5 to vehicles. Player with highway access to objectives can run vehicle-heavy armies at 2x effective speed. Infantry-heavy armies gain nothing. Asymmetric highway access biases optimal army composition per side. | NO |
| XSI-13 | Bridge scarcity x army routing | terrain.ts, pathfinding.ts | If too few bridges cross a river, all units funnel to the same hexes. Bridge congestion makes "occupy the bridge" a dominant strategy, reducing tactical variety. Defense modifier 0% on bridges makes holding them costly. | NO |
| XSI-14 | validatePathExistence x reroll budget | map-gen.ts | `validatePathExistence()` rejects maps where rivers partition cities from a deploy zone (infantry path must exist). Combined with existing city-distance fairness rejects, the reroll rate may increase. If RIVER_COUNT is high or BRIDGES_PER_RIVER is low, many maps fail validation → more rerolls → risk of hitting MAX_REROLL (still undefined). | PARTIAL — rejects feed into reroll loop but no reroll budget contract |
| XSI-15 | Highway x river auto-bridge | map-gen.ts | `generateHighways()` converts river hexes to bridge when a highway crosses a river. This bypasses `placeBridges()` spacing rules — auto-bridges can cluster if multiple highways cross the same river. Also inflates effective bridge count beyond BRIDGES_PER_RIVER. | NO |

---

## 9. Seeded RNG Inventory

Every source of randomness in the engine. ALL must be seeded from the match seed for determinism and reproducibility.

| ID | RNG Source | Current seeding | File:line | Used for |
|----|-----------|----------------|-----------|----------|
| RNG-01 | `mulberry32(seed)` in map-gen | Seeded from `Date.now()` or passed seed | map-gen.ts:119 | Terrain noise, elevation noise, city placement |
| RNG-02 | Terrain noise generator | Sub-seed from RNG-01 | map-gen.ts:122-124 | Terrain type assignment per hex |
| RNG-03 | Elevation noise generator | Sub-seed from RNG-01 | map-gen.ts:125 | Elevation per hex |
| RNG-04 | City placement shuffle | Same RNG-01 stream | map-gen.ts:100 | Which hexes become cities |
| RNG-05 | Damage random factor | `0.85 + Math.random() * 0.3` DEFAULT (unseeded!) | combat.ts:24 | Damage variance per hit |
| RNG-06 | Server seeded damage | `0.85 + mulberry32(turnSeed)() * 0.3` | game-loop.ts (referenced in GAME_MATH_ENGINE.md) | Server-side deterministic damage |

**CRITICAL**: RNG-05 uses `Math.random()` as the DEFAULT. Only the server injects a seeded version (RNG-06). Any client-side or test usage of `calculateDamage()` without injecting a seeded `randomFn` produces non-deterministic, non-reproducible results. This is a reproducibility gap for Monte Carlo testing.

**New RNG sources needed for hex-of-hexes** (not yet implemented):
| ID | RNG Source | What it seeds |
|----|-----------|--------------|
| RNG-07 | Land use noise | Macro-hex terrain type assignment |
| RNG-08 | Mountain peak placement | Peak offset from macro-hex center |
| RNG-09 | Mountain peak height | Height per mountain macro-hex |
| RNG-10 | Directional slope noise | Per-mountain-macro-hex slope variation |
| RNG-11 | Non-mountain elevation noise | Plains/forest/city gentle elevation |
| RNG-12 | Deploy corner selection | Which corners players spawn at (if randomized) |
| RNG-13 | City macro-hex selection | Which macro-hexes become cities |
| RNG-14 | Prop placement | Per-hex prop selection and rotation |
| RNG-15 | River source selection + walk noise | `generateRivers()` — high-elevation source hex selection, downhill walk with noise jitter for curve. Seeding controls river shape and count. | IMPLEMENTED (map-gen.ts, step 10.5) |
| RNG-16 | Bridge placement spacing | `placeBridges()` — evenly-spaced positions (20-80% range) per river, min spacing enforced | IMPLEMENTED (map-gen.ts, step 10.5) |
| RNG-17 | Highway path selection | `generateHighways()` — A* between city pairs using tank move costs. Deterministic given terrain, but city pair ordering affects which paths are stamped first. | IMPLEMENTED (map-gen.ts, step 10.5) |

ALL of RNG-07 through RNG-17 must derive sub-seeds from a single match seed via mulberry32, same pattern as current map-gen.

---

## 10. Implementation Priority

For the Monte Carlo harness to produce useful data, instrumentation should be added in this order:

**P0 — Required before any AI vs AI testing is meaningful:**
- WIN-05 (P1 win rate — the fairness signal)
- WIN-01 (win condition type — what ends games)
- CMB-01, CMB-03 (hits to kill + verdict — validates math model)
- MAP-01, MAP-02 (city distance fairness — validates map gen)
- RNG-05 fix (seed ALL randomness — reproducibility)

**P1 — Required before map generation parameters can be tuned:**
- MAP-03 through MAP-11 (full map fairness suite including river/highway)
- WIN-06 (side win rate across seeds)
- ECN-01, ECN-05 (economy scaling with city count)
- VIS-01, VIS-02 (vision fairness)

**P2 — Required before balance pass:**
- CMB-02, CMB-04, CMB-05, CMB-06, CMB-07 (full combat telemetry)
- ECN-02, ECN-03, ECN-06 (economy health)
- MOV-01, MOV-02, MOV-03, MOV-05, MOV-06, MOV-07 (movement health + modifier impact)
- DIR-01 through DIR-04 (AI behavior health)

**P3 — Performance monitoring:**
- MOV-04 (A* node count)
- VIS-03 (blind spot coverage)
- WIN-03, WIN-04 (game pacing)
