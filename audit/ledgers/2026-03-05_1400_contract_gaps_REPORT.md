# Contract Gap Audit Report
**Session:** 2026-03-05_1400
**Project:** HexWar
**Branch:** Chack-Atacc
**Team:** space-auditor, combat-auditor, control-auditor, resolution-auditor, economy-auditor

---

## Coverage Summary

| Domain | Weighted Units | Covered | Partially | Uncovered | Score |
|--------|---------------|---------|-----------|-----------|-------|
| Space | 51 | 38 | 7 | 6 | 38/51 |
| Combat | 21 | 12 | 3 | 6 | 12/21 |
| Control | 30 | 12 | 8 | 10 | 12/30 |
| Resolution | 45 | 30 | 6 | 9 | 30/45 |
| Economy | 19 | 14 | 1 | 4 | 14/19 |
| **Total** | **166** | **106** | **25** | **35** | **106/166 (64%)** |

---

## STRUCTURAL Gaps (game can produce wrong outcomes)

### GAP-1: DEF stat nullified on plains terrain
- **Type:** Design doc <-> engine divergence (type 6) + uncontracted interaction (type 4)
- **Location:** `combat.ts:37` — `effectiveDef * terrainDef` where `terrainDef=0` on plains
- **Evidence:** combat-auditor formula audit. Test author discovered this at `combat.test.ts:63-66` and switched to mountain to get observable difference.
- **What exists:** DEF is multiplied by terrain defense modifier. Plains has modifier 0. DEF * 0 = 0. DEF does nothing on the most common terrain type.
- **What's missing:** No contract governs the interaction order of DEF and terrain defense. The target formula (C-DMG-TARGET) fixes this by making terrain a multiplier on base damage and DEF a flat subtraction.
- **Risk:** All combat on plains ignores DEF entirely. Hold directive +1 DEF bonus provides zero benefit on plains. Infantry DEF=2 is functionally identical to DEF=0 on the majority of the map.
- **Adjacent to:** Known design risk 8.5, but the risk only mentions "DEF does nothing on plains." The hold-directive interaction (GAP-2) is a different surface.

### GAP-2: Hold directive DEF bonus worthless on plains
- **Type:** Uncontracted interaction (type 4)
- **Location:** `combat.ts:33` (effectiveDef = def + 1) combined with `combat.ts:37` (effectiveDef * 0 = 0)
- **Evidence:** combat-auditor hold interaction audit
- **What exists:** Hold adds +1 DEF. But on plains, all DEF is nullified. Hold provides zero damage reduction on the most common terrain.
- **What's missing:** No contract defines whether hold bonus should be immune to the terrain-nullification bug.
- **Risk:** Core directive mechanic provides no mechanical benefit on majority of hexes. Players using hold on plains are making a strategically null choice without knowing it.

### GAP-3: CP_PER_ROUND = 4 vs design spec of 3
- **Type:** Design doc <-> engine divergence (type 6)
- **Location:** `commands.ts:3` — `export const CP_PER_ROUND = 4`
- **Evidence:** control-auditor. DESIGN.md line 163 says 3. Code says 4. Tests assert 4, encoding the divergence.
- **What exists:** Players get 4 CP per round.
- **What's missing:** No document explains when or why this changed from 3 to 4. Tests claim to validate "design spec" but validate code values.
- **Risk:** 33% more tactical overrides than designed. Changes the directive-vs-manual-control balance.

### GAP-4: Capture directive has no DEF bonus
- **Type:** Design doc <-> engine divergence (type 6)
- **Location:** `combat.ts:33` checks only `directive === 'hold'`. DESIGN.md line 141 says capture should "hold position with DEF bonus."
- **Evidence:** control-auditor behavior check
- **What exists:** Only hold directive gets +1 DEF. Capture directive gets nothing.
- **What's missing:** Contract says capture includes DEF bonus. Code doesn't implement it.
- **Risk:** Units capturing cities are defensively weaker than designed.

### GAP-5: Combat RNG produces identical values within a turn
- **Type:** Uncontracted edge case (type 5)
- **Location:** `game-loop.ts:418,446` — `const combatRng1 = (): number => 0.85 + mulberry32(turnSeed1)() * 0.3`
- **Evidence:** resolution-auditor BUG-1. Each call creates a NEW mulberry32 instance from the same seed, producing the same first value every time.
- **What exists:** Every combat roll in a half-turn returns the identical random value.
- **What's missing:** The RNG closure should create the PRNG once and call it repeatedly.
- **Risk:** All combat in a turn has identical variance. Deterministic but degenerate.

### GAP-6: Both players get identical combat seeds
- **Type:** Uncontracted edge case (type 5)
- **Location:** `game-loop.ts:417,445` — turnSeed1 and turnSeed2 computed from same turnNumber
- **Evidence:** resolution-auditor BUG-2. `state.round.turnNumber` hasn't incremented between the two computations.
- **Risk:** Combined with GAP-5, both players produce identical damage rolls in the same turn.

### GAP-7: filterValidCommands doesn't check CP limits — uncaught throw
- **Type:** Uncontracted edge case (type 5)
- **Location:** `game-state.ts:155` (filterValidCommands) and `commands.ts:17-24` (spendCommand throws)
- **Evidence:** resolution-auditor GAP-2
- **What exists:** Commands are geometry-validated but not CP-validated. `spendCommand` throws on CP exhaustion. This throw is uncaught in `resolveSimultaneousTurn`.
- **Risk:** A player submitting >4 commands or duplicate-unit commands crashes the server resolution for both players.

### GAP-8: state-filter cloneMap drops modifiers field
- **Type:** Uncontracted API surface (type 7)
- **Location:** `state-filter.ts:164` — `cloneMap` omits `modifiers` from the clone
- **Evidence:** resolution-auditor GAP-6
- **What exists:** `cloneMap` copies terrain, elevation, megaHexes, megaHexInfo, but NOT modifiers.
- **Risk:** Clients never receive hex modifier data (rivers, bridges, highways) during gameplay. Modifiers are invisible to players.

### GAP-9: Both-eliminated tiebreak always favors player1
- **Type:** Uncontracted edge case (type 5)
- **Location:** `game-state.ts:581` — `if (p1Units === 0 && p2Units === 0) return { winner: 'player1' }`
- **Evidence:** resolution-auditor GAP-4
- **Risk:** In simultaneous mode where both armies die in the same turn, player1 always wins regardless of resolution order.

---

## SEMANTIC Gaps (behavior is ambiguous or misunderstood)

### GAP-10: Three-way damage formula divergence
- **Type:** Design doc <-> engine divergence (type 6)
- **Location:** DESIGN.md:92-93 vs combat.ts:36-37 vs GAME_MATH_ENGINE.md:263-265
- **Evidence:** combat-auditor formula comparison
- **What exists:** Three structurally different formulas. Code matches neither doc exactly.
- **Risk:** No single source of truth for the core game mechanic.

### GAP-11: moveRange/visionRange +1 on all units — unacknowledged
- **Type:** Design doc <-> engine divergence (type 6)
- **Location:** `units.ts:14,17,25,28,35,39,47,50` — all 8 values are +1 vs DESIGN.md
- **Evidence:** combat-auditor authority chain. Systematic +1 shift, likely from hex-of-hexes scaling. GME §7 records code values without noting divergence.
- **Risk:** Design doc is stale for these values. Tests claim "design spec match" but encode code values.

### GAP-12: Two-layer directive model (ROE) not implemented
- **Type:** Uncontracted mechanic (type 1)
- **Location:** Entire `directives.ts` — flat DirectiveType, no ROE layer
- **Evidence:** control-auditor ROE check. C-TWO-LAYER is specified in RESOLUTION_PIPELINE.md but code uses monolithic directive functions.
- **Risk:** Sprint 1 prerequisite. Every directive is bespoke code rather than composable movement+ROE layers.

### GAP-13: Flank offsets hardcoded for ~20-wide map
- **Type:** Uncontracted balance surface (type 3)
- **Location:** `directives.ts` — q-offsets [-5,-4,-3] / [5,4,3]
- **Evidence:** control-auditor, space-auditor (both flagged). Known issue in MEMORY.md.
- **Risk:** Hex-of-hexes maps have ~30 hex diameter. Offsets may overshoot or produce degenerate waypoints.

### GAP-14: Support healing amount unspecified
- **Type:** Uncontracted mechanic (type 1)
- **Location:** `game-state.ts:289-309` — heal +1 HP per turn
- **Evidence:** control-auditor GAP on support directive
- **What's missing:** DESIGN.md says "heals adjacent friendlies" but no amount. Code does +1. No contract governs the amount.

### GAP-15: Scout standoff distance imprecise
- **Type:** Design doc <-> engine divergence (type 6)
- **Location:** `directives.ts` executeScout — holds at dist <= 2 only
- **Evidence:** control-auditor. Design says "2-3 hex distance." Code uses <= 2 threshold with no 3-hex standoff behavior.

### GAP-16: Attack priority tiebreaker undocumented
- **Type:** Uncontracted mechanic (type 1)
- **Location:** `directives.ts` tryAttackClosest — prefers lower HP targets at equal distance
- **Evidence:** control-auditor. No design doc specifies this targeting preference.

### GAP-17: scoreRound has no phase guard
- **Type:** Uncontracted state transition (type 2)
- **Location:** `game-state.ts:629` — no `phase === 'battle'` check
- **Evidence:** resolution-auditor GAP-1. Every other phase-sensitive function validates phase.
- **Risk:** Engine function callable from any phase without error.

### GAP-18: Within-pass directive ordering uncontracted
- **Type:** Uncontracted mechanic (type 1)
- **Location:** `game-state.ts:238-248` — units processed in array insertion order
- **Evidence:** resolution-auditor GAP-8
- **Risk:** First-placed unit wins hex conflicts. Subtle positional advantage based on unit placement order.

### GAP-19: Cross-player command staleness uncontracted
- **Type:** Uncontracted interaction (type 4)
- **Location:** `game-loop.ts:420-448` — second player's commands execute against post-first-resolution state
- **Evidence:** resolution-auditor GAP-3
- **Risk:** Commands validated at submission but stale at resolution. Wasted commands produce no feedback.

---

## BALANCE Gaps (competitive integrity compromised)

### GAP-20: Type advantage matrix is "broken" per GME — no clean RPS cycle
- **Type:** Uncontracted balance surface (type 3)
- **Location:** `units.ts:88-93` — artillery 1.2-1.3x vs everything, recon crushed by 2 units
- **Evidence:** combat-auditor. GME §3.2 labels current matrix "broken." Target clean 4-unit cycle not implemented.
- **Risk:** Artillery is generalist with no hard counter. Recon has only one niche.

### GAP-21: 1-hit kills on plains prevent RPS from playing out
- **Type:** Uncontracted balance surface (type 3)
- **Evidence:** combat-auditor kill timing analysis. Tank->Infantry=1 hit, Artillery->Tank=1 hit on plains.
- **Risk:** Counter matchups kill instantly. No room for tactical response or disengagement.

### GAP-22: Kill bonus flat 25 — cheap unit farming on larger maps
- **Type:** Uncontracted balance surface (type 3)
- **Location:** `economy.ts:9` — `KILL_BONUS = 25`
- **Evidence:** economy-auditor GAP-3. GME targets `floor(unit.cost * 0.1)`. Map is now ~10x larger.
- **Risk:** Players farm 100-cost recon for 25g each. 25% return on investment per kill regardless of unit type.

### GAP-23: Economy constants not scaled for hex-of-hexes
- **Type:** Uncontracted balance surface (type 3)
- **Evidence:** economy-auditor GAP-4. Original tuning: 7 cities / 280 hexes. Current: ~5 cities / ~2800 hexes.
- **Risk:** Income balance shifted. Fewer cities means city income is proportionally less impactful.

### GAP-24: Starting resources (800) is a magic number with no named constant
- **Type:** Uncontracted balance surface (type 3)
- **Location:** `game-state.ts:50,56` — hardcoded literal 800
- **Evidence:** economy-auditor GAP-2. Only documented in GME.

### GAP-25: 4 of 5 fairness metrics are dead code
- **Type:** Uncontracted mechanic (type 1)
- **Location:** `map-gen-params.ts:163-172` — thresholds exported but never consumed
- **Evidence:** space-auditor GAP-5. Only `FAIR_CITY_DIST_THRESHOLD` is used.
- **Risk:** Maps may be unfair in ways the dead metrics were designed to catch.

---

## OPERATIONAL Gaps (development velocity / testability)

### GAP-26: Hex modifier code paths have zero test coverage
- **Type:** Uncontracted mechanic (type 1)
- **Location:** `terrain.ts:36-43` (getMoveCost), `terrain.ts:57` (getDefenseModifier)
- **Evidence:** space-auditor GAP-1. River/bridge/highway/lake modifiers implemented but untested.

### GAP-27: No test for DEF on plains
- **Evidence:** combat-auditor M1. Would expose GAP-1 immediately.

### GAP-28: No kill-timing tests
- **Evidence:** combat-auditor M3. No test validates C-KILL-TIMING targets (2/3-4/6-7 hits).

### GAP-29: No integration test for net resource formula
- **Evidence:** economy-auditor GAP-5. `max(0, carryover - maintenance + income)` composition untested.

### GAP-30: Scout-first ordering has weak test contract
- **Evidence:** resolution-auditor GAP-7. Test only verifies non-crash, not actual ordering.

### GAP-31: KotH double-increment clamp has no test
- **Evidence:** resolution-auditor GAP-5. Critical win condition logic for simultaneous mode untested.

### GAP-32: 2 failing tests in game-loop.test.ts
- **Location:** `game-loop.test.ts:367,413` — expect turnNumber=3, actual=2
- **Evidence:** resolution-auditor BUG-3. Tests expect turnNumber to increment by 2 per simultaneous turn; code increments by 1.

### GAP-33: AI uses unseeded Math.random() for preset selection
- **Location:** `ai.ts:151`
- **Evidence:** control-auditor V-9. Non-deterministic AI behavior. Cannot reproduce AI matches.

### GAP-34: isValidHex and getAllHexes are vestigial
- **Location:** `hex.ts:67,77` — rectangular grid assumptions
- **Evidence:** space-auditor GAP-6. Still exported and consumed by ai.ts and client renderers.

### GAP-35: MEMORY.md has wrong WORLD_ELEV_STEP value
- **Location:** MEMORY.md says 0.15, actual is 0.75 at `world.ts:22`
- **Evidence:** space-auditor GAP-7

---

## Priority Ranking

### Fix Now (blocks correct gameplay)
1. **GAP-5 + GAP-6**: Combat RNG bug — identical seeds, re-instantiated PRNG
2. **GAP-7**: filterValidCommands CP check — server crash vector
3. **GAP-8**: cloneMap drops modifiers — clients can't see rivers/bridges/highways
4. **GAP-32**: 2 failing tests

### Fix Before Playtest
5. **GAP-1 + GAP-2**: DEF nullified on plains + hold worthless on plains (fix by implementing C-DMG-TARGET formula)
6. **GAP-3**: CP_PER_ROUND 4 vs 3 — decide and document
7. **GAP-4**: Capture directive DEF bonus missing
8. **GAP-9**: Both-eliminated tiebreak fairness

### Fix Before Balance Pass
9. **GAP-20 + GAP-21**: Type advantage matrix + 1-hit kills (fix together with stat scaling)
10. **GAP-22 + GAP-23**: Economy scaling for hex-of-hexes
11. **GAP-13**: Flank offsets parametric

### Document / Decide
12. **GAP-10**: Choose one authoritative damage formula
13. **GAP-11**: Acknowledge moveRange/visionRange +1 change
14. **GAP-24**: Name the starting resources constant
15. **GAP-25**: Implement or delete dead fairness metrics

### Test Coverage
16. **GAP-26 through GAP-31**: Add missing tests for modifiers, DEF-on-plains, kill timing, net resources, scout ordering, KotH clamp

---

## Bugs Found (not gaps — code doing wrong thing)

| ID | Location | Bug | Severity |
|----|----------|-----|----------|
| BUG-1 | game-loop.ts:418 | RNG re-instantiated per call — all rolls identical | Critical |
| BUG-2 | game-loop.ts:417,445 | turnSeed1 === turnSeed2 — both players same seed | Critical |
| BUG-3 | game-loop.test.ts:367,413 | Tests expect wrong turnNumber increment | Moderate |
| BUG-4 | state-filter.ts:164 | cloneMap omits modifiers field | Critical |

---

*End of report. 35 gaps identified across 5 domains. 4 bugs found. 64% weighted contract coverage.*
