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

## DECISIONS — DESIGN CHOICES MADE

Every decision below is locked unless explicitly reopened. Reasoning is included so future decisions stay consistent.

---

### D1 — Simultaneous Turn Resolution

**Decision:** Both players submit commands simultaneously. Resolution happens only after both have committed. Neither player sees the other's plan before committing.

**Reasoning:** This is the foundational design choice. Sequential turns (current engine) create first-mover advantage and allow reactive play. Simultaneous resolution forces prediction, creates the poker dynamic, and eliminates downtime. Without this, the game is chess, not poker.

**Implication for engine:** The server must hold both players' command submissions and only call `executeTurn()` after both are received. The current architecture processes turns immediately on submission — this must change.

**Open problem:** Collision resolution. When both players move a unit to the same hex simultaneously, behavior is undefined. See D4.

---

### D2 — Fred's Invariant: Units Are Semi-Autonomous

**Decision:** Players cannot re-order all their troops every turn. Commands are scarce. Units act on standing directives unless explicitly overridden with a command point.

**Reasoning:** This is what separates the game from every other tactics game. You're not moving pieces. You're nudging a machine that has its own momentum. Skill is in setting up the right standing orders and knowing when to spend your limited interventions. The larger the map, the more this matters — you cannot micromanage a 40-wide battlefield with 4 CP.

**Implication:** The directive AI quality is load-bearing. If autopilot makes obviously dumb decisions, players feel punished for not having enough CP to fix everything. The AI must make *reasonable* decisions that a player can live with, while still being beatable through clever directive design.

---

### D3 — Command Points Scale With Map Size

**Decision:** CP_PER_ROUND is not fixed at 4. It is a function of map size. Larger maps get more CP — but not linearly. The player should always feel *slightly under-resourced*.

**Reasoning:** 4 CP on 20×14 with 6-8 units means you influence ~50% of your army. On a 40×28 map with 15 units, 4 CP means influencing 25%. You need to scale CP so the feel of "I can almost fix everything but not quite" remains constant across map sizes.

**Approximate scaling:**
| Map size | CP per turn |
|----------|-------------|
| 20×14 (current) | 4 |
| 40×28 | 6 |
| 60×40 | 8 |

---

### D4 — Collision Resolution

**Decision:** Collision behavior depends on unit directives and approach angle, not a simple rule.

**Reasoning:** A hunt-directive unit moving into a hex occupied by an enemy is not the same as two neutral units accidentally pathing to the same hex. Context determines outcome.

**Resolution rules (to be implemented):**
- Hunt directive unit entering enemy hex → initiates combat immediately, no counter-attack if approach is flanking
- Two units moving to the same empty hex → faster unit (higher moveRange) wins the hex; slower unit stops one hex short
- Head-on collision (both moving toward each other into adjacent hexes) → simultaneous combat, both units attack, response time determines counter-attack eligibility

---

### D5 — Response Time & Counter-Attack

**Decision:** Combat is not one-directional. Counter-attacks exist but are gated by response time.

**Response time is affected by:**
- Approach angle — flanking unit attacks first; defender's response time penalty applies
- Unit type — scouts react fast, artillery reacts slow
- HP threshold — if incoming damage kills the defender, no counter fires

**Head-to-head engagements:** Both units attack. Response time determines order. If the first hit kills the defender, no counter. If both survive, both attacks resolve.

**Reasoning:** One-directional combat (current engine) means artillery is pure free damage with zero risk. Counter-attacks create real cost for aggressive play and make positioning meaningful.

---

### D6 — Melee Is a Separate Combat State

**Decision:** When two units end up in the same hex or move into contact after an engagement, they enter **melee** — a separate combat mode governed by a `meleeRating` stat, not ATK/DEF.

**Melee ratings (approximate):**
| Unit | Melee | Reasoning |
|------|-------|-----------|
| Scout | S | Fast, close-quarters, ninja archetype |
| Infantry | A | That is their entire purpose |
| Tank | D | Can't rotate turret fast enough |
| Artillery | F | It's a cannon |
| Plane | N/A | Disengages, cannot be held in melee |
| Boat | B | Boarding actions, separate rules |

**Reasoning:** Melee creates a real counter for artillery — a scout that reaches artillery doesn't just shoot it, it locks it in melee where artillery is helpless. This is a counter relationship that feels logical and creates dramatic chase/escape decisions.

---

### D7 — Win Condition Is Multi-City Capture, Not KotH

**Decision:** Replace the current King of the Hill (hold center hex for 2 turns) with a multi-city majority capture win condition.

**Rule:** First player to simultaneously hold X cities wins the round. X scales with map size.

```
Small map (1v1):   hold 3 of 5 cities
Medium map:        hold 4 of 7 cities
Large map (FFA):   hold 5 of 9 cities
```

**Reasoning:** KotH creates a single point of contest. Everyone knows where the fight is. No misdirection is possible. Multi-city capture creates distributed objectives, allows fake-out strategies (threaten one city to pull units from another), and scales cleanly to 5-player FFA without changing mechanics — just more cities on a bigger map.

---

### D8 — Progression Is Objective-Based, Not Currency-Based

**Decision:** Upgrades are earned through in-match behavioral achievements, not purchased with gold.

**Why not currency:**
- Gold already governs units, maintenance, and carryover. Adding upgrades makes gold a god-currency where every decision competes on the same axis.
- Winner already earns more gold. Currency upgrades compound the snowball.
- Produces ROI-optimization behavior, not strategic identity.

**Why objective-based:**
- Reinforces the core differentiator — commitment under uncertainty. The upgrades you're chasing shape your directive choices before the round starts.
- Creates path-dependent advantage. How you played determines what you unlock, not how much gold you accumulated.
- Opponent can infer your upgrade path from your behavior. Another hidden information layer to read and bluff.

**Upgrade trigger visibility:** When a player earns an upgrade, a signal is visible to both players — "enemy achieved kill threshold" or "enemy held city 2 turns." You don't see what was unlocked. You see that something was unlocked. That is information. That is the read.

---

### D9 — Four Play Archetypes, Counter Cycle

**Decision:** The upgrade system produces four emergent play archetypes, each with a behavioral trigger set and a natural counter.

| Archetype | Trigger behavior | Unlocks | Countered by |
|-----------|-----------------|---------|--------------|
| Conqueror | City control, expansion | Economic/fortification upgrades | Predator — kills army before cities matter |
| Predator | Kill accumulation | Combat upgrades (response time, melee) | Ghost — sees them coming, sets traps |
| Ghost | Vision, recon, information | Fog-of-war upgrades, ambush bonuses | Fortress — doesn't matter what Ghost knows if nothing moves |
| Fortress | Defensive positioning, holding ground | Hold bonuses, city fortification, support healing | Conqueror — spreads faster than fortress can hold |

**Counter cycle:**
```
Conqueror → beats → Fortress
Predator  → beats → Conqueror
Ghost     → beats → Predator
Fortress  → beats → Ghost
```

**Bluff layer:** A skilled player signals one archetype in early rounds to bait a counter-response, then pivots. Opponent must decide — are they still playing Ghost or did they switch to Conqueror? This is the strategic poker layer.

---

### D10 — Map Scaling Is Parametric

**Decision:** All map-dependent constants are derived from a single `GRID` parameter. Nothing is hardcoded to 20×14.

**Constants that must be derived, not hardcoded:**
- Deployment zone rows: `floor(height × 0.2)`
- Flank directive offsets: `floor(width × 0.25)`
- City minimum distance: `floor(width × 0.15)`
- City count: scales with map area
- Central objective position: `floor(width/2), floor(height/2)`
- KotH turnsHeld threshold: scales with map size
- maxTurnsPerSide: scales with map size

**Reasoning:** A 5-8x map size increase will break every hardcoded constant silently. Parametric derivation means one number changes and everything recalculates correctly.

---

### D11 — Domains: Ground, Air, Sea

**Decision:** The game has three combat domains. Units belong to one domain and have an `attackableDomains[]` property defining what they can hit.

**Design questions to resolve before implementation:**
1. Can infantry shoot planes? Or is dedicated anti-air required?
2. Can artillery hit boats? (coastal defense mechanic)
3. Do planes ignore terrain for movement but not for vision?
4. Is water a terrain type or a separate map layer?
5. What is the boat's primary role — transport, bombardment, or economic?

**Reasoning:** Planes and boats don't just add units. They create new counter relationships that cascade through the entire existing unit matrix. These questions must be answered before any domain implementation.

---

### D12 — Art Direction: Five Factions, Post-Collapse World

**World premise:** A global construction boom stopped overnight. Civilization built infrastructure at extreme speed — megaprojects, highways, rail, power grids — then something triggered abrupt systemic failure. The landscape is full of unfinished systems. Highways that stop in midair. Half-finished cities. Giant cranes frozen in place.

**Five factions, each answering "who survives a sudden infrastructure collapse" differently:**

| Faction | Identity | Palette | Answer |
|---------|----------|---------|--------|
| Engineers | Trying to restart construction | Yellow, steel grey, black | Rebuild it |
| Caravaners | Mobile convoy culture, trade routes | Copper, turquoise, sand | Route around it |
| Wardens | Old security crews who never left | Charcoal, high-vis orange, white | Enforce what's left |
| Scrappers | Pure salvagers, harvest everything | Rust red, dirty copper, toxic green | Consume it |
| The Current | Control the power grid, control everything | Electric blue, white, near-black navy | Own whoever controls energy |

**Visual language:** Not monsters, not machines — **characters**. Units have personality and presence. Players should project identity onto their army.

**Art pipeline:** AI-generated 3D low-poly models (~300-800 tris, vertex colored), pre-rendered to 2D isometric sprite sheets. Zero runtime 3D cost.

---

### D13 — Mechanics Are Invariant Across Map Sizes

**Decision:** No mechanic changes between 1v1 small maps and 5-player FFA large maps. Only the map gets bigger and the math model scales.

**Reasoning:** A consistent mechanical language means players who learn the game on 1v1 can immediately transfer to FFA. Different maps are not different games. The scaling variables (CP, city count, turn limits, flank offsets) handle the feel difference automatically.

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

## ARCHETYPE SYSTEM — OPEN DESIGN FORKS

*This section documents what is known, what is decided, and what is deliberately left open. Do not collapse these forks until there is playtest data. The wrong commitment here is harder to undo than almost any other design decision.*

---

### What Is Decided

**Archetypes exist.** Players develop a strategic identity through in-match behavior. Upgrades are earned through objectives, not purchased with gold (see D8).

**Four archetypes for 1v1 MVP:**

| Archetype | Identity | Trigger behavior |
|-----------|----------|-----------------|
| Conqueror | Expansion | City capture and control |
| Predator | Aggression | Kill accumulation |
| Ghost | Information | Vision, scouting, ambush |
| Fortress | Defense | Holding ground, surviving pressure |

**Counter cycle (1v1):**
```
Conqueror → beats → Fortress
Predator  → beats → Conqueror
Ghost     → beats → Predator
Fortress  → beats → Ghost
```

**Upgrade triggers are visible to both players as signals. Specific unlocks are hidden.** The opponent knows you hit a threshold. Not what you got. This is the poker layer at archetype level.

**Complexity scales with match length.** Short matches see Tier 1 only. Long, close matches see both players fully developed. Endgame complexity is earned by the match staying competitive.

**Layered reveal timing.** Archetypes should not be fully active from turn 1.
```
Match start  → directives and ROE only
Mid game     → Tier 1 archetype unlocks
Late game    → Tier 2-3 abilities
```

---

### Fork 1 — Commitment Structure

**The decision:** When a player earns their first archetype trigger, how locked in are they?

**Option A — Hard Lock**
First trigger permanently sets archetype. Cannot change.

```
Pros: strong mind-games, highly readable, archetypes feel meaningful
Cons: early mistake is fatal, early map RNG matters too much, weak in FFA
Best for: 1v1 ranked where both players know what they're doing
```

**Option B — Free Pivot**
Triggers accumulate across archetypes simultaneously. Mixed bonuses.

```
Pros: flexible, forgiving, easier to balance
Cons: archetypes dissolve into meta builds, everyone converges,
      strategic identity disappears
Risk: becomes a deck-builder, not an identity system
```

**Option C — Soft Lock**
First trigger opens a tree. Switching is possible but costs reset progress.

```
active_archetype = current tree
switching → loses earned tier progress, starts new tree from zero

Pros: commitment pressure, bluff potential, recovery if misread
Cons: more state to track, UI must communicate progress clearly
Best for: both 1v1 and FFA
```

**Fred's recommendation:** Soft Lock (C). Most modern strategy games use this model.

**Status: OPEN.** Do not decide until 1v1 is playtested. Hard Lock may feel better in practice than it reads on paper. Soft Lock adds UI complexity that may not be worth it at MVP.

---

### Fork 2 — Graph Structure (1v1 vs FFA)

**The 4-unit cycle works because each archetype has exactly 1 predator and 1 prey.** Clean, learnable, meaningful.

**The 1v1 counter cycle is locked (see above).** This is a chain. Simple and readable.

**For FFA, a chain breaks.** A 7-way chain produces a dominant archetype in any given lobbies depending on composition. The correct structure for FFA is a **sparse directed graph** where each archetype:

```
beats 2 others
loses to 2 others
neutral vs remaining
```

No archetype dominates the table regardless of what the other 4 players are doing.

**Status: OPEN.** FFA graph topology cannot be designed until the 6-archetype set is finalized and the 1v1 cycle is playtested. Designing the web before understanding how archetypes play in practice will produce the wrong graph.

---

### Fork 3 — Archetype Count for FFA

**Minimum for 1v1:** 4 (decided, above)

**Candidates for FFA expansion:**

*Raider* — economic disruption. Razes cities, sabotages supply lines, blocks income. Doesn't build — destroys. Counters expansion players. Fred: strong addition, FFA needs this role.

*Warlord* — vertical scaling. Invests in unit quality over quantity. Elite squads, unit veterancy, morale effects. Fewer but stronger units. Counters attrition strategies. Fred: very good, introduces vertical vs horizontal as a strategic axis.

*Tactician* — CP efficiency and command control. Extra directive slots, faster redeployment, reaction bonuses. Fred's concern: "CP efficiency tends to become the mathematically best archetype." Reframe as Command Control to avoid economic optimization trap. Status: weakest of the three candidates.

**Fred's recommendation:** 6 archetypes (4 existing + Raider + Warlord). Tactician becomes a directive mechanic, not an archetype. 7 risks cognitive overload.

**Status: OPEN.** 6 vs 7 archetypes is a FFA-only question. Do not design FFA until 1v1 with 4 archetypes is stable.

---

### Fork 4 — Tier Structure

**Three tiers is decided.** Shallow enough to learn in one match, deep enough that late-game play feels meaningfully different from early game.

**What triggers tier advancement — two candidate models:**

**Model A — Achievement repetition**
```
Tier 1: threshold met once
Tier 2: threshold met twice
Tier 3: threshold met three times
```
Simple. Easy to communicate. Brittle — players farm the easiest trigger mechanically.

**Model B — Scaling thresholds**
```
Predator example:
Tier 1: first ambush kill
Tier 2: 3 ambush kills total
Tier 3: 5 ambush kills OR wipe an enemy army
```
Harder to farm. Tier 3 requires sustained commitment or a decisive moment. Fred: scaling thresholds are easier for players to understand than repetition counting.

**Status: OPEN. Lean toward Model B.** But the specific thresholds per archetype cannot be set until the archetype ability trees are designed. Thresholds must be calibrated against how frequently the trigger behavior naturally occurs in a match.

---

### Fork 5 — Escalation Gating

**Hard time gate:**
```
Tier 2 requires minimum round 2
Tier 3 requires minimum round 4
```
Prevents rush metas definitively. Feels arbitrary. Players who earn 5 ambush kills in round 1 wait for a timer.

**Soft cost gate:**
```
Tier 3 achievement requirement decreases over time:
Round 2: requires 6 kills
Round 4: requires 5 kills
Round 6: requires 4 kills
```
Natural pressure against rushing without hard rules. Rush metas punished by higher requirements, not blocked entirely.

**Fred's recommendation:** Soft cost gate. More elegant, same effect.

**Status: OPEN.** Cannot finalize until match length data exists from playtests. Gating that feels right on a 5-round match may be wrong on a 3-round match.

---

### What Needs To Happen Before Any Fork Is Closed

1. **1v1 playtests with 4 archetypes and Tier 1 only.** Does the counter cycle actually play out? Do players naturally signal which archetype they're pursuing? Does the Ghost vs Predator read work in practice?

2. **At minimum 20 competitive matches.** Not AI vs AI — human players who understand the system.

3. **Log archetype trigger frequency.** How often does each trigger fire per match? If Ghost triggers fire 3× more often than Predator triggers, the thresholds are wrong.

4. **Only then: design the full Tier 1-3 ability trees.** Fred offered to design the actual upgrade trees. Hold that until the above data exists.

---

### The Hidden Risk (Fred's Warning)

This design stacks three complexity systems:

```
1. Directives (movement + ROE)
2. Combat resolution (initiative, counter-fire, melee)
3. Archetype progression (tiers, triggers, abilities)
```

If all three mature simultaneously in the same match, the game becomes opaque. The layered reveal timing above (directives first, archetypes mid, tier 3 late) is the mitigation. But it must be enforced in implementation — not assumed.

---

## DESIGN ALIGNMENT — TENSIONS WITH FRED'S v1.0 DOC

*Fred's original Game Design Document (v1.0, March 2026) is the foundation this project was built on. The engine he shipped is excellent and largely consistent with that doc. The decisions in this section represent intentional divergences from v1.0. Each tension is flagged with a justification and a proposal. Fred's stated position: "Any change is fine with me as long as the game experience still works."*

---

### T1 — Simultaneous Resolution vs. Alternating Turns

**Fred's doc (Section 5, Phase 5):**
> "Implement alternating battle turns with server-enforced turn timer."

The v1.0 architecture processes one player's turn, broadcasts result, then awaits the other player. The server's `game-loop.ts` reflects this — `handleSubmitCommands` fires immediately on one player's submission.

**The proposal:** Replace alternating turns with simultaneous resolution. Both players submit commands during a shared planning window. The server holds both submissions and resolves only when both are received. Neither player sees the other's plan before committing.

**Justification — Game Design:**

Alternating turns make this game chess. Simultaneous resolution makes it poker. The difference is not cosmetic — it changes what skill means. In alternating turns, the second player always has an information advantage: they saw your move and can react. The first player is structurally disadvantaged. In simultaneous resolution, nobody reacts. Both players predict. The entire skill expression shifts from execution to inference.

This is the "show your hands" moment that defines the product. Without it, the directive system is just a slower version of every other tactics game. With it, the game is genuinely new.

**Justification — Market:**

The poker audience is one of the most valuable and underserved audiences in competitive gaming. Poker players already understand the core loop: hidden information, commitment under uncertainty, reading opponents, reveal. They don't need to be taught the game. They need a battlefield instead of a table.

The alternating-turn strategy market is crowded (Into the Breach, Advance Wars, XCOM). The simultaneous-commit market has almost no direct competitors at the indie level. Mechabellum is the closest but uses a placement phase, not a directive system, and has no hidden information during planning.

**Market Research Prompt (to run separately):**

> "Compare the market size, spending behavior, platform preferences, and competitive overlap between two audiences: (1) competitive turn-based strategy game players (Into the Breach, Advance Wars, XCOM, Mechabellum) and (2) online poker and competitive card game players (poker, Legends of Runeterra, Slay the Spire). For each audience: estimate global active player count, average annual spend on games/platforms, willingness to engage with betting or staking ecosystems, preferred platforms (PC/mobile/console), and crossover potential. Identify whether a simultaneous-commit hex tactics game with hidden information and a reveal mechanic would index more strongly with audience 1 or audience 2, and what the monetization ceiling looks like for each."

**Engine change required:**
`game-loop.ts` must buffer both players' command submissions before calling `executeTurn()`. This is a load-bearing change but architecturally clean — the resolution logic itself doesn't change, only the trigger condition.

---

### T2 — Upgrade System: Objective-Based vs. Currency-Based

**Fred's doc:** No progression system. Units are static. No upgrades between rounds.

**The proposal:** Objective-based upgrades. Players earn unlock triggers through in-match behavioral achievements — not by spending gold.

**The fork defined:**

**Fork A — Currency upgrades (gold buys power)**
Upgrades are items in the build phase shop. Win a round, earn more gold, spend gold on upgrades alongside units.

What this optimizes for: resource allocation efficiency. The skilled play becomes "maximize ROI on gold spent." Every decision competes on the same axis — should I buy another tank or buy this upgrade?

What this produces in practice: economic optimization as the primary skill. The game becomes budgeting with tactics as a secondary layer. Players who are good at spreadsheet optimization win. The "poker" identity weakens because the hidden information layer is replaced by a visible currency race.

Structural risks: gold already governs units, maintenance, and carryover. Adding upgrades creates a god-currency where every decision is fungible. Winner-gets-more-gold becomes winner-gets-better-units-AND-upgrades. The catch-up mechanic is patching a self-inflicted snowball. Small gold rebalances cascade into unit viability, upkeep viability, and upgrade viability simultaneously — a coupled system that is hell to tune.

**Fork B — Objective-based upgrades (behavior earns power)**
Upgrades are unlocked by achieving specific in-match conditions during battle. Not purchased.

Example triggers:
- Hold 3 cities simultaneously → unlock Fortify directive
- Kill 3 units in one round → unlock melee tier upgrade for one unit
- Scout 60% of enemy map → unlock Ambush directive
- Hold defensive position 3 consecutive turns → support heal radius increases

What this optimizes for: strategic identity. The upgrades you're chasing shape your directive choices before the round even starts. You're playing a style, not a budget.

What this produces: a second rock-paper-scissors layer on top of the unit one. Units counter each other tactically. Archetypes counter each other strategically.

The four archetypes that emerge naturally:

| Archetype | Chases | Unlocks | Countered by |
|-----------|--------|---------|--------------|
| Conqueror | City control | Economic/fortification | Predator |
| Predator | Kill accumulation | Combat/melee bonuses | Ghost |
| Ghost | Vision/information | Fog upgrades, ambush | Fortress |
| Fortress | Defensive holding | Hold bonuses, healing | Conqueror |

Counter cycle: Conqueror → Fortress → Ghost → Predator → Conqueror.

The bluff layer: a skilled player signals one archetype in early rounds to bait a counter-response, then pivots. Opponent must read whether the switch happened. This is the strategic poker layer — operating one level above unit combat.

**Upgrade trigger visibility:** When a player earns an upgrade, a signal is visible to both players ("enemy achieved kill threshold"). The specific unlock is hidden. You know they've been hunting. You don't know what they got. That is information. That is the read.

**Verdict:** Fork B is correct for this game's identity. Fork A produces a better budgeting game. Fork B produces a better poker game.

---

### T3 — Map Size: 10×8 vs. Scale Target

**Fred's doc (Section 2.1):**
> "Grid Size: 10 wide × 8 tall (80 hexes). Large enough for tactics, small enough for fast play."

The current engine shipped at 20×14 (280 hexes). The design direction is 5-8x current size — targeting roughly 60×40 to 100×70.

**The tension:** Fred's v1.0 explicitly targets 10-15 minute matches. Bigger maps mean longer matches. This is real and must be watched.

**The proposal:** Accept slightly longer matches — 15-20 minutes instead of 10-15 — in exchange for what the larger map enables.

**What the larger map buys:**

*The chain needs space to build.* The emotional engine of this game is commitment → escalation → reveal. On a 10×8 map, armies are in contact by turn 2. There is no buildup phase, no misdirection, no opportunity to commit to a flanking strategy that takes 4 turns to execute. The chain is compressed into a skirmish. On a larger map, early rounds establish position, mid-game creates the tension of converging plans, late rounds deliver the payoff. That arc requires physical distance on the board.

*Strategies need room to diverge.* The archetype system (Conqueror, Predator, Ghost, Fortress) only produces meaningful differentiation if the map is large enough that a Conqueror can spread across multiple city corridors while a Fortress digs in elsewhere. On 10×8, everyone is fighting over the same 2 hexes from turn 1.

*Water requires map real estate.* Naval units (boats) are a planned domain addition. A 10×8 map has no room for a meaningful sea lane. A larger map can have a coastal region, a river system, or an inland sea that creates genuine naval strategy. Without the space, boats are a novelty unit, not a strategic layer.

**The monitoring commitment:** Match length must be tracked from the first playtests. If 15-20 minutes feels like waiting rather than tension-building, the map is too large or the movement speeds are too slow. The fix is parametric (movement scales with map width per D10) not architectural. This is a tuning risk, not a design risk.

**Recommendation:** Ship the sprint on a medium map (40×28). Measure match length. If matches hit 20+ minutes consistently, tune movement ranges up before expanding further. Do not lock map size until 20+ matches of data exist.

---

### T4 — Aircraft & Anti-Air: Post-MVP vs. MVP Inclusion

**Fred's doc (Section 10.2):**
> "Post-MVP (v1.1+): Aircraft and Anti-Air units."

The v1.0 reasoning: simplicity for launch. Fewer unit types = faster onboarding = smaller MVP scope.

**The proposal:** Include aircraft and anti-air in MVP, or at minimum define them fully in the math model before any other balancing work begins.

**Justification — It's trivial to add once the math model exists:**

Aircraft and anti-air are not new mechanics. They are new entries in two existing tables: `UNIT_STATS` and `TYPE_ADVANTAGE`. The engine already has the insertion points (Section 3.3 of this doc). Adding a new unit type requires: one new row in UNIT_STATS, one new row and column in TYPE_ADVANTAGE, and one domain flag (`moveType: 'air'`) that bypasses terrain movement costs.

The art pipeline is AI-generated. A plane model takes the same 10 minutes as the bulldozer. There is no art bottleneck.

**Justification — The math model must include them now regardless:**

This is the stronger argument. The TYPE_ADVANTAGE matrix is a 4×4 grid today. If we balance units assuming 4 types and then add 2 more later, every existing multiplier needs re-examination. A recon that counters artillery at 2.0× (per aspirational design) may become overpowered if aircraft also counter artillery at 2.0× — now artillery has two hard counters and becomes unplayable. The entire RPS balance shifts with each new unit added.

Defining aircraft and anti-air in the math model now — even if they are not in the first playtest build — means the 4-unit balance is designed with the full 6-unit system in mind. We tune for the target state, not an intermediate state we'll have to undo.

**Resolution:** Aircraft and anti-air are post-MVP. The argument for defining the 6-unit matrix now assumes we can predict how aircraft will interact with a ground meta that doesn't exist yet. We can't. Balance the 4-unit cycle first. Once the ground meta is stable (20+ competitive matches), derive the 6-unit matrix from observed data, not theory. This aligns with U1.

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

## COMBAT TIMELINE — SIMULTANEOUS RESOLUTION SPECIFICATION

*Finalized. This is the authoritative simulation order for simultaneous turn resolution. Every mechanic must plug into one of these phases. No mid-phase rule changes. Each phase reads from the previous state and writes to the next.*

---

### Core Design Properties

**Predictable physics + unpredictable opponent.**

Players are uncertain because they do not know the opponent's plan. Not because the engine behaves in ways they cannot reason about. Players reason about zones, not paths. "If I move through tank range, something might happen." Chain reactions within a tick are forbidden — movement decisions are locked before combat resolves. No unit reroutes because of another unit's combat outcome in the same tick.

**The uncertainty is correct uncertainty.** We plan and the collision of plans produces drama. The chaos comes from conflicting intentions, not from an opaque engine.

**Animation mapping.** Every phase maps directly to a visual layer in the reveal sequence:

```
Phase 3 → movement arrows animate
Phase 5 → gunfire / first strike
Phase 6 → return shots
Phase 7 → close combat animation
Phase 8 → support / effects glows
Phase 9 → city color flips
```

Players literally watch the timeline play out.

---

### The Two-Layer Directive Model

Every unit carries two directive layers. These are set during the planning phase and cannot change mid-tick.

**Movement Directive** — defines destination and path behavior:

| Directive | Behavior |
|-----------|----------|
| `advance(target)` | Move toward target hex via shortest path |
| `flank(target)` | Move toward target via offset flanking arc |
| `hold` | Do not move |
| `retreat` | Move toward deployment zone |

**Engagement Directive (Rules of Engagement)** — defines behavior when enemy contact occurs:

| ROE | Behavior |
|-----|----------|
| `assault` | Stop movement immediately and engage |
| `skirmish` | Fire once while passing, continue moving |
| `cautious` | Stop if threatened, do not initiate |
| `ignore` | Complete movement regardless of contact |

Specialty actions (capture, support, scout, fortify) are **modifiers** on these two layers, not a third category.

**Interaction examples:**

| Movement | ROE | Result |
|----------|-----|--------|
| advance | assault | Moves toward target, stops at first contact |
| advance | skirmish | Moves through, fires once per threat zone |
| advance | ignore | Completes full path, no mid-move combat |
| flank | cautious | Reroutes if threatened, does not initiate |
| hold | assault | Stationary, engages anything entering range |

---

### Global Invariants

These rules cannot be broken by any directive combination:

1. **Movement locks before combat.** No unit changes its path because another unit died or moved in the same tick.
2. **No same-tick chain reactions.** A hex freed by a kill in tick N is available in tick N+1, not N.
3. **One intercept cap per unit per tick.** Each unit may generate maximum 1 intercept event as a source or target per movement phase. Tunable. MVP = 1.
4. **Intercept eligibility requires ROE.** An enemy unit only fires during movement if its engagement directive is `assault` or `skirmish`. `cautious` and `ignore` units do not generate intercept events.

---

### Phase 1 — Snapshot

Freeze world state. All calculations in this tick reference this baseline.

```
snapshot = clone(gameState)
```

Snapshot contains: units, hp, positions, directives, terrain, cities, vision state.

Nothing mutates the snapshot during resolution.

---

### Phase 2 — Intent Collection

Each unit generates a composite intent from its two directive layers plus any active CP commands.

```
intent {
  unitId
  movementDirective    // advance | flank | hold | retreat
  engagementROE        // assault | skirmish | cautious | ignore
  specialtyModifier    // capture | support | scout | fortify | null
  cpOverride           // direct-move | direct-attack | redirect | retreat
  targetHex
  targetUnit
}
```

CP commands take priority over directive AI. A unit with a CP override executes the command; its directive AI does not run this tick.

All intents generated simultaneously from snapshot state. No unit sees another unit's intent.

---

### Phase 3 — Movement Phase

**Movement is step-by-step along the path. Decisions are local to the moving unit. Other units never reroute.**

**Step 1 — Path Determination**

Each unit computes path toward intent target using A* with terrain costs. Movement budget = `moveRange` (cost-based, not step-based — see design risk 8.2 for current engine discrepancy to fix).

**Step 2 — Intercept Check (per step)**

At each step along the path:

```
for each enemy unit with attackRange covering this hex:
  if enemy.ROE is ASSAULT or SKIRMISH:
    queue interceptEvent(enemy → moving unit)
    if movingUnit.ROE is ASSAULT or CAUTIOUS:
      movement stops here
      queue engagementEvent(movingUnit → enemy)
    if movingUnit.ROE is SKIRMISH:
      queue engagementEvent(movingUnit → enemy)  // fires once, keeps moving
    if movingUnit.ROE is IGNORE:
      intercept event queued, movement continues
```

**Intercept cap:** Each unit may be the source of maximum 1 intercept event per tick. First eligible enemy fires. Subsequent threats along the path do not generate additional intercept events this tick.

**Step 3 — Destination Reservation**

After all paths are stepped, every unit proposes a final destination hex.

```
destinationMap: hex → [units]
```

**Step 4 — Collision Resolution**

| Situation | Resolution |
|-----------|------------|
| Single claimant | Unit moves successfully |
| Multiple claimants, same faction | Higher moveRange wins hex. Others stop one hex short. Tie → both stop one hex short. |
| Multiple claimants, enemy hex | Engagement flagged. Both stop one hex short (adjacent). |
| Head-on collision (A→B, B→A, same path) | Both stop one hex short of each other. Now adjacent. No combat this tick unless ROE triggers. Melee eligible next tick. |
| Same-hex after step resolution | Cannot occur — collision resolution prevents it. No stacking exception. |

**Movement decisions are now locked. No rerouting for remainder of tick.**

---

### Phase 4 — Engagement Detection

After all movement is resolved, determine which units are in combat range.

For each unit pair (friendly, enemy):

```
check: cubeDistance ≤ attackRange
check: line of sight (domain-dependent)
check: domain compatibility (attackableDomains includes defender.domain)
check: engagementROE ≠ ignore
```

Generate attack events for all eligible pairs.

```
attackEvent {
  attacker
  defender
  distance
  approachAngle   // used for initiative modifier
  isInterceptEvent  // flagged from Phase 3
}
```

If multiple enemies in range → directive targeting rules choose primary target (closest first, lowest HP tiebreak — existing engine behavior).

---

### Phase 5 — Initiative Resolution (First Strike)

All `assault` and `skirmish` ROE units fire. Order determined by response time.

**Response time** (lower = fires first):

| Unit | Base Response Time |
|------|--------------------|
| Scout | 1 |
| Infantry | 2 |
| Tank | 3 |
| Artillery | 4 |
| Plane | 1 |
| Boat | 3 |

**Modifiers:**

| Condition | Modifier |
|-----------|----------|
| Flanking approach angle | Attacker −1 (fires faster) |
| Defender on mountain | Defender −1 (high ground awareness) |
| Defender in forest | Attacker +1 (obscured target) |

**Resolution:**

```
sort attackEvents by responseTime (ascending)

for each attackEvent:
  if attacker.hp > 0:
    damage = calculateDamage(attacker, defender, terrain)
    defender.hp -= damage
    if defender.hp <= 0:
      removeUnit(defender)
      cancel all pending attackEvents where source = defender
      cancel melee entry for defender
```

Intercept events from Phase 3 are included in this queue with the moving unit as attacker or defender depending on who initiated.

---

### Phase 6 — Counter Fire

Units that survived Phase 5 and have `cautious` ROE fire back.

Same resolution logic as Phase 5. Same initiative ordering.

```
for each surviving defender with cautious ROE:
  if attacker still alive AND in range:
    damage = calculateDamage(defender, originalAttacker, terrain)
    originalAttacker.hp -= damage
    if originalAttacker.hp <= 0:
      removeUnit(originalAttacker)
      cancel that unit's remaining attack events
```

**Note on Phases 5+6:** These are two sub-steps of one Engagement Resolution phase. Phase 5 = initiative fire (weapons free + intercepts). Phase 6 = counter fire (return fire only). Separated for clarity and animation mapping, but logically one event stream.

---

### Phase 7 — Melee Resolution

Units in contact after movement and ranged engagement enter melee.

**Contact conditions:**
- Adjacent hex after Phase 3 movement locked
- Head-on collision result (both stopped one hex short, now adjacent)
- Collision on enemy hex (both stopped adjacent)

**Melee does NOT require same hex.** The stacking invariant is preserved. Melee = adjacent contact, not co-occupation.

**Melee damage uses `meleeRating`, not ATK/DEF.**

| Unit | Melee Rating |
|------|-------------|
| Scout | S (fastest, close-quarters) |
| Infantry | A |
| Tank | D (turret rotation penalty) |
| Artillery | F (it's a cannon) |
| Plane | N/A — automatically disengages, cannot be locked |
| Boat | B (boarding rules, separate) |

Melee persists until one unit dies or one unit retreats (costs 1 CP next planning phase to break melee).

---

### Phase 8 — Directive Effects

Non-combat directive actions execute. These occur after combat so they cannot undo lethal damage.

| Directive | Effect |
|-----------|--------|
| `support` | Heal adjacent friendly with lowest HP by +1 |
| `scout` | Reveal all enemy units within visionRange |
| `fortify` | Apply defense modifier for next tick |
| `capture` | Begin/continue city capture sequence |

---

### Phase 9 — Territory Resolution

Cities update ownership.

```
for each city hex:
  if unit standing on city AND city.owner ≠ unit.owner:
    city.owner = unit.owner
    unit.hp -= 1
    if unit.hp ≤ 0: removeUnit(unit)  // city still flips
```

City capture HP cost represents the cost of securing and holding a position under fire.

---

### Phase 10 — Round End Check

Evaluate win conditions in priority order:

1. **City majority:** does any player hold ≥ X cities simultaneously? (X = floor(totalCities × 0.6), scales with map)
2. **Elimination:** one side has 0 units
3. **Turn limit:** both sides have reached `maxTurnsPerSide`

If none triggered → next planning phase begins.

---

### Event Log Format

The simulation must emit a structured event stream. This powers replay, debugging, and spectator tools. The existing `TurnRecord` in `server/src/types.ts` is the foundation — extend it to this format:

```
MOVE      unitId → hex(q,r)
INTERCEPT enemyId fires at unitId at hex(q,r)
ATTACK    attackerId → defenderId  [damage: N]
COUNTER   defenderId → attackerId  [damage: N]
KILL      unitId  at hex(q,r)  killedBy: unitId
MELEE     unitA ↔ unitB  at hex(q,r)
CAPTURE   cityHex  newOwner: playerId
HEAL      unitId  +N hp  by: unitId
REVEAL    unitId  hexes: [...]
```

Do not rebuild from scratch. Extend the existing structure.

---

### The System in One Sentence

```
movement (step + intercept check) → engagement detection → initiative fire → counter fire → melee → effects → territory → round check
```

Every mechanic plugs into one of those layers. If a new mechanic doesn't fit, the design of that mechanic needs revisiting before the timeline does.

---

### Implementation Notes & Watchlist

**N1 — Intercept Cap Is The Primary Balance Lever**

`INTERCEPT_CAP = 1` (per unit per tick) is the single most impactful tuning variable in the entire system. It determines how dangerous movement is, which determines whether offensive or defensive play dominates.

- Cap = 1 → movement is relatively safe. Flanking and repositioning are viable. Aggressive play is rewarded.
- Cap = 2 → moving through contested space is costly. Defensive positioning strengthens.
- Cap = 3+ → movement becomes extremely dangerous. Turtling dominates. The game slows down.

Start at 1. Watch the first 20 matches. Raise to 2 only if defensive turtling is clearly dominant. Do not change this number based on theory — change it based on match data.

**N2 — Head-On Stall Exploit**

The head-on collision rule (both stop one hex short, no combat this tick if move-only ROE) is clean and deterministic. But it creates a specific stall pattern: two units using `advance` toward each other will stop adjacent every tick forever if neither has an `assault` or `skirmish` ROE. Neither moves forward. Neither fights. Permanent mutual block.

This may emerge as a deliberate stall tactic in competitive play — park a cheap unit in a corridor to freeze an expensive enemy unit indefinitely.

Monitor for this. If it becomes a pattern, the fix is a **contested hex rule:**

> If two units have been adjacent and facing each other for N consecutive ticks without either moving or engaging, both automatically enter `assault` ROE for the next tick.

N = 2 is probably right. Do not implement until the pattern is confirmed in playtests.

**N3 — Event Log Is Load-Bearing Infrastructure**

The event log is not a nice-to-have. It is the foundation of three critical systems:

1. **Reveal animation** — the renderer plays the event stream sequentially. Without a structured log, the reveal is a teleport, not a story.
2. **Debugging** — simultaneous resolution with intercepts, counter-fire, and melee creates interactions that are impossible to debug from state diffs alone. The event stream is the only way to trace why a unit died.
3. **Spectator and replay** — any future spectator mode or match replay is just a playback of the event log.

Implement the full event log format in the first build, not as a polish pass. Every hour spent on it early saves ten hours of blind debugging later. Extend the existing `TurnRecord` structure — do not rebuild from scratch.

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

*Post-MVP. Do not implement until MVP is stable, playtested, and the ground unit meta is understood. These features depend on a working MVP foundation.*

---

### U1 — Aircraft & Anti-Air

**Why post-MVP:** Aircraft and anti-air cannot be balanced correctly until the 4-unit ground cycle is stable. Adding them to a broken ground meta produces a broken 6-unit meta. Fix the foundation first.

**When to add:** After 20+ competitive matches with the 4-unit system. When the ground meta has settled and dominant strategies are understood.

**Design intent (to be finalized at implementation time):**

Aircraft is a soft universal threat (1.3× all ground units) that ignores terrain movement cost. Anti-air is the 2.0× hard counter. Infantry and Tank can overrun AA positions at 1.5×. Artillery cannot target aircraft (0.0×).

Full 6-unit matrix to be derived from the math model at implementation time. Do not define final numbers until ground cycle is confirmed stable.

**Domain properties to add:**
```
domain: 'ground' | 'air'
moveType: 'land' | 'air'
attackableDomains: ('ground' | 'air')[]
```

Air units: ignore terrain movement cost, cannot enter melee, automatically disengage from ground contact.

**Open questions before implementation:**
1. Can infantry shoot planes without dedicated AA? (affects AA unit necessity)
2. Do planes see through all terrain or are they blocked by elevation?
3. Does anti-air have a minimum attack range like artillery?

### U2 — Naval Units & Water Terrain

**Why post-MVP:** Requires water as a terrain type or map layer, map designs with coastlines and sea lanes, and a naval unit sub-tree (at minimum: transport, gunboat, destroyer). The map design implications alone make this a major feature, not a unit addition.

**When to add:** After aircraft/anti-air are stable. Requires dedicated map design work.

**Design intent:** Boats control sea lanes and enable coastal bombardment. Transport boats allow troop movement across water. Naval units create a third strategic axis on large maps.

### U3 — Five-Player FFA Mode

**Why post-MVP:** Requires matchmaking infrastructure for 5 players, balance testing across FFA dynamics (kingmaking, alliance behavior, elimination pacing), and larger map variants. The core mechanics do not change — maps get bigger and city counts scale. But the social dynamics of FFA (targeting, diplomacy without chat, elimination timing) need dedicated design work.

**When to add:** After 1v1 is stable and the ranked ladder has an active player base.

### U4 — Full Archetype Unlock Tree

**Why post-MVP:** The four upgrade triggers in A9 are the MVP version. A full archetype system has branching unlock paths, counter-archetype signals, and a richer set of unlockable directives. Requires match data to balance — cannot be designed correctly without knowing how players actually pursue objectives.

### U5 — Spectator Mode & Match Replay

**Why post-MVP:** Depends on the event log being fully implemented and stable (N3). Once the event log is solid, spectator mode is mostly a renderer feature — play the event stream for a third client. Replay is the same. High value for the poker/betting audience but not blocking for launch.

### U6 — Betting & Staking Ecosystem

**Why post-MVP:** Not built by the dev team. Designed for. Requires: clean spectator mode, verifiable match results, public match history, stable ranked system. When those exist, third-party betting markets can emerge organically. The Stake/Polymarket audience will find the game if the spectator infrastructure exists. Do not build the platform. Build the conditions for the platform to emerge.

### U7 — Faction System (Visual)

**Why post-MVP:** Five factions (Engineers, Caravaners, Wardens, Scrappers, The Current) are defined in the art direction. Faction identity is purely visual — same stats, different skins. Post-MVP because it requires a full art pass per faction and a faction selection UI. The game is fully playable with one faction skin. Add others as content updates.

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
