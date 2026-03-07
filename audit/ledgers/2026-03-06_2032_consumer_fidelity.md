# Consumer Fidelity Audit — Reveal Animation & Visual Language
**date:** 2026-03-06 20:32
**scope:** Client renderer + store + network vs REVEAL_ANIMATION_SPEC.md + VISUAL_LANGUAGE.md
**agents:** reveal-auditor, visual-language-auditor, store-network-auditor
**total findings:** 16 (5 STRUCTURAL, 5 SEMANTIC, 6 SPEC_GAP)

---

## EXECUTIVE SUMMARY

The reveal animation system has a **fundamental architectural split**: a dormant `reveal-sequencer.ts` that consumes `BattleEvent[]` correctly and implements the 10-phase pipeline, and an active `replay-sequencer.ts` that fabricates events from state diffs and plays them as a flat list. The active system violates the spec on every major dimension. The dormant system is never called.

The visual language audit is mostly clean — color palette, Y offsets, and render order are faithful. Three targeted distortions need fixing.

---

## STRUCTURAL GAPS (blocking — player sees wrong story or misses events)

---

### [FG-01] reveal-sequencer.ts exists but is never called
**type:** FABRICATION
**severity:** STRUCTURAL
**boundary:** network-manager.ts → replay-sequencer.ts

`reveal-sequencer.ts` consumes `BattleEvent[]` directly, groups by `pipelinePhase`, implements per-phase timing via `PHASE_TIMING`, and handles all 16 event types. It is never imported or invoked anywhere. `network-manager.ts:276` calls `startReplay()` from `replay-sequencer.ts` instead.

`replay-sequencer.ts` is a flat event loop over synthetic `TurnEvent[]` reconstructed from state diffs. It handles 6 of 16 event types. It has no phase grouping, no phase timing, and no LOS awareness.

**evidence:**
- `network-manager.ts:276` — `startReplay(replayEvents, ...)` calls replay-sequencer
- `reveal-sequencer.ts` — `startReveal()` exported but 0 call sites
- `replay-sequencer.ts:99` — `startReplay(events: TurnEvent[])` — wrong type entirely

**fix:** Import `startReveal` from `reveal-sequencer.ts`. Call it with `data.events` from the socket. Delete `startReplay` call.

---

### [FG-02] Server emits unfiltered BattleEvent[] to both players
**type:** DROP
**severity:** STRUCTURAL
**boundary:** game-loop.ts → socket emit

`game-loop.ts:380` sends `events: allEvents` — the raw `state.pendingEvents` array — identically to both players. No per-player fog filtering exists. Both players see every enemy maneuver regardless of LOS.

REVEAL_ANIMATION_SPEC.md §Visibility Rule (D-VIS-5, line 30): "The server filters `BattleEvent[]` per player before sending in the `turn-result` payload. Each event is checked against the observing player's vision set for that tick."

**evidence:**
- `game-loop.ts:375–381` — `io.to(player.socketId).emit('turn-result', { state: filtered, events: allEvents })`
- `allEvents` is the same object sent to both players
- `state-filter.ts` filters unit positions but has no `filterEventsForPlayer()` function

**fix:** Add `filterEventsForPlayer(events, playerId, visibleHexes)` to `state-filter.ts`. Compute LOS set from Phase 1 snapshot per player. Strip events where all positions are outside LOS, per EVENT_LOG_SPEC.md §Fog Filtering rules.

---

### [FG-03] Client discards server BattleEvent[] and fabricates replacements
**type:** FABRICATION
**severity:** STRUCTURAL
**boundary:** network-manager.ts → store

`network-manager.ts:248` calls `diffTurnEvents(unitsBefore, unitsAfter, ...)` and passes the synthetic result to the sequencer. The server's `data.events: BattleEvent[]` is routed only to the battle log UI (line 254) and discarded for replay.

`diffTurnEvents()` fabricates `attackerId: 'unknown'` (line 59), uses wrong attacker positions (line 62), and generates no intercept / counter / heal / reveal / capture-damage / capture-death / objective events.

**evidence:**
- `network-manager.ts:248` — `const replayEvents = diffTurnEvents(...)`
- `network-manager.ts:276` — `startReplay(replayEvents, ...)` — synthetic events, not server events
- `replay-sequencer.ts:59` — `attackerId: 'unknown'`
- Store has no `BattleEvent[]` field — only `turnReplayEvents: TurnEvent[]`

**fix:** Add `pendingRevealEvents: BattleEvent[]` to the store. Populate from `data.events` in the turn-result handler. Pass to `startReveal()`.

---

### [FG-04] No LOS gating of enemy visuals during reveal (D-VIS-5)
**type:** DESYNC
**severity:** STRUCTURAL
**boundary:** replay-sequencer.ts rendering

Even after FG-01/FG-02/FG-03 are fixed, the renderer must gate enemy visuals to the observing player's LOS set for that tick. Currently no such gating exists anywhere in the replay path.

Spec: "An enemy unit moving through explored-but-unobserved territory: you see nothing." Scout placement is the primary intelligence mechanic — a scout on hold buys LOS coverage for the reveal.

**evidence:**
- `replay-sequencer.ts` — no `observingPlayerId` parameter, no LOS set parameter
- `reveal-sequencer.ts` — has `observingPlayer` in callback type but doesn't gate visuals per event
- `diffTurnEvents()` — no LOS awareness at all

**fix:** `startReveal()` must accept `observingPlayerId` and the player's LOS set. Per event, check if the acting unit is owned by the observer; if not, check if the position is in LOS. Skip or render as "from-fog" accordingly.

---

### [FG-05] No planning→reveal continuity
**type:** DROP
**severity:** STRUCTURAL
**boundary:** reveal phase transition

Spec (§Planning → Reveal Continuity): "Planning visuals do not clear at reveal start. Blue paths, directive icons, and target hex markers stay exactly where they are as movement begins."

The active replay sequencer animates unit position tweens only. No path lines, no ROE icons, no "line eats itself" animation, no static/dynamic/divergence execution modes, no collision pulses.

**evidence:**
- `replay-sequencer.ts:112–127` — only `tweenUnitTo()` called per move event; no path drawing
- No line geometry created or destroyed during reveal
- `effects-renderer.ts` — no intercept pulse, no engagement flash geometry

**fix:** This requires the full reveal-sequencer.ts path (FG-01). The sequencer must: keep selection-renderer directive paths alive at reveal start, animate them "eating themselves" as units advance, deform/truncate on intercept/collision, implement hunt lock-on snapping and retreat-on-contact redraw.

---

## SEMANTIC GAPS (player sees misleading or incomplete information)

---

### [FG-06] Phase 5 and Phase 6 tracers use identical yellow color
**type:** DISTORTION
**severity:** SEMANTIC
**boundary:** effects-renderer.ts

Spec (§Phase 6): "Muzzle flash color: orange (Phase 5 = blue/faction color, Phase 6 = orange)." VISUAL_LANGUAGE.md: counter-fire tracers = `0xdd8833`.

`spawnAttackTracer()` has no color parameter. All tracers hardcode `0xffff88` yellow. `reveal-sequencer.ts:233` notes "orange tracer for counter-fire" but still calls the same colorless function.

**evidence:**
- `effects-renderer.ts:77` — `color: 0xffff88` hardcoded
- `spawnAttackTracer(fromX, fromY, fromZ, toX, toY, toZ)` — no color arg
- `constants.ts:34` — `COUNTER_COLOR = 0xdd8833` defined but unused by effects-renderer

**fix:** Add `color: number = 0xffff88` parameter to `spawnAttackTracer()`. Pass `COUNTER_COLOR` for Phase 6 / counter events.

---

### [FG-07] Floating combat text has no variants
**type:** DROP
**severity:** SEMANTIC
**boundary:** effects-renderer.ts

Spec (§Floating Text — Full Style Guide) specifies 8 variants: standard hit, critical, counter (orange + "COUNTER" prefix), melee, kill (skull), heal (green "+1 HP"), reveal (white "REVEALED"), city captured (white bold larger).

`spawnDamageNumber()` has one style: rust `#9a4a3a`, no prefix, no color variants, no size variants.

**evidence:**
- `effects-renderer.ts:48–63` — single style, `el.textContent = damage > 0 ? `-${damage}` : 'CAPTURED'`
- No counter prefix, no green heal, no white reveal, no skull

**fix:** Add `variant` parameter to `spawnDamageNumber()`: `'hit' | 'counter' | 'heal' | 'kill' | 'reveal' | 'capture'`. Apply color and prefix per variant.

---

### [FG-08] Move range highlight color is electric blue, should be beige
**type:** DISTORTION
**severity:** SEMANTIC
**boundary:** selection-renderer.ts

Spec: "Move range fill: `0xe8e4d8` beige, 0.08 opacity. Move range outline: `0xe8e4d8` beige, 0.7 opacity."

`selection-renderer.ts:359` sets color as `highlightMode === 'move' ? 0x00ccff : 0x9a4a3a`. Move range hexes render in electric blue (same as move destination), not beige. This conflates "reachable hexes" with "selected destination."

**evidence:**
- `selection-renderer.ts:359` — `color = highlightMode === 'move' ? 0x00ccff : 0x9a4a3a`
- Spec: move range = beige, move destination = electric blue (separate visual)

**fix:** Split color logic: `highlightMode === 'move'` → `0xe8e4d8` (beige) for range tiles, `0x00ccff` only for the selected destination hex.

---

### [FG-09] Explored fog opacity is 0.25, should be 0.6
**type:** DISTORTION
**severity:** SEMANTIC
**boundary:** fog-renderer.ts

Spec (VISUAL_LANGUAGE.md §Fog of War): "Explored: `0x16160E`, 0.6 opacity."

`fog-renderer.ts:37` — `opacity: 0.25`. The explored wash is much lighter than specified, making previously-seen terrain nearly indistinguishable from live LOS.

**evidence:**
- `fog-renderer.ts:37` — `opacity: 0.25`

**fix:** Change to `opacity: 0.6`.

---

### [FG-10] Recon model scale is 2.00, should be 1.30
**type:** DISTORTION
**severity:** SEMANTIC
**boundary:** unit-model.ts

Spec (VISUAL_LANGUAGE.md §Unit Models): "infantry 1.20, tank 1.80, artillery 1.50, recon 1.30."

`unit-model.ts:68` — `recon: 2.00`. Recon is rendered 54% larger than spec, same size as tank.

**evidence:**
- `unit-model.ts:68` — `recon: 2.00`

**fix:** Change to `recon: 1.30`.

---

## SPEC_GAP (spec defines behavior with no implementation path yet)

These are not fidelity failures against existing code — they are features the spec describes that don't exist yet. Noted for Sprint 5 scoping.

---

### [SG-01] Playback controls not implemented
Spec (§Playback Controls): speed slider (0.5×/1×/2×), spacebar pause, ← → phase step, rewind button. `reveal-sequencer.ts` has `setRevealSpeed()` but it's in the dormant system. No UI component exists.

---

### [SG-02] Camera nudges not implemented
Spec (§Camera Nudge Rules): 0.5s ease-in/out push-in + 8° tilt on kills (Phase 5), counter kills (Phase 6), melee resolution (Phase 7), city capture (Phase 9). No camera manipulation in any sequencer.

---

### [SG-03] Phase 4 engagement detection flash not implemented
Spec (§Phase 4): both hexes flash white once + "ENGAGED" label for 1 second per clash. No engine event type for this; requires inference from Phase 4 engagement list in pipeline output.

---

### [SG-04] 25-order dynamic transition table not implemented
Spec (§Order Transition System): each of the 25 movement×ROE combinations has a specified execution mode (static/dynamic/procedural/divergence) and visual behavior. Hunt lock-on tracking, retreat-on-contact line redraw, ambush/tripwire line spawn — none implemented.

---

### [SG-05] Phase 9 city flag animation not implemented
Spec (§Phase 9): flag-raise animation + 0.5s camera push-in toward city. Only a color flip exists today.

---

### [SG-06] Phase 10 round-end banner + income breakdown not implemented
Spec (§Phase 10): victory/defeat banner slides in, income breakdown pops in top-right for 1.5s then fades. No round-end animation exists.

---

## PRIORITY RANKING

### Fix immediately (unblock Sprint 5)
1. **FG-01** — Wire `reveal-sequencer.ts`. One import + one function call in network-manager.ts.
2. **FG-03** — Pass `data.events` to the sequencer instead of `diffTurnEvents()` output.
3. **FG-06** — Add color param to `spawnAttackTracer()`. 2-line change.
4. **FG-10** — Recon scale 2.00 → 1.30. 1-line change.
5. **FG-09** — Explored fog opacity 0.25 → 0.6. 1-line change.
6. **FG-08** — Move range beige vs electric blue split. ~5-line change.

### Fix before playtest
7. **FG-02** — Implement `filterEventsForPlayer()` in state-filter.ts.
8. **FG-04** — LOS gating in reveal-sequencer.ts.
9. **FG-07** — Floating text variants.
10. **FG-05** — Planning→reveal continuity (large, part of Sprint 5 core work).

### Sprint 5 scope (spec gaps, expected)
11–16. SG-01 through SG-06.

---

## ONE-LINE PATCHES (can be committed now, no design decisions needed)

| File | Line | Change |
|------|------|--------|
| `fog-renderer.ts` | 37 | `opacity: 0.25` → `opacity: 0.6` |
| `unit-model.ts` | 68 | `recon: 2.00` → `recon: 1.30` |
| `effects-renderer.ts` | 77 | add `color: number = 0xffff88` param to `spawnAttackTracer` |
