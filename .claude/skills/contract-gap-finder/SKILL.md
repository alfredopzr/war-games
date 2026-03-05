---
name: contract-gap-finder
description: Deep codebase audit that finds game mechanics, state transitions, combat interactions, and balance surfaces that have no contract defining what correct or incorrect means. Not looking for bugs — looking for the absence of rules.
user-invocable: true
---

# Contract Gap Finder — Game Engine

Find places where the game has behavior but no contract governing that behavior.

This is not a documentation audit. This is a **rule coverage audit**. The question is never "is this documented?" — it is "does a contract exist that would tell me if this code were wrong?"

---

## 1. Contract Ontology

### 1.1 What Counts as a Contract

A contract is a written rule that satisfies at least one of these types:

| Type Code | Name | Definition |
|-----------|------|------------|
| **INV** | Invariant | States what must always be true (e.g., "q + r + s = 0 for all hex coordinates") |
| **CON** | Constraint | States what is forbidden (e.g., "artillery cannot fire at adjacent hexes") |
| **BAL** | Balance Contract | States a numeric relationship that must hold (e.g., "ATK = HP × 0.35") |
| **CASCADE** | Cascade/Consequence | States what must happen when X changes (e.g., "if a unit dies, cancel all pending attack events from that unit") |
| **SEM** | Semantics | States what the output means (e.g., "moveRange is cost budget, not step count") |
| **AUTH** | Authority | States who owns the data (e.g., "balance spreadsheet is authoritative, not code constants") |

### 1.2 Where Contracts Live

| Location | What it contains |
|----------|-----------------|
| `docs/DESIGN.md` | Game rules, unit roster, terrain definitions, economy, win conditions, control system |
| `docs/GAME_MATH_ENGINE.md` | Math model, damage formula, type advantage matrix, combat timeline, balance framework, design decisions (D1-D13), MVP targets (A1-A12), known design risks (8.1-8.10) |
| `docs/ChackAttacc.md` | Vision system updates, additional design refinements |
| `strategy_game_balance_master.xlsx` | Authoritative balance numbers (UnitStats, TypeMatrix, DamageMatrix, HitsToKill) |
| `packages/engine/src/types.ts` | Type definitions — implicit contracts when they encode game rules (e.g., UnitType union constrains valid unit types) |
| Test files (`*.test.ts`) | Behavioral contracts — tests that assert specific outcomes are implicit contracts on those mechanics |

**Important:** A test that asserts `calculateDamage()` returns a specific value IS a contract on that damage formula. But a test that merely checks "function doesn't throw" is structural hygiene, not a semantic contract. The auditor must distinguish.

### 1.3 Contract Map Extraction Format

For each contract found, write a `CONTRACT_MAP` ledger entry:

```
contract_id: D1
type: INV
source: docs/GAME_MATH_ENGINE.md §D1
covered_surfaces:
  - game-state.ts:executeTurn()
  - server game-loop.ts:handleSubmitCommands()
rule: "Both players submit commands simultaneously. Resolution happens only after both have committed."
consequences: If broken — first-mover advantage, reactive play replaces prediction
```

---

## 2. Gap Taxonomy

### 2.1 Gap Types

| # | Gap Type | Detection Question |
|---|----------|-------------------|
| 1 | **Uncontracted mechanic** | "Does this game behavior have a rule defining correct behavior?" |
| 2 | **Uncontracted state transition** | "Is the legality of this state change defined?" (e.g., phase transitions, unit death, city capture) |
| 3 | **Uncontracted balance surface** | "Is this numeric value governed by the math model or is it an orphan constant?" |
| 4 | **Uncontracted interaction** | "When system A meets system B, is the combined behavior defined?" (e.g., flanking + forest terrain + hold directive) |
| 5 | **Uncontracted edge case** | "What happens at the boundary?" (e.g., 0 HP exactly, max range exactly, empty command list) |
| 6 | **Design doc ↔ engine divergence** | "Does the code match what the design doc says?" |
| 7 | **Uncontracted API surface** | "Does the caller know what this function promises?" (engine public exports, network protocol messages) |

### 2.2 What is NOT a Gap

- A bug (code doing the wrong thing against an existing contract)
- A known design risk explicitly listed in GAME_MATH_ENGINE.md §8 (8.1-8.10)
- A deliberately open design fork (Fork 1-5 in GAME_MATH_ENGINE.md)
- Missing code for a planned feature (e.g., melee system not yet implemented)
- Code style or quality issues

### 2.3 Adjacent-to-Known-Risk Rule

If a surface is related to a known design risk (§8.x) but covers a **different behavior**, it IS still a gap. Report it with annotation: `"Adjacent to design risk 8.X but covers a different surface."` The exclusion applies only when the exact surface matches.

---

## 3. Coverage Metric

### 3.1 Auditable Units

The audit counts coverage in discrete units. A unit is one of:

| Unit Type | Example | How to enumerate |
|-----------|---------|-----------------|
| `module.function` | `combat.ts:calculateDamage()` | Read engine source exports |
| `type.field` | `Unit.hp`, `GameState.phase` | Read `types.ts` |
| `balance_constant` | `UNIT_STATS.infantry.atk`, `BASE_INCOME` | Read `units.ts`, `economy.ts` |
| `state_transition` | `build → battle`, `unit alive → dead` | Read `game-state.ts` phase transitions |
| `interaction` | `flank directive + forest terrain` | Cross-reference directive AI with terrain system |
| `network_message` | `submit-commands`, `state-update` | Read `types.ts` network protocol types |
| `test_assertion` | `combat.test.ts: "minimum 1 damage"` | Read test files for behavioral contracts |

### 3.2 Coverage Definition

A unit is **covered** if and only if:
- At least one contract (design doc rule, math model formula, test assertion, or type constraint) explicitly references it, AND
- The rule states what correct behavior is OR what is forbidden OR what numeric relationship must hold

A unit is **partially covered** if a contract mentions the domain but does not explicitly reference this specific unit.

A unit is **uncovered** if no contract references it or its containing domain.

### 3.3 Weighting

| Weight | Criteria |
|--------|----------|
| **3** (critical) | Balance constants, damage formula inputs/outputs, state transitions, win conditions, combat resolution, economy calculations |
| **1** (standard) | Everything else |

**Coverage score:**
```
covered_weight = SUM(weight for covered units)
total_weight = SUM(weight for all units)
coverage = covered_weight / total_weight
```

Report as a fraction (e.g., "87/142 weighted units covered") — not as a bare percentage.

---

## 4. Team Architecture

### 4.1 Domain Model

Five domains, each mapping to one auditor agent and one spec doc. Domains are defined by what changes together, not by file proximity.

#### Domain 1: Space — where things exist and how they traverse the world

**Files:** `hex.ts`, `world.ts`, `terrain.ts`, `pathfinding.ts`, `vision.ts`, `map-gen.ts`, `noise.ts`, `rng.ts`
**Spec:** `SPATIAL_SYSTEMS.md`

The physical layer. Coordinates, grid topology, terrain definitions (costs, passability, LoS blocking, defense modifier values), movement budgets, pathfinding, vision/fog of war, map generation, deployment zones, elevation.

`terrain.ts` belongs here — it defines the physical surface. Combat reads the defense modifier from it but doesn't own the definitions. `rng.ts` belongs here — its heaviest consumers are map-gen and noise. Combat auditor must be aware of it for seeded determinism.

#### Domain 2: Combat — how units fight, take damage, and die

**Files:** `combat.ts`, `units.ts` (stats + type advantage matrix)
**Spec:** needs `COMBAT_MODEL.md`

Damage formula, type advantage matrix, attack range checks, initiative/response time, counter-attacks, melee ratings, kill timing targets, HP/ATK/DEF invariant (`ATK = HP × 0.35`), RNG variance band. The pure math model.

Narrowly scoped. Only the formulas and numbers. Not "when combat happens" (Resolution) or "who decides to attack" (Control).

#### Domain 3: Control — how units decide what to do

**Files:** `directives.ts`, `commands.ts`, `ai.ts`
**Spec:** needs `DIRECTIVE_SYSTEM.md`

Two-layer directive model (movement + ROE). Specialty modifiers (capture, support, scout, fortify). Command points and CP scaling. CP overrides. Directive AI target selection and retargeting. AI build-phase logic.

`commands.ts` belongs here — CP spending is a control concern ("how many units can the player override"), not a state machine concern.

#### Domain 4: Resolution — how a tick resolves and what the game loop does

**Files:** `game-state.ts`, `serialization.ts`, `packages/server/src/game-loop.ts`
**Spec:** needs `RESOLUTION_PIPELINE.md`

The 10-phase combat timeline pipeline. Simultaneous submission model. Phase transitions (build → battle → scoring → game-over). Turn execution order. Collision resolution. Intercept queuing. Event log emission. Round scoring. Win conditions (multi-city majority, elimination, tiebreaker). State snapshots. Serialization across transport boundaries.

`game-state.ts` is the integration point — it calls combat, economy, directives. The auditor's job is the orchestration: in what order things happen, what state transitions are legal, what events get emitted. Not re-auditing the systems it calls.

Server `game-loop.ts` is in scope — that's where simultaneous submission is enforced.

#### Domain 5: Economy — resources, costs, and progression

**Files:** `economy.ts`, `units.ts` (cost field only)
**Spec:** needs `ECONOMY_AND_PROGRESSION.md`

Income sources (base, city, kill bonus, win/catch-up), maintenance, carryover, starting resources, unit costs. Plus the archetype system (triggers, tiers, counter cycle) — currently in GAME_MATH_ENGINE.md but is progression economics.

### 4.2 Cross-Cutting Concerns (lead owns, not any single auditor)

- **`types.ts`** — defines types for all domains. Lead enumerates type fields during Phase 1 and distributes relevant fields to each auditor's task description.
- **`index.ts`** — public API surface. Any exported function with no contract is a gap. Lead checks this during Phase 7.
- **Network message types** (ClientMessage, ServerMessage in `types.ts`) — the client↔server contract surface. Resolution auditor checks these.

### 4.3 Shared File Ownership

Some files are consumed by multiple domains. Ownership is by who defines, not who reads:

| File | Owner (defines) | Consumers (reads) |
|------|----------------|-------------------|
| `terrain.ts` | Space | Combat (defense modifier), Control (flank cost reduction) |
| `units.ts` | Combat (stats, type matrix) | Economy (cost field), Resolution (createUnit) |
| `rng.ts` | Space (map-gen, noise) | Combat (seeded damage variance) |

When an auditor encounters a shared file outside their domain, they check only the consumption — "does my domain use this value correctly per its contract?" They do not re-audit the definition.

### 4.4 Team Structure

| Agent | Role | Domain | Scope |
|-------|------|--------|-------|
| **lead** | Orchestrator | Cross-cutting | Phase 1 (contract map from all design docs). `types.ts`, `index.ts` (public API). Phase 7-8 (gap identification, report). |
| **space-auditor** | Physical layer | Space | `hex.ts`, `world.ts`, `terrain.ts`, `pathfinding.ts`, `vision.ts`, `map-gen.ts`, `noise.ts`, `rng.ts`. Spatial invariants, movement budget semantics, LoS, map validation. |
| **combat-auditor** | Damage math | Combat | `combat.ts`, `units.ts` (stats + type matrix). Damage formula, type advantages, kill timing, stat invariants, balance authority chain. |
| **control-auditor** | Intent → action | Control | `directives.ts`, `commands.ts`, `ai.ts`. Directive behaviors, ROE, CP system, target selection, AI decision logic. |
| **resolution-auditor** | Orchestration | Resolution | `game-state.ts`, `serialization.ts`, server `game-loop.ts`. Phase transitions, turn pipeline, collision resolution, win conditions, event emission, simultaneous submission. |
| **economy-auditor** | Resource flow | Economy | `economy.ts`, `units.ts` (cost field). Income, maintenance, carryover, catch-up, kill bonus scaling, archetype triggers. |

### 4.5 Spawn Sequence

1. **Lead** spawns first. Executes Phase 1 (contract map extraction). Writes all `CONTRACT_MAP` entries to the ledger. Enumerates cross-cutting type fields.
2. **Lead** creates tasks in the team task list — one per auditor agent, scoped to their domain. Each task includes the relevant type fields from `types.ts`.
3. **Lead** spawns the five auditor agents (all `general-purpose` subagent_type with `team_name`).
4. Each auditor claims its task, reads the ledger to access the contract map, then explores its domain and appends findings.
5. When all auditors complete, **lead** reads the full ledger, checks `index.ts` exports, and synthesizes the gap report.

### 4.6 Agent Instructions (passed to each auditor at spawn)

Each auditor receives:

```
You are {agent_name} on the contract-gap-finder team.

YOUR LEDGER: audit/ledgers/{session_id}.md
YOUR DOMAIN: {domain name from §4.1}
YOUR FILES: {files listed for this agent in §4.4}

PROTOCOL:
1. Read the ledger. The CONTRACT_MAP entries are already there from the lead.
2. Explore every file in your domain. For each auditable unit found, append a SURFACE_UNIT entry.
3. For each cross-domain interaction originating in your files, append INTERACTION entries.
   Your domain DEFINES these surfaces. Other auditors check their CONSUMPTION.
4. {domain-specific checks — see §5}
5. When done, mark your task completed.

CROSS-DOMAIN RULE:
- If you encounter a shared file (see §4.3), audit only what your domain owns or consumes.
- Example: combat-auditor reads terrain.ts defense modifier values but does NOT audit
  terrain cost definitions (that's space-auditor's job).

RULES:
- APPEND ONLY. Never edit or delete existing ledger entries.
- Every entry must have your agent name and a timestamp.
- Do not assign severity or declare gaps. Only the lead does that.
- If you cannot open a file, append a BLOCKED entry. Do not guess.
```

---

## 5. Execution Protocol

### Phase 1: Load the Contract Map (lead only)

Read every design document **completely**. Do NOT skim.

```
docs/DESIGN.md                      → game rules, unit roster, terrain, economy, win conditions
docs/GAME_MATH_ENGINE.md            → math model, combat timeline, design decisions, balance framework
docs/ChackAttacc.md                 → vision updates, additional design
strategy_game_balance_master.xlsx    → authoritative balance numbers (if readable)
```

For each contract, extract records per §1.3 format. Append `CONTRACT_MAP` entries to the ledger.

Also scan `packages/engine/src/*.test.ts` for behavioral assertions that constitute implicit contracts. Log as `TEST_CONTRACT` entries.

### Phase 2: Map the Codebase Surface (auditor agents, parallel)

Each auditor explores its domain and appends findings to the ledger.

**space-auditor:**
- Read `hex.ts` — coordinate math, distance, neighbors, line drawing, grid bounds
- Read `world.ts` — hex-to-pixel and pixel-to-hex conversion
- Read `terrain.ts` — all terrain definitions: movement costs, passability (infantryOnly), LoS blocking, defense modifier values, vision modifiers
- Read `pathfinding.ts` — A* implementation, cost calculation, blocked hex handling, edge cases
- Read `vision.ts` — visibility calculation, fog of war, LoS raycasting, forest hiding rules
- Read `map-gen.ts` — grid size, deployment zones, city placement, symmetry, terrain distribution, validation
- Read `noise.ts` — noise generation for map terrain
- Read `rng.ts` — seeded RNG implementation, determinism guarantees
- Check: are all hardcoded map constants (§4.2 of GAME_MATH_ENGINE.md) parametric or still hardcoded?
- Check: movement budget semantics — cost-based or step-based? (Known risk 8.2)

**combat-auditor:**
- Read `combat.ts` — damage formula (every term), attack range check, all inputs/outputs
- Read `units.ts` — all stat constants (HP, ATK, DEF, moveRange, attackRange, minAttackRange, visionRange), type advantage matrix, `createUnit()`
- Check consumption of `terrain.ts` defense modifier in damage formula — does DEF work on plains? (Known risk 8.5)
- Check consumption of `rng.ts` — is damage randomness seeded? Is the [0.85, 1.15] band enforced?
- Run balance authority chain (Phase 4) and math model checklist (Phase 5)

**control-auditor:**
- Read `directives.ts` — every directive behavior function, target selection (`tryAttackClosest`), movement resolution (`moveToward`), retargeting logic
- Read `commands.ts` — CP pool creation, spending, validation, per-unit command limit
- Read `ai.ts` — AI evaluation heuristic, build-phase unit purchasing, tactical decision making, difficulty levels
- Check consumption of `terrain.ts` flank cost reduction rule
- Check consumption of `pathfinding.ts` — how directives invoke A*, what params they pass
- Run AI behavior checklist (Phase 6)

**resolution-auditor:**
- Read `game-state.ts` — every public function, every phase transition, every state mutation
- Read `serialization.ts` — what state is preserved, what is lost across serialization
- Read server `game-loop.ts` (if accessible at `packages/server/src/game-loop.ts`) — simultaneous submission buffer, turn timer, command validation
- Map all state transitions: build → battle → scoring → game-over. What guards exist at each transition?
- Map turn execution order: command processing → scout pass → other directive pass → city ownership → objective → player switch
- Map win condition checks: KotH/multi-city, elimination, turn limit tiebreaker — in what order, with what precedence?
- Map event emission: what events does the engine produce? Does anything consume them?

**economy-auditor:**
- Read `economy.ts` — every constant (BASE_INCOME, CITY_INCOME, KILL_BONUS, ROUND_WIN_BONUS, CATCH_UP_BONUS, CARRYOVER_RATE, MAINTENANCE_RATE), every function
- Read `units.ts` cost field only — are unit costs consistent with the economy balance?
- Check consumption by `game-state.ts:scoreRound()` — does round scoring use economy functions correctly?
- Check: is kill bonus flat or scaled by unit cost? (Known design risk — GAME_MATH_ENGINE.md §A7)
- Check: are archetype trigger thresholds defined anywhere in code? (GAME_MATH_ENGINE.md §A9)

### Phase 3: Cross-Domain Interaction Discovery (all auditors)

Each auditor checks interactions **originating from or consumed by** their domain. The owning auditor checks the definition side; the consuming auditor checks the consumption side. Both append `INTERACTION` entries.

**Space × Combat:**
- Terrain defense modifier → damage formula (Space defines, Combat consumes)
- LoS → attack eligibility? (Space defines LoS, Combat's `canAttack()` does NOT check it — known risk 8.3)
- Infantry-only passability → affects which units can reach which positions → affects combat outcomes

**Space × Control:**
- Terrain movement cost → pathfinding → directive movement resolution
- Flank directive forest cost reduction (Control behavior, Space data)
- Vision range + terrain vision modifier → scout directive behavior
- Map deployment zones → unit placement constraints

**Combat × Control:**
- Hold directive +1 DEF bonus → damage formula
- Directive AI target selection → which enemy gets attacked
- Command `direct-attack` → bypasses directive AI target choice

**Combat × Economy:**
- Unit cost → kill bonus calculation
- Unit stats → army composition decisions (cost-effectiveness)

**Resolution × all domains:**
- Turn execution order → when each domain's logic runs
- Phase transitions → when economy scoring happens, when combat resolves
- Simultaneous submission → how both players' intents interact

**Economy × Resolution:**
- Round scoring → income + maintenance + carryover calculation
- Win bonus / catch-up bonus → applied at round transition

Append `INTERACTION` entry per cross-domain touch point. Mark each as `contracted`, `partially contracted`, or `uncontracted`.

### Phase 4: Balance Authority Check (combat-auditor + economy-auditor)

For every numeric constant in the engine:

| Check | Question |
|-------|----------|
| **Design doc match** | Does the code value match DESIGN.md? |
| **Math engine match** | Does the code value match GAME_MATH_ENGINE.md? |
| **Internal consistency** | Does the value satisfy the math model invariant (ATK = HP × 0.35)? |
| **Spreadsheet authority** | Is the spreadsheet considered authoritative? If so, do code values match? |

Note: DESIGN.md (Fred's v1.0) and GAME_MATH_ENGINE.md intentionally diverge on several values — the tensions are documented in T1-T4 and the §Engine Now sections. Only flag divergences NOT acknowledged as intentional tensions.

Combat-auditor owns unit stat authority chains. Economy-auditor owns economy constant authority chains.

### Phase 5: Math Model Checklist (combat-auditor)

For each unit matchup in the type advantage matrix:

| Field | Question |
|-------|----------|
| **Kill timing** | Does counter matchup kill in ~2 hits? Neutral in 3-4? Disadvantaged in 6-7? |
| **Formula correctness** | Does `calculateDamage()` implement the formula from GAME_MATH_ENGINE.md §A3? |
| **RNG bounds** | Is random factor bounded to [0.85, 1.15]? Is it seeded for determinism on server? |
| **Min damage** | Is minimum 1 damage guaranteed? |
| **DEF on plains** | Does DEF actually reduce damage on plains terrain? (Known risk 8.5) |
| **Terrain application order** | Is terrain defense applied as percentage reduction before flat DEF subtraction? (§A3 formula) |

Append `MATH_CHECK` entry per check performed.

### Phase 6: Domain-Specific Checklists

#### Space Checklist (space-auditor)

| Field | Question |
|-------|----------|
| **Coordinate invariant** | Is `q + r + s = 0` enforced or assumed? What happens with invalid coords? |
| **Movement semantics** | Is moveRange a cost budget or step count? Are all three movement systems (direct-move, moveToward, retreat) consistent? |
| **Map symmetry** | Does `generateMap` enforce symmetry? How? Is it validated? |
| **Hardcoded constants** | Are deployment rows, flank offsets, city sectors, city count hardcoded to 20×14? (§4.2 of GAME_MATH_ENGINE.md) |
| **LoS consistency** | Does vision use LoS? Does combat use LoS? Are they the same algorithm? |
| **Passability** | Is infantry-only terrain enforced in all three movement paths? |

Append `SPATIAL_CHECK` entry per check.

#### Control Checklist (control-auditor)

For each directive type:

| Field | Question |
|-------|----------|
| **Movement rule** | Is the behavior defined in DESIGN.md §4.1? Does code match? |
| **Attack priority** | When does the unit attack vs move? Is this defined? |
| **Edge behavior** | What happens when the directive is impossible? (blocked path, no target, etc.) |
| **Target handling** | What happens when the target becomes invalid? (enemy dies, city captured) |
| **CP interaction** | How does a command override interact with the directive? |
| **ROE layer** | Does the two-layer model (movement + ROE) exist in code, or is it still flat? |

Append `BEHAVIOR_CHECK` entry per directive audited.

#### Resolution Checklist (resolution-auditor)

| Field | Question |
|-------|----------|
| **Phase transition guards** | What prevents invalid transitions (e.g., battle → build without scoring)? |
| **Turn order fairness** | Does player1 always go first? Is this acknowledged? (Known risk 8.6) |
| **Command processing order** | If command A kills a unit targeted by command B, what happens? |
| **Directive execution order** | Scout-first, then others — is this order contracted? |
| **Dead unit cleanup** | Are dead units removed immediately or at end of turn? Consistent across command and directive paths? |
| **Simultaneous submission** | Does the server hold both submissions before resolving? Or is it still alternating? |

Append `RESOLUTION_CHECK` entry per check.

#### Economy Checklist (economy-auditor)

| Field | Question |
|-------|----------|
| **Net resource formula** | Is `max(0, carryover - maintenance + income)` the actual formula? Order of operations? |
| **Kill bonus scaling** | Flat 25g or `floor(unit.cost × 0.1)`? Which does the code implement? Which does the doc say? |
| **Catch-up vs win bonus** | Is catch-up (250) > win bonus (200) intentional? Is it documented? |
| **Maintenance timing** | When is maintenance deducted — before or after income? |
| **City reset** | Do cities reset to neutral between rounds? Is this enforced? |

Append `ECONOMY_CHECK` entry per check.

### Phase 7: Identify Gaps (lead only)

Lead reads the complete ledger. For each `SURFACE_UNIT`:

> "Does any `CONTRACT_MAP` or `TEST_CONTRACT` entry reference this unit?"

If NO → it's a gap. Classify per §2.1. Assign severity per §6 rubric.

Cross-reference `INTERACTION` entries: if a cross-domain interaction has no contract covering the combined behavior → interaction gap (type 4).

Cross-reference `MATH_CHECK` entries: if a balance constant violates the math model → balance divergence gap (type 3 + 6).

Cross-reference domain-specific checks (`BEHAVIOR_CHECK`, `SPATIAL_CHECK`, `RESOLUTION_CHECK`, `ECONOMY_CHECK`): any field marked UNCONTRACTED → gap in that domain.

Cross-reference `AUTHORITY_CHAIN` entries: if a constant has no authority chain or a broken chain (code ≠ doc ≠ spreadsheet without acknowledged tension) → balance gap (type 3).

Check `index.ts` exports: any exported function with no contract anywhere in the ledger → API surface gap (type 7).

### Phase 8: Report (lead only)

Lead appends the final `REPORT` entry to the ledger, then outputs it to the user.

---

## 6. Severity Rubric

Do not assign severity by intuition. Use this rubric:

### STRUCTURAL

The game can silently produce **wrong outcomes** if this gap is exploited. Characteristics:
- Violates game rules (damage calculation wrong, win condition bypassed, units teleporting)
- Balance invariant broken (ATK ≠ HP × 0.35 and no acknowledged exception)
- State transition allows illegal game state (dead units acting, negative HP persisting)
- Cross-system interaction produces behavior neither system's contract covers

### SEMANTIC

The game produces results that are **technically functional but can be misunderstood**. Characteristics:
- A function's behavior is ambiguous (does moveRange mean steps or cost?)
- Network protocol message semantics are undefined
- A type field's meaning is unclear from its name and no contract defines it

### BALANCE

The game's **competitive integrity** is compromised. Characteristics:
- A numeric value is an orphan constant with no authority chain
- Code value diverges from design doc / spreadsheet without acknowledged reason
- A matchup produces kill timings outside the math model's target bands
- An economy value creates degenerate strategy (farming cheap units for equal bounty — known risk)

### OPERATIONAL

The game's **development velocity or testability** degrades. Characteristics:
- A mechanic has no test coverage and no design doc rule — changes break silently
- A cross-system interaction is untested
- Map generation has no validation for a specific invariant

---

## 7. Rules for the Auditor

1. **Do not fabricate coverage.** If you cannot find a contract that covers a surface, it is uncovered. Do not say "this is probably covered by..." — either cite the rule or declare the gap.

2. **Do not confuse implementation with contract.** Code that does the right thing is not the same as a contract that says what the right thing is. If the code works correctly but no contract defines the expectation, it's still a gap.

3. **Known design risks: exact surface match only.** If a gap's exact surface is acknowledged in GAME_MATH_ENGINE.md §8, skip it. Different surface in the same domain → still a gap.

4. **Trace actual code, don't guess.** Open the files. Read the functions. Follow the call chain. "It probably uses the damage formula" is not evidence.

5. **Gaps are honest. Guesses are lies.** If you can't determine whether a surface is contracted, append a `BLOCKED` entry. Do not assume coverage. Do not assume gaps.

6. **Design doc divergences must cite both sources.** To claim the code doesn't match the doc, you must cite file:line in the code AND section in the doc. "The doc says X" without opening the doc is fabrication.

7. **Stop conditions:**
   - Stop when every unit enumerated in Phase 2 has either (a) a coverage pointer to a contract, or (b) a GAP entry, or (c) a BLOCKED entry.
   - If a file cannot be opened or is too large, append BLOCKED.
   - Do not recurse into node_modules or generated files.

---

## 8. Shared Ledger Protocol

### 8.1 Ledger Location and Naming

```
audit/ledgers/{YYYY-MM-DD}_{HHMM}_contract_gaps.md
```

One ledger per session. The lead creates it. All agents append. Timestamp is set once at creation.

### 8.2 Immutability Rules

1. **Append only.** No agent may edit or delete existing entries.
2. **No overwrites.** If an entry was wrong, append a `CORRECTION` entry.
3. **Attribution required.** Every entry must identify its author and timestamp.
4. **The lead never edits auditor entries.** Disagreements are new entries.

### 8.3 Entry Types

#### CONTRACT_MAP
Written by: lead (Phase 1)

```markdown
---
## [CONTRACT_MAP] D1: Simultaneous Turn Resolution
**agent:** lead
**time:** 14:32
**phase:** 1

contract_id: D1
type: INV
source: docs/GAME_MATH_ENGINE.md §D1
covered_surfaces:
  - game-state.ts:executeTurn()
  - server game-loop.ts:handleSubmitCommands()
rule: "Both players submit commands simultaneously. Resolution only after both committed."
consequences: If broken — first-mover advantage, reactive play replaces prediction
```

#### TEST_CONTRACT
Written by: lead (Phase 1)

```markdown
---
## [TEST_CONTRACT] combat.test.ts: "minimum 1 damage"
**agent:** lead
**time:** 14:35
**phase:** 1

source: packages/engine/src/combat.test.ts:42
covered_surface: combat.ts:calculateDamage()
assertion: "damage is always >= 1 regardless of DEF/terrain"
contract_type: CON
```

#### SURFACE_UNIT
Written by: any auditor (Phase 2)

```markdown
---
## [SURFACE_UNIT] combat.ts:calculateDamage()
**agent:** combat-auditor
**time:** 14:48
**phase:** 2

unit_type: module.function
location: packages/engine/src/combat.ts:20-39
weight: 3 (damage formula — core balance surface)
description: Computes final damage from attacker stats, defender stats, terrain, type advantage, random factor
```

#### INTERACTION
Written by: any auditor (Phase 3)

```markdown
---
## [INTERACTION] hold directive × terrain defense
**agent:** combat-auditor
**time:** 15:02
**phase:** 3

systems: [combat.ts, directives.ts, terrain.ts]
location: combat.ts:33 (effectiveDef = def + hold bonus), terrain.ts:38 (defense modifier)
combined_behavior: Hold directive adds +1 flat DEF, terrain multiplies effective DEF. Order: add first, multiply second.
contracted: Partially — DESIGN.md §4.1 mentions hold gives +1 DEF. GAME_MATH_ENGINE.md §2.1 defines the formula. But the interaction order (additive before multiplicative) is not stated anywhere.
```

#### AUTHORITY_CHAIN
Written by: combat-auditor (Phase 4)

```markdown
---
## [AUTHORITY_CHAIN] infantry.atk = 2
**agent:** combat-auditor
**time:** 15:10
**phase:** 4

constant: UNIT_STATS.infantry.atk
code_value: 2 (units.ts:12)
design_doc_value: 2 (DESIGN.md §3.1)
math_engine_value: 10 (GAME_MATH_ENGINE.md §Starting Stats — after ×10 scaling)
spreadsheet_authority: strategy_game_balance_master.xlsx UnitStats sheet (value unknown — binary file)
status: DIVERGENT — code matches DESIGN.md v1.0 but not GAME_MATH_ENGINE.md target stats. This is a known tension (scaling not yet applied).
```

#### MATH_CHECK
Written by: combat-auditor (Phase 5)

```markdown
---
## [MATH_CHECK] Infantry vs Tank kill timing
**agent:** combat-auditor
**time:** 15:20
**phase:** 5

matchup: infantry attacking tank
type_multiplier: 0.5 (units.ts:87)
expected_category: disadvantaged (target: 6-7 hits to kill)
calculation: ATK(2) × 0.5 × 1.0 (no terrain) = 1.0 → floor(1.0 - 3×0) = 1 → tank HP 4 / 1 = 4 hits
verdict: TOO_FAST (4 hits vs target 6-7) — but note: current engine uses small HP values, math model targets ×10 scaling
```

#### BEHAVIOR_CHECK
Written by: control-auditor (Phase 6)

```markdown
---
## [BEHAVIOR_CHECK] Advance directive
**agent:** control-auditor
**time:** 15:30
**phase:** 6

directive: advance
design_doc_rule: DESIGN.md §4.1 — "Move toward the target by the shortest path. Attack enemies encountered along the way."
code_behavior: directives.ts:42-78 — uses findPath() to target, checks canAttack() before moving, attacks if enemy in range
movement_rule: MATCHED
attack_priority: MATCHED — attacks if enemy in range, otherwise moves
edge_behavior: UNCONTRACTED — DESIGN.md says "defaults to Hold" if path blocked. Code at directives.ts:200 returns null action (unit does nothing). Different behavior.
target_handling: UNCONTRACTED — no design doc rule for what happens when advance target is an enemy unit that dies
```

#### SPATIAL_CHECK
Written by: space-auditor (Phase 6)

```markdown
---
## [SPATIAL_CHECK] Movement semantics — cost vs steps
**agent:** space-auditor
**time:** 15:32
**phase:** 6

field: movement_semantics
question: Is moveRange a cost budget or step count?
finding: INCONSISTENT — direct-move (game-state.ts:286) uses cubeDistance (step count, ignores terrain). moveToward (directives.ts:199) uses path.length (step count along A* path, but A* routes by cost). Neither actually spends a cost budget.
contracted: DESIGN.md §4.1 says moveRange but doesn't define semantics. GAME_MATH_ENGINE.md §1.4 documents the discrepancy explicitly as design risk 8.2. §A5 targets cost-based.
status: Known risk (8.2) — exact surface match, excluded from gap report.
```

#### RESOLUTION_CHECK
Written by: resolution-auditor (Phase 6)

```markdown
---
## [RESOLUTION_CHECK] Command processing order
**agent:** resolution-auditor
**time:** 15:35
**phase:** 6

field: command_processing_order
question: If command A kills a unit targeted by command B, what happens?
finding: game-state.ts:170-177 — commands processed sequentially in array order. If command[0] kills defender, command[1] targeting that defender finds unit missing and skips (no CP spent). Array order is submission order.
contracted: No design doc defines command ordering or the skip-dead-unit behavior.
status: UNCONTRACTED
```

#### ECONOMY_CHECK
Written by: economy-auditor (Phase 6)

```markdown
---
## [ECONOMY_CHECK] Kill bonus scaling
**agent:** economy-auditor
**time:** 15:38
**phase:** 6

field: kill_bonus_scaling
question: Flat 25g or floor(unit.cost × 0.1)?
finding: economy.ts:9 — KILL_BONUS = 25 (flat). GAME_MATH_ENGINE.md §A7 targets floor(unit.cost × 0.1). Code has not been updated.
contracted: GAME_MATH_ENGINE.md §A7 defines the target. Code diverges. Not listed in T1-T4 tensions.
status: DIVERGENT — unacknowledged
```

#### BLOCKED
Written by: any agent

```markdown
---
## [BLOCKED] strategy_game_balance_master.xlsx — binary file
**agent:** combat-auditor
**time:** 15:35
**phase:** 4

reason: Cannot read .xlsx binary file. Balance spreadsheet values unverifiable.
affected_units: All AUTHORITY_CHAIN entries that reference spreadsheet values
```

#### CORRECTION
Written by: any agent

```markdown
---
## [CORRECTION] Revises SURFACE_UNIT combat.ts:calculateDamage()
**agent:** combat-auditor
**time:** 15:40
**phase:** 2

original_entry: "[SURFACE_UNIT] combat.ts:calculateDamage()" at 14:48
correction: Weight should be 3, not 1. This is the core damage pipeline.
```

#### GAP
Written by: lead only (Phase 7)

```markdown
---
## [GAP] GAP-{N}: {Short title}
**agent:** lead
**time:** 16:00
**phase:** 7

type: {gap type from §2.1}
severity: {STRUCTURAL | SEMANTIC | BALANCE | OPERATIONAL}
location: {file:line or module.function}
evidence: {exact file:line ranges — from ledger entries}
what_exists: {behavior/code that exists today}
what_missing: {rule/contract that doesn't exist}
risk_if_undefined: {what goes wrong when someone changes this without a contract}
suggested_contract:
  - "{one-line contract statement}"
  - "{one-line contract statement}"
```

#### REPORT
Written by: lead only (Phase 8)

The final synthesis. Contains coverage summary, full gap list sorted by severity, blocked surfaces, and priority ranking.

### 8.4 Ledger Initialization

```markdown
# Contract Gap Audit Ledger
**session:** {YYYY-MM-DD}_{HHMM}
**project:** HexWar (hex-based tactical strategy game)
**initiated_by:** lead
**team:** space-auditor, combat-auditor, control-auditor, resolution-auditor, economy-auditor

This ledger is append-only. No entry may be edited or deleted after writing.
Corrections reference the original entry and append a new one.

---
```

---

## 9. Previous Ledgers

When running a new audit session, the lead SHOULD read the most recent previous ledger (if any exist in `audit/ledgers/`) to:

1. Identify gaps that were found before — check if they've been resolved since
2. Avoid re-discovering the same blocked surfaces without new information
3. Track gap resolution velocity across sessions

Previous ledger findings are **informational only**. The current session re-does the contract map and surface enumeration from scratch. But the lead should annotate recurring gaps: `"Also found in session {previous_date}. Still unresolved."` and newly resolved ones: `"Found in session {previous_date}. Now resolved by {contract_id}."`
