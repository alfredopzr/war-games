# Combat Balance Layer 1 — Implementation Plan

Branch: `combat-balance-L1` (off `main`, parallel to `layered-directives`)
Spec: GAME_MATH_ENGINE.md §Math Model, §A2, §A3, §A4

---

## BLOCKER: Terrain System Simplification

**This must land before 1.1/1.2/1.3.** The damage formula (1.3) reads `defenseModifier` from terrain. The terrain system currently has per-terrain defense, movement cost, and LoS rules that are inconsistent, have bugs, and are too complex for players to reason about. Fixing the formula on top of broken terrain semantics means retuning twice.

### Problem Statement

The current terrain system has too many variables that interact in non-obvious ways. A player looking at the board cannot predict what will happen. The rules should follow physical intuition: forests hide you and slow you down, high ground lets you see far, mountains block your line of sight. Everything else should be neutral.

Current complexity a player would need to memorize:

- Plains: moveCost 1, defense 0%, no LoS effect
- Forest: moveCost 2, defense 25%, blocks LoS (terrain flag), conceals units (adjacency-only detection)
- Mountain: moveCost 3, defense 40%, doesn't block LoS (!), infantry/recon only (climb gate)
- City: moveCost 1, defense 30%, no LoS effect
- Highway modifier: moveCost 0.5 for vehicles, defense 0%
- Bridge modifier: moveCost 1, defense 0%
- River/Lake modifier: impassable
- Elevation uphill: +0.5 cost per elevation unit
- Elevation downhill: free
- Elevation climb gate: delta > 3 blocks non-climbers
- Elevation vision: +floor(sqrt(elev)) range
- Elevation LoS: interpolated sight line... but only blocks if terrain has `blocksLoS: true` (BUG — only forest qualifies)
- Forest concealment: units in forest only visible to adjacent observers
- Flank directive: reduces forest cost from 2 to 1

That's 15+ rules across 4 terrain types, 4 modifiers, and elevation. No player can hold this in their head. And several of them are buggy or contradictory.

### Design Goal

Two systems. Physics-based (elevation) and one memorable terrain rule (forest = cover).

**What the player needs to know:**
1. **Forest** = cover. Hides you. Hard to shoot into. Slows you down.
2. **Elevation** = advantage. See farther. Costs more to climb. Blocks sight lines.
3. **Everything else** = neutral ground.

That's it. Three sentences. The rest is just numbers.

### Terrain Simplification Spec

#### Movement Cost

| Terrain | Current | New | Rationale |
|---------|---------|-----|-----------|
| Plains | 1 | 1 | Unchanged |
| Forest | 2 | 2 | Forest is the only terrain with a movement penalty. Trees, undergrowth, no roads. |
| Mountain | 3 | 1 | Remove terrain-level cost. Elevation already penalizes uphill movement (+0.5 per elev unit). A mountain macro-hex has elevation 2-20 — that's +1 to +10 extra cost per step from elevation alone. The terrain moveCost of 3 was double-taxing mountain hexes. |
| City | 1 | 1 | Unchanged |

The flank-directive forest discount (forest cost 2 -> 1) stays. Flanking through forest is a real tactic and the discount makes it viable.

#### Defense Modifier

| Terrain | Current | New | Rationale |
|---------|---------|-----|-----------|
| Plains | 0.00 | 0.00 | Unchanged — open ground, no cover |
| Forest | 0.25 | 0.25 | Forest is the ONLY terrain that provides cover. Canopy, trunks, undergrowth. Players see the trees, they understand "hard to hit." |
| Mountain | 0.40 | 0.00 | Remove. Mountains provide advantage through elevation (vision, LoS blocking, climb cost), not a magic defense aura. A unit standing on a bare rocky peak isn't harder to hit — they're more exposed. |
| City | 0.30 | 0.00 | Remove. Cities are objectives, not fortresses. Holding a city should be valuable for economy, not for a combat bonus that makes cities self-reinforcing defensive positions. If cities give defense, the first player to capture a city gets a defensive advantage that makes it harder to take back — snowball. |

**One rule: forest = cover. Everything else = open.**

#### Line of Sight — Two Independent Systems

Current LoS is broken. `vision.ts:73` requires `intermediateElev >= sightHeight AND TERRAIN[intermediateTerrain].blocksLoS`. Since only forest has `blocksLoS: true`, mountains at elevation 20 don't block sight. This must be two separate checks:

**System 1 — Elevation occlusion (physics-based):**

Any intermediate hex whose elevation exceeds the interpolated sight-line height blocks LoS. Terrain type is irrelevant. A mountain peak between you and the target blocks your view. A hill blocks your view. This is how physics works.

```
// For each intermediate hex on the sight line:
if (intermediateElev > sightHeight) {
  blocked = true;
}
```

Note: changed from `>=` to `>`. A hex at exactly the sight-line height is on the line, not above it. The observer can see over it at a shallow angle. This also prevents flat terrain (elev 0) from blocking other flat terrain (elev 0) on the sight line.

**You can see UP but not BEHIND something above you.** A unit at elevation 0 can see a unit on a ledge at elevation 5 — the sight line goes upward, nothing blocks it. But a unit at elevation 0 cannot see another unit at elevation 0 if there's a ridge at elevation 5 between them — the ridge is above the sight line (interpolated height at the ridge = 0, ridge elev = 5, `5 > 0` = blocked).

Same-elevation units can always see each other on flat ground. The sight line interpolation between two hexes at the same elevation produces a flat line at that elevation. An intermediate hex only blocks if it's strictly above that line.

**System 2 — Forest concealment (terrain-based):**

Forest visibility has three rules:

1. **Outside looking in: blind.** Units inside forest CANNOT be seen by observers outside the forest, regardless of distance. No adjacency exception. You have to enter the forest to find out what's in there.

2. **Inside looking out: reduced vision.** Units inside forest CAN see out, but with a penalty. The canopy limits how far you can see in any direction.

3. **Inside looking inside: same reduced vision.** The penalty applies to all vision from a forest hex, whether looking at forest or open ground.

```
Forest vision penalty: -2 range when observer is on a forest hex
```

This means a recon (vision 6) in forest sees 4 hexes. An infantry (vision 3) in forest sees 1 hex. Forest gives you concealment but costs you awareness. You're hidden, but partially blind. That's the trade-off.

**Removed: `blocksLoS` terrain flag.** No longer needed. Elevation handles physical occlusion. Forest concealment is a separate unit-detection rule, not a sight-line rule. The `TerrainDefinition.blocksLoS` field can be removed from `types.ts`.

#### Elevation Vision Scaling

Current: `floor(sqrt(elevation))`. This gives:

| Elevation | Bonus |
|-----------|-------|
| 1 | +1 |
| 4 | +2 |
| 9 | +3 |
| 16 | +4 |
| 20 | +4 |

The sqrt curve flattens too aggressively. A mountain peak at elevation 20 gets the same bonus as elevation 16. The difference between a hill and a mountain is barely perceptible. A player who fights uphill to a peak should get a meaningful vision reward.

New formula: `floor(elevation / 3)`. This gives:

| Elevation | Bonus |
|-----------|-------|
| 1 | 0 |
| 2 | 0 |
| 3 | +1 |
| 6 | +2 |
| 9 | +3 |
| 12 | +4 |
| 15 | +5 |
| 20 | +6 |

Linear scaling. Every 3 elevation = +1 vision. Predictable. A unit on a mountain peak (elev 20) gets +6 vision — a recon up there sees 12 hexes, which is dominant map awareness. That's the reward for getting a unit to the top.

The `/3` divisor is a tunable constant. Add `VISION_ELEV_DIVISOR = 3` to `map-gen-params.ts`.

#### LoS on Attacks

Current: `canAttack()` (`combat.ts:49-57`) checks distance only. No LoS check. Artillery fires through mountains, over forests, behind ridgelines.

New: attacks require LoS. If you can't see it, you can't shoot it. This doesn't need a separate "LoS on attacks" system — it's the same `calculateVisibility` / elevation occlusion system used for fog of war. If a hex isn't visible to the attacking unit, the unit can't target anything on it.

Implementation: `canAttack()` gains an optional `visibleHexes: Set<string>` parameter. When provided, the target's hex must be in the set. The vision system already computes this per unit — it just needs to be threaded through to the attack check.

This replaces roadmap item 2.5 ("LoS on attacks"). That item was poorly defined — LoS and attacks are the same question. You can't attack what you can't see. Period.

#### Capture HP Cost

Current: `-1 HP` per city flip (`game-state.ts:798`). Already one-time (only fires when `currentOwner !== unit.owner`, line 795). With HP scaling to 30-40, `-1` is negligible.

New: `ceil(maxHp * 0.1)` = infantry loses 3 HP, tank loses 4 HP per capture. 10% of max health. Three city captures costs 30% HP — meaningful trade-off. The one-time behavior is already correct.

This change lives in `game-state.ts:798`. One line. The directive branch touches surrounding code (directive field renames) so this will produce a merge conflict, but it's a trivial one-line resolution.

---

### Terrain Simplification — Files Touched

| File | Change |
|------|--------|
| `terrain.ts` | Mountain moveCost 3 -> 1. Mountain defenseModifier 0.4 -> 0. City defenseModifier 0.3 -> 0. Remove `blocksLoS` from TERRAIN records. |
| `types.ts` | Remove `blocksLoS` from `TerrainDefinition`. |
| `vision.ts` | Rewrite LoS check: elevation occlusion without `blocksLoS` gate. Add forest vision penalty (-2 range). |
| `map-gen-params.ts` | Add `VISION_ELEV_DIVISOR = 3`. Add `FOREST_VISION_PENALTY = 2`. |
| `combat.ts` | Add `visibleHexes?` param to `canAttack()`. |
| `game-state.ts` | Thread visibility set to attack checks. Capture HP cost scaling. |
| `terrain.test.ts` | Update defense modifier assertions. Update moveCost assertions. |
| `vision.test.ts` | Rewrite LoS tests: mountain occlusion, forest vision penalty, elevation-only blocking. |
| `combat.test.ts` | Add LoS-gated attack tests. |

### Terrain Simplification — What the Player Learns

```
FOREST:  Slow (cost 2). Cover (25% damage reduction). Invisible from outside. Reduced vision inside.
         "Forest = ambush terrain. You're hidden, but partially blind."

ELEVATION: Costs more to climb. See farther from high ground. Mountains block sight lines.
           Can't shoot what you can't see.
           "High ground = vision advantage. Low ground = hidden approach."

EVERYTHING ELSE: Neutral. No movement penalty. No defense bonus. No visibility tricks.
                 "Plains, cities, mountains = open ground. What you see is what you get."
```

Three concepts. No per-terrain stat tables to memorize.

---

### Implementation Order (revised)

**Phase 0 — Terrain simplification** (this section, BLOCKER):
1. `types.ts` — Remove `blocksLoS` from `TerrainDefinition`
2. `terrain.ts` — Update TERRAIN records (mountain moveCost, defense modifiers)
3. `map-gen-params.ts` — Add `VISION_ELEV_DIVISOR`, `FOREST_VISION_PENALTY`
4. `vision.ts` — Elevation occlusion rewrite, forest vision penalty
5. `combat.ts` — Add LoS to `canAttack()`
6. `game-state.ts` — Thread visibility, capture HP cost
7. All affected tests

**Phase 1 — Combat balance** (1.1, 1.2, 1.3 as originally planned):
1. `units.ts` — RPS matrix + stat scaling
2. `combat.ts` — Damage formula
3. All combat/integration tests

Phase 1 depends on Phase 0 because the damage formula reads `defenseModifier`. If we change which terrains have defense modifiers (Phase 0), then the kill timing verification in Phase 1 needs to reflect the simplified terrain. Doing it in the wrong order means verifying kill timing against terrain values that are about to change.

---

## Scope

Three engine changes that can land independently of the two-layer directive refactor:

| Item | What | Files touched |
|------|------|---------------|
| 1.1  | Clean 4-unit RPS matrix | `units.ts` |
| 1.2  | HP/stat scaling (x10) | `units.ts`, `types.ts` (if UnitStats changes), `economy.ts` |
| 1.3  | Damage formula fix | `combat.ts`, `terrain.ts` |

All three share a test surface (`combat.test.ts`, `units.test.ts`, `economy.test.ts`, `game-state.test.ts`, `integration.test.ts`). Ship together — partial application breaks kill timing.

---

## Directive Branch Interaction

The directive refactor changes `defender.directive === 'hold'` to `defender.movementDirective === 'hold'` in `combat.ts:33`. This branch changes the formula around that line. **One-line merge conflict**, resolved by using `movementDirective` with the new formula. No other overlap — RPS matrix, stats, and formula don't read directive fields.

---

## 1.1 — Clean RPS Matrix

### Current (units.ts:120-125)

```
infantry:  { infantry: 1.0, tank: 0.5, artillery: 1.2, recon: 1.0 }
tank:      { infantry: 1.5, tank: 1.0, artillery: 1.2, recon: 1.5 }
artillery: { infantry: 1.3, tank: 1.3, artillery: 1.0, recon: 1.3 }
recon:     { infantry: 0.8, tank: 0.3, artillery: 1.5, recon: 1.0 }
```

Problems: artillery is a generalist (1.2-1.3x everything), tank dominates two types, no clean cycle.

### Target (GAME_MATH_ENGINE.md §A2)

```
infantry:  { infantry: 1.0, tank: 0.6, artillery: 1.0, recon: 2.0 }
tank:      { infantry: 2.0, tank: 1.0, artillery: 0.6, recon: 1.0 }
artillery: { infantry: 1.0, tank: 2.0, artillery: 1.0, recon: 1.0 }
recon:     { infantry: 1.0, tank: 1.0, artillery: 2.0, recon: 1.0 }
```

Cycle: Tank -> Infantry -> Recon -> Artillery -> Tank. Each unit has exactly one 2.0x counter and one 0.6x weakness. All other matchups neutral.

### Why 0.6x not 0.5x

GAME_MATH_ENGINE.md §Math Model: 0.5x with the ATK/DEF ratios produces 8-10 hits to kill in disadvantaged matchups. The disadvantaged unit almost never dies in a 1v1 without external pressure, killing the RPS cycle. 0.6x produces 6-7 hits — disadvantaged unit dies but has time to survive until help arrives.

**Open tuning item:** If playtests show disadvantaged fights resolve too quickly, revert to 0.5x and accept longer fights. Test data decides. (GAME_MATH_ENGINE.md §Math Model, final paragraph under Starting Stats.)

---

## 1.2 — HP & Stat Scaling

### Core Invariant (GAME_MATH_ENGINE.md §Math Model)

```
ATK = HP * 0.35    (rounded to nearest integer)
DEF = max(1, round(HP * 0.05))
```

### Target Stats

Source: GAME_MATH_ENGINE.md §Starting Stats (lines 239-244). These are derived from the invariant.

| Unit      | HP | ATK | DEF | Cost | moveRange | attackRange | minAttackRange | visionRange | canClimb |
|-----------|----|-----|-----|------|-----------|-------------|----------------|-------------|----------|
| Infantry  | 30 | 10  | 2   | 100  | (scaled)  | 1           | 1              | 3           | true     |
| Tank      | 40 | 14  | 2   | 250  | (scaled)  | 1           | 1              | 3           | false    |
| Artillery | 20 | 10  | 1   | 200  | (scaled)  | 3           | 2              | 3           | false    |
| Recon     | 20 | 7   | 1   | 100  | (scaled)  | 1           | 1              | 6           | true     |

### Invariant Verification

```
Infantry:  ATK = round(30 * 0.35) = round(10.5) = 10  DEF = max(1, round(30 * 0.05)) = max(1, round(1.5)) = 2
Tank:      ATK = round(40 * 0.35) = round(14.0) = 14  DEF = max(1, round(40 * 0.05)) = max(1, round(2.0)) = 2
Artillery: ATK = round(20 * 0.35) = round(7.0)  = 7   DEF = max(1, round(20 * 0.05)) = max(1, round(1.0)) = 1
Recon:     ATK = round(20 * 0.35) = round(7.0)  = 7   DEF = max(1, round(20 * 0.05)) = max(1, round(1.0)) = 1
```

### Artillery ATK Override

Artillery invariant gives ATK=7. Spec bumps it to ATK=10.

Reason (GAME_MATH_ENGINE.md §Starting Stats, Artillery note): Counter vs tank at ATK=7 gives `(7 * 2.0) - 2 = 12 dmg`, tank HP=40, kills in 4 hits. Violates the 2-hit counter target. At ATK=10: `(10 * 2.0) - 2 = 18 dmg`, 40/18 = 2.2 hits, kills in 2-3 with RNG. Acceptable.

**This is an intentional invariant violation.** Document it, don't hide it.

### A4 Contradiction — RESOLVED

GAME_MATH_ENGINE.md §A4 (line 1030) lists different values (Infantry ATK=20, DEF=20, etc.). These are from an early draft before the math model was developed. The §Starting Stats table (line 239) is derived from the invariant and internally consistent. **§Starting Stats is authoritative. §A4 is stale and should be corrected in GAME_MATH_ENGINE.md.**

### Economy Interaction

Unit costs stay the same (100/250/200/100). HP scaling doesn't affect purchase cost, maintenance, or income. But:

- **Support healing** (`game-state.ts:248-269`): currently +1 HP flat. With HP 20-40, +1 HP is negligible (2.5-5% of max). Deferred — directive branch touches support behavior, scale when that stabilizes.
- **City capture HP cost**: scaled in Phase 0 (terrain simplification) to `ceil(maxHp * 0.1)`.
- **Kill bonus**: stays flat 25g per unit (economy.ts:9). Scaling to `floor(cost * 0.1)` is item 2.3 (Layer 2), not in this branch.

---

## 1.3 — Damage Formula

### Current Formula (combat.ts:36-37)

```
baseDamage = ATK * typeMultiplier * randomFactor
finalDamage = max(1, floor(baseDamage - effectiveDef * terrainDef))
```

Bug: on plains (`terrainDef = 0`), the entire DEF term is `effectiveDef * 0 = 0`. DEF stat does nothing on 60%+ of the map.

### Target Formula (GAME_MATH_ENGINE.md §A3)

```
finalDamage = max(1, floor(
  (ATK * typeMultiplier * randomFactor) * (1 - terrainDefense) - DEF
))
```

Terrain reduces incoming raw damage as a percentage. DEF subtracts flat after. DEF is meaningful on all terrain including plains.

### Terrain Defense Values (post-simplification)

After Phase 0 terrain simplification:

| Terrain  | defenseModifier |
|----------|-----------------|
| Plains   | 0.00 |
| Forest   | 0.25 |
| Mountain | 0.00 |
| City     | 0.00 |

Only forest provides cover. All kill timing verification below uses these values.

### Kill Timing Verification — Open Ground (defenseModifier = 0)

This applies to plains, mountain, and city — all open ground post-simplification.

```
Counter (2.0x), roll=1.0:
  Tank vs Infantry: (14 * 2.0 * 1.0) * (1 - 0) - 2 = 28 - 2 = 26 dmg.  30/26 = 1.15 -> 2 hits
  Infantry vs Recon: (10 * 2.0 * 1.0) * 1 - 1 = 20 - 1 = 19 dmg.  20/19 = 1.05 -> 2 hits
  Recon vs Artillery: (7 * 2.0 * 1.0) * 1 - 1 = 14 - 1 = 13 dmg.  20/13 = 1.54 -> 2 hits
  Artillery vs Tank: (10 * 2.0 * 1.0) * 1 - 2 = 20 - 2 = 18 dmg.  40/18 = 2.22 -> 3 hits

Counter target: 2 hits.
Result: 3 of 4 matchups hit 2 hits. Artillery vs Tank is 3 hits (known, documented in spec as acceptable).
```

```
Neutral (1.0x), roll=1.0:
  Infantry vs Artillery: (10 * 1.0 * 1.0) * 1 - 1 = 9 dmg.  20/9 = 2.22 -> 3 hits
  Infantry vs Infantry: (10 * 1.0 * 1.0) * 1 - 2 = 8 dmg.  30/8 = 3.75 -> 4 hits
  Tank vs Recon: (14 * 1.0 * 1.0) * 1 - 1 = 13 dmg.  20/13 = 1.54 -> 2 hits (!)
  Tank vs Tank: (14 * 1.0 * 1.0) * 1 - 2 = 12 dmg.  40/12 = 3.33 -> 4 hits
  Recon vs Infantry: (7 * 1.0 * 1.0) * 1 - 2 = 5 dmg.  30/5 = 6 -> 6 hits (!)

Neutral target: 3-4 hits.
Result: Tank vs Recon is 2 hits (too fast). Recon vs Infantry is 6 hits (too slow).
```

**Known outlier — Tank vs Recon (2 hits, neutral):** Documented in GAME_MATH_ENGINE.md §Starting Stats: "Recon dying fast to tanks is acceptable by design. Recon should not be fighting tanks directly — if it is, planning failed. Monitor in logs. If recon is dying to tanks before it can disengage, the ROE system is the fix, not stat changes."

**Known outlier — Recon vs Infantry (6 hits, neutral):** Recon ATK=7 is low by design. Recon is a scout, not a fighter. 6 hits means recon can't kill infantry in the field without help. Acceptable — recon's value is information, not damage.

```
Disadvantaged (0.6x), roll=1.0:
  Actual disadvantaged pairs:
  Infantry vs Tank:     floor((10 * 0.6) * 1 - 2) = 4 dmg -> ceil(40/4) = 10 hits
  Tank vs Artillery:    floor((14 * 0.6) * 1 - 1) = 7 dmg -> ceil(20/7) = 3 hits

Disadvantaged target: 6-7 hits.
Result: Infantry vs Tank is 10 hits (too slow). Tank vs Artillery is 3 hits (too fast).
```

**Disadvantaged matchup asymmetry.** The 4-unit cycle with heterogeneous stats can't produce uniform disadvantaged timing. Accept it. The Monte Carlo harness flags outliers.

### Kill Timing Verification — Forest (defenseModifier = 0.25)

```
Counter (2.0x), roll=1.0, defender in forest:
  Tank vs Infantry: (14 * 2.0) * 0.75 - 2 = 21 - 2 = 19 dmg.  30/19 = 1.58 -> 2 hits
  Artillery vs Tank: (10 * 2.0) * 0.75 - 2 = 15 - 2 = 13 dmg.  40/13 = 3.08 -> 4 hits

Neutral (1.0x), roll=1.0, defender in forest:
  Infantry vs Infantry: (10 * 1.0) * 0.75 - 2 = 5.5 - 2 = 3 dmg.  30/3 = 10 -> 10 hits
  Tank vs Tank: (14 * 1.0) * 0.75 - 2 = 10.5 - 2 = 8 dmg.  40/8 = 5 -> 5 hits
```

Forest is now the ONLY defensive terrain. It pushes neutral infantry mirror from 4 hits to 10 hits. That's enormous — forest is a real stronghold. This makes forest the key tactical terrain: it's where you set ambushes, where you dig in, where you fight if you're outnumbered. Mountains give you vision. Forest gives you survival. Clear strategic identity for each.

---

## Hold Bonus

### Decision: keep +1 flat DEF.

The spec says +1. DEF subtracts flat in the new formula, so +1 DEF always removes exactly 1 damage per hit. On infantry taking 8 dmg/hit, hold makes it 7 dmg/hit — 4 hits becomes 5 hits. One extra hit to survive. Clean, predictable.

The combat timeline (0.4) will add ROE-based modifiers. Hold is a positional stance, ROE is an engagement stance. Don't over-engineer hold before the system it plugs into exists.

---

## Support Healing

### Decision: defer.

Currently +1 HP flat. Negligible at 10x HP. But support behavior is being rewritten by the directive branch (`specialtyModifier === 'support'`), and the combat timeline changes when healing fires (Phase 8, after all combat). Scale healing when both systems stabilize.

---

## Capture HP Cost

### Decision: scale to `ceil(maxHp * 0.1)`, keep one-time behavior.

Already one-time in the code — only fires when `currentOwner !== unit.owner` (`game-state.ts:795`). Once the city flips to the capturing unit's owner, subsequent turns don't cost HP. Infantry (HP 30) loses 3 HP per capture. Three cities = 9 HP = 30% of max. Real trade-off.

Included in Phase 0 (terrain simplification), not Phase 1.

---

## Monte Carlo Verdict Thresholds

The `[MATH_AUDIT]` logging spec (GAME_MATH_ENGINE.md §AI vs AI Logging Spec) uses verdicts but doesn't define exact thresholds. Defining them here for the test harness:

| Matchup class | Target hits | ON_TARGET | TOO_FAST | TOO_SLOW |
|---------------|-------------|-----------|----------|----------|
| Counter (2.0x) | 2 | 1-2 | — | 3+ |
| Neutral (1.0x) | 3-4 | 2-5 | 1 | 6+ |
| Disadvantaged (0.6x) | 6-7 | 4-9 | 1-3 | 10+ |
| Mirror (self) | same as neutral | 2-5 | 1 | 6+ |

**Wide ON_TARGET bands are intentional.** Forest (the only cover terrain) and RNG shift hit counts. A counter fight in forest might take 3-4 hits — that's terrain working, not broken balance. The verdicts flag statistical outliers across 100+ matches, not individual fights.

**Per-match aggregate thresholds** (GAME_MATH_ENGINE.md §AI vs AI Logging Spec):
- `dominant_unit` appearing in >40% of MATCH_END events -> unit is overtuned
- `rng_tiebreaks_pct` > 15% -> modifier stack needs more differentiation
- `TOO_FAST` or `TOO_SLOW` matchups exceeding 15% of all KILL events -> stat adjustment needed

---

## HexModifier Interactions

`getDefenseModifier()` (terrain.ts:75-78) returns 0 for highway, bridge, and lake. In the new formula:

```
(ATK * typeMul * rng) * (1 - 0) - DEF = (ATK * typeMul * rng) - DEF
```

No terrain reduction. Full damage minus DEF. Units on highways/bridges are fully exposed. Correct behavior — no change needed.

---

## Implementation Order

**Phase 0 — Terrain simplification (BLOCKER):**
1. `types.ts` — Remove `blocksLoS` from `TerrainDefinition`
2. `terrain.ts` — Mountain moveCost 3 -> 1, mountain defenseModifier 0.4 -> 0, city defenseModifier 0.3 -> 0
3. `map-gen-params.ts` — Add `VISION_ELEV_DIVISOR = 3`, `FOREST_VISION_PENALTY = 2`
4. `vision.ts` — Elevation occlusion (remove `blocksLoS` gate), forest vision penalty, new vision bonus formula
5. `combat.ts` — Add LoS param to `canAttack()`
6. `game-state.ts` — Thread visibility to attack checks, capture HP cost scaling
7. All affected test files

**Phase 1 — Combat balance (1.1 + 1.2 + 1.3):**
1. `units.ts` — Update `UNIT_STATS` (HP, ATK, DEF) and `TYPE_ADVANTAGE` matrix
2. `combat.ts` — Rewrite `calculateDamage()` formula
3. `combat.test.ts` — Rewrite all expected values, add kill-timing verification tests
4. `units.test.ts` — Update stat assertions
5. `game-state.test.ts`, `integration.test.ts` — Update expected HP/damage values
6. Other test files — grep for old stat values and update

---

## Test Plan — Monte Carlo Readiness

### Unit tests (combat.test.ts)

Per-matchup kill timing on open ground (plains/mountain/city, defenseModifier=0) with roll=1.0:

| Test | Attacker | Defender | Terrain | Expected dmg | Expected hits |
|------|----------|----------|---------|-------------|---------------|
| counter: tank vs infantry | tank | infantry | plains | 26 | 2 |
| counter: infantry vs recon | infantry | recon | plains | 19 | 2 |
| counter: recon vs artillery | recon | artillery | plains | 13 | 2 |
| counter: artillery vs tank | artillery | tank | plains | 18 | 3 |
| neutral: infantry vs infantry | infantry | infantry | plains | 8 | 4 |
| neutral: tank vs tank | tank | tank | plains | 12 | 4 |
| neutral: tank vs recon | tank | recon | plains | 13 | 2 |
| neutral: recon vs infantry | recon | infantry | plains | 5 | 6 |
| disadvantaged: infantry vs tank | infantry | tank | plains | 4 | 10 |
| disadvantaged: tank vs artillery | tank | artillery | plains | 7 | 3 |
| min damage floor | any weak matchup | — | — | — | always >= 1 |

Forest variants (defenseModifier=0.25):

| Test | Attacker | Defender | Terrain | Expected dmg | Expected hits |
|------|----------|----------|---------|-------------|---------------|
| counter: tank vs infantry | tank | infantry | forest | 19 | 2 |
| neutral: infantry vs infantry | infantry | infantry | forest | 3 | 10 |
| neutral: tank vs tank | tank | tank | forest | 8 | 5 |

Mountain/city variants should produce SAME values as plains (defenseModifier=0 post-simplification).

### Hold bonus tests

Hold adds +1 DEF, reduces damage by exactly 1 per hit:
- Tank vs infantry (hold) on plains: 26 - 1 = 25 dmg. 30/25 = 1.2 -> 2 hits (same)
- Infantry vs infantry (hold) on plains: 8 - 1 = 7 dmg. 30/7 = 4.3 -> 5 hits (one more)

### LoS-gated attack tests

- Artillery cannot attack target behind mountain ridge (elevation occlusion)
- Infantry cannot attack adjacent unit behind a cliff it can't see over (no melee exception)
- Unit in forest is not targetable by any unit outside the forest (concealment — no adjacency exception)
- Unit in forest CAN attack unit in forest within reduced vision range
- Unit in forest CAN attack unit on open ground within reduced vision range

### Vision tests

- Mountain peak (elev 20) blocks LoS for observers on both sides
- Unit in forest has vision reduced by 2
- Unit at elevation 12 gets +4 vision bonus (floor(12/3))
- Unit at elevation 20 gets +6 vision bonus (floor(20/3))

### RNG band tests

Verify damage range with min roll (0.85) and max roll (1.15) for representative matchups. Confirm no matchup produces 0 damage (min floor = 1).

### Integration sanity

Full game loop with new stats + simplified terrain: units don't die in 1 hit, rounds don't end in 1 turn, AI builds still function with same costs.

---

## Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| A4 vs §Starting Stats contradiction | §Starting Stats is authoritative | Derived from invariant, internally consistent |
| Artillery ATK override (10 vs invariant 7) | Accept override | Documented in spec, needed for counter target |
| Terrain defense modifiers | Forest only (0.25). Mountain/city -> 0. | One memorable rule: forest = cover |
| Mountain moveCost | 1 (was 3) | Elevation already penalizes. Double-taxing removed. |
| LoS blocking | Elevation-based (physics), not terrain flag | Mountains block sight. `blocksLoS` removed. |
| Forest concealment | Invisible from outside (no adjacency exception), -2 vision for units inside | Hidden but partially blind — that's the trade-off |
| Vision elevation scaling | floor(elev/3), replacing floor(sqrt(elev)) | Linear, predictable, rewards high ground more |
| LoS on attacks | Attacks require LoS (same system as vision) | Can't shoot what you can't see |
| Hold bonus | Keep +1 flat | Spec says +1, combat timeline adds ROE modifiers |
| Support healing scaling | Defer | Directive branch + combat timeline will rewrite |
| Capture HP cost | Scale to ceil(maxHp * 0.1), one-time on flip | Gates snowball capture chains |
| Disadvantaged matchup asymmetry | Accept, log with verdicts | Heterogeneous stats can't produce uniform timing |

---

## Resolved Questions

1. **Range-1 attacks and LoS**: No exception. If you can't see them, you can't hurt them. Period. Adjacent units behind a cliff edge you can't see over? Can't attack. This keeps the rule absolute — no special cases to memorize.

2. **Forest concealment + attacks**: Units in forest are invisible to anyone outside the forest. Can't see them, can't target them, can't attack them. You have to enter the forest. Once inside, you can see (with reduced range) and fight normally.

3. **Elevation occlusion threshold**: Strict `>`. Same-elevation units see each other on flat ground. You can see a unit above you on a ledge (sight line goes up, nothing blocks). You can't see a unit behind something taller than the sight line.
