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

## 1. Map Validity & Generation Fairness

The game is asymmetric by design ("poker meets tactics"). Sometimes you get a bad hand. The question is not "is this map fair?" but **"is this map playable?"**

### 1.1 Map Validity Gate (MAP-01, MAP-02)

The harness classifies every generated map into one of three validity classes using two Dijkstra floods (one per deploy center, via `computeMovementCostField` from `pathfinding.ts`):

| Class | Definition | Harness behavior |
|-------|-----------|-----------------|
| **VALID** | Both players can reach ALL cities AND have ≥1 walkable deploy exit | Match proceeds. Results enter gameplay dataset. |
| **DEGRADED** | Either player can't reach all cities but reaches ≥1 | Weak hand, still playable. Match proceeds. Results enter gameplay dataset. Classification logged. |
| **BROKEN** | Either player has 0 reachable cities OR 0 deploy exits | **Match skipped.** Map validity logged, `brokenMaps` counter incremented, no gameplay data collected. |

**BROKEN maps do not produce gameplay data.** A map where a player cannot reach any city or cannot leave their deploy zone does not produce game balance signal — it produces generator failure signal. Running a match on a BROKEN map contaminates the gameplay dataset with outcomes driven by map invalidity, not by game rules or AI skill. BROKEN maps belong in the generator diagnostics dataset (MAP-02 batch counts), not in win rate or combat statistics.

**What gets measured per map:**
- `p1ReachableCities` / `p2ReachableCities` — count of cities present in each player's cost field
- `totalCities` — total cities on the map
- `p1DeployExits` / `p2DeployExits` — neighbors of deploy center hex that are walkable (present in cost field)
- `p1AvgCityCost` / `p2AvgCityCost` — average weighted movement cost to reachable cities

**Why classification, not blanket rejection:** The gate classifies all maps but only skips BROKEN ones. DEGRADED maps still play — a player who can't reach one distant city has a weak hand, not an invalid game. This preserves the "poker meets tactics" philosophy while preventing invalid state spaces from polluting results.

**Why not symmetry deltas:** The old MAP-01/MAP-02 computed `cityDistDelta` and `pathCostDelta` — how symmetric the map was. This answers the wrong question. A map where both players have equal cost to cities but one player is sealed behind mountains is "fair" by delta but broken by validity. Reachability is the primitive. Cost asymmetry is a diagnostic (logged separately by MAP-03..11).

| ID | Metric | What it measures | Source of randomness | Status |
|----|--------|-----------------|---------------------|--------|
| MAP-01 | `MAP_VALIDITY` | Map validity classification (VALID/DEGRADED/BROKEN), per-player reachable city count, deploy exit count, avg city cost | Terrain + elevation + mountain placement | UNINSTRUMENTED |
| MAP-02 | `MAP_VALIDITY_BATCH` | Aggregate validity counts across batch (valid/degraded/broken map counts) | All map RNG | UNINSTRUMENTED |

### 1.2 Map Diagnostic Metrics (MAP-03..14)

These measure structural asymmetry for correlation with win rates. They do not gate anything — they are logged for analysis.

| ID | Metric | What it measures | Source of randomness | Status |
|----|--------|-----------------|---------------------|--------|
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

**Correlation warning:** MAP-04 (mountain walls), MAP-07 (elevation approach), MAP-08 (vision access), and MAP-09 (chokepoints) are **not independent variables** — mountains drive all of them. Treating them as independent in statistical models will produce noisy, spurious correlations. For analysis, consider collapsing mountain-derived metrics into composite signals (e.g., `approach_difficulty = f(mtn_wall, elev_approach, choke_count)`).

**Risk**: Without MAP-01 (validity gate) and MAP-03..14 (diagnostics), we cannot distinguish "player lost because of bad strategy" from "player lost because the map was structurally broken." Every AI vs AI match must log MAP-01. Diagnostic metrics (MAP-03..14) enable correlation with win rates for tuning.

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

**VIOLATION — Kill timing classification breaks Section 0 Rule 2 + Rule 4.** The harness function `computeKillThresholds()` recomputes `minDmg`, `maxDmg`, `okMin`, `okMax` from the damage formula inside the harness. This is reimplementing game logic. Even if the formula matches the engine today, it can drift silently.

**Required fix — move kill band computation into the engine:**

1. **`types.ts`** — Add fields to the `kill` variant of `BattleEvent`:
   - `expectedHitsMin: number` — fewest hits to kill (max damage per hit, `ceil(HP / maxDmg)`)
   - `expectedHitsMax: number` — most hits to kill (min damage per hit, `ceil(HP / minDmg)`)

2. **`resolution-pipeline.ts`** — At kill emission site, compute the OK band using the same `UNIT_STATS`, `getTypeAdvantage`, and `terrainDefense` values already in scope. Attach `expectedHitsMin` and `expectedHitsMax` to the kill event.

3. **`ai-harness.ts`** — Delete `computeKillThresholds()` and `classifyKillTiming()`. Replace with a comparison against the event fields:
   ```
   const verdict = hitCount < event.expectedHitsMin ? 'TOO_FAST'
                 : hitCount > event.expectedHitsMax ? 'TOO_SLOW'
                 : 'OK';
   ```

4. **`ai-harness.ts`** — Delete `KillThresholds` interface and `terrainDefense` lookup table. These exist only to support the harness-side computation.

After this fix, the harness contains zero combat math. Kill verdicts trace entirely to engine output.

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

**Note on metric categories:** MOV-01 through MOV-03 and MOV-05 through MOV-07 are **game balance metrics** — they detect map-driven fairness problems. MOV-04 (`A_STAR_NODE_COUNT`) is an **engine profiling metric** — it detects performance bottlenecks. These serve different analytical purposes and should not be correlated with each other.

**Risk**: MOV-03 detects mountains creating unfair vehicle routing. MOV-06 and MOV-07 detect rivers/bridges creating asymmetric chokepoints — if one player's approach to the center requires crossing a river while the other's doesn't, that's a map fairness issue. MOV-04 detects A* becoming a bottleneck at 2800 hexes (10x original).

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
| WIN-05 | `SPAWN_ADVANTAGE` | Position advantage per seed, measured via paired simulations (see Section 11) | All systems | UNINSTRUMENTED |
| WIN-06 | `SPAWN_ADVANTAGE_BY_CLASS` | Spawn advantage conditioned on map validity class (VALID/DEGRADED/BROKEN) | Map generation + all systems | UNINSTRUMENTED |

### WIN-05 / WIN-06 — Why paired simulations, not raw win rate

The game is asymmetric by design. Maps intentionally produce unequal starting conditions. A raw "P1 win rate" conflates four sources of bias:

1. **Map structure** — terrain, elevation, city placement favor one spawn
2. **Spawn position** — one corner is structurally closer to objectives
3. **AI evaluation order** — P1 commands evaluated first in pipeline phases
4. **Information asymmetry** — one player sees the other earlier (VIS-02)

A raw 55% P1 win rate tells you nothing about which source is responsible.

**Position swapping isolates spawn advantage.** For each seed, run two matches:

- Match A: AI plays as P1 on seed N
- Match B: AI plays as P2 on seed N (same map, swapped spawns)

Paired result interpretation:

| Match A winner | Match B winner | Interpretation |
|---------------|---------------|---------------|
| P1 | P2 | Position advantage exists — whoever gets that spawn wins |
| P1 | P1 | Map strongly favors P1 spawn regardless of AI assignment |
| P2 | P2 | Map strongly favors P2 spawn regardless of AI assignment |
| P2 | P1 | No position advantage (or cancels out) |
| Draw | any | Inconclusive for that pair |

**Spawn advantage** = `wins_as_P1 - wins_as_P2` across all paired runs. With identical AI skill, expected value is 0.

**WIN-06 conditions on map class** because a BROKEN map may show extreme spawn advantage that is irrelevant to game balance — it's a generator problem, not a rules problem. Only VALID maps produce meaningful spawn advantage data.

**Risk**: Without paired simulations, win-rate deviations are uninterpretable. A 60/40 split could be map bias, AI evaluation order, or vision timing. Paired runs collapse these possibilities.

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

Every entry has a **disposition** — what we intend to do about it:

- **ACCEPTED RISK** — Known gap, intentionally left uncontracted. Will not cause incorrect behavior, but may affect balance. Monitored by telemetry.
- **TODO CONTRACT** — Needs a rule defined before the interaction can be considered safe. Blocks balance tuning in that area.
- **RESOLVED** — Contract exists or the interaction has been eliminated.

| ID | Interaction | Systems | What could go wrong | Disposition |
|----|-------------|---------|--------------------|----|
| XSI-01 | Elevation x movement cost | terrain, pathfinding | Mountains cost 3 regardless of slope steepness. Gentle slope = cliff wall. | **ACCEPTED RISK** — elevation is cosmetic for movement. Simplicity > realism. |
| XSI-02 | Elevation x combat damage | terrain, combat | No high-ground attack bonus. Infantry on peak (elev 20) = flat ground damage. | **ACCEPTED RISK** — adding elevation damage would require rebalancing all matchup tables. Revisit post-launch if data shows elevation is meaningless. |
| XSI-03 | Forest LoS x elevation | vision, terrain | High ground sees OVER forests but forest defense (+25%) doesn't change when attacker has LoS through it. | **ACCEPTED RISK** — forest defense represents cover, not concealment. LoS doesn't reduce physical cover. |
| XSI-04 | Mountain infantry-only x deploy zone | terrain, map-gen | Mountain macro-hex adjacent to deploy corner boxes in vehicles. | **TODO CONTRACT** — MAP-01 validity gate (deploy exits) will detect this. If deploy exits = 0, map is BROKEN. But partial boxing (exits exist but are few) needs a threshold. |
| XSI-05 | City count x economy | economy, map-gen | CITY_INCOME=125 tuned for 7 cities. 15 cities = 1875g city income, ~3x BASE_INCOME. | **TODO CONTRACT** — economy constants must become parametric to city count. ECN-05 will quantify the problem. |
| XSI-06 | Map size x turn limit | game-state, map-gen | maxTurnsPerSide=12 hardcoded. At 2800 hexes, armies may never meet. | **TODO CONTRACT** — must implement `maxTurns = ceil(mapDiameter / avgMoveSpeed)`. GAME_MATH_ENGINE.md A6 defines `floor(MAP_SPAN/2)` but code ignores it. Real gameplay bug. |
| XSI-07 | Map size x vision range | units, map-gen | visionRange=3 was 21% of map width (20-wide). At ~60-wide, it's 5%. Fog dominance. | **TODO CONTRACT** — needs scaling formula or intentional acceptance that fog dominance is a design feature at scale. |
| XSI-08 | Elevation x city capture | game-state, terrain | Cities at elevation > 0. Capture costs 1 HP regardless. Elevation irrelevant to capture. | **ACCEPTED RISK** — capture is a movement action, not combat. Elevation affecting capture would add complexity with minimal tactical depth. |
| XSI-09 | Deploy corner x map center distance | map-gen | Opposite corners on R_MACRO=3 hex are equidistant (6 macro-hexes). 3+ player layouts may not be. | **ACCEPTED RISK** — 2-player only for now. Symmetric by geometry. |
| XSI-10 | Mountain peak x vision dominance | vision, map-gen | MTN_PEAK_MAX(20) gives floor(sqrt(20))=4 vision bonus. Closer player gets persistent advantage. | **TODO CONTRACT** — VIS-04 will quantify. If peak proximity correlates with win rate on VALID maps (WIN-06), peak placement or vision cap needs a rule. |
| XSI-11 | River x deploy access | map-gen, terrain | River between deploy and center forces bridge routing. Cost asymmetry not checked by `validatePathExistence()`. | **TODO CONTRACT** — MAP-01 validity gate checks reachability, but not cost parity. MOV-06 and MOV-07 will quantify routing asymmetry. If paired-run data (WIN-05) shows river-side spawn loses disproportionately, generator needs a cost-asymmetry threshold. |
| XSI-12 | Highway x vehicle composition | terrain, economy | Highway gives 0.5 cost to vehicles. Asymmetric access biases army composition. | **ACCEPTED RISK** — asymmetric optimal composition is a feature ("poker hands"). MAP-11 logs highway access per side for monitoring. |
| XSI-13 | Bridge scarcity x routing | terrain, pathfinding | Too few bridges = unit funneling. "Hold the bridge" becomes dominant. | **ACCEPTED RISK** — chokepoint control is valid tactics. MAP-14 monitors effective bridge count. If MOV-07 shows extreme congestion, tune BRIDGES_PER_RIVER. |
| XSI-14 | validatePathExistence x reroll budget | map-gen | High RIVER_COUNT + low BRIDGES_PER_RIVER = many rejects, risk of hitting MAX_REROLL. | **TODO CONTRACT** — MAX_REROLL must be defined. MAP-12 will quantify reroll rate. If rate exceeds threshold, parameter combination is invalid. |
| XSI-15 | Highway x river auto-bridge | map-gen | Highway auto-bridges bypass `placeBridges()` spacing, can cluster. Inflates bridge count. | **TODO CONTRACT** — MAP-14 will detect. Auto-bridges should count toward BRIDGES_PER_RIVER or respect spacing rules. |

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

## 10. Generator Parameter Logging

The harness records many metrics per match but must also record **the generator parameters that produced the map**. Without this, Monte Carlo results are impossible to interpret — you cannot answer "which parameters produce broken maps" if the parameters aren't stored.

Every match must log:

| Field | Source | Why |
|-------|--------|-----|
| `seed` | `runMatch(seed)` | Reproducibility |
| `R_MACRO` | `map-gen-params.ts` | Map size |
| `R_MINI` | `map-gen-params.ts` | Hex density |
| `CITY_COUNT` | `map-gen-params.ts` | Economy surface |
| `RIVER_COUNT` | `map-gen-params.ts` | Routing constraints |
| `BRIDGES_PER_RIVER` | `map-gen-params.ts` | Chokepoint density |
| `MTN_PEAK_MAX` | `map-gen-params.ts` | Vision ceiling |
| `LAND_USE_*` percentages | `map-gen-params.ts` | Terrain distribution |
| `ai_version` | harness config | Skill identity (see Section 12) |

Log format: `[MATH_AUDIT] GEN_PARAMS  seed:X  R_MACRO:3  R_MINI:5  CITY_COUNT:5  ...`

This enables filtering batch results by parameter region — e.g., "show me win rates only for maps with RIVER_COUNT >= 3."

---

## 11. Experimental Protocol

### 11.1 Paired Simulations (Position Swapping)

Every seed must be played **twice** with sides swapped. This is the only way to isolate spawn advantage from AI behavior.

```
seed 100, match A: AI plays P1
seed 100, match B: AI plays P2 (same map, swapped spawn)
```

The harness `runBatch` must support a `paired: true` mode that runs `2 × matchCount` games (each seed twice) and computes spawn advantage instead of raw win rate.

**Spawn advantage** = `wins_as_P1 - wins_as_P2` across all paired runs. With identical AI, expected value = 0.

### 11.2 AI Versioning

Skill is stratified by **AI version**, not by internal scoring. The harness must log `ai_version` per match so results remain interpretable as the AI evolves.

Experiment matrix example:

| AI version | Description | What it tests |
|-----------|-------------|--------------|
| `baseline` | Current `aiBuildPhase` + `aiBattlePhase` | Reference point |
| `epsilon_5` | 5% of decisions randomized | Skill sensitivity — does the map reward precision? |
| `epsilon_10` | 10% of decisions randomized | Wider noise band |

Within a batch, both players always run the **same AI version**. Cross-version matches test something different (relative strength) and must be tagged separately.

### 11.3 Confidence Intervals

Monte Carlo results require `mean ± confidence interval` to be interpretable.

For win rate: use Wilson score interval (works for proportions near 0 or 1, unlike normal approximation).

Minimum batch size for meaningful signal: **N ≥ 100 paired runs** (200 matches). At N=100, a 95% confidence interval for 50% win rate is ±~10%. At N=400, it's ±~5%.

The batch summary must report:

```
Spawn advantage: +3.2% ± 4.1% (n=200, 95% CI)
```

If the confidence interval includes 0, spawn advantage is not statistically significant.

### 11.4 Experiment Configuration

A batch run is only comparable to another if the parameter vector is frozen. The harness should accept and log an experiment config:

```
experiment_id: "river_sweep_01"
frozen: { unit_stats, economy_constants, ai_version }
variable: { RIVER_COUNT: [1, 2, 3, 4] }
```

This is not enforced by code — it's a discipline. But logging the experiment ID per match makes it possible to filter and group results after the fact.

---

## 12. Implementation Priority

For the Monte Carlo harness to produce useful data, instrumentation should be added in this order:

**P0 — Required before any AI vs AI testing is meaningful:**
- MAP-01, MAP-02 (map validity gate + batch aggregation)
- WIN-05 (spawn advantage via paired simulations — the fairness signal)
- WIN-01 (win condition type — what ends games)
- CMB-01, CMB-03 (hits to kill + verdict — but engine must emit `expectedHitsMin/Max` first, see Section 2 violation note)
- RNG-05 fix (seed ALL randomness — reproducibility)
- GEN_PARAMS logging (Section 10 — generator parameters per match)
- Paired simulation mode in `runBatch` (Section 11.1)

**P1 — Required before map generation parameters can be tuned:**
- MAP-03 through MAP-14 (full map diagnostic suite)
- WIN-06 (spawn advantage conditioned on map validity class)
- ECN-01, ECN-05 (economy scaling with city count)
- VIS-01, VIS-02 (vision fairness)
- Confidence intervals in batch summary (Section 11.3)

**P2 — Required before balance pass:**
- CMB-02, CMB-04, CMB-05, CMB-06, CMB-07 (full combat telemetry)
- ECN-02, ECN-03, ECN-06 (economy health)
- MOV-01, MOV-02, MOV-03, MOV-05, MOV-06, MOV-07 (movement health)
- DIR-01 through DIR-04 (AI behavior health)
- AI versioning support (Section 11.2)

**P3 — Performance monitoring:**
- MOV-04 (A* node count — engine profiling, not game telemetry)
- VIS-03 (blind spot coverage)
- WIN-03, WIN-04 (game pacing)
