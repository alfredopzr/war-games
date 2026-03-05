---
name: consumer-fidelity-auditor
description: Audits the client consumption layer (renderer, store, components, network) and the instrumentation layer ([MATH_AUDIT] logging) for faithful representation of engine/server outputs. Not looking for bugs — looking for where a consumer silently drops, transforms, fabricates, or misequences information from its source.
user-invocable: true
---

# Consumer Fidelity Auditor

Find places where a consumer layer silently misrepresents its source.

This is not a UI/UX review. This is a **fidelity audit**. The question is never "does this look right?" — it is "does this consumer faithfully represent what the source emitted?"

---

## 1. What "Correct" Means for a Consumer

A consumer receives data from a source and presents it. Correctness is fidelity to that source, measured across five dimensions:

| Dimension | Definition | Example violation |
|-----------|-----------|-------------------|
| **Completeness** | Every source event/field has a consumer that handles it | Server emits `round-end` with `roundResult` — client ignores `catchUpBonus` field |
| **Accuracy** | The consumer represents the source value without semantic distortion | Engine says unit has 3 HP — store stores 3 — component renders "3" — but renderer shows green HP bar (>60% threshold is wrong because max HP changed) |
| **Sequencing** | Events are consumed in emission order | Replay plays KILL before ATTACK — death animation before gunfire |
| **Timing** | Temporal relationships between events are preserved | Two simultaneous Phase 5 attacks render sequentially with a 500ms gap — implies turn order that doesn't exist |
| **No fabrication** | Consumer never displays information absent from source | Renderer shows attack tracer for a unit that wasn't in the event list — leftover from previous turn |

A consumer is **faithful** when it satisfies all five. A consumer is **unfaithful** when it violates any, even if the result looks plausible to a player.

---

## 2. Consumer Domains

### 2.1 Domain Map

Five consumer domains. Each has a source it reads from and a presentation it writes to.

| Domain | Source | Presentation | Files |
|--------|--------|-------------|-------|
| **Renderer** | Game state + event log | Three.js scene (meshes, animations, effects) | `packages/client/src/renderer/*.ts` |
| **Store** | Server socket messages | Zustand state (the single client-side truth) | `packages/client/src/store/game-store.ts` |
| **Components** | Zustand store | React DOM (HUD, menus, overlays) | `packages/client/src/components/*.tsx` |
| **Network** | Socket.IO events | Store mutations (deserialize + dispatch) | `packages/client/src/network/network-manager.ts` |
| **Instrumentation** | Engine internals (combat pipeline, turn resolution) | `[MATH_AUDIT]` log lines | Not yet implemented — audit against spec in `GAME_MATH_ENGINE.md` §AI vs AI Logging Spec |

### 2.2 Data Flow Chain

```
Engine (server)
  → Socket.IO event (serialized JSON)
    → NetworkManager.setupListeners() (deserialize, route)
      → game-store mutations (Zustand set())
        → React components (read store via hooks)
        → Renderer functions (read store, mutate Three.js scene)
```

Plus the parallel instrumentation path:

```
Engine combat pipeline (server)
  → [MATH_AUDIT] log lines (stdout / logger.ts)
    → log-viewer.ts SSE stream
      → browser log viewer (HTML)
```

Every arrow is a fidelity boundary. Each boundary can drop, transform, fabricate, or misequence data.

---

## 3. Fidelity Contract Surface

### 3.1 Network → Store Boundary

The network manager receives socket events and writes to the store. This is the most security-critical boundary — the server is authoritative.

**What to audit per socket event:**

| Socket Event | What server sends | What store should receive | Fidelity question |
|-------------|------------------|--------------------------|-------------------|
| `game-start` | Full serialized GameState + playerId + opponentName | Deserialized GameState, myPlayerId set, build timer started | Does deserialization lose any fields? Are nested objects (units Map, cities Map) correctly reconstructed? |
| `state-update` | Serialized GameState | Store replaces gameState | Same deserialization question. Is the old state fully replaced, or partially merged (leak risk)? |
| `build-confirmed` | `{ playerId }` | `opponentBuildConfirmed = true` | Only if playerId is opponent — does the store guard this? |
| `battle-start` | Serialized GameState | Phase transition + state update | Does the store clear build-phase UI state (placement mode, selected unit)? |
| `turn-result` | `{ state, events }` | State update + battle log entries from events | Are ALL event types in `events[]` handled? Or only some? |
| `round-end` | `{ roundResult, state }` | Round result screen + state update | Does roundResult contain fields the store ignores? |
| `game-over` | `{ winnerId, reason, finalState }` | Game over screen | Does `reason` get consumed or dropped? |
| `timer-sync` | `{ timeRemaining }` | Build timer sync | Clock drift handling? |
| `opponent-disconnected` / `opponent-reconnected` / `forfeit` | Status messages | UI state flags | Are all three handled? |

### 3.2 Store → Renderer Boundary

The renderer reads game state from the store and creates/updates Three.js objects.

**What to audit per renderer module:**

| Module | Source data | Fidelity question |
|--------|-----------|-------------------|
| `terrain-renderer.ts` | `gameState.map` (hex grid, terrain types, elevation, cities) | Does every terrain type in `types.ts` have a color mapping? Are city ownership borders updated when ownership changes? |
| `unit-model.ts` | `gameState.players[].units` (Map of units with position, type, hp, directive, owner) | Does `syncUnitModels()` handle: unit creation (new unit placed), unit removal (unit killed), unit movement (position changed), HP change, directive change? All five mutation types? |
| `fog-renderer.ts` | `store.visibleHexes`, `store.lastKnownEnemies` | Two fog levels (never-seen 0.85, explored 0.5) — does the store actually provide enough state to distinguish these? Or is one level fabricated? |
| `effects-renderer.ts` | Turn events (from `turn-result`) | Attack tracers, damage numbers, death markers — are these spawned from actual event data, or inferred from state diff? If inferred, can the inference miss events? |
| `replay-sequencer.ts` | Turn events or state snapshots (determine which) | Does it consume engine events directly, or reconstruct them from state diffs? See §4 for why this matters. |
| `deploy-renderer.ts` | Phase, deployment zone bounds | Does it read zone bounds from engine or hardcode them? |
| `selection-renderer.ts` | Store selection state + engine range calculations | Does it call engine `getHexesInRange()` or reimplement range logic? |
| `unit-renderer.ts` | `store.lastKnownEnemies` (ghost markers for unseen enemies) | What populates `lastKnownEnemies`? When are ghosts cleared — on reveal, on round end, on game end? |

### 3.3 Store → Components Boundary

Components read store via Zustand hooks and render UI.

**What to audit per component category:**

| Category | Components | Fidelity question |
|----------|-----------|-------------------|
| **HUD** | BattleHUD, CommandMenu, UnitShop | Do they read live store values or cache stale state? |
| **Selection** | DirectiveSelector, unit info displays | When selected unit dies mid-turn, does the component handle the null? |
| **Overlays** | Round result, game over, toast notifications | Do overlays display all fields from the event data or drop some? |
| **Battle log** | Battle log component | Does it render all event types from `addBattleLogEntries()` or only a subset? |
| **Timer** | Build timer display | Does it read from store timer state or run its own independent timer? |

### 3.4 State Filter Boundary (server-side)

`state-filter.ts` strips information from the game state before sending to each player. This is a fidelity boundary in reverse — intentional information removal for fog of war.

**What to audit:**

| Filter rule | Fidelity question |
|------------|-------------------|
| Build phase: enemy units hidden | Is the unit Map emptied, or are unit IDs leaked with positions stripped? |
| Battle phase: non-visible enemies hidden | Does `calculateVisibility()` match the engine's `vision.ts`? Same algorithm, same inputs? |
| Enemy directives stripped → replaced with neutral `advance` | Is the replacement consistent? Does the client know the directive is fake, or does it render it as real? |
| Deep clone | Are all nested structures cloned? A shallow clone leaks mutation paths. |

### 3.5 Instrumentation Boundary

The `[MATH_AUDIT]` logging spec (GAME_MATH_ENGINE.md §AI vs AI Logging Spec) defines what the engine must emit during combat. This is a spec-to-implementation fidelity check.

**Specified event tags and their required fields:**

| Tag | Required fields | Source location in engine |
|-----|----------------|-------------------------|
| `ENGAGEMENT` | attacker type, defender type, matchup category, multiplier | Combat pipeline — engagement detection (Phase 4) |
| `INITIATIVE` | unitA, unitB, scoreA, scoreB, winner, method (MODIFIERS or RNG), seed + engagementId if RNG | Combat pipeline — initiative resolution (Phase 5) |
| `HIT` | attacker, defender, expected_dmg, actual_dmg, dmg, hp_before, hp_after, hit_number | Damage application |
| `KILL` | attacker, defender, total_hits, expected_hits, verdict (ON_TARGET / TOO_FAST / TOO_SLOW) | Kill event |
| `ESCAPE` | unit, after_hits_taken, reason | Directive retreat / disengage |
| `MATCH_END` | rounds, p1_units_lost, p2_units_lost, avg_hits_to_kill, dominant_unit, rng_tiebreaks_pct | Match conclusion |

**Fidelity checks for instrumentation:**

| Check | Question |
|-------|----------|
| **Tag completeness** | Does the engine emit ALL six tag types? Or are some unimplemented? |
| **Field completeness** | For each tag, are all required fields present? Or are some stubbed as 0 / null / omitted? |
| **Verdict accuracy** | Does `ON_TARGET / TOO_FAST / TOO_SLOW` compare against the math model's kill timing targets (2 hits counter, 3-4 neutral, 6-7 disadvantaged)? Are those targets hardcoded or derived? |
| **Grep compatibility** | Are tags formatted as `[MATH_AUDIT] TAG` with consistent spacing for grep-based batch analysis? |
| **expected_dmg derivation** | Is `expected_dmg` in HIT events computed from the math model formula, or is it just a copy of `actual_dmg`? (If they're always equal, the field is useless.) |
| **Coverage of combat paths** | Do intercepts, counter-attacks, and melee all emit the same tags? Or only primary attacks? |

---

## 4. Replay Sequencer — Special Case

The replay sequencer requires special attention because of a fundamental architectural question: **does it consume engine events, or does it reconstruct events from state diffs?**

These are different things with different fidelity properties.

**If the sequencer consumes engine events directly:**
- Fidelity depends on completeness (does it handle all event types?) and sequencing (does it play them in emission order?)

**If the sequencer reconstructs events by diffing before/after state:**
- It is fabricating a parallel event stream. Three fidelity risks emerge:

| Risk | Description |
|------|-------------|
| **Fabrication** | Diff infers an event that didn't actually happen (e.g., unit teleported due to server correction — diff generates a "move" event) |
| **Omission** | Diff misses an event that did happen (e.g., unit took damage and healed in same turn — diff sees no HP change, generates no events) |
| **Ordering** | Diff generates events in an order that doesn't match engine resolution order (e.g., kill before attack) |

**The auditor must determine which model is in use.** Trace the data: where does the sequencer get its event list? From the `events` array in `turn-result`, or from comparing state snapshots?

GAME_MATH_ENGINE.md §N3 specifies that the event log is load-bearing infrastructure for reveal animation, debugging, and replay. The auditor must check whether this spec is satisfied by the actual consumption path.

---

## 5. Event Log → Animation Mapping

GAME_MATH_ENGINE.md §4.3 defines the mapping from combat timeline phases to visual layers:

| Phase | Engine event types | Expected animation |
|-------|-------------------|-------------------|
| Phase 3 | MOVE, INTERCEPT | Movement arrows, intercept fire |
| Phase 5 | ATTACK (initiative fire) | Gunfire / first strike |
| Phase 6 | COUNTER | Return fire |
| Phase 7 | MELEE | Melee contact |
| Phase 8 | HEAL | Support/heal effects |
| Phase 9 | CAPTURE | City ownership flip |

**Fidelity audit per mapping:**

For each row, the auditor must determine:
1. Does the renderer have a visual representation for this event type?
2. Is it triggered by the actual engine event, or by a state diff?
3. If the engine event type doesn't exist yet (planned but unimplemented), note it as SPEC_GAP — not a fidelity failure.

Compare the event types the renderer handles against the event types the engine spec defines. Any mismatch in either direction (renderer handles events not in spec, spec defines events renderer ignores) is a finding.

---

## 6. Team Architecture

### 6.1 Agents

| Agent | Domain | Files to read |
|-------|--------|---------------|
| **lead** | Cross-cutting | All design docs for consumer specs. `types.ts` (network protocol types). `index.ts` (public engine API). |
| **renderer-auditor** | Renderer | All files in `packages/client/src/renderer/`. Cross-reference with engine event types. |
| **store-auditor** | Store + Network | `game-store.ts`, `network-manager.ts`. Cross-reference with server `game-loop.ts` socket emissions. |
| **component-auditor** | Components | All files in `packages/client/src/components/`. Cross-reference with store state shape. |
| **instrument-auditor** | Instrumentation + State Filter | `packages/server/src/logger.ts`, `state-filter.ts`, `game-loop.ts` (event emission). Cross-reference with `[MATH_AUDIT]` spec. |

### 6.2 Spawn Sequence

1. **Lead** reads design docs and extracts the consumer spec — what each consumer layer is supposed to receive. Writes `CONSUMER_SPEC` entries to ledger.
2. **Lead** reads `types.ts` network protocol types (ClientMessage, ServerMessage) and engine `index.ts` public API. Maps what the engine exports and what the server emits.
3. **Lead** spawns four auditor agents, each scoped to their domain.
4. Each auditor reads their files, traces every consumption point, and appends findings.
5. When all auditors complete, **lead** cross-references findings and writes the fidelity report.

---

## 7. Execution Protocol

### Phase 1: Extract Consumer Specs (lead)

Read design docs for every statement about what a consumer should do:

```
GAME_MATH_ENGINE.md §N3    → event log drives reveal animation, debugging, replay
GAME_MATH_ENGINE.md §4.3   → phase-to-animation mapping table
GAME_MATH_ENGINE.md §4.4   → [MATH_AUDIT] logging spec with tag formats and fields
GAME_MATH_ENGINE.md §0.5   → structured event log format
DESIGN.md                   → fog of war rules, phase transitions, what players see
```

For each spec found, write a `CONSUMER_SPEC` entry:

```markdown
---
## [CONSUMER_SPEC] CS-1: Reveal animation driven by event log
**agent:** lead
**time:** {timestamp}
**phase:** 1

source_doc: GAME_MATH_ENGINE.md §N3
consumer: renderer (replay-sequencer.ts)
source_data: structured event log from turn resolution
spec: "The renderer plays the event stream sequentially. Without a structured log, the reveal is a teleport, not a story."
fidelity_dimensions: sequencing, completeness, timing
```

Also read `types.ts` for:
- All socket message types (ClientMessage variants, ServerMessage variants)
- GameState shape — every field that crosses the wire

Map engine `index.ts` exports to identify what the client can call vs what the server mediates.

### Phase 2: Trace Consumption Points (auditors, parallel)

**renderer-auditor:**
- For each renderer module, identify what store/state data it reads
- For each engine event type (MOVE, ATTACK, KILL, CAPTURE, etc.), trace whether the renderer handles it
- Check `replay-sequencer.ts:diffTurnEvents()` — what events does it reconstruct vs what the engine actually emits?
- Check animation triggers — are they driven by events or by state diffs?
- Append `CONSUMPTION_POINT` entries

**store-auditor:**
- For each socket event in `network-manager.ts:setupListeners()`, trace what store mutation it triggers
- For each store field, identify its source (which socket event populates it)
- Check for store fields with no source (fabricated client state) — some are valid (UI state like selectedUnit), some are fidelity risks (derived game state computed client-side)
- Check deserialization: `deserializeGameState()` — does it reconstruct Maps, handle nested objects, preserve all fields?
- Append `CONSUMPTION_POINT` entries

**component-auditor:**
- For each component, identify which store fields it reads (via Zustand hooks)
- Check: does the component render all relevant fields, or does it drop some?
- Check: does the component handle missing/null state (unit died, game ended)?
- Check: does any component compute derived game state instead of reading from store? (e.g., calculating damage locally instead of reading from event)
- Append `CONSUMPTION_POINT` entries

**instrument-auditor:**
- Read `logger.ts` — what does it capture?
- Read `game-loop.ts` — what events does it emit in `generateBattleEvents()`?
- Cross-reference with `[MATH_AUDIT]` spec — which tags exist in code, which are missing?
- Read `state-filter.ts` — trace every field that gets stripped or replaced
- Check: does `filterStateForPlayer()` use the same visibility calculation as `vision.ts`?
- Append `CONSUMPTION_POINT` and `INSTRUMENT_CHECK` entries

### Phase 3: Cross-Boundary Fidelity Checks (all auditors)

Each auditor checks the boundary between their domain and the adjacent domain:

| Boundary | Auditor responsible | What to check |
|----------|-------------------|---------------|
| Server → Network | store-auditor | Every socket.emit() in server has a matching socket.on() in client |
| Network → Store | store-auditor | Every received event triggers a store mutation that preserves all fields |
| Store → Renderer | renderer-auditor | Renderer reads current store state, not stale cached values |
| Store → Components | component-auditor | Components re-render on relevant state changes |
| Engine → Instrumentation | instrument-auditor | Every combat path emits the specified log tags |
| Engine → State Filter → Network | instrument-auditor | Filtered state is a strict subset (no added fields, no transformed values) |

Append `BOUNDARY_CHECK` entries:

```markdown
---
## [BOUNDARY_CHECK] Server → Client: turn-result event
**agent:** store-auditor
**time:** {timestamp}
**phase:** 3

boundary: server game-loop.ts → network-manager.ts
server_emits: io.to(socket).emit('turn-result', { state: filteredState, events: battleEvents })
client_receives: socket.on('turn-result', (data) => { ... })
fields_emitted: state (GameState), events (array of {type, attacker?, defender?, damage?, hex?, unitId?})
fields_consumed: state (deserialized → store.setGameState), events (→ addBattleLogEntries)
fields_dropped: [list any fields in emitted data not consumed]
fidelity: {FAITHFUL | INCOMPLETE | FABRICATED}
```

### Phase 4: Fidelity Report (lead)

Lead reads all entries. For each `CONSUMPTION_POINT`:

> "Is this consumption faithful across all five dimensions (completeness, accuracy, sequencing, timing, no fabrication)?"

Classify fidelity gaps:

| Gap Type | Definition |
|----------|-----------|
| **DROP** | Source emits data that no consumer handles |
| **FABRICATION** | Consumer displays information not present in source |
| **DISTORTION** | Consumer transforms source data in a way that changes meaning |
| **MISEQUENCE** | Consumer presents events in wrong order |
| **DESYNC** | Consumer uses stale or independently computed data instead of source |
| **SPEC_MISSING** | Instrumentation tag or field required by spec is not implemented |

---

## 8. Severity Rubric

### STRUCTURAL

The player sees something that **didn't happen** or **doesn't see something that did**.
- Renderer plays attack animation for a unit that wasn't attacked
- Kill event missing from replay — unit disappears without death animation
- Fog of war shows enemy unit position that should be hidden
- State filter leaks hidden information

### SEMANTIC

The player sees something **ambiguous or misleading**.
- HP bar color thresholds don't match actual HP percentages after stat scaling
- Directive icon shows "advance" for an enemy whose real directive was stripped by state filter — player can't tell the difference
- Damage number floats but no attack tracer — unclear who attacked whom

### INSTRUMENT

The instrumentation layer **cannot fulfill its specified purpose**.
- `[MATH_AUDIT]` tag missing for a combat path — balance analysis has blind spots
- `verdict` field always says ON_TARGET because expected_hits is copied from actual_hits
- MATCH_END tag missing dominant_unit — can't detect unit balance issues

### SPEC_GAP

The design doc specifies a consumer behavior that **has no implementation path**.
- §N3 says event log drives reveal animation, but client uses state diffs
- §4.3 maps Phase 7 to melee animation, but replay-sequencer has no melee event type
- `[MATH_AUDIT]` ESCAPE tag specified but no engine code path emits it

---

## 9. Ledger Entry Types

### CONSUMER_SPEC
Written by: lead (Phase 1)

```markdown
---
## [CONSUMER_SPEC] CS-{N}: {title}
**agent:** lead
**time:** {timestamp}
**phase:** 1

source_doc: {doc reference}
consumer: {domain (file)}
source_data: {what the consumer receives}
spec: "{quoted spec text}"
fidelity_dimensions: {which of the 5 dimensions this spec constrains}
```

### CONSUMPTION_POINT
Written by: any auditor (Phase 2)

```markdown
---
## [CONSUMPTION_POINT] {module}:{function} reads {source}
**agent:** {auditor name}
**time:** {timestamp}
**phase:** 2

consumer: {file:line}
source: {what it reads — store field, socket event, engine export}
what_it_does: {how it uses the data}
fidelity_risk: {DROP | FABRICATION | DISTORTION | MISEQUENCE | DESYNC | NONE}
evidence: {file:line showing the consumption}
```

### BOUNDARY_CHECK
Written by: any auditor (Phase 3)

Format shown in §7 Phase 3.

### INSTRUMENT_CHECK
Written by: instrument-auditor (Phase 2)

```markdown
---
## [INSTRUMENT_CHECK] [MATH_AUDIT] {TAG}
**agent:** instrument-auditor
**time:** {timestamp}
**phase:** 2

tag: {ENGAGEMENT | INITIATIVE | HIT | KILL | ESCAPE | MATCH_END}
spec_source: GAME_MATH_ENGINE.md §AI vs AI Logging Spec
required_fields: {list from spec}
implemented: {YES | PARTIAL | NO}
implementation_location: {file:line or "not found"}
missing_fields: {list of fields not emitted}
```

### FIDELITY_GAP
Written by: lead only (Phase 4)

```markdown
---
## [FIDELITY_GAP] FG-{N}: {title}
**agent:** lead
**time:** {timestamp}
**phase:** 4

type: {DROP | FABRICATION | DISTORTION | MISEQUENCE | DESYNC | SPEC_MISSING}
severity: {STRUCTURAL | SEMANTIC | INSTRUMENT | SPEC_GAP}
boundary: {which boundary — e.g., "Server → Store" or "Store → Renderer"}
consumer: {file:line}
source: {what was expected}
what_happens: {what actually happens}
what_should_happen: {faithful behavior}
evidence: {ledger entry references}
```

### FIDELITY_REPORT
Written by: lead only (Phase 4)

Final synthesis with: boundary-by-boundary fidelity summary, all gaps sorted by severity, instrumentation coverage percentage, replay reconstruction vs event-driven assessment, priority ranking.

---

## 10. Shared Ledger Protocol

Same as contract-gap-finder: append-only, attribution required, no overwrites. See contract-gap-finder §8 for full protocol.

Ledger location:
```
audit/ledgers/{YYYY-MM-DD}_{HHMM}_consumer_fidelity.md
```

---

## 11. Rules for the Auditor

1. **Trace actual data flow.** Follow the variable. `socket.on('turn-result', (data) => ...)` — what is `data`? Open the server file that emits it. Compare field by field. Do not assume.

2. **State diffs are not events.** If the client reconstructs events from before/after state, that is not consuming the event log. It is fabricating a parallel event stream. Flag it, even if the fabrication is currently accurate.

3. **Intentional omission is still an omission.** State filter deliberately strips enemy directives. That's correct behavior — but the auditor must verify the client knows the directive is fake. If the client renders the replacement directive as if it were real, that's a DISTORTION, even though the server intended the strip.

4. **"It works" is not fidelity.** A renderer that shows correct-looking animations from state diffs is not faithful if the design spec says animations should come from the event log. The result might be identical today and diverge tomorrow when the engine adds events that state diffs can't reconstruct.

5. **Instrumentation is not optional.** The `[MATH_AUDIT]` spec exists because balance tuning depends on it. A missing tag is not "we'll add it later" — it's a hole in the balance feedback loop. Flag it as SPEC_MISSING.

6. **Do not audit engine correctness.** That's contract-gap-finder's job. This skill audits whether consumers faithfully represent what the engine produces, not whether the engine produces the right thing.
