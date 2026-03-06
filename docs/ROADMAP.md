# Roadmap

Daily standup tool. Sprint schedule, design decisions, and change ledger.

**Team:** 2 engineers + Claude Codes
**Start date:** March 4, 2026
**Target:** Playtestable build with simultaneous resolution, combat timeline, and reveal animation (marketing start for steam launch)

---

## Rules

1. **This doc is append-only after the change ledger section.** Sprint dates and scope can be updated, but old entries are never deleted — they're struck through with a reason.
2. **Every scope change gets a ledger entry.** Moving a task between sprints, adding a task, cutting a task — all logged with date and justification.
3. **No silent cuts.** If something planned doesn't happen, it gets a ledger entry explaining why.
4. **Sprint goals are commitments, not aspirations.** If a sprint goal is unrealistic, resize it before the sprint starts and log the change. Don't discover it's impossible on day 5.
5. **Design decisions are final unless reopened.** Reopening a decision requires a ledger entry citing what new information changed the calculus.

---

## Design Decisions

Locked choices that govern everything below. Full reasoning in `DESIGN_DECISIONS.md`.

| ID | Decision | Source | Status |
|----|----------|--------|--------|
| D1 | Simultaneous turn resolution — both players submit, server resolves after both commit | DD §D1 | Locked |
| D2 | Units are semi-autonomous — directives + scarce command points | DD §D2 | Locked, implemented |
| D3 | CP scales with map size: 20×14→4, 40×28→6, 60×40→8 | DD §D3 | Locked |
| D4 | Collision resolution: hunt→combat, same-hex→speed wins, head-on→both stop | DD §D4 | Locked |
| D5 | Counter-attacks gated by response time | DD §D5 | Locked |
| D6 | Melee is separate combat state with meleeRating, not ATK/DEF | DD §D6 | Locked, **numeric values TBD** |
| D7 | Win condition: multi-city majority capture, not KotH | DD §D7 | Locked |
| D8 | Upgrades earned through behavior, not purchased with gold | DD §D8 | Locked |
| D9 | Four archetypes: Conqueror, Predator, Ghost, Fortress | DD §D9 | Locked for 1v1 |
| D10 | All map constants derived from GRID parametrically | DD §D10 | Locked |
| D11 | Three combat domains: ground, air, sea | DD §D11 | Locked, **post-MVP** |
| D12 | Five factions, post-collapse world | ASSETS.md | Locked (visual only) |
| D13 | Mechanics invariant across map sizes | DD §D13 | Locked |
| T1 | Simultaneous replaces alternating turns (diverges from Fred v1.0 §5) | DD §T1 | Locked |
| T2 | Objective-based upgrades replace no-progression (diverges from Fred v1.0) | DD §T2 | Locked |
| T3 | Map size targets 40×28+, not 10×8 (diverges from Fred v1.0 §2.1) | DD §T3 | Locked |
| T4 | Aircraft/anti-air post-MVP (aligns with Fred v1.0 §10.2) | DD §T4 | Locked |

---

## Current State (as of March 5, 2026)

### What works
- Full game engine: simultaneous resolution only (alternating-turn code fully stripped), 8 directives with targeting, damage formula, A* pathfinding (min-heap), vision/LoS, economy, map generation (noise + elevation), round scoring, KotH win condition
- `executeTurn()` is now a pure resolver — no post-turn bookkeeping (no player switching, no turnsPlayed increment, no command pool creation). Orchestrators (`resolveSimultaneousTurn` on server, `resolveSimultaneousLocal` on client) manage all turn lifecycle externally.
- `RoundState.turnsPlayed` is a single number (was per-player Record). `maxTurns` replaces `maxTurnsPerSide`.
- Three.js renderer: terrain meshes, unit GLB models, fog, deploy zones, selection, HP bars, click detection via raycaster, pending command visuals (move path lines, attack crosshairs)
- Server: Socket.io game loop, room management, build/battle phases, reconnection, simultaneous resolution with deterministic RNG
- Client: React + Zustand, BattleHUD, UnitInfoPanel, Field Command palette, CommandMenu with move/attack range highlights
- **Simultaneous resolution** (0.3): server buffers both players' commands, resolves when both received or timeout. Client vsAI mode uses `resolveSimultaneousLocal` with same pattern. Randomized resolution order per turn. turnsHeld double-increment fix. Hotseat mode removed entirely.
- **AI**: Scored attack system (focus fire, type advantage, kill bonuses), direct-move positioning toward objectives/enemies/cities, smart retreat at 1HP. 6 build presets with leftover budget fill. Console telemetry for debugging.

### What doesn't exist yet
- Combat timeline (10-phase pipeline)
- Two-layer directives (movement + ROE split)
- Response time / initiative system
- Counter-attacks
- Melee system
- Intercept mechanics during movement
- Structured event log - STARTED
- Reveal animation (event log playback)
- Multi-city win condition (currently KotH)
- Parametric map constants (currently hardcoded to 20×14)
- HP/stat scaling (currently 2-4 HP, needs ×10)
- Clean RPS matrix (currently artillery is generalist)
- Fixed damage formula (currently DEF×terrainDef, needs (1-terrainDef) percentage)
- LoS check on attacks (currently distance-only)
- Cost-based movement (currently step-counting)
- Archetype/upgrade system
- AI vs AI test harness

---

## Sprint Schedule

8 weeks. Each sprint is 1 week (Mon–Sun). Tasks marked [E] are engine, [C] are client, [S] are server.

---

### Sprint 1 — Directive Model & Cost Movement (Mar 4–10) — **NOT STARTED, overdue**

Layer 0 foundation. Structural changes everything else sits on. Implementation Plan items 0.1 + 0.2. Week was spent on vsAI simultaneous resolution, AI rewrite, hotseat removal, and engine cleanup instead (see ledger).

- [E] **Two-layer directive model** (0.1): Replace flat `DirectiveType` with `movementDirective` (advance/flank/hold/retreat) + `engagementROE` (assault/skirmish/cautious/ignore) + specialty modifier (capture/support/scout/fortify/null)
- [E] **Update Unit type** in `types.ts`: replace `directive: DirectiveType` with the two-layer fields
- [E] **Update all directive consumers**: `directives.ts`, `game-state.ts`, `combat.ts` (hold bonus → ROE-based), `commands.ts`, `ai.ts`
- [E] **Update serialization** for new directive fields
- [E] **Cost-based movement** (0.2): Unify `direct-move`, `moveToward()`, `retreat` into single `moveUnit()` that walks A* path spending cost budget, not step count. Fixes risks 8.1 + 8.2
- [S] **Update server** for new directive structure in placement/redirect messages
- [E] **Update all tests** for new directive model and movement

**Exit criteria:** `pnpm test` all green. Every unit carries movement + ROE. Old `DirectiveType` union removed. All movement uses cost budget, not step count.

---

### Sprint 2 — Simultaneous Resolution (Mar 11–17) — **mostly complete early**

The architectural pivot. Both players submit simultaneously. Layer 0 item 0.3 + client UI (4.1, 4.2).

- [S] ~~**Buffer both submissions** (0.3)~~ DONE — `handleSubmitCommands` buffers per player, `resolveSimultaneousTurn` fires when both received. Randomized resolution order (deterministic from seed). turnsHeld double-increment fix. Timeout fills empty commands for missing players.
- [S] ~~**Remove alternating player logic**~~ DONE — both players plan → both submit → resolve → next tick.
- [C] ~~**vsAI simultaneous resolution**~~ DONE (Mar 5) — `resolveSimultaneousLocal` in BattleHUD mirrors server pattern. AI generates commands from pre-resolution state, randomized order, two `executeTurn` calls with event drainage.
- [E] ~~**Strip alternating-turn engine code**~~ DONE (Mar 5) — `executeTurn()` no longer switches currentPlayer, increments turnsPlayed, creates command pools, or resets hasActed. `turnsPlayed` simplified from `Record<PlayerId, number>` to `number`. `maxTurnsPerSide` renamed to `maxTurns`. Orchestrators manage all lifecycle externally.
- [C] ~~**Remove hotseat mode**~~ DONE (Mar 5) — `GameMode` is `'vsAI' | 'online'`. TurnTransition component deleted. All alternating-turn UI paths removed.
- [E] ~~**AI rewrite**~~ DONE (Mar 5) — scored attacks (focus fire, type advantage, kill bonuses), direct-move positioning, smart retreat, 6 build presets with leftover budget fill.
- [C] **Two-layer directive picker UI** (4.1): movement + ROE selection during planning phase — **not started**, blocked on Sprint 1 (0.1 directive model)
- [C] ~~**Simultaneous submit UI** (4.2)~~ DONE — both players see End Turn simultaneously. "Waiting for opponent..." / "Resolving..." states. CommandMenu hidden after submission. Reconnect restores submission state.

**Exit criteria:** ~~Two clients can submit commands simultaneously. Server waits for both before resolving.~~ DONE. ~~vsAI uses same simultaneous pattern.~~ DONE. ~~Alternating-turn code stripped from engine.~~ DONE. Client can assign both directive layers during build phase ← blocked on 4.1 (needs 0.1 directive model first).

---

### Sprint 3 — Combat Timeline (Mar 18–24)

The big one. Replace `executeTurn()` with the 10-phase pipeline. Event log built into each phase, not added after. Layer 0 items 0.4 + 0.5.

- [E] **Phase 1-2** (0.4): Snapshot + intent collection. Clone state, generate composite intents from directives + CP overrides
- [E] **Phase 3**: Step-by-step movement along A* path. Intercept check per step (ROE-gated). Destination reservation. Collision resolution (D4). Movement locks.
- [E] **Phase 4**: Engagement detection. Scan for in-range pairs. LoS check. ROE filter.
- [E] **Phase 5-6**: Initiative fire + counter fire. Response time ordering with modifiers (flanking, terrain, ROE). Cancel-on-death.
- [E] **Phase 8-10**: Support heal, city capture (HP cost), round end check
- [E] **Event log** (0.5): typed events emitted from every phase. `MOVE`, `INTERCEPT`, `ATTACK`, `COUNTER`, `KILL`, `CAPTURE`, `HEAL`

**Phase 7 (melee) deferred** — needs numeric meleeRating values. See open decision D6.

**Exit criteria:** Full tick resolves both players' intents simultaneously through phases 1-6, 8-10. Event log emitted. Tests cover: movement collision, intercept checks, initiative ordering, counter-fire cancel-on-death, city capture.

---

### Sprint 4 — Combat & Balance (Mar 25–31)

Layer 1. Implement the math model. Layer 0 is complete — these can be built in any order within the sprint.

- [E] **Clean RPS matrix** (1.1): Replace `TYPE_ADVANTAGE` with clean 4-unit cycle. Each unit: one 2.0× counter, one 0.6× disadvantage, all else 1.0×
- [E] **HP/stat scaling** (1.2): Apply `ATK = HP × 0.35`, `DEF = max(1, round(HP × 0.05))` invariant. Infantry 30/10/2, Tank 40/14/2, Artillery 20/10/1, Recon 20/7/1
- [E] **Damage formula update** (1.3): `max(1, floor((ATK × typeMul × rng) × (1 - terrainDef) - DEF))`. Fixes DEF-on-plains bug (risk 8.5)
- [E] **Response time system** (1.4): Add `responseTime` stat to unit definitions. Wire Phase 5/6 ordering with modifiers (flanking, terrain, ROE)
- [E] **Intercept mechanics** (1.5): Wire Phase 3 Step 2 intercept checks. `INTERCEPT_CAP = 1`. Skirmish attack cap.
- [E] **Update all tests** for new stats, formula, timing

**1.6 (melee) deferred** — OD-1 still open.

**Exit criteria:** Kill timing matches math model targets: counter ~2 hits, neutral 3-4 hits, disadvantaged 6-7 hits on plains. Response time ordering works. Intercepts fire during movement.

---

### Sprint 5 — Reveal Animation (Apr 1–7)

The product. Event log plays back as animation. Players watch their plans collide. Layer 4 items 4.3 + 4.4.

- [C] **Event log renderer** (4.3): consume event stream, play phase-by-phase
- [C] **Phase 3 → movement arrows/tweens**: units animate along paths
- [C] **Phase 5 → attack effects**: gunfire, damage numbers
- [C] **Phase 6 → counter-fire effects**: return shots
- [C] **Phase 8 → support/heal glow**
- [C] **Phase 9 → city capture color flip**
- [C] **Playback controls**: play/pause, speed control, skip to result
- [E] **AI vs AI test harness** (4.4): headless match runner, `[MATH_AUDIT]` logging, 100-match batch runner

**Exit criteria:** Two players submit plans, then watch a cinematic reveal of both plans colliding. AI vs AI produces kill timing data matchable against math model targets.

---

### Sprint 6 — Map & Economy (Apr 8–14)

Layer 2. Parametric map, win condition, economy scaling.

- [E] **Parametric constants** (2.1, A6): all map-dependent values derived from `GRID`
  - `deploymentRows = floor(height × 0.2)`
  - `flankOffset = floor(width × 0.25)`
  - `cityMinDistance = floor(width × 0.15)`
  - `cityCount = floor(width × height / 40)`
  - `maxTurns = floor(width / 2)`
  - `CP_PER_ROUND = 4 + floor((width - 20) / 10)`
- [E] **Multi-city win condition** (2.2, D7): `victoryCities = floor(totalCities × 0.6)`. Remove KotH center-hex logic. Remove `objective` from `RoundState`.
- [E] **Kill bonus scaling** (2.3): `KILL_BONUS = floor(unit.cost × 0.1)` replaces flat 25
- [E] **40×28 map** (2.4): Scale map. Movement ranges auto-derive from A5: `infantry = floor(w/8)`, `tank = floor(w/7)`, `recon = floor(w/5)`, `artillery = floor(w/12)`
- [E] **LoS on attacks** (2.5): Add `hexLineDraw` LoS check to `canAttack()`. Artillery can no longer fire through forests.
- [C] **Render at scale**: terrain mesh batching if needed, camera bounds, minimap
- [E] **Match length measurement**: instrument AI vs AI for average match duration at 40×28

**Exit criteria:** Game plays on 40×28. All constants scale correctly. KotH removed, multi-city capture working. Match length measured — if >20 min average, adjust movement ranges before proceeding.

---

### Sprint 7 — Progression (Apr 15–21)

Layer 3. Archetype system, tier 1 only.

- [E] **Upgrade trigger tracking** (3.1): cities held simultaneously, kills per round, hexes scouted, consecutive defensive ticks
- [E] **Archetype signals** (3.2): emit visible trigger notifications to opponent. Specific unlock hidden.
- [E] **Tier 1 abilities** (3.3): implement first-tier unlocks per archetype
  - Conqueror: Fortify directive
  - Predator: melee tier upgrade (one unit)
  - Ghost: Ambush directive
  - Fortress: support heal radius +1
- [C] **Archetype UI**: trigger notification display, upgrade selection (if applicable), opponent signal display

**Exit criteria:** Archetype triggers fire during battle. Opponent sees signals. Tier 1 abilities activate and affect gameplay. Tier 2-3 deliberately not implemented (needs playtest data per GAME_MATH_ENGINE.md §Fork 4).

---

### Sprint 8 — Playtest & Ship (Apr 22–28)

No new features. Fix, tune, test.

- **Balance tuning**: run 100+ AI vs AI matches. Compare kill timing verdicts against math model. Adjust stats if TOO_FAST/TOO_SLOW matchups exceed 15%
- **20+ human playtests**: real players, real matches, real feedback
- **Bug fixes**: everything found during playtests
- **Performance**: profile at 40×28, optimize if needed
- **Polish**: sound effects, death animations, UI transitions
- **Steam page live**: store page, screenshots, trailer capture

**Exit criteria:** Game is playable end-to-end by humans. No crash bugs. Balance is within math model targets. Steam page is live and collecting wishlists.

---

## Open Decisions (block future work)

These need resolution before the sprint that depends on them. Tracked here, decided in domain spec docs.

| ID | Decision Needed | Blocks | Current Lean |
|----|----------------|--------|--------------|
| OD-1 | Melee numeric values (D6 says letter grades, needs numbers) | Sprint 3 Phase 7 | Deferred — sprint 3 ships without melee |
| OD-2 | Elevation gameplay rules — does elevation affect combat/vision/movement? | Post-sprint 6 | Stay cosmetic for MVP |
| OD-3 | Water terrain — terrain type or map layer? | Post-MVP (D11) | Terrain type (simpler) |
| OD-4 | Fog during reveal — full "show your hands" or fog-gated? | Sprint 5 | Full reveal (poker model) |
| OD-5 | Noise frequency scaling with map size | Sprint 6 | Fixed frequencies (more features at larger scale) |
| OD-6 | Archetype commitment structure (Fork 1: hard lock vs soft lock vs free pivot) | Sprint 7 | Soft lock, but needs playtest data |

---

## Change Ledger

Every scope change, decision change, or sprint adjustment is logged here. Append only.

```
DATE       | SPRINT | CHANGE                                          | REASON
-----------+--------+-------------------------------------------------+-----------------------------------------------
2026-03-04 | —      | Roadmap created. 8-sprint schedule established.  | Initial planning session.
2026-03-04 | S3     | Melee (Phase 7) deferred from Sprint 3.          | D6 defines letter grades, not numbers. Can't implement without numeric values. Sprint 3 ships phases 1-6, 8-10.
2026-03-04 | S8     | Steam page added to Sprint 8 scope.              | Wishlist collection is launch survival infrastructure per GAME_MATH_ENGINE.md market analysis.
2026-03-04 | S1-S6  | Sprint schedule rewritten to match Implementation Plan layers. | Previous schedule put Layer 1 items (RPS, HP scaling, damage formula) in Sprint 1 before Layer 0 foundation work. Violated Layer 0→1→2→3 dependency chain from GAME_MATH_ENGINE.md §Implementation Plan.
2026-03-04 | S2     | 0.3 + 4.2 pulled ahead of Sprint 1 (0.1 + 0.2). | GAME_MATH_ENGINE.md §0.3 explicitly says "can be tested with existing executeTurn as a placeholder." Server architecture change is independent of directive model. 4.1 (directive picker) remains blocked on 0.1.
2026-03-05 | S1     | Sprint 1 (directive model + cost movement) not started by deadline. | Week spent on vsAI simultaneous, AI rewrite, hotseat removal, and engine cleanup. These were unplanned prerequisites — game was unplayable in vsAI mode without them.
2026-03-05 | S2     | vsAI simultaneous resolution added to Sprint 2 scope. | Server-only simultaneous was done but vsAI still used alternating turns. Client needed `resolveSimultaneousLocal` to mirror server pattern.
2026-03-05 | S2     | Hotseat mode removed. GameMode narrowed to 'vsAI' | 'online'. | Hotseat was the only consumer of alternating-turn UI code. Removing it unblocked stripping engine internals.
2026-03-05 | S2     | AI rewrite added to Sprint 2 scope. | Old AI was 3 weak priorities, didn't use build presets, wasted ~50% budget. Game was unplayable for testing without competent AI.
2026-03-05 | S2     | Engine alternating-turn internals stripped. | executeTurn() no longer does post-turn bookkeeping. turnsPlayed simplified to number. maxTurnsPerSide renamed to maxTurns. Completes the simultaneous-only architecture.
2026-03-05 | S1     | Sprint 1 scope unchanged but schedule slipped. | Directive model (0.1) and cost movement (0.2) are next. No work started. Sprint dates need rebasing.
```

---

## Post-MVP Feature Sequence

Each feature is gated on the one before it. Full reasoning in `DESIGN_DECISIONS.md`.

### U1 — Aircraft & Anti-Air

**When:** After 20+ competitive matches with the 4-unit ground cycle. When dominant strategies are understood.

Aircraft is a soft universal threat (1.3× all ground units) that ignores terrain movement cost. Anti-air is the 2.0× hard counter. Full 6-unit matrix derived from the math model at implementation time. Do not define final numbers until ground cycle is confirmed stable.

Domain properties: `domain: 'ground' | 'air'`, `moveType: 'land' | 'air'`, `attackableDomains: ('ground' | 'air')[]`. Air units ignore terrain movement cost, cannot enter melee, auto-disengage from ground contact.

Open questions: Can infantry shoot planes without AA? Do planes see through terrain? Does AA have minimum attack range?

### U2 — Naval Units & Water Terrain

**When:** After aircraft/anti-air are stable. Requires dedicated map design work.

Boats control sea lanes and enable coastal bombardment. Transport boats allow troop movement across water. Requires water as a terrain type or map layer, coastline map designs, and a naval unit sub-tree.

### U3 — Five-Player FFA Mode

**When:** After 1v1 is stable and the ranked ladder has an active player base.

Core mechanics do not change — maps get bigger and city counts scale. Social dynamics (kingmaking, alliance behavior, elimination pacing) need dedicated design work. Requires matchmaking infrastructure for 5 players.

### U4 — Full Archetype Unlock Tree

**When:** After Tier 1 is playtested with 20+ human matches.

Branching unlock paths, counter-archetype signals, richer set of unlockable directives. Cannot be designed correctly without match data. See `ECONOMY_AND_PROGRESSION.md` for open forks.

### U5 — Spectator Mode & Match Replay

**When:** After event log is fully stable.

Spectator mode = play the event stream for a third client. Replay = same. High value for the poker/betting audience but not blocking for launch.

### U6 — Betting & Staking Ecosystem

Not built by the dev team. Designed for. Requires: clean spectator mode, verifiable match results, public match history, stable ranked system. Build the conditions for the platform to emerge.

### U7 — Faction System (Visual)

Five factions (Engineers, Caravaners, Wardens, Scrappers, The Current) defined in art direction. Faction identity is purely visual — same stats, different skins. Requires full art pass per faction. Game is fully playable with one faction skin.

---

## What Not To Build

- Do not build the 6-unit TYPE_ADVANTAGE matrix until ground meta is stable (T4 resolution)
- Do not close archetype forks (commitment structure, tier advancement, FFA graph) until 20+ human matches
- Do not optimize pathfinding (spatial indexing) until 40×28 map proves it's a bottleneck
- Do not build betting/staking infrastructure (U6) — build the conditions for it to emerge

