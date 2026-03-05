# Roadmap

Daily standup tool. Sprint schedule, design decisions, and change ledger.

**Team:** 2 engineers + Claude Code
**Start date:** March 4, 2026
**Target:** Playtestable build with simultaneous resolution, combat timeline, and reveal animation

---

## Rules

1. **This doc is append-only after the change ledger section.** Sprint dates and scope can be updated, but old entries are never deleted — they're struck through with a reason.
2. **Every scope change gets a ledger entry.** Moving a task between sprints, adding a task, cutting a task — all logged with date and justification.
3. **No silent cuts.** If something planned doesn't happen, it gets a ledger entry explaining why.
4. **Sprint goals are commitments, not aspirations.** If a sprint goal is unrealistic, resize it before the sprint starts and log the change. Don't discover it's impossible on day 5.
5. **Design decisions are final unless reopened.** Reopening a decision requires a ledger entry citing what new information changed the calculus.

---

## Design Decisions

Locked choices that govern everything below. Full reasoning in `GAME_MATH_ENGINE.md` (section cited per decision).

| ID | Decision | Source | Status |
|----|----------|--------|--------|
| D1 | Simultaneous turn resolution — both players submit, server resolves after both commit | GME §D1 | Locked |
| D2 | Units are semi-autonomous — directives + scarce command points | GME §D2 | Locked, implemented |
| D3 | CP scales with map size: 20×14→4, 40×28→6, 60×40→8 | GME §D3 | Locked |
| D4 | Collision resolution: hunt→combat, same-hex→speed wins, head-on→both stop | GME §D4 | Locked |
| D5 | Counter-attacks gated by response time | GME §D5 | Locked |
| D6 | Melee is separate combat state with meleeRating, not ATK/DEF | GME §D6 | Locked, **numeric values TBD** |
| D7 | Win condition: multi-city majority capture, not KotH | GME §D7 | Locked |
| D8 | Upgrades earned through behavior, not purchased with gold | GME §D8 | Locked |
| D9 | Four archetypes: Conqueror, Predator, Ghost, Fortress | GME §D9 | Locked for 1v1 |
| D10 | All map constants derived from GRID parametrically | GME §D10 | Locked |
| D11 | Three combat domains: ground, air, sea | GME §D11 | Locked, **post-MVP** |
| D12 | Five factions, post-collapse world | ASSETS.md | Locked (visual only) |
| D13 | Mechanics invariant across map sizes | GME §D13 | Locked |
| T1 | Simultaneous replaces alternating turns (diverges from Fred v1.0 §5) | GME §T1 | Locked |
| T2 | Objective-based upgrades replace no-progression (diverges from Fred v1.0) | GME §T2 | Locked |
| T3 | Map size targets 40×28+, not 10×8 (diverges from Fred v1.0 §2.1) | GME §T3 | Locked |
| T4 | Aircraft/anti-air post-MVP (aligns with Fred v1.0 §10.2) | GME §T4 | Locked |

---

## Current State (as of March 4, 2026)

### What works
- Full game engine: sequential turns, 8 directives with targeting, damage formula, A* pathfinding (min-heap), vision/LoS, economy, map generation (noise + elevation), round scoring, KotH win condition
- Three.js renderer: terrain meshes, unit GLB models, fog, deploy zones, selection, HP bars, click detection via raycaster
- Server: Socket.io game loop, room management, build/battle phases, reconnection
- Client: React + Zustand, BattleHUD, UnitInfoPanel, Field Command palette

### What doesn't exist yet
- Simultaneous resolution (server buffers both submissions)
- Combat timeline (10-phase pipeline)
- Two-layer directives (movement + ROE split)
- Response time / initiative system
- Counter-attacks
- Melee system
- Intercept mechanics during movement
- Structured event log
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

### Sprint 1 — Foundation Fixes (Mar 4–10)

Fix the engine bugs that block everything else. No new systems — just make the existing math correct.

- [E] **Damage formula fix** (A3): `max(1, floor((ATK × typeMul × rng) × (1 - terrainDef) - DEF))`. Fixes DEF-on-plains bug (risk 8.5)
- [E] **Clean RPS matrix** (A2): replace current asymmetric matrix with clean 4-unit cycle. Each unit: one 2.0× counter, one 0.6× disadvantage, all else 1.0×
- [E] **HP/stat scaling** (A4): multiply all stats ×10. Infantry 30/10/2, Tank 40/14/2, Artillery 20/10/1, Recon 20/7/1. Apply `ATK = HP × 0.35` invariant
- [E] **Cost-based movement** (0.2): unify `direct-move`, `moveToward()`, `retreat` into single function that walks A* path spending cost budget, not step count. Fixes risks 8.1 + 8.2
- [E] **LoS on attacks** (2.5): add `hexLineDraw` LoS check to `canAttack()`. Artillery can no longer fire through forests
- [E] **Update all tests** for new stats, formula, movement

**Exit criteria:** `pnpm test` all green. Damage formula matches A3. Kill timing: counter ~2 hits, neutral 3-4 hits, disadvantaged 6-7 hits on plains.

---

### Sprint 2 — Directive Overhaul (Mar 11–17)

Split the flat directive into two layers. This is a type change that cascades everywhere — do it before building the combat timeline on top.

- [E] **Two-layer directive model** (0.1): `movementDirective` (advance/flank/hold/retreat) + `engagementROE` (assault/skirmish/cautious/ignore) + specialty modifier (capture/support/scout/fortify/null)
- [E] **Update Unit type** in `types.ts`: replace `directive: DirectiveType` with the two-layer fields
- [E] **Update all directive consumers**: `directives.ts`, `game-state.ts`, `combat.ts` (hold bonus → ROE-based), `commands.ts`, `ai.ts`
- [E] **Update serialization** for new directive fields
- [C] **Update directive picker UI** to two-layer selection (movement + ROE)
- [S] **Update server** for new directive structure in placement/redirect messages

**Exit criteria:** All tests pass. Every unit carries movement + ROE. Old `DirectiveType` union removed. Client can assign both layers during build phase.

---

### Sprint 3 — Simultaneous Resolution (Mar 18–24)

The architectural pivot. Both players submit simultaneously. This changes the server game loop and client flow.

- [S] **Buffer both submissions** (0.3): `handleSubmitCommands` stores commands per player. Resolution fires only when both are received. Turn timer runs for shared planning window, not per-player.
- [S] **Remove alternating player logic**: no `currentPlayer` switching. Both players plan → both submit → resolve → next tick
- [C] **Simultaneous submit UI** (4.2): both players see planning phase. Submit button. Waiting-for-opponent state. No information leak.
- [E] **Multi-city win condition** (2.2, D7): `victoryCities = floor(totalCities × 0.6)`. Remove KotH center-hex logic. Remove `objective` from `RoundState`.
- [E] **Kill bonus scaling** (2.3): `KILL_BONUS = floor(unit.cost × 0.1)` replaces flat 25

**Exit criteria:** Two clients can submit commands simultaneously. Server waits for both before resolving. KotH removed, multi-city capture working.

---

### Sprint 4 — Combat Timeline (Mar 25–31)

The big one. Replace `executeTurn()` with the 10-phase pipeline. Build it incrementally — movement first, then combat, then effects.

- [E] **Phase 1-2**: Snapshot + intent collection. Clone state, generate composite intents from directives + CP overrides
- [E] **Phase 3**: Step-by-step movement along A* path. Intercept check per step (ROE-gated). Destination reservation. Collision resolution (D4). Movement locks.
- [E] **Phase 4**: Engagement detection. Scan for in-range pairs. LoS check. ROE filter.
- [E] **Phase 5-6**: Initiative fire + counter fire. Response time ordering with modifiers (flanking, terrain, ROE). Cancel-on-death.
- [E] **Phase 8-10**: Support heal, city capture (HP cost), round end check
- [E] **Event log** (0.5): typed events emitted from every phase. `MOVE`, `INTERCEPT`, `ATTACK`, `COUNTER`, `KILL`, `CAPTURE`, `HEAL`

**Phase 7 (melee) deferred** — needs numeric meleeRating values. See open decision D6.

**Exit criteria:** Full tick resolves both players' intents simultaneously through phases 1-6, 8-10. Event log emitted. Tests cover: movement collision, intercept checks, initiative ordering, counter-fire cancel-on-death, city capture.

---

### Sprint 5 — Reveal Animation (Apr 1–7)

The product. Event log plays back as animation. Players watch their plans collide.

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

### Sprint 6 — Map Scaling (Apr 8–14)

Parametric map. Test at 40×28.

- [E] **Parametric constants** (2.1, A6): all map-dependent values derived from `GRID`
  - `deploymentRows = floor(height × 0.2)`
  - `flankOffset = floor(width × 0.25)`
  - `cityMinDistance = floor(width × 0.15)`
  - `cityCount = floor(width × height / 40)`
  - `maxTurnsPerSide = floor(width / 2)`
  - `CP_PER_ROUND = 4 + floor((width - 20) / 10)`
- [E] **Movement scaling** (A5): `infantry = floor(w/8)`, `tank = floor(w/7)`, `recon = floor(w/5)`, `artillery = floor(w/12)`
- [E] **40×28 map generation**: validate noise frequencies produce good terrain at this scale
- [C] **Render at scale**: terrain mesh batching if needed, camera bounds, minimap
- [E] **Match length measurement**: instrument AI vs AI for average match duration at 40×28

**Exit criteria:** Game plays on 40×28. All constants scale correctly. Match length measured — if >20 min average, adjust movement ranges before proceeding.

---

### Sprint 7 — Progression (Apr 15–21)

Archetype system, tier 1 only.

- [E] **Upgrade trigger tracking** (A9, 3.1): cities held simultaneously, kills per round, hexes scouted, consecutive defensive ticks
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
| OD-1 | Melee numeric values (D6 says letter grades, needs numbers) | Sprint 4 Phase 7 | Deferred — sprint 4 ships without melee |
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
2026-03-04 | S4     | Melee (Phase 7) deferred from Sprint 4.          | D6 defines letter grades, not numbers. Can't implement without numeric values. Sprint 4 ships phases 1-6, 8-10.
2026-03-04 | S8     | Steam page added to Sprint 8 scope.              | Wishlist collection is launch survival infrastructure per GAME_MATH_ENGINE.md market analysis.
```
