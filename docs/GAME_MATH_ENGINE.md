# ChackAttacc — Game Design & Math Engine

---

## NAME OPTIONS

| Name | Origin | Why it fits |
|------|--------|-------------|
| **Rubicon** | Caesar crossed the Rubicon and there was no going back. That's the game in one word. Irreversible commitment. Poker players feel this every time they shove. Military players know the history. Nobody needs it explained. |
| **Sealed Orders** | Real military term. Commanders received orders they couldn't open until a specific moment. Hidden information, then reveal. The structure of the game in two words. Poker players recognize the mechanic immediately without it ever saying poker. |
| **Feint** | Military and fencing term for a move designed to deceive. You advance on the left to draw attention from the right. That's bluffing. That's the directive system. One word, completely on brand, zero poker vocabulary. |
| **Dead Reckoning** | Navigation term. You calculate your position from your last known point with no landmarks. Pure estimation under uncertainty. What every player is doing every turn. |

---

## INTRO — VISION & IDENTITY

### What This Game Is

A multiplayer hex-based tactical strategy game where players do not micromanage units. Instead, players assign **directives** — high-level standing orders — and watch their strategy execute autonomously. Skill lives in the planning phase and in knowing when to spend limited command points to intervene.

The core emotional experience is **commitment under uncertainty**. Both players plan simultaneously, then reveal. Plans collide. Neither player was reacting — they were predicting.

**One sentence:** Poker-meets-tactics. Hidden information, reading your opponent, committing to a plan.

### The Differentiator

Most tactics games are about execution — who moves units better in the moment. This game is about prediction — who reads their opponent better before the turn resolves.

The "show your hands" moment is the product. Every system exists to make that moment more dramatic and more legible.

### The Mechanical Core

```
PLAN (hidden) → COMMIT (simultaneous) → REVEAL → RESOLVE → REPEAT
```

This is a chain, not a loop. Each step increases emotional investment because the player has stacked irreversible decisions. The reveal is the climax. If the reveal is dramatic and understandable, the design works. If it feels random or confusing, it collapses.

### Target Audience

Primary: competitive strategy players who are bored of pure execution games. The lawyer who is grandchamp at Rocket League and top 1% in LoL — extremely high IQ, craves games that reward strategic reasoning over mechanical skill.

Secondary: poker and crypto communities. Players who already understand hidden information, reading opponents, and committing under uncertainty. They will find the game's language immediately familiar and will naturally create betting/staking ecosystems around it.

### Closest Comps

- **Mechabellum** — auto-battle tactics with placement phase. Most direct mechanical analogue. ~400k-700k owners. Proved the market exists.
- **The Battle of Polytopia** — hex strategy, accessible, mobile-first. Proved hex strategy scales.
- **Into the Breach** — deterministic tactical systems attract hardcore strategy players.
- **Poker** — not a game comp, a design comp. Hidden info + commit + reveal.

### Realistic Market Position

Not a mass-market genre. A solid competitive niche.

- Expected case: 40k units × $20 = ~$560k net (after Steam cut)
- Good case: 150k units = ~$2M net
- Breakout: <5% probability

The AI art and AI-assisted code pipeline eliminates the art and dev bottleneck that used to kill small teams. The new risk is not execution — it's visibility. Wishlists before launch determine everything.

### Market Risk — Honest Odds Assessment

*Assumes perfect execution and targeted social media marketing toward poker and crypto communities.*

The base rate is brutal. 79% of Steam releases in 2024 never crossed the visibility threshold. Not bad games — structural reality of the platform. Most games disappear because nobody saw them, not because they were bad. Perfect execution removes execution risk. It does not remove market risk.

**Probability breakdown:**

| Outcome | Probability | What it looks like |
|---------|-------------|-------------------|
| Quiet flop | 40% | Sub-5k sales, multiplayer dies month 1, becomes a solo curiosity |
| Limited success | 35% | 10k-40k sales, small dedicated community, breaks even |
| Expected case | 15% | 40k-150k sales, active ranked ladder, sustainable |
| Breakout | 10% | 150k+ sales, viral moment, poker community adopts it |

Flop probability with perfect execution: ~40%. The 60% success side is real but so is the 40%.

**The risks that survive perfect execution:**

- **Multiplayer liquidity is the most likely killer.** The game requires opponents. If the player base doesn't hit critical mass in launch week, matchmaking dies. 3,000 players spread across 24 time zones is an unplayable game. Marketing doesn't fully solve this — you need concentration at launch, not just total numbers.
- **The reveal moment must land on video.** The entire marketing thesis depends on the "show your hands" moment being viscerally understandable to someone who has never played. If the first clip requires explanation, it doesn't spread. Legible in 15 seconds to a stranger — that's the bar. This is a design and UX risk, not just a marketing risk.
- **The poker community might not convert.** They understand the concept immediately. But affinity for a concept doesn't guarantee installation, learning a new interface, and finding opponents. The activation energy is real.
- **Match length is load-bearing for social media.** Short matches produce clips. Long matches produce Reddit threads. Clips spread. If map scaling pushes matches to 25+ minutes, the marketing strategy weakens meaningfully. The 15-20 minute target must hold.

**What moves the needle most:**

One streamer or content creator in the poker/competitive gaming space gets outread badly in a close match and posts it. That single organic clip is worth more than any paid campaign. The game is designed to produce that moment — someone making the wrong read and watching their plan get dismantled in real time. That's inherently watchable. That's the product.

The Steam wishlist number before launch is the single most predictive metric:

```
7k wishlists  = visibility threshold (algorithmic discovery kicks in)
50k wishlists = momentum (launch week has enough players to sustain matchmaking)
```

Everything between the Steam page going live and release should point at that number.

The multiplayer liquidity cliff is the scenario that turns a slow launch into a dead game. Mitigation: bots on day one, async play option, Steam page live as early as possible. These are not nice-to-haves — they are launch survival infrastructure.

### The Multiplayer Liquidity Problem

The single biggest structural risk. Multiplayer games need concurrent players. If launch visibility is poor (<7k wishlists), matchmaking dies in week 2 and the game quietly disappears. Mitigation: strong bots, async play option, Steam page live as early as possible, build community before launch.

---

## DECISIONS

**Moved to [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md).** D1-D13 locked decisions and T1-T4 design tensions with Fred's v1.0 doc.

---

## MATH MODEL — COMBAT BALANCE FRAMEWORK

*This section defines the mathematical framework that governs all unit balance. Specific numbers are starting points derived from the framework. Final values come from AI vs AI test data. The ratios are the invariant — not the numbers.*

---

### Balance Controller

**File:** `strategy_game_balance_master.xlsx` (project root)

This spreadsheet is the single source of truth for all balance numbers. The engine reads from code constants, but the spreadsheet is where tuning happens. When running balance passes, update the spreadsheet first, then sync to code.

**Sheets:**

| Sheet | Role |
|-------|------|
| `UnitStats` | Master table: HP, ATK, DEF, Cost, ResponseTime per unit. All other sheets derive from this. |
| `TypeMatrix` | 4×4 type advantage multipliers. Change a cell, DamageMatrix and HitsToKill recalculate. |
| `DamageMatrix` | Computed. `MAX(1, ATK × typeMultiplier - DEF)` per matchup. Plains-only (no terrain factor). |
| `HitsToKill` | Computed. `CEILING(defenderHP / damage)` per matchup. The primary balance readout — compare against kill timing targets below. |
| `Initiative` | Derived from UnitStats.ResponseTime. Reference sheet for combat timeline Phase 5/6 ordering. |
| `Terrain` | Defense reduction values per terrain type. Feed into the full damage formula (not yet wired into DamageMatrix). |
| `RNGModel` | Random factor range [0.85, 1.15]. Controls variance band width. |
| `MatchAnalytics` | Template for AI vs AI test output. Columns: MatchID, AvgHitsToKill, CounterKills, NeutralKills, DisadvantageKills, RNGTieRate. |

**Workflow:**

1. Adjust values in `UnitStats` or `TypeMatrix`
2. Check `HitsToKill` against kill timing targets (2 hits counter, 3-4 neutral, 6-7 disadvantaged)
3. If HitsToKill looks right, sync to engine constants and run AI vs AI matches
4. Log results in `MatchAnalytics`, compare `[MATH_AUDIT]` verdicts against spreadsheet predictions
5. If verdicts diverge from spreadsheet (terrain, RNG, melee not modeled in sheet), the spreadsheet needs a new column or the formula needs the terrain factor

**Monte Carlo usage:** Swap UnitStats values to test scenarios. Run spreads on baseline values (e.g., ATK ± 2, HP ± 5) and check whether HitsToKill stays within target bands across the spread. If a ±2 ATK change flips a matchup from 3-hit to 2-hit, that stat is on a cliff — widen the HP gap or narrow the multiplier.

**Current divergences from doc:** The spreadsheet is a living tuning surface. Values in the sheet may differ from the Math Model starting stats below. When they diverge, the spreadsheet is authoritative for implementation. The doc defines the framework and targets; the sheet holds the actual numbers being tested.

---

### The Core Invariant

All units must satisfy:

```
ATK = HP × 0.35        (rounded to nearest integer)
DEF = max(1, round(HP × 0.05))
```

This keeps lethality proportional across units. Any new unit — including future aircraft and anti-air — must follow these ratios to slot into balance without breaking existing matchups. If a unit needs to feel different, adjust HP first. ATK and DEF follow.

---

### Kill Timing Targets

```
Counter matchup (2.0×):       2 hits to kill
Neutral matchup (1.0×):       3-4 hits to kill  
Disadvantaged matchup (0.6×): 6-7 hits to kill
```

**Why 2 hits for counter:** Fast enough that counter relationships resolve in the field. The RPS cycle only works if catching your counter actually wins the fight.

**Why 3-4 for neutral:** Gives the losing unit time to react — disengage, call for help, change ROE. Splitting units is costly. Single units should survive long enough to matter.

**Why 6-7 for disadvantaged:** A disadvantaged unit in a 1v1 will eventually die but has time to survive until help arrives. Multiple attackers collapse it fast. This is intentional — coordinated attacks should be decisive.

**Why not 0.5× for disadvantaged:** 0.5× with the ratios produces 8-10 hits. The disadvantaged unit almost never loses a 1v1 without external pressure, which kills the RPS cycle. 0.6× matches the design target.

---

### Derivation

On plains terrain (`terrainDef = 0`), ignoring random variance, the damage formula simplifies to:

```
finalDamage = ATK × typeMultiplier − DEF
```

Plugging in the ratios:

```
Counter (2.0×):
  HP×0.35×2.0 − HP×0.05 = 0.65HP per hit → 2 hits ✓

Neutral (1.0×):
  HP×0.35×1.0 − HP×0.05 = 0.30HP per hit → 3-4 hits ✓

Disadvantaged (0.6×):
  HP×0.35×0.6 − HP×0.05 = 0.16HP per hit → 6-7 hits ✓
```

**Rounding note:** `floor()` in the damage formula clips low damage values, systematically lengthening fights by ~0.5-1 hit in practice. This is acceptable — the targets are design intent, not hard constraints. Real hit counts come from `[MATH_AUDIT]` logs.

**DEF must use `round()` not `floor()`:** `floor()` truncates DEF harder than ATK, making low-HP units disproportionately lethal. Use `max(1, round(HP × 0.05))`.

---

### Type Advantage Matrix

Clean 4-unit cycle. Each unit dominates one other unit and is dominated by one other unit. All other matchups neutral.

```
Tank      → beats → Infantry   (2.0×)
Infantry  → beats → Recon      (2.0×)
Recon     → beats → Artillery  (2.0×)
Artillery → beats → Tank       (2.0×)
```

Full matrix:

| ATK↓ DEF→ | Infantry | Tank | Artillery | Recon |
|-----------|----------|------|-----------|-------|
| **Infantry** | 1.0 | 0.6 | 1.0 | 2.0 |
| **Tank** | 2.0 | 1.0 | 0.6 | 1.0 |
| **Artillery** | 1.0 | 2.0 | 1.0 | 1.0 |
| **Recon** | 1.0 | 1.0 | 2.0 | 1.0 |

Disadvantaged slots use 0.6×, not 0.5×. Mirror slots (Tank disadvantaged vs Artillery, Infantry disadvantaged vs Tank) are symmetric.

---

### Starting Stats

Derived from the invariant ratios. These are frameworks, not finals.

| Unit | HP | ATK | DEF | Cost |
|------|----|-----|-----|------|
| Infantry | 30 | 10 | 2 | 100 |
| Tank | 40 | 14 | 2 | 250 |
| Artillery | 20 | 10 | 1 | 200 |
| Recon | 20 | 7 | 1 | 100 |

**Notes per unit:**

*Infantry:* DEF = round(30×0.05) = round(1.5) = 2. Slight rounding benefit is acceptable.

*Tank:* ATK = 14. Counter vs infantry: (14×2.0)−2 = 26 per hit, infantry HP 30, kills in 2 hits ✓. Neutral vs recon: (14×1.0)−1 = 13 per hit, recon HP 20, kills in 2 hits — violates neutral target. Recon dying fast to tanks is acceptable by design (recon should not be fighting tanks directly — if it is, planning failed). Monitor in logs. If recon is dying to tanks before it can disengage, the ROE system is the fix, not stat changes.

*Artillery:* ATK = 10 (bumped from 8 to achieve 2-hit counter vs tank). Counter vs tank: (10×2.0)−2 = 18 per hit, tank HP 40, kills in 3 hits — borderline. Bump to ATK 10 gives (10×2.0)−2=18, 40/18=2.2 → 2-3 hits with RNG. Acceptable. Artillery HP = 20 (low — it dies fast if reached, which is correct. Recon reaching artillery is the payoff for committing to that flank).

*Recon:* Low HP by design. Recon dying faster than other units is correct. It is a scout, not a frontline unit. High risk, high information reward.

**Open tuning item:** 0.6× disadvantaged multiplier vs 0.5×. The matrix uses 0.6×. If playtests show disadvantaged fights resolve too quickly (the counter player doesn't have to work for it), revert to 0.5× and accept longer disadvantaged fights. Test data decides.

---

### Damage Formula (Final)

```
finalDamage = max(1, floor(
  (ATK × typeMultiplier × randomFactor) × (1 − terrainDefense) − DEF
))
```

`randomFactor` = `[0.85, 1.15]` — seeded with `turnSeed` for determinism.

Terrain reduces damage as a percentage first. DEF subtracts flat after. DEF is meaningful on all terrain including plains (fixes current engine bug — see Section 8.5).

---

### Initiative & Tiebreaker

**Base response time** (lower fires first):

| Unit | Base |
|------|------|
| Scout / Plane | 1 |
| Infantry | 2 |
| Tank / Boat | 3 |
| Artillery | 4 |

**Modifiers** (additive):

| Condition | Modifier |
|-----------|----------|
| Flanking approach angle | Attacker −1 |
| Mountain defender | Defender −1 |
| Forest target | Attacker +1 |
| `assault` ROE | −0.5 |
| `skirmish` ROE | −0.25 |
| `cautious` ROE | +0.5 |

**Resolution:**

```
finalScore = baseResponseTime + sum(modifiers)
Lower finalScore fires first.
RNG only when finalScoreA === finalScoreB exactly.
```

Modifiers can override base differences. A flanking scout with `assault` ROE attacking a `cautious` artillery fires significantly before a stationary infantry even though scout base(1) < infantry base(2).

**Tiebreaker rules:**
1. Single RNG roll per engagement — not re-rolled per hit. Initiative winner keeps it for the full fight.
2. Seeded with `turnSeed` + `engagementId` — deterministic and replayable.
3. `engagementId` differentiates simultaneous tied engagements in the same tick.

```
if finalScoreA === finalScoreB:
  tieRoll = seededRng(turnSeed, engagementId)
  initiativeWinner = tieRoll > 0.5 ? A : B
```

If `[MATH_AUDIT]` logs show RNG tiebreakers exceeding 15% of all engagements, the modifier stack needs more differentiation.

---

### The Neutral 1v1 Invariant

In a neutral 1v1 with counter-fire active, the winner survives with minimal HP. This is an emergent property of the cancel-on-death rule in Phase 5 of the combat timeline — not a new rule.

```
A fires first  → B loses ~30% HP
B counter-fires → A loses ~30% HP
A fires again  → B loses ~30% HP
B counter-fires → A loses ~30% HP
A fires again  → B dies → B's counter CANCELED
A survives at ~10% HP
```

Both units cannot die from a neutral 1v1. The loser's killing blow cancels their pending counter-fire.

**Exception:** If loser has `ignore` ROE, no counter-fires occur. Winner survives at ~65% HP. This is a real strategic choice — `ignore` units die cleanly but surrender the counter-damage trade.

---

### Skirmish Attack Cap

A unit may perform **maximum 1 offensive attack during the movement phase**, regardless of how many threat zones it passes through.

Intercept fire received from enemies does not count against this cap.

**Why this rule exists:** Without it, `skirmish` ROE becomes damage farming. A recon crossing 3 enemy threat zones takes 1 intercept hit (cap=1) but fires 3 skirmish shots. Net positive trade every time. Movement becomes a free damage source rather than a positioning tool.

---

### AI vs AI Logging Spec

All simulation events tagged `[MATH_AUDIT]`. Same pattern as combat timeline event log. Consistent tag enables grep-based analysis across thousands of matches.

```
[MATH_AUDIT] ENGAGEMENT   attacker:tank  defender:infantry  
             matchup:counter  multiplier:2.0

[MATH_AUDIT] INITIATIVE   unitA:scout  unitB:tank  
             scoreA:0.5  scoreB:4.5  winner:scout  method:MODIFIERS

[MATH_AUDIT] INITIATIVE   unitA:infantry  unitB:infantry  
             scoreA:2.0  scoreB:2.0  winner:infantryA  method:RNG  seed:83921  engagementId:4

[MATH_AUDIT] HIT          attacker:tank  defender:infantry  
             expected_dmg:26  actual_dmg:27  
             dmg:27  hp_before:30  hp_after:3  hit_number:1

[MATH_AUDIT] KILL         attacker:tank  defender:infantry  
             total_hits:2  expected_hits:2  verdict:ON_TARGET

[MATH_AUDIT] KILL         attacker:infantry  defender:recon  
             total_hits:1  expected_hits:2  verdict:TOO_FAST

[MATH_AUDIT] ESCAPE       unit:infantry  after_hits_taken:1  reason:directive_retreat

[MATH_AUDIT] MATCH_END    rounds:3  
             p1_units_lost:4  p2_units_lost:6  
             avg_hits_to_kill:2.3  dominant_unit:tank  
             rng_tiebreaks_pct:0.12
```

**`verdict` values:** `ON_TARGET` / `TOO_FAST` / `TOO_SLOW`

**Analysis workflow after 100 AI vs AI matches:**
1. Sort KILL events by verdict. `TOO_FAST` matchups → reduce ATK or raise HP. `TOO_SLOW` → reverse.
2. Check `dominant_unit` across MATCH_END events. Any unit appearing >40% is overtuned.
3. Check `rng_tiebreaks_pct`. Above 15% → add more modifier differentiation.
4. Check `method:RNG` in INITIATIVE events. High frequency on specific matchups → those units need response time differentiation.

---

## ARCHETYPE SYSTEM

**Moved to [`ECONOMY_AND_PROGRESSION.md`](ECONOMY_AND_PROGRESSION.md).** Open design forks (Forks 1-5), decided elements, Fred's hidden risk warning.

---

## DESIGN ALIGNMENT — TENSIONS WITH FRED'S v1.0 DOC

**Moved to [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) §Design Tensions.** T1-T4 divergences from Fred's v1.0 with justifications.

---

## ENGINE NOW

*The following sections document the current state of the engine as audited. All claims cite file:line.*

---

## SECTION 1 — MOVEMENT MODEL

### 1.1 Movement Range

Units have a fixed `moveRange` stat. No modifiers apply to it — no terrain penalty to range, no buff from directives.

```
units.ts:14    infantry.moveRange  = 3
units.ts:25    tank.moveRange      = 4
units.ts:36    artillery.moveRange = 2
units.ts:47    recon.moveRange     = 5
```

### 1.2 Path Cost

**Function:** `getMoveCost()` — `terrain.ts:38-48`

```
getMoveCost(terrain, unitType, directive):
  if terrain.infantryOnly AND unitType !== 'infantry' → Infinity
  if terrain === 'forest' AND directive in ['flank-left', 'flank-right'] → 1
  else → TERRAIN[terrain].moveCost
```

**Constants:**

| Terrain  | moveCost | infantryOnly | `terrain.ts` line |
|----------|----------|--------------|-----|
| plains   | 1        | false        | 5   |
| forest   | 2        | false        | 13  |
| mountain | 3        | true         | 20  |
| city     | 1        | false        | 29  |

**Special rule:** Flank directives (`flank-left`, `flank-right`) reduce forest cost from 2 → 1. (`terrain.ts:44`)

### 1.3 Pathfinding

**Function:** `findPath()` — `pathfinding.ts:30-118`

Standard A* on hex grid.

- **Heuristic:** `cubeDistance(neighbor, end)` — `pathfinding.ts:110`. This is the hex Manhattan distance (`max(|dq|, |dr|, |ds|)`), used as `h(n)`.
- **Edge cost:** `getMoveCost(terrain, unitType, directive)` — `pathfinding.ts:96`
- **Blocked hexes:** occupied hexes are skipped except the destination (`pathfinding.ts:100`)
- **Open set:** `Map<string, PathNode>`, linear scan for min-f (`pathfinding.ts:66-71`)
- **Closed set:** `Set<string>` (`pathfinding.ts:81`)

**Function:** `pathCost()` — `pathfinding.ts:128-146`

Sums `getMoveCost` for each step after the start hex.

### 1.4 Movement Resolution — Three Separate Systems

Movement is NOT unified. There are three independent move resolution paths:

**A. `direct-move` command** — `game-state.ts:286-313`

```
dist = cubeDistance(unit.position, targetHex)
if dist > stats.moveRange → Error
unit.position = targetHex
```

**No pathfinding. No terrain cost check.** Pure distance check against `moveRange`. A unit can teleport across mountains, through occupied hexes, ignoring all terrain cost. Only validates: hex exists, is unoccupied, is within cube distance.

**B. Directive AI `moveToward()`** — `directives.ts:177-201`

```
path = findPath(unit.position, target, terrain, unitType, occupied, directive)
stepIndex = min(stats.moveRange, path.length - 1)
unit.position = path[stepIndex]
```

Uses A* pathfinding. Respects terrain costs, blocked hexes, infantry-only. But `stepIndex` counts *path nodes* not *move cost*. So if the path passes through 2 forest tiles (cost 2 each), `stepIndex` of 3 means the unit moved 3 steps costing 5 total — exceeding moveRange of 3. **The moveRange cap counts steps, not cost.**

**C. `retreat` command** — `game-state.ts:349-394`

Same logic as B: `findPath` then `min(stats.moveRange, path.length - 1)` step along path. Same step-counting issue.

### 1.5 Stacking / Collision

**No stacking.** One unit per hex, enforced at:
- `placeUnit`: `game-state.ts:103-107` — checks all units from both players
- `direct-move`: `game-state.ts:296-302` — checks all units
- `applyDirectiveAction` move: `game-state.ts:417-421` — checks all units
- `findPath`: `pathfinding.ts:100` — skips occupied hexes (except destination)

**Hidden assumption:** Collision is checked at move time, not at resolution time. If two directive-AI units both target the same hex, the first one succeeds; the second finds it occupied and its path is invalid.

### 1.6 Hidden Assumptions & Scaling Risks

- **`direct-move` ignores terrain entirely** — on larger maps with more terrain variety, this becomes increasingly exploitable. A tank can teleport 4 hexes across mountains.
- **Step-counting vs cost-counting** — `moveToward()` and `retreat` count path *nodes* not accumulated cost. `moveRange: 3` means "3 steps along A* path" not "3 cost worth of movement." Forest (cost 2) or mountain (cost 3) terrain is only respected during pathfinding routing, not as a movement budget.
- **A* open set is a linear scan** — `pathfinding.ts:66-71`. O(n^2) in the worst case. On a 20x14 map (280 hexes) this is fine. On a 60x40 map (2400 hexes), pathfinding becomes a bottleneck, especially with `scoutExplore` iterating all terrain keys (`directives.ts:294`).
- **`scoutExplore` iterates every hex on the map** — `directives.ts:294-313`. For each scout unit, it scans all terrain keys and computes `cubeDistance` to every friendly unit. O(hexes x friendlyUnits) per scout per turn.
- **Flank offsets are hardcoded to +/-5/+/-4/+/-3 q-offset** — `directives.ts:69`. These assume a ~20-wide map. On a wider map, these won't produce meaningful flanking arcs.

---

## SECTION 2 — COMBAT MODEL

### 2.1 Damage Calculation

**Function:** `calculateDamage()` — `combat.ts:20-39`

```
attackerStats = UNIT_STATS[attacker.type]
defenderStats = UNIT_STATS[defender.type]
typeMultiplier = TYPE_ADVANTAGE[attacker.type][defender.type]
terrainDef = TERRAIN[defenderTerrain].defenseModifier

effectiveDef = defenderStats.def + (defender.directive === 'hold' ? 1 : 0)
randomFactor = randomFn()                          // default: 0.85 + Math.random() * 0.3
baseDamage = attackerStats.atk * typeMultiplier * randomFactor
finalDamage = max(1, floor(baseDamage - effectiveDef * terrainDef))
```

**Inputs:**

| Input | Source | Line |
|-------|--------|------|
| `attackerStats.atk` | `units.ts:7-52` | per-type |
| `defenderStats.def` | `units.ts:7-52` | per-type |
| `typeMultiplier` | `units.ts:86-91` | 4x4 matrix |
| `terrainDef` | `terrain.ts:3-36` | per-terrain |
| `defender.directive` | unit state | runtime |
| `randomFn()` | injected or default | `combat.ts:24` |

**Output:** Integer >= 1. Always deals at least 1 damage.

**Randomness:** `randomFn` returns value in `[0.85, 1.15]`. Default implementation: `0.85 + Math.random() * 0.3`. Server passes seeded version: `0.85 + mulberry32(turnSeed)() * 0.3` (`game-loop.ts:354`).

### 2.2 Attack Range Check

**Function:** `canAttack()` — `combat.ts:48-57`

```
distance = cubeDistance(attacker.position, defender.position)
return attacker.owner !== defender.owner
    AND distance >= stats.minAttackRange
    AND distance <= stats.attackRange
```

| Unit      | minAttackRange | attackRange | `units.ts` line |
|-----------|---------------|-------------|------|
| infantry  | 1             | 1           | 16-17 |
| tank      | 1             | 1           | 27-28 |
| artillery | 2             | 3           | 37-38 |
| recon     | 1             | 1           | 48-49 |

**No line-of-sight check for attacks.** `canAttack` only checks distance. A unit can attack through forests, over mountains. LoS is only used for visibility/fog-of-war, not combat.

### 2.3 Damage Application & Death

`game-state.ts:330-335` (command), `game-state.ts:436-441` (directive):

```
defender.hp -= damage
if defender.hp <= 0:
  removeUnit(enemyUnits, defender.id)
  state.round.unitsKilledThisRound[currentPlayer] += 1
```

No overkill tracking. No counter-attack. No retreat on damage.

### 2.4 Health

| Unit      | maxHp | `units.ts` line |
|-----------|-------|------|
| infantry  | 3     | 11   |
| tank      | 4     | 22   |
| artillery | 2     | 33   |
| recon     | 2     | 44   |

### 2.5 Support Healing

`game-state.ts:248-269`:

```
if unit.directive === 'support':
  find adjacent friendly with lowest HP < maxHp
  bestTarget.hp += 1
```

Flat +1 HP heal. No cost. Happens after the unit's own directive action. Only heals one unit per turn.

### 2.6 City Capture HP Cost

`game-state.ts:664-686`:

```
if city is unowned or owned by enemy, and a unit stands on it:
  city flips to unit.owner
  unit.hp -= 1
  if unit.hp <= 0: unit dies
```

Capturing a city costs 1 HP. Can kill the capturing unit. The city still flips even if the unit dies.

### 2.7 Initiative / Turn Order

- Commands execute in submission order — `game-state.ts:170-177`. Commands are processed sequentially in array order. A command can kill a unit that a later command targets.
- Directive AI runs in two passes — `game-state.ts:182-192`:
  a. Scout directive units act first
  b. All other directive units act second
- Within each pass, units execute in array order (order they were placed).
- No speed stat, no initiative stat. Turn order is determined by: whose turn it is (alternating), then command order, then directive pass order.

### 2.8 Target Selection (Directive AI)

**Function:** `tryAttackClosest()` — `directives.ts:137-157`

```
for each enemy in range (canAttack):
  record { enemy, distance }
sort by distance ascending, then hp ascending
attack targets[0]
```

AI prefers: closest enemy first, lowest HP to break ties.

---

## SECTION 3 — ROCK / PAPER / SCISSORS HOOKS

### 3.1 Existing Type Advantage Matrix

Location: `units.ts:86-91`

```
const TYPE_ADVANTAGE: Record<UnitType, Record<UnitType, number>> = {
  infantry:  { infantry: 1.0, tank: 0.5, artillery: 1.2, recon: 1.0 },
  tank:      { infantry: 1.5, tank: 1.0, artillery: 1.2, recon: 1.5 },
  artillery: { infantry: 1.3, tank: 1.3, artillery: 1.0, recon: 1.3 },
  recon:     { infantry: 0.8, tank: 0.3, artillery: 1.5, recon: 1.0 },
};
```

Accessed via: `getTypeAdvantage(attacker, defender)` — `units.ts:93-95`

Used in: `calculateDamage()` — `combat.ts:28`

### 3.2 Current Relationships

```
tank → infantry:   1.5×  (strong)
tank → recon:      1.5×  (strong)
recon → artillery: 1.5×  (strong)
infantry → tank:   0.5×  (weak)
recon → tank:      0.3×  (very weak)
artillery → all non-self: 1.2-1.3× (generalist advantage)
```

This is not a clean RPS triangle. Artillery is a generalist with no hard counter. Tank dominates two types. Recon has one niche (killing artillery) and is crushed by everything else.

### 3.3 Insertion Points for Extended RPS

The system is already architected for it. To add new types:

1. Add to `UnitType` union — `types.ts:54`
2. Add stats row to `UNIT_STATS` — `units.ts:7-52`
3. Add row+column to `TYPE_ADVANTAGE` — `units.ts:86-91`
4. Add terrain interactions to `getMoveCost` if needed — `terrain.ts:38-48`

The multiplier is cleanly injected into the damage formula at `combat.ts:28`. No code changes needed in the damage pipeline itself.

---

## SECTION 4 — MAP SCALE DEPENDENCIES

### 4.1 Hardcoded Grid Size

```
map-gen.ts:14     const GRID: GridSize = { width: 20, height: 14 }
```

280 total hexes. Used throughout `generateMap` and `validateMap`.

### 4.2 Constants Tied to Map Size

| Constant | Value | Location | Why it breaks |
|----------|-------|----------|---------------|
| `GRID` | 20×14 | `map-gen.ts:14` | All map generation assumes this size |
| Central objective | `createHex(10, 2)` → offset (10, 7) | `map-gen.ts:131` | Hardcoded to center of 20×14 |
| Deployment rows | 0-2 (P1), 11-13 (P2) | `map-gen.ts:133-136` | Hardcoded to 14-row map |
| City sectors | colMin/colMax of [0,5], [6,13], [14,19] | `map-gen.ts:64-68` | Hardcoded to 20-column map |
| City row candidates | [3, 4, 5, 6] | `map-gen.ts:70` | Hardcoded neutral zone rows |
| City min distance | 3 | `map-gen.ts:80` | Absolute hex distance, not relative to map size |
| Expected city count | 7 | `map-gen.ts:219` | Hardcoded in validation |
| Flank offsets | [-5, -4, -3] / [5, 4, 3] | `directives.ts:69` | Assumes ~20-wide map |

### 4.3 Vision & Range Constants

| Constant | Value | Location | Scale concern |
|----------|-------|----------|---------------|
| `infantry.visionRange` | 3 | `units.ts:17` | ~21% of map width |
| `tank.visionRange` | 3 | `units.ts:28` | ~21% of map width |
| `artillery.visionRange` | 3 | `units.ts:39` | ~21% of map width |
| `recon.visionRange` | 6 | `units.ts:50` | ~43% of map width |
| `mountain.visionModifier` | +2 | `terrain.ts:24` | Recon on mountain = 8, sees 57% of map width |
| `forest.blocksLoS` | true | `terrain.ts:16` | Only LoS blocker |

### 4.4 Turn/Round Limits

```
game-state.ts:64     maxTurnsPerSide: 12
game-state.ts:71     maxRounds: 3
```

12 turns per side on a 20×14 map. A recon (speed 5) can cross the entire map in ~3 turns. On a larger map, 12 turns may not be enough for any engagement to occur.

### 4.5 KotH Threshold

```
game-state.ts:492-493   turnsHeld >= 2 → round win
game-state.ts:473       requires citiesHeld >= 2 (city gate)
```

2 turns held is trivial to achieve on a small map. On a larger map this remains the same, meaning KotH becomes harder proportional to distances. **Note: KotH win condition is being replaced — see D7.**

### 4.6 Performance Concerns at Scale

| Operation | Complexity | Location | At 20×14 (280) | At 60×40 (2400) |
|-----------|-----------|----------|----------------|-----------------|
| `calculateVisibility` | O(units × hexes × dist) | `vision.ts:40` | Fine | LoS line-draw per hex per unit |
| `scoutExplore` | O(hexes × friendlyUnits) | `directives.ts:294` | Fine | 2400 × N per scout |
| A* open set scan | O(n²) worst case | `pathfinding.ts:66` | Fine | Noticeable |
| `updateCityOwnership` | O(units + cities) | `game-state.ts:664` | Trivial | Trivial |

---

## SECTION 5 — ECONOMY INTERACTIONS

### 5.1 Unit Purchase

**Function:** `placeUnit()` — `game-state.ts:81-119`

```
cost = UNIT_STATS[unitType].cost
if resources < cost → Error
resources -= cost
```

| Unit | cost | `units.ts` line |
|------|------|------|
| infantry | 100 | 10 |
| tank | 250 | 21 |
| artillery | 200 | 32 |
| recon | 100 | 43 |

Starting resources: 800 per player — `game-state.ts:49,55`

### 5.2 Round Income

**Function:** `calculateIncome()` — `economy.ts:23-33`

```
income = BASE_INCOME
       + citiesHeld × CITY_INCOME
       + unitsKilled × KILL_BONUS
       + (wonRound ? ROUND_WIN_BONUS : 0)
       + (lostRound ? CATCH_UP_BONUS : 0)
```

| Constant | Value | `economy.ts` line |
|----------|-------|------|
| `BASE_INCOME` | 650 | 7 |
| `CITY_INCOME` | 125 | 8 |
| `KILL_BONUS` | 25 | 9 |
| `ROUND_WIN_BONUS` | 200 | 10 |
| `CATCH_UP_BONUS` | 250 | 11 |

### 5.3 Carryover

**Function:** `applyCarryover()` — `economy.ts:38-39`

```
carryover = floor(unspentResources × CARRYOVER_RATE)
```

`CARRYOVER_RATE = 0.5` — `economy.ts:12`

### 5.4 Maintenance

**Function:** `applyMaintenance()` — `economy.ts:45-48`

```
totalCost = sum of UNIT_STATS[unit.type].cost for surviving units
maintenance = floor(totalCost × MAINTENANCE_RATE)
```

`MAINTENANCE_RATE = 0.15` — `economy.ts:13`

### 5.5 Net Resources Between Rounds

Applied in `scoreRound()` — `game-state.ts:593-606`:

```
newResources = max(0, carryover - maintenance + income)
```

### 5.6 Economy ↔ Combat Interactions

- Unit cost directly feeds maintenance. Expensive armies drain resources between rounds.
- Kill bonus is per-unit, not per-cost. Killing a 100g recon gives the same 25g as killing a 250g tank. **Design risk: on a bigger map with longer engagements this warps strategy. Players farm cheap units. Fix: `KILL_BONUS = floor(unit.cost × 0.1)`**
- City income scales with city count. 7 cities (fixed). Holding all cities = 875g city income. More than BASE_INCOME.
- Catch-up bonus (250) is larger than win bonus (200). Loser gets +50 net advantage.
- No per-action cost. Commands are free.

---

## SECTION 6 — TURN RESOLUTION ENGINE

### 6.1 Full Turn Pipeline

**Function:** `executeTurn()` — `game-state.ts:152-216`

```
1. Receive commands[] from current player

2. FOR each command:
   a. Find unit in friendly units
   b. If unit dead → skip (no CP spent)
   c. Spend 1 CP from pool
   d. Execute command (move/attack/redirect/retreat)

3. Directive AI Pass 1 — scout units
   FOR each friendly unit with directive === 'scout':
     If not commanded and not dead:
       executeDirective() → UnitAction
       applyDirectiveAction()

4. Directive AI Pass 2 — all other units
   FOR each friendly unit with directive !== 'scout':
     Same as pass 1

5. updateCityOwnership()
6. updateObjective()
7. turnsPlayed[currentPlayer] += 1
8. Switch currentPlayer
9. Create fresh CP pool (4 CP)
10. Reset next player's units' hasActed = false
```

**NOTE: Steps 8-10 reflect sequential turn model. This changes with D1 (simultaneous resolution).**

### 6.2 Round End Check

**Function:** `checkRoundEnd()` — `game-state.ts:488-527`

Priority order:
1. KotH: `objective.turnsHeld >= 2` → winner = occupier *(being replaced — see D7)*
2. Elimination: one side has 0 units
3. Turn limit: both sides played >= `maxTurnsPerSide` (12)

### 6.3 Round Scoring & Transition

**Function:** `scoreRound()` — `game-state.ts:565-645`

```
1. roundWinner.roundsWon += 1
2. Count cities held per player
3. Calculate income
4. Calculate maintenance
5. Calculate carryover
6. newResources = max(0, carryover - maintenance + income)
7. Check game over
8. If not: phase → 'build', reset round state
```

---

## SECTION 7 — BALANCE SURFACE

Every tunable parameter currently in the engine:

### Unit Stats

| Parameter | infantry | tank | artillery | recon | Location |
|-----------|---------|------|-----------|-------|----------|
| cost | 100 | 250 | 200 | 100 | `units.ts:10,21,32,43` |
| maxHp | 3 | 4 | 2 | 2 | `units.ts:11,22,33,44` |
| atk | 2 | 4 | 5 | 1 | `units.ts:12,23,34,45` |
| def | 2 | 3 | 1 | 1 | `units.ts:13,24,35,46` |
| moveRange | 3 | 4 | 2 | 5 | `units.ts:14,25,36,47` |
| attackRange | 1 | 1 | 3 | 1 | `units.ts:15,26,37,48` |
| minAttackRange | 1 | 1 | 2 | 1 | `units.ts:16,27,38,49` |
| visionRange | 3 | 3 | 3 | 6 | `units.ts:17,28,39,50` |

### Type Advantage Matrix (current — broken)

| Attacker → Defender | infantry | tank | artillery | recon |
|---------------------|---------|------|-----------|-------|
| infantry | 1.0 | 0.5 | 1.2 | 1.0 |
| tank | 1.5 | 1.0 | 1.2 | 1.5 |
| artillery | 1.3 | 1.3 | 1.0 | 1.3 |
| recon | 0.8 | 0.3 | 1.5 | 1.0 |

**Known issue:** Artillery beats everything. No clean counter cycle. See aspirational design for intended replacement.

### Economy

| Parameter | Value | Location |
|-----------|-------|----------|
| Starting resources | 800 | `game-state.ts:49` |
| `BASE_INCOME` | 650 | `economy.ts:7` |
| `CITY_INCOME` | 125 | `economy.ts:8` |
| `KILL_BONUS` | 25 | `economy.ts:9` |
| `ROUND_WIN_BONUS` | 200 | `economy.ts:10` |
| `CATCH_UP_BONUS` | 250 | `economy.ts:11` |
| `CARRYOVER_RATE` | 0.5 | `economy.ts:12` |
| `MAINTENANCE_RATE` | 0.15 | `economy.ts:13` |

---

## SECTION 8 — DESIGN RISKS

### 8.1 `direct-move` Ignores Terrain
`game-state.ts:305-309` — uses `cubeDistance` not `pathCost`. Infantry can teleport 3 hexes over mountains.

### 8.2 moveRange Counts Steps, Not Cost
`directives.ts:199` — `min(moveRange, path.length - 1)`. Movement budget and movement cost are disconnected.

### 8.3 No LoS Check on Attacks
`combat.ts:48-57` — artillery can fire through forests and mountains.

### 8.4 Elevation Is Cosmetic
Elevation map exists but is never read by combat, movement, or any game mechanic.

### 8.5 DEF Does Nothing on Plains
`terrainDef = 0` on plains → `effectiveDef × 0 = 0`. The entire DEF stat is nullified on the majority of the map.

### 8.6 First-Mover Advantage
`player1` always goes first. All tiebreakers favor `player1`. **Resolved by D1 (simultaneous resolution).**

### 8.7 No Counter-Attack
Combat is one-directional. **Resolved by D5 (response time + counter-attack).**

### 8.8 Flank Directive Hardcoded to Map Width
Offsets of `[-5, -4, -3]` / `[5, 4, 3]`. **Resolved by D10 (parametric map scaling).**

### 8.9 Scout AI Is O(n²)
`directives.ts:294-313` — iterates all terrain keys per scout per turn. Needs spatial index at larger map sizes.

### 8.10 Economy Doesn't Scale With Map Size
All economy constants are absolute. More cities = city income dominates. **Needs parametric derivation per D10.**

---

## COMBAT TIMELINE

**Moved to [`RESOLUTION_PIPELINE.md`](RESOLUTION_PIPELINE.md).** 10-phase combat timeline, two-layer directive model, event log format, and implementation notes N1-N3.

---

## MVP TARGET DESIGN

*This is the build target. Everything here should be implemented and working before anything in ULTRA ASPIRATIONAL is touched. Tag: MVP.*

---

### A1 — Simultaneous Resolution Architecture

Both players submit commands. Server holds submissions. Resolves only when both are in.

```
PLAN PHASE (both players, hidden from each other)
↓
BOTH SUBMIT
↓
SERVER RESOLVES SIMULTANEOUSLY
↓
REVEAL ANIMATION (both plans visible, colliding)
↓
OUTCOME STATE
↓
NEXT PLAN PHASE
```

### A2 — Type Advantage Matrix (Clean 4-Unit RPS Cycle)

Four-unit clean counter cycle. Each unit has exactly one dominant matchup and one losing matchup. All other matchups neutral.

```
Tank      → beats Infantry  (2.0×)
Infantry  → beats Recon     (2.0×)
Recon     → beats Artillery (2.0×)
Artillery → beats Tank      (2.0×)
All other matchups: 1.0×
```

Full matrix:

| ATK↓ DEF→ | Infantry | Tank | Artillery | Recon |
|-----------|----------|------|-----------|-------|
| **Infantry** | 1.0 | 0.5 | 1.0 | 2.0 |
| **Tank** | 2.0 | 1.0 | 0.5 | 1.0 |
| **Artillery** | 1.0 | 2.0 | 1.0 | 1.0 |
| **Recon** | 1.0 | 1.0 | 2.0 | 1.0 |

No unit has a multiplier advantage against itself. No unit is a generalist. Every unit fears exactly one other unit and dominates exactly one other unit.

### A3 — Damage Formula

```
finalDamage = max(1, floor(
  (ATK × typeMultiplier × randomFactor) × (1 - terrainDefense) - DEF
))
```

Terrain reduces incoming damage as a percentage first. DEF subtracts a flat amount after. DEF is meaningful on all terrain types including plains (fixes current engine bug where DEF = 0 on plains).

Random factor: `[0.85, 1.15]` — preserved from current engine. Narrow enough to be predictable, wide enough to create occasional upsets.

### A4 — HP & Stat Scaling

Current HP values (2-4) produce single-hit kills. No room for the RPS cycle to play out across multiple engagements. Scale everything ×10.

Target stat ranges:

| Unit | HP | ATK | DEF | Cost |
|------|----|-----|-----|------|
| Infantry | 30 | 20 | 20 | 100 |
| Tank | 40 | 40 | 30 | 250 |
| Artillery | 20 | 50 | 10 | 200 |
| Recon | 20 | 10 | 10 | 100 |

These are starting points for the math model pass. Do not treat as final. The math model section below governs how these numbers are derived.

### A5 — Movement Scaling Formula

Movement range derived from map width. Units should feel meaningfully different in speed without any unit crossing the full map in one turn.

```
infantry moveRange  = floor(mapWidth / 8)
tank moveRange      = floor(mapWidth / 7)
recon moveRange     = floor(mapWidth / 5)
artillery moveRange = floor(mapWidth / 12)
```

At 40-wide map: infantry=5, tank=5, recon=8, artillery=3.
At 20-wide map (current): infantry=2, tank=2, recon=4, artillery=1. (Note: current engine values are higher — this formula is the target, not the current state.)

### A6 — Parametric Map Constants

All map-dependent values derived from `GRID`. Nothing hardcoded.

```
deploymentRows    = floor(height × 0.2)
flankOffset       = floor(width × 0.25)
cityMinDistance   = floor(width × 0.15)
cityCount         = floor((width × height) / 40)
maxTurnsPerSide   = floor(width / 2)
CP_PER_ROUND      = 4 + floor((width - 20) / 10)
victoryCities     = floor(cityCount × 0.6)
```

### A7 — Kill Bonus Scaling

```
KILL_BONUS = floor(unit.cost × 0.1)
```

Replaces flat 25g. Killing a 250g tank yields 25g. Killing a 100g recon yields 10g. Removes the exploit of farming cheap units for equal bounty.

### A8 — Win Condition: Multi-City Majority Capture

```
victoryCities = floor(totalCities × 0.6)
```

First player to simultaneously hold `victoryCities` wins the round. Scales with map size. No KotH center hex. No timer-based hold. Pure map control.

### A9 — Objective-Based Upgrade Triggers

Unlocks earned through in-match behavioral achievements. Not purchased with gold.

| Trigger | Threshold | Archetype signal | What unlocks |
|---------|-----------|-----------------|--------------|
| Cities held simultaneously | 3+ | Conqueror | Fortify directive |
| Enemy units killed in one round | 3+ | Predator | Melee tier upgrade (one unit) |
| Enemy map hexes scouted | 60%+ | Ghost | Ambush directive |
| Held defensive position | 3+ consecutive ticks | Fortress | Support heal radius +1 |

Triggers visible to both players as a signal. Specific unlock contents hidden.

### A10 — Two-Layer Directive System

Every unit carries two directive layers set during planning. Cannot change mid-tick.

**Movement:** `advance` / `flank` / `hold` / `retreat`

**Engagement ROE:** `assault` / `skirmish` / `cautious` / `ignore`

Specialty actions (capture, support, scout, fortify) are modifiers on these layers, not a third category.

### A11 — Response Time & Counter-Attack

Response time ranking (lower = fires first): Scout(1) → Infantry(2) → Tank(3) → Artillery(4)

Flanking approach: attacker −1. Mountain defender: −1. Forest target: attacker +1.

Counter-attack fires if defender survives first strike and has `cautious` ROE.

### A12 — Melee System

Triggered by adjacent contact after movement phase locks. Governed by `meleeRating`, not ATK/DEF.

Ratings: Scout(S) → Infantry(A) → Tank(D) → Artillery(F)

Melee persists until one unit dies or one unit spends 1 CP to retreat.

---

## ULTRA ASPIRATIONAL

**Moved to [`ROADMAP.md`](ROADMAP.md) §Post-MVP Feature Sequence.** U1-U7 post-MVP features with gating conditions.

---

## IMPLEMENTATION PLAN

*Dependency-ordered. Each layer depends on the one above it. Within a layer, items can be built in any order.*

---

### Layer 0 — Foundation

These are structural changes. Everything else sits on top of them. Build in this order.

**0.1 — Two-Layer Directive Model**

Replace the flat `DirectiveType` enum (`advance | hold | flank-left | flank-right | scout | support`) with the two-layer model: movement directive + engagement ROE.

Touches: `types.ts` (new types), `Unit` interface, `placeUnit`, all directive references in `directives.ts`, `game-state.ts`, `combat.ts` (hold bonus reads directive). Every file that reads `unit.directive` must be updated.

Do this first. It is a type change that cascades everywhere. The surface area grows with every other feature added — doing it later means rewriting more code.

**0.2 — Cost-Based Movement**

Fix the three movement systems (Section 1.4) to use movement cost, not step count. Unify `direct-move`, `moveToward()`, and `retreat` into a single `moveUnit()` function that:
- Computes A* path
- Walks the path spending cost budget (not step count)
- Stops when budget is exhausted or destination is reached

This eliminates design risks 8.1 and 8.2. The combat timeline assumes cost-based movement — it cannot work without this.

Touches: `game-state.ts` (applyCommand direct-move, retreat), `directives.ts` (moveToward). Consider a shared `movement.ts` module.

**0.3 — Simultaneous Resolution**

Rewrite the server game loop so both players submit commands during a shared planning window. The server holds submissions and resolves only when both are received.

This is the architectural pivot. The current `handleSubmitCommands` fires immediately on one player's submission and alternates `currentPlayer`. The new model:

```
Both players submit → server buffers both → resolve simultaneously → emit results to both
```

The resolution logic itself changes in 0.4. This step only changes the *trigger condition* — when resolution fires, not how it works. This means it can be tested with the existing `executeTurn` as a placeholder (run it twice, once per player's commands) before the full timeline is wired.

Touches: `game-loop.ts` (handleSubmitCommands, turn timer logic), `types.ts` (Room needs command buffer for both players), client submission flow.

**0.4 — Combat Timeline Pipeline**

Replace `executeTurn()` with the 10-phase pipeline defined in the Combat Timeline section. This is the largest single change. Build it in sub-phases:

- **Phase 1-2** (Snapshot + Intent Collection): Clone state, generate intents from directives + CP overrides. Testable immediately — snapshot in, intents out.
- **Phase 3** (Movement + Intercepts + Collisions): Step-by-step movement with intercept checks and collision resolution. Most complex phase. Test with movement-only scenarios first, add intercepts second.
- **Phase 4** (Engagement Detection): Scan for in-range pairs. Straightforward once movement is resolved.
- **Phase 5-6** (Initiative Fire + Counter Fire): Response time ordering, damage application, cancel-on-death. The math model section defines the damage formula and initiative system.
- **Phase 7** (Melee): Adjacent contact after movement. Requires `meleeRating` stat on units.
- **Phase 8-10** (Effects + Territory + Round End): Support healing, city capture, win condition check. Largely reuses existing logic.

Touches: `game-state.ts` (complete rewrite of `executeTurn` and supporting functions), new `timeline.ts` or similar module, `combat.ts` (damage formula update per A3).

**0.5 — Structured Event Log**

Extend `TurnRecord` to emit typed events from each phase. Every phase writes events as it resolves. This is not a separate feature — it must be built *into* each phase during 0.4, not added after.

The event log format is defined in the Combat Timeline section. The renderer, debugger, and future spectator mode all consume this stream.

Touches: `server/src/types.ts` (TurnRecord extension), every phase in the pipeline emits events.

---

### Layer 1 — Combat & Balance

These implement the math model. They can be built in any order once Layer 0 exists.

**1.1 — Clean RPS Matrix**

Replace `TYPE_ADVANTAGE` with the 4-unit clean cycle (Math Model section). Each unit: one 2.0× counter, one 0.6× disadvantage, all else 1.0×.

**1.2 — HP & Stat Scaling**

Apply the `ATK = HP × 0.35`, `DEF = max(1, round(HP × 0.05))` invariant. Update all unit stats per the Math Model starting stats table.

**1.3 — Damage Formula Update**

Implement A3: `max(1, floor((ATK × typeMultiplier × randomFactor) × (1 - terrainDefense) - DEF))`. Terrain reduces as percentage first, DEF subtracts flat after. Fixes design risk 8.5 (DEF on plains).

**1.4 — Response Time System**

Add `responseTime` stat to unit definitions. Implement Phase 5/6 ordering with modifiers (flanking, terrain, ROE bonuses per Math Model).

**1.5 — Intercept Mechanics**

Implement Phase 3 Step 2 intercept checks during movement. Wire `INTERCEPT_CAP = 1`. Add skirmish attack cap (1 offensive attack per movement phase).

**1.6 — Melee System**

Add `meleeRating` stat (needs numeric values — letter grades in D6 must be converted to numbers before implementation). Implement Phase 7 adjacent-contact resolution.

---

### Layer 2 — Map & Economy

**2.1 — Parametric Map Constants**

Derive all map-dependent values from `GRID` per A6. Replace every hardcoded constant identified in Section 4.2.

**2.2 — Multi-City Win Condition**

Replace KotH with `victoryCities = floor(totalCities × 0.6)` per A8/D7. Remove objective hex and turnsHeld logic.

**2.3 — Kill Bonus Scaling**

Replace flat `KILL_BONUS = 25` with `floor(unit.cost × 0.1)` per A7.

**2.4 — 40×28 Map**

Scale map to 40×28 for MVP playtests. Movement ranges auto-derive from A5 formulas. Run 20+ matches and measure match length before scaling further.

**2.5 — LoS on Attacks**

Add line-of-sight check to `canAttack()`. Fixes design risk 8.3. Artillery can no longer fire through forests and mountains.

---

### Layer 3 — Progression & Meta

**3.1 — Objective-Based Upgrade Triggers**

Implement the four behavioral triggers (A9). Track cities held, kills per round, hexes scouted, consecutive defensive ticks.

**3.2 — Archetype Signals**

Emit visible trigger notifications to opponent. "Enemy achieved kill threshold." Specific unlock hidden.

**3.3 — Tier 1 Abilities**

Implement the first tier of archetype unlocks. Only Tier 1 for MVP — Tiers 2-3 require playtest data (see Archetype System forks).

---

### Layer 4 — Client

Parallel track. Can start once Phase structure is defined in Layer 0.

**4.1 — Planning UI**

Two-layer directive picker (movement + ROE). Must communicate the combinatorial space without overwhelming. CP spending overlay.

**4.2 — Simultaneous Submit Flow**

Both players plan, submit, wait for opponent. Waiting state UI. No information leak during wait.

**4.3 — Reveal Animation**

Play the event log as a timeline. Each phase maps to a visual layer:
- Phase 3 → movement arrows
- Phase 5 → gunfire / first strike
- Phase 6 → return fire
- Phase 7 → melee
- Phase 8 → support/heal effects
- Phase 9 → city captures

This is the product. If the reveal doesn't feel dramatic and readable, the game doesn't work. Invest here.

**4.4 — AI vs AI Test Harness**

`[MATH_AUDIT]` logging per the Math Model spec. Headless match runner for balance data. Runs 100+ matches and outputs kill timing, dominant unit, RNG tiebreak frequency. Results feed back into `strategy_game_balance_master.xlsx` → `MatchAnalytics` sheet. The spreadsheet is the controller — swap UnitStats values, run a batch, compare verdicts. Monte Carlo on stat spreads to find cliff edges in the balance surface.

---

### Post-MVP

In this order, each gated on the one before it:

1. Aircraft & Anti-Air (U1) — after 20+ competitive ground matches
2. Naval Units & Water (U2) — after aircraft stable
3. Five-Player FFA (U3) — after 1v1 ranked is active
4. Full Archetype Tree (U4) — after Tier 1 playtest data
5. Spectator & Replay (U5) — after event log stable
6. Faction Skins (U7) — content updates, any time after MVP

---

### What Not To Build

- Do not build the 6-unit TYPE_ADVANTAGE matrix until ground meta is stable (T4 resolution)
- Do not close archetype forks (commitment structure, tier advancement, FFA graph) until 20+ human matches
- Do not optimize pathfinding (A* priority queue, spatial indexing) until 40×28 map proves it's a bottleneck

---

## TODO — NEEDS DESIGN

### 1. Engine Integration Spec (Three.js ↔ Game Engine)

The doc covers game design and math. It says nothing about how Three.js consumes the assets the pipeline produces. This is a full section — needs the following designed and written:

- How to load `.glb` files and initialize `AnimationMixer` per unit
- How to trigger animation clips from the event log (`MOVE` → play move clip, `ATTACK` → play attack clip, etc.)
- How units travel hex-to-hex (tween position while move clip loops, crossfade to idle on arrival)
- How the reveal sequence works — event log plays back as animation, not instant state change
- How multiple simultaneous engagements render (Phase 5 counter-fire, two attack clips firing at the same time on different units)
- How the isometric camera is set up to match the 30° render angle from the asset pipeline
- Hex grid rendering and coordinate system (`.glb` faces +Y, Three.js is Y-up — confirm nothing needs rotation)

**Estimate:** 2-3 hours to write properly.

### 2. Build Order / Sprint Sequence

The doc has *what* to build but not *the sequence*. Needs a prioritized sprint list:

1. **Sprint 1:** Fix critical engine bugs (DEF formula, terrain costs, artillery LoS)
2. **Sprint 2:** Simultaneous resolution (`game-loop.ts`)
3. **Sprint 3:** Two-layer directive system
4. **Sprint 4:** Math model stats (HP/ATK/DEF scaled, damage formula fixed)
5. **Sprint 5:** Asset pipeline integration (load `.glb`s, `AnimationMixer`)
6. **Sprint 6:** Combat timeline phases 1-10
7. **Sprint 7:** Event log + reveal animation
8. **Sprint 8:** Archetype trigger detection (Tier 1 only)

**What's buildable now:** Math model, combat timeline, and directive system are locked. Sprints 1-4 can start today without blocking on anything else. Asset pipeline (Sprint 5) is parallel work — doesn't block game logic.

**Status:** Hardened enough to start. Not hardened enough to finish without the engine integration spec (TODO #1).
- Do not build betting/staking infrastructure (U6) — build the conditions for it to emerge
