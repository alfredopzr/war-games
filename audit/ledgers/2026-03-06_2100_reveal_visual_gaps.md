# Contract Gap Audit Ledger — Reveal Animation & Visual Language
**session:** 2026-03-06_2100
**project:** HexWar (hex-based tactical strategy game)
**scope:** `docs/REVEAL_ANIMATION_SPEC.md` + `docs/VISUAL_LANGUAGE.md` + `docs/EVENT_LOG_SPEC.md` vs client implementation
**initiated_by:** lead

This ledger is append-only. No entry may be edited or deleted after writing.
Corrections reference the original entry and append a new one.

---

## [SURFACE_UNIT] effects-renderer.ts:spawnDamageNumber
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/effects-renderer.ts:48-64
weight: 5
description: Spawns a CSS2D floating damage number. Uses `font-family:monospace; font-size:16px; font-weight:bold; color:#9a4a3a`. Rises at 0.8 u/s, fades at 1.5 α/s (~0.67s lifetime). Text is `-{damage}` for damage>0, `CAPTURED` for damage==0. No outline. No pop/hold/fade animation (just linear rise+fade). No faction color parameter — color is hardcoded rust. No skull icon support.

---

## [SURFACE_UNIT] effects-renderer.ts:spawnAttackTracer
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/effects-renderer.ts:67-92
weight: 3
description: Spawns a Three.js Line between two world positions. Default color `0xffff88` yellow, overridable via `color` parameter. Fades over 0.4s lifetime. Y-offset +0.3. No muzzle flash effect.

---

## [SURFACE_UNIT] effects-renderer.ts:spawnDeathMarker
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/effects-renderer.ts:95-127
weight: 2
description: Spawns an X-shaped line pair at world position. Color `0xff2222` bright red. Fades at 0.33 α/s (~3s lifetime). Y-offset +0.3. Matches VISUAL_LANGUAGE spec.

---

## [SURFACE_UNIT] unit-model.ts:hpColor
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/unit-model.ts:221-225
weight: 1
description: Returns HP bar fill color based on ratio. >0.6 returns `#6a8a48` green, >0.3 returns `#a08a40` yellow, else `#9a4a3a` red. HP bar background is `#333` (line 167). Matches VISUAL_LANGUAGE §HP Bar spec exactly.

---

## [SURFACE_UNIT] selection-renderer.ts:createROEIcon
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/selection-renderer.ts:281-302
weight: 3
description: Creates ROE icon geometry at a target hex. Hardcodes `color = 0x5599bb` (blue) on line 294. Does not accept a player/color parameter. Always renders blue regardless of whether the unit is friendly or enemy.

---

## [SURFACE_UNIT] reveal-sequencer.ts:animateEvent (damage case)
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:201-215
weight: 4
description: For 'damage' events: calls `getPlayerColor(event.actingPlayer, observingPlayer)` to get faction-resolved colors. Passes `colors.tracer` to `spawnAttackTracer`. Calls `spawnDamageNumber(defPos.x, defPos.y, defPos.z, event.damage)` — no color argument passed, so damage number is always hardcoded rust `#9a4a3a`.

---

## [SURFACE_UNIT] reveal-sequencer.ts:animateEvent (counter case)
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:234-248
weight: 4
description: For 'counter' events: uses `COUNTER_TRACER_COLOR` (orange `0xdd8833`) for tracer. Calls `spawnDamageNumber(defPos.x, defPos.y, defPos.z, event.damage)` — no "COUNTER" prefix on the floating text. Damage number shows plain `-{damage}` in rust color.

---

## [SURFACE_UNIT] reveal-sequencer.ts:animateEvent (kill case)
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:217-232
weight: 4
description: For 'kill' events: identical to 'damage' except also calls `spawnDeathMarker` and plays 'death' animation. No skull icon on the damage number — `spawnDamageNumber` has no skull support. Damage number is identical format to regular damage.

---

## [SURFACE_UNIT] reveal-sequencer.ts:animateEvent (heal case)
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:250-257
weight: 2
description: Calls `spawnDamageNumber(0, 0, 0, 0)` — spawns at world origin (0,0,0) with damage=0, which renders "CAPTURED" text (line 50 of effects-renderer.ts). No green color, no "+1 HP" text, no heal glow. Pure stub.

---

## [SURFACE_UNIT] reveal-sequencer.ts:animateEvent (reveal case)
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:259-265
weight: 2
description: Only fires a sound callback. No visual effect at all — no expanding dotted circle, no "REVEALED" text. Pure stub.

---

## [SURFACE_UNIT] reveal-sequencer.ts:animateEvent (capture case)
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:267-277
weight: 3
description: Parses cityKey to get hex position. Calls `spawnDamageNumber(pos.x, pos.y+0.3, pos.z, 0)` which renders "CAPTURED" text in rust color. No city color change, no flag animation, no "CITY CAPTURED" text (shows "CAPTURED" instead), not white bold.

---

## [SURFACE_UNIT] reveal-sequencer.ts:animateEvent (intercept case)
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:191-199
weight: 3
description: Spawns a damage number at the intercept hex. No red pulse effect, no "INTERCEPT" text — just a plain damage number in rust color.

---

## [SURFACE_UNIT] constants.ts:getPlayerColor
**agent:** effects-visual-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/constants.ts:42-50
weight: 3
description: Returns `REVEAL_COLORS[unitOwner]` if enemy, `REVEAL_COLORS[observingPlayer]` if friendly. Both player1 and player2 entries have `tracer: 0xffff88` (yellow). So `colors.tracer` is always yellow regardless of faction. Path and icon colors differ: player1=`0x5599bb` blue, player2=`0x9a4a3a` red.

---

## [GAP] GAP-V1: Damage number font/size/outline diverges from spec
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Floating Text + VISUAL_LANGUAGE.md §Effects
code_location: packages/client/src/renderer/effects-renderer.ts:51
what_exists: `font-family:monospace; font-size:16px; font-weight:bold` with no outline
what_missing: Spec requires "Bold sans-serif (Inter Black or Roboto Condensed Bold)", 28px world-space, 2px black outline
risk: Damage numbers will be small, wrong font, and hard to read against busy backgrounds without the outline. Legibility failure during reveal.

---

## [GAP] GAP-V2: Damage number animation model diverges from spec
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Floating Text
code_location: packages/client/src/renderer/effects-renderer.ts:57-63 + updateEffects:139-149
what_exists: Linear rise at 0.8 u/s + linear fade at 1.5 α/s simultaneously from spawn (~0.67s total)
what_missing: Spec requires 3-phase animation: pop 0.2s -> hold 0.8s -> fade 0.3s (1.3s total). Current implementation has no pop phase, no hold phase, and starts fading immediately.
risk: Numbers disappear too fast (0.67s vs 1.3s spec) and lack the pop-hold-fade readability curve. Players may miss damage values during fast action.

---

## [GAP] GAP-V3: Damage number color hardcoded instead of faction color
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Floating Text ("Color: Attacker's faction color")
code_location: packages/client/src/renderer/effects-renderer.ts:51 + reveal-sequencer.ts:210
what_exists: `spawnDamageNumber` hardcodes `color:#9a4a3a` rust. No color parameter exists. `reveal-sequencer.ts` calls `getPlayerColor()` but only uses `colors.tracer` for the tracer line — the damage number call passes no color.
what_missing: Damage number should use attacker's faction color. Spec says "Attacker's faction color (P1 yellow / P2 blood red)." Currently always rust regardless of attacker.
risk: Player cannot visually distinguish who dealt damage. Both players' damage looks identical.

---

## [GAP] GAP-V4: Counter-fire floating text missing "COUNTER" prefix
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Phase 6 + §Floating Text variants table
code_location: packages/client/src/renderer/reveal-sequencer.ts:243
what_exists: `spawnDamageNumber(defPos.x, defPos.y, defPos.z, event.damage)` — plain `-{damage}` text in rust
what_missing: Spec requires "COUNTER" tag prefix on floating text + orange color for counter-fire. Current code only uses orange for the tracer, not the text.
risk: Player cannot distinguish Phase 5 initiative fire from Phase 6 counter-fire in the floating text. Only the tracer color differs (yellow vs orange).

---

## [GAP] GAP-V5: Attack tracer color always yellow — spec says faction color for Phase 5
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Phase 5 ("Muzzle flash color: blue/faction color") + VISUAL_LANGUAGE.md §Reveal Effects ("Phase 5: Faction color")
code_location: packages/client/src/renderer/constants.ts:30-33
what_exists: `REVEAL_COLORS` has `tracer: 0xffff88` (yellow) for both player1 and player2. `getPlayerColor()` returns this yellow for all tracers. VISUAL_LANGUAGE.md §Effects separately documents tracers as `0xffff88` yellow.
what_missing: REVEAL_ANIMATION_SPEC §Phase 5 says "Muzzle flash + tracer line" in faction color. VISUAL_LANGUAGE §Reveal Effects says Phase 5 initiative fire uses "Faction color." But the constants define tracer as yellow for both players. Internal contradiction between VISUAL_LANGUAGE §Effects (yellow) and §Reveal Effects (faction color).
risk: Spec self-contradiction. VISUAL_LANGUAGE.md §Effects says yellow, VISUAL_LANGUAGE.md §Reveal Effects says faction color, REVEAL_ANIMATION_SPEC says faction color. Code follows the yellow definition. Need design decision to resolve.

---

## [GAP] GAP-V6: Heal effect is a broken stub
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: STRUCTURAL
spec_source: REVEAL_ANIMATION_SPEC.md §Phase 8 + §Floating Text variants
code_location: packages/client/src/renderer/reveal-sequencer.ts:251-252
what_exists: `spawnDamageNumber(0, 0, 0, 0)` — spawns at world origin (0,0,0) with damage=0, which renders "CAPTURED" text (effects-renderer.ts:50 — `damage > 0 ? `-${damage}` : 'CAPTURED'`). Wrong text, wrong position.
what_missing: Spec requires: soft green heal glow + green "+1 HP" float at the healed unit's position. No heal glow effect exists. No green color variant in spawnDamageNumber.
risk: Heal events render "CAPTURED" at the world origin. Actively misleading if heal events fire during gameplay.

---

## [GAP] GAP-V7: Reveal effect has no visual — sound-only stub
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: STRUCTURAL
spec_source: REVEAL_ANIMATION_SPEC.md §Phase 8 ("expanding dotted circle that reveals hidden enemies, 'REVEALED' text in white")
code_location: packages/client/src/renderer/reveal-sequencer.ts:259-265
what_exists: Only fires `callbacks.onSound?.('reveal')`. No visual spawned.
what_missing: Expanding dotted circle from scout position + "REVEALED" text in white. No visual implementation at all.
risk: Scout reveal — a core intelligence mechanic — has zero visual feedback. Players will not see when their scouts reveal enemies.

---

## [GAP] GAP-V8: City capture visual incomplete
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Phase 9
code_location: packages/client/src/renderer/reveal-sequencer.ts:267-277
what_exists: Parses cityKey, calls `spawnDamageNumber(pos.x, pos.y+0.3, pos.z, 0)` which shows "CAPTURED" in rust `#9a4a3a`. Sound callback fires.
what_missing: Spec requires: (1) city instantly changes to faction color — no color change code exists, (2) flag-raise animation — not implemented, (3) "CITY CAPTURED" text in white bold — text says "CAPTURED" not "CITY CAPTURED", color is rust not white, (4) 0.5s camera push-in — not implemented.
risk: City capture is a major game event. Current visual is a small rust-colored "CAPTURED" label. No territory color flip means player can't see ownership change during reveal.

---

## [GAP] GAP-V9: Intercept visual missing red pulse and "INTERCEPT" text
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Phase 3 ("red pulse + 'INTERCEPT' ping for 0.4s")
code_location: packages/client/src/renderer/reveal-sequencer.ts:191-199
what_exists: `spawnDamageNumber(pos.x, pos.y+0.3, pos.z, event.damage)` — plain damage number in rust.
what_missing: Spec requires: red pulse effect on hex + "INTERCEPT" text ping for 0.4s. No pulse effect. No "INTERCEPT" label. Just a generic damage number.
risk: Intercept (passive damage when entering threat zones) is visually indistinguishable from regular damage. Player can't tell when units are being intercepted during movement.

---

## [GAP] GAP-V10: ROE icons always blue — no red for enemy units
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: VISUAL_LANGUAGE.md §Selection ("Friendly paths/icons = blue 0x5599bb, Enemy paths/icons = red 0x9a4a3a") + REVEAL_ANIMATION_SPEC.md §Order Transition System
code_location: packages/client/src/renderer/selection-renderer.ts:294
what_exists: `const color = 0x5599bb` hardcoded. `createROEIcon` does not accept a color/player parameter.
what_missing: Enemy ROE icons should be red (`0x9a4a3a`). The function has no way to receive player context. Currently only renders friendly unit ROE icons (line 399 iterates `friendlyUnits`), so enemy icons are not rendered at all yet — but when they are, the color will be wrong without a parameter.
risk: Low immediate risk (enemy ROE icons not rendered during planning). Will become a bug when reveal-phase enemy icon rendering is added.

---

## [GAP] GAP-V11: Kill damage number has no skull icon
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Floating Text variants ("Kill: `-14` + skull icon — Skull appended")
code_location: packages/client/src/renderer/reveal-sequencer.ts:226 + effects-renderer.ts:48-64
what_exists: `spawnDamageNumber(defPos.x, defPos.y, defPos.z, event.damage)` — identical call to regular damage. `spawnDamageNumber` has no skull/icon parameter and no way to append icons.
what_missing: Kill events should append a skull icon to the damage number. `spawnDamageNumber` API does not support any text decoration or icon attachment.
risk: Players cannot visually distinguish a kill shot from regular damage in the floating text. Only the death animation and death marker differentiate kills.

---

## [GAP] GAP-V12: Death marker matches spec — NO GAP
**agent:** effects-visual-auditor
**phase:** 7

type: N/A
severity: N/A
spec_source: VISUAL_LANGUAGE.md §Effects
code_location: packages/client/src/renderer/effects-renderer.ts:95-127
what_exists: Color `0xff2222`, fadeRate 0.33 α/s, ~3s lifetime
what_missing: Nothing. Implementation matches spec.
risk: None.

---

## [GAP] GAP-V13: HP bar colors match spec — NO GAP
**agent:** effects-visual-auditor
**phase:** 7

type: N/A
severity: N/A
spec_source: VISUAL_LANGUAGE.md §HP Bar
code_location: packages/client/src/renderer/unit-model.ts:221-225, 167
what_exists: >60% `#6a8a48`, 30-60% `#a08a40`, <30% `#9a4a3a`, bg `#333`
what_missing: Nothing. Implementation matches spec exactly.
risk: None.

---

## [GAP] GAP-V14: Muzzle flash effect not implemented
**agent:** effects-visual-auditor
**phase:** 7

type: 6 (design doc <-> engine divergence)
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Phase 5 ("Muzzle flash + tracer line from shooter to target")
code_location: packages/client/src/renderer/reveal-sequencer.ts:201-215 + effects-renderer.ts
what_exists: Attack tracer line + damage number + attack animation. No muzzle flash particle/light effect.
what_missing: Muzzle flash VFX at the attacker's position. `effects-renderer.ts` has no muzzle flash function. No flash/particle system exists.
risk: Fire events lack the visual punch the spec describes. Tracer line alone is less readable than flash+tracer.

---

## [GAP] GAP-F1: Server sends unfiltered events to both players
**agent:** fog-visibility-auditor
**phase:** 7

type: missing implementation
severity: critical
spec_source: `docs/EVENT_LOG_SPEC.md` lines 95-96 ("The server filters BattleEvent[] per player before sending in the turn-result payload."), `docs/REVEAL_ANIMATION_SPEC.md` line 30 ("The server filters BattleEvent[] per player before sending in the turn-result payload.")
code_location: `packages/server/src/game-loop.ts:340-381`
what_exists: `resolveSimultaneousTurn()` drains `state.pendingEvents` into `allEvents` (line 340), then on lines 375-382 iterates both players and emits `turn-result` with `events: allEvents` identically to both. The state is filtered per player via `filterStateForPlayer()`, but `allEvents` is the same unfiltered array for both players.
what_missing: No per-player event filtering exists anywhere. The spec requires three filtering rules (own-unit always include, enemy-only include only if position in LOS, structural always include). No function implementing these rules exists in `state-filter.ts` or `game-loop.ts`. The server leaks full enemy movement, combat, and positioning data to both players via the event stream.
risk: **Information leak.** Both players receive every BattleEvent including enemy-only events outside their LOS. A player can read the raw event payload to see all enemy movements, damage, kills, and positions regardless of fog of war. This completely defeats fog of war for any player who inspects network traffic.

---

## [GAP] GAP-F2: No event filtering function exists
**agent:** fog-visibility-auditor
**phase:** 7

type: missing implementation
severity: critical
spec_source: `docs/EVENT_LOG_SPEC.md` lines 99-102 (three filtering rules: own-unit, enemy-only, structural)
code_location: `packages/server/src/state-filter.ts` (entire file, lines 1-229)
what_exists: `filterStateForPlayer()` filters the GameState (units, resources) per player. `filterEnemyUnits()` filters enemy unit visibility in the state snapshot. No function exists that filters `BattleEvent[]`.
what_missing: A function like `filterEventsForPlayer(events: BattleEvent[], playerId: PlayerId, losSet: Set<string>): BattleEvent[]` that implements the three rules: (1) own-unit events always included, (2) enemy-only events included only if a position field is in LOS, (3) structural events (round-end, game-end, koth-progress, objective-change) always included. The spec in EVENT_LOG_SPEC.md lines 97-108 defines this contract precisely but zero code implements it.
risk: Blocks GAP-F1. Without this function, the server cannot filter events. The entire fog-gated reveal system described in the spec is non-functional at the transport layer.

---

## [GAP] GAP-F3: No "from fog" attacker rendering in reveal-sequencer
**agent:** fog-visibility-auditor
**phase:** 7

type: missing implementation
severity: high
spec_source: `docs/REVEAL_ANIMATION_SPEC.md` lines 24 ("tracer originates from the fog edge, not from the enemy's position. The attacker's identity is unknown"), `docs/EVENT_LOG_SPEC.md` lines 103-104 ("the client renders the attacker as 'from fog' -- tracer originates from the LOS boundary, attacker identity unknown")
code_location: `packages/client/src/renderer/reveal-sequencer.ts:201-248` (damage/kill/counter cases in `animateEvent`)
what_exists: The `damage` case (line 201-215) unconditionally uses `event.attackerPosition` to compute `attPos` and spawns a tracer from attacker to defender. The `kill` case (line 217-232) does the same. The `counter` case (line 234-248) also uses `event.attackerPosition` directly. The `observingPlayer` parameter is passed into `animateEvent` but is only used for color selection via `getPlayerColor()`, never for LOS checking.
what_missing: No code checks whether `event.attackerPosition` is within the observing player's LOS set. No "from fog" tracer logic exists (computing fog edge intersection, hiding attacker identity). Even if GAP-F1/F2 are fixed and the server filters events, the spec says own-unit damage events are always included even when the attacker is outside LOS -- the client must then render the tracer as originating from the fog boundary. This client-side rendering logic does not exist.
risk: When a friendly unit takes damage from an enemy outside LOS, the tracer will render from the enemy's true position, revealing their exact location even through fog. Violates the core intelligence mechanic.

---

## [GAP] GAP-F4: Progressive fog update contradicts "frozen at tick-start LOS" spec
**agent:** fog-visibility-auditor
**phase:** 7

type: spec-code contradiction
severity: medium
spec_source: `docs/VISUAL_LANGUAGE.md` line 114 ("During reveal: fog state is frozen at tick-start LOS.")
code_location: `packages/client/src/network/network-manager.ts:271-288` (onUnitArrived callback), `packages/client/src/components/BattleHUD.tsx:234-254` (onUnitArrived callback)
what_exists: Both the online path (network-manager.ts:271-288) and the vsAI path (BattleHUD.tsx:234-254) register `onUnitArrived` callbacks that dynamically recalculate visibility as friendly units move during reveal. When a friendly unit arrives at a new hex, `calculateVisibility()` is called with updated positions, `setVisibleHexes()` updates the store, and explored hexes are accumulated. This progressively clears fog as the reveal plays.
what_missing: The spec says fog is "frozen at tick-start LOS" during reveal. The code does the opposite: it progressively updates fog as friendly units move through the reveal animation. These are mutually exclusive behaviors. Note: REVEAL_ANIMATION_SPEC.md line 30 says LOS is computed "from their unit positions at Phase 1 snapshot", which also implies frozen. Both spec docs agree on frozen; code disagrees.
risk: The spec and code disagree on a fundamental visibility mechanic. Either the spec is wrong (progressive fog is the intended design) or the code is wrong (fog should be frozen). The progressive approach is arguably better gameplay (units reveal fog as they move forward), but it contradicts both written specs. This needs a design decision to resolve the contradiction.

---

## [GAP] GAP-F5: vsAI calculateVisibility call missing unitStats parameter
**agent:** fog-visibility-auditor
**phase:** 7

type: bug (latent)
severity: medium
spec_source: `packages/engine/src/vision.ts:27-32` (function signature: `unitStats` is optional, defaults to `UNIT_STATS` from units.ts)
code_location: `packages/client/src/components/BattleHUD.tsx:245` vs `packages/client/src/network/network-manager.ts:281`
what_exists: BattleHUD.tsx line 245 calls `calculateVisibility(syntheticUnits, gameState.map.terrain, gameState.map.elevation)` -- no `unitStats` parameter. network-manager.ts line 281 calls `calculateVisibility(syntheticUnits, newState.map.terrain, newState.map.elevation, newState.unitStats)` -- includes `unitStats`.
what_missing: The vsAI path omits `unitStats`. In vision.ts line 47, when `unitStats` is undefined, the fallback is `UNIT_STATS` imported from `units.ts`. If `state.unitStats` matches the engine-default `UNIT_STATS` (which it currently does), the behavior is identical and there is no functional bug today. However, if `unitStats` ever diverges from the hardcoded defaults (e.g., per-game stat modifiers, balance patches applied at game creation), the vsAI path would use stale vision ranges while the online path would use correct ones.
risk: Latent bug. Currently no functional difference because `state.unitStats` equals `UNIT_STATS`. Will silently break if unit stats become per-game configurable. The inconsistency between the two code paths is a maintenance hazard.

---

## [GAP] GAP-F6: No explored-vs-LOS gating for enemy unit rendering (accidentally correct)
**agent:** fog-visibility-auditor
**phase:** 7

type: fragile implementation
severity: low
spec_source: `docs/VISUAL_LANGUAGE.md` line 109 ("Explored (previously seen) ... No enemy visuals, no order visuals."), `docs/REVEAL_ANIMATION_SPEC.md` line 17 ("Explored hexes show terrain but no enemy activity.")
code_location: `packages/client/src/renderer/unit-model.ts:289-339` (syncUnitModels function)
what_exists: `syncUnitModels()` at line 304 determines enemy unit visibility with: `const isVisible = isBuildPhase ? isOwn : (isOwn || visibleHexes.has(key))`. This checks whether the enemy unit's hex is in the `visibleHexes` set (active LOS). The `exploredHexes` set is never consulted -- the function does not distinguish between explored-but-not-visible and actively-visible hexes.
what_missing: The current code is actually correct because `visibleHexes` only contains LOS hexes (not explored hexes). Enemy units on explored-but-not-LOS hexes will not render because `visibleHexes.has(key)` returns false. The spec requirement "explored shows terrain but no enemy activity" is met by accident. However, there is no explicit guard or comment documenting that `visibleHexes` must be strictly the LOS set and must never include explored hexes.
risk: Low immediate risk (behavior is correct). Fragile -- correctness depends on `visibleHexes` being strictly LOS, which is an implicit contract. A future developer could reasonably pass explored hexes into `visibleHexes` and break fog of war for enemy units.

---

## [SURFACE_UNIT] fog-renderer.ts:renderFog color values
**agent:** fog-visibility-auditor
**phase:** 7

unit_type: verified match
location: `packages/client/src/renderer/fog-renderer.ts:20-39` + `packages/client/src/renderer/constants.ts:18`
weight: 1
description: Unexplored fog uses `FOG_NEVER_SEEN` (0x16160E) at full opacity via `fogTopMaterial` (no transparency set). Explored wash uses `FOG_NEVER_SEEN` (0x16160E) at opacity 0.6 via `exploredWashMaterial` (transparent:true, opacity:0.6). Both match VISUAL_LANGUAGE.md spec exactly. LOS border ring uses `0xe8e4d8` (line 42-46) -- not documented in spec but does not conflict.

---

## [SURFACE_UNIT] onUnitArrived tracks friendly units only
**agent:** fog-visibility-auditor
**phase:** 7

unit_type: verified correct
location: `packages/client/src/network/network-manager.ts:246-253,271-272` + `packages/client/src/components/BattleHUD.tsx:220-225,234-235`
weight: 2
description: Both paths populate `replayPositions` only for the observing player's own units (network-manager.ts checks `unit.owner === myPlayer` at line 249; BattleHUD.tsx checks `snap.owner === 'player1'` at line 222). The `onUnitArrived` callback early-returns if the unitId is not in `replayPositions` (network-manager.ts:272, BattleHUD.tsx:235). Only friendly unit positions drive fog recalculation, matching the spec requirement that LOS is computed from the observing player's own units.

---

## Transport-Store Auditor Findings

### [SURFACE_UNIT] Event transport path (engine -> server -> client -> renderer)
**agent:** transport-store-auditor
**phase:** 2

unit_type: data_flow
weight: 5
description: Traced the full online-mode path. (1) Engine: `resolveTurn()` appends events to `state.pendingEvents` (types.ts:182). (2) Server: `resolveSimultaneousTurn()` drains into `allEvents` (game-loop.ts:340 — `const allEvents = [...state.pendingEvents]; state.pendingEvents = [];`). (3) Server emits `turn-result` with `events: allEvents` (game-loop.ts:377-381). (4) Client: `network-manager.ts` receives `data.events` in `turn-result` handler (network-manager.ts:218-223). (5) Client passes `data.events` directly to `startReveal()` (network-manager.ts:265). (6) Renderer: `reveal-sequencer.ts` groups by `pipelinePhase` and schedules animations (reveal-sequencer.ts:69-112). No transformation or field stripping occurs on the non-round-ending path. The `BattleEvent[]` array passes through unchanged.

---

### [GAP] GAP-T1: Events from final turn of a round are lost in online mode
**agent:** transport-store-auditor
**phase:** 7

type: 4 (data loss at boundary)
severity: CRITICAL
spec_source: EVENT_LOG_SPEC.md section Transport — "The server drains pendingEvents after the call. The array is sent in the turn-result payload."
code_location: `packages/server/src/game-loop.ts:363-415`
what_exists: When `roundEnd.roundOver` is true (line 363), the server does NOT emit `turn-result`. It branches: game-over emits `game-over` (line 396) with NO events field; round-continues emits `round-end` (lines 401-409) with NO events field. The `allEvents` array (containing all combat events — moves, damage, kills, captures from that final turn) is pushed to `room.turnLog` (lines 348-356) but never sent to client.
what_missing: The final turn's `BattleEvent[]` must be included in whatever socket message ends the round. Client handlers `round-end` (network-manager.ts:302-322) and `game-over` (network-manager.ts:324-332) apply state immediately with no reveal — they never call `startReveal()`.
risk: The decisive turn of every round — the one that triggers elimination, KotH, or turn-limit — has no reveal animation. State jumps from pre-resolution to post-round. All movement, combat, kills, and captures from the most dramatic turn are invisible.

---

### [GAP] GAP-T2: No fog filtering of BattleEvent[] per player
**agent:** transport-store-auditor
**phase:** 7

type: 5 (spec-mandated behavior missing)
severity: MEDIUM
note: Independently confirmed. Overlaps with GAP-F1 and GAP-F2 from fog-visibility-auditor.
spec_source: EVENT_LOG_SPEC.md section Fog Filtering — "The server filters BattleEvent[] per player before sending in the turn-result payload." REVEAL_ANIMATION_SPEC.md section Visibility Rule — same statement.
code_location: `packages/server/src/game-loop.ts:374-382`, `packages/server/src/state-filter.ts`
what_exists: game-loop.ts:377-381 sends `events: allEvents` identically to both players via per-player loop, but only the state is filtered per player — the events array is shared. `state-filter.ts` has no function for filtering `BattleEvent[]`. No `filterEvents`, `filterBattleEvents`, or similar function exists anywhere in the server package.
what_missing: Per-player event filtering based on LOS set. Both specs state this explicitly. Without it, both players receive the full unfiltered event stream including events involving only enemy units entirely outside their LOS.
risk: Breaks the core information asymmetry mechanic. Scout placement (described as "the primary intelligence mechanic" in both specs) provides no advantage — both players see everything regardless.

---

### [SURFACE_UNIT] vsAI event path roundtrip
**agent:** transport-store-auditor
**phase:** 2

unit_type: data_flow
weight: 3
description: BattleHUD.tsx `resolveSimultaneousLocal()` drains `gameState.pendingEvents` (line 146-149), wraps each as `BattleLogEntry { turn, event }`, then extracts back via `logEntries.map(e => e.event)` (line 216). No data loss — the wrapper adds only `turn: number` and `.event` holds the original `BattleEvent` reference unchanged.

---

### [GAP] GAP-T3: Store has no field for BattleEvent[] — reveal events are fire-and-forget
**agent:** transport-store-auditor
**phase:** 7

type: 3 (missing state for spec'd feature)
severity: LOW
spec_source: REVEAL_ANIMATION_SPEC.md section Playback Controls — "Rewind: Button — Jump back 5 seconds"
code_location: `packages/client/src/store/game-store.ts`
what_exists: Store has `turnReplayEvents: TurnEvent[]` (line 90, legacy, never populated), `battleLog: BattleLogEntry[]` (line 81, capped at 50 entries on line 383), and `isReplayPlaying: boolean` (line 91). Events are passed directly to `startReveal()` as a function argument (network-manager.ts:265, BattleHUD.tsx:228) without being stored in any accessible state field.
what_missing: A `currentTurnBattleEvents: BattleEvent[]` field (or equivalent) in the store. Without it, rewind/rewatch is impossible — once `startReveal()` consumes the events, they exist only in the closure's local scope and are garbage-collected after reveal completes.
risk: Rewind playback control cannot be implemented. The `battleLog` contains events but is capped at 50 entries (line 383 `.slice(0, 50)`) and loses phase ordering.

---

### [GAP] GAP-T4: turnReplayEvents and setTurnReplayEvents are dead state
**agent:** transport-store-auditor
**phase:** 7

type: 2 (dead code / orphaned state)
severity: LOW
spec_source: N/A (internal consistency)
code_location: `packages/client/src/store/game-store.ts:4,90,137,394,474`
what_exists: Store imports `TurnEvent` from `replay-sequencer.ts` (line 4), declares `turnReplayEvents: TurnEvent[]` (line 90), `setTurnReplayEvents` (line 137/394), initializes to `[]` (line 172), and resets in `resetGame` (line 474). Neither `turnReplayEvents` nor `setTurnReplayEvents` are called anywhere — all replay is now driven by `startReveal()` with `BattleEvent[]`. The `isReplayPlaying` flag (line 91) IS used by the new system via `setReplayPlaying()`.
what_missing: Cleanup. These fields are vestiges of the pre-Sprint-3 `diffTurnEvents`-based replay system.
risk: Confusion for future developers. Minor memory waste.

---

### [GAP] GAP-T5: Skip-replay keyboard handler calls wrong function (BUG)
**agent:** transport-store-auditor
**phase:** 7

type: 1 (functional bug)
severity: HIGH
spec_source: REVEAL_ANIMATION_SPEC.md section Playback Controls — "Pause: Spacebar"
code_location: `packages/client/src/components/BattleHUD.tsx:13,290-299,429-435`
what_exists: BattleHUD.tsx line 13 imports `skipReplay` from `replay-sequencer.ts` AND `skipReveal` from `reveal-sequencer.ts`. The keyboard handler (lines 290-299) calls `skipReplay()` on Space key. The "Skip Replay" button (lines 429-435) also calls `skipReplay`. Both call into the OLD `replay-sequencer.ts` which clears `replayTimers` and calls `finishReplay()`. The NEW system uses `reveal-sequencer.ts` with separate `revealTimers` and `finishReveal()`.
what_missing: Both the keyboard handler and button should call `skipReveal()` (already imported on line 14) instead of `skipReplay()`.
risk: Pressing Space or clicking "Skip Replay" during reveal does nothing useful. It clears the old system's empty timer array and calls the old system's no-op finish. The reveal animation continues playing to completion. `revealActive` stays true. The `revealOnComplete` callback is never fired by the skip, so state application hangs until the reveal naturally finishes. The user cannot skip the 18-22 second reveal.

---

### [SURFACE_UNIT] State application timing during reveal
**agent:** transport-store-auditor
**phase:** 2

unit_type: state_lifecycle
weight: 4
description: Both online (network-manager.ts:266-269) and vsAI (BattleHUD.tsx:229-233) defer `setGameState(newState)` / `applyFinalState()` inside `onComplete` callback. During reveal, store's `gameState` reflects pre-resolution state. Unit visual positions come from Three.js tweens via `tweenUnitTo()` (unit-model.ts), not from store positions. Both paths store `preRevealUnitPositions` (network-manager.ts:256-262, BattleHUD.tsx:133-139) for selection renderer. This is intentional and correct — renderer and store sync up when `onComplete` fires.

---

### [GAP] GAP-T6: calculateVisibility call signature inconsistency between vsAI and online
**agent:** transport-store-auditor
**phase:** 7

type: 6 (divergence between paths)
severity: LOW
note: Independently confirmed. Overlaps with GAP-F5 from fog-visibility-auditor.
spec_source: N/A (internal consistency)
code_location: `packages/client/src/components/BattleHUD.tsx:245`, `packages/client/src/network/network-manager.ts:281`
what_exists: BattleHUD.tsx:245 calls `calculateVisibility(syntheticUnits, gameState.map.terrain, gameState.map.elevation)` with 3 args. network-manager.ts:281 calls `calculateVisibility(syntheticUnits, newState.map.terrain, newState.map.elevation, newState.unitStats)` with 4 args including `unitStats`.
what_missing: Consistent argument passing. If `unitStats` is required for correct per-unit-type vision ranges, the vsAI path computes wrong visibility during reveal fog updates.
risk: Currently no functional difference (state.unitStats matches engine defaults). Will silently break if unit stats become per-game configurable.

---

### [GAP] GAP-T7: No adapter between BattleEvent and TurnEvent — parallel type systems
**agent:** transport-store-auditor
**phase:** 7

type: 2 (parallel systems, no bridge)
severity: LOW
spec_source: EVENT_LOG_SPEC.md section Consumer Contract — "Sprint 5 migrates [replay-sequencer] to consume BattleEvent[] from the turn result directly."
code_location: `packages/client/src/renderer/replay-sequencer.ts:15-23`, `packages/engine/src/types.ts:285-454`
what_exists: `TurnEvent` has 6 variants with field names like `attackerPos`, `killedBy`, `cityHex`. `BattleEvent` has 16 variants with field names like `attackerPosition`, `attackerId`, `cityKey`. No adapter function exists. The new `reveal-sequencer.ts` consumes `BattleEvent[]`. The old `replay-sequencer.ts` consumes `TurnEvent[]`. They never interchange data.
what_missing: The old system is effectively dead (see GAP-T4), so no adapter is needed now. Spec acknowledges migration is Sprint 5.
risk: Low. If someone mistakenly calls `startReplay()` with BattleEvent data, it would fail silently due to structural mismatch.

---

### [SURFACE_UNIT] Event ordering guarantee
**agent:** transport-store-auditor
**phase:** 2

unit_type: invariant
weight: 3
description: EVENT_LOG_SPEC.md section Event Ordering states events in `pendingEvents` are ordered by pipeline phase (3->5->6->8->9->10). Verified: `resolveTurn()` in resolution-pipeline.ts executes phases sequentially, each appending to `state.pendingEvents`. Ordering is guaranteed by construction. `reveal-sequencer.ts:132-154` `groupByPhase()` groups consecutive events with same `pipelinePhase` — would create spurious extra groups if events arrived out of order, but they never do.

---

### [GAP] GAP-T8: round-end/game-end actingPlayer defaults to 'player1' on draw
**agent:** transport-store-auditor
**phase:** 7

type: 6 (semantic inaccuracy)
severity: LOW
spec_source: EVENT_LOG_SPEC.md section Event Type Table — BattleEventRoundEnd has `actingPlayer: PlayerId`
code_location: `packages/server/src/game-loop.ts:366`, `packages/client/src/components/BattleHUD.tsx:175`
what_exists: Both construct `round-end` events with `actingPlayer: roundEnd.winner ?? 'player1'`. On a draw (`winner: null`), `actingPlayer` is `'player1'`.
what_missing: Draw has no acting player. The `??` fallback is misleading — it implies player1 caused the round to end. Could affect downstream consumers that filter by `actingPlayer`.
risk: Low. Semantic issue only. No current consumer filters round-end events by `actingPlayer`.

---

## Reveal Sequencer Auditor Findings

---

### [SURFACE_UNIT] reveal-sequencer.ts:PHASE_TIMING
**agent:** reveal-sequencer-auditor
**phase:** 2

unit_type: module.constant
location: packages/client/src/renderer/reveal-sequencer.ts:33-41
weight: 5
description: PHASE_TIMING constant defines per-phase animation durations. Entries for phases 3, 5, 6, 7, 8, 9, 10. Phase 4 has NO entry (falls through to DEFAULT_TIMING at line 43). Exact values: Phase 3 perEventMs=900 staggerMs=50 pauseAfterMs=400, Phase 5 perEventMs=1000 staggerMs=200 pauseAfterMs=300, Phase 6 perEventMs=1000 staggerMs=200 pauseAfterMs=300, Phase 7 perEventMs=1200 staggerMs=0 pauseAfterMs=300, Phase 8 perEventMs=600 staggerMs=100 pauseAfterMs=200, Phase 9 perEventMs=1000 staggerMs=0 pauseAfterMs=500, Phase 10 perEventMs=2000 staggerMs=0 pauseAfterMs=0.

---

### [SURFACE_UNIT] reveal-sequencer.ts:startReveal
**agent:** reveal-sequencer-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:69-112
weight: 5
description: Main entry point. Accepts BattleEvent[], elevationMap, observingPlayer, and RevealCallbacks (onComplete, onUnitArrived, onPhaseStart, onSound). Groups events by pipelinePhase via groupByPhase(), schedules them with stagger via nested setTimeout calls, and fires onPhaseStart at each phase boundary. No pause/step/rewind support -- only forward playback with speed scaling via revealSpeed divisor.

---

### [SURFACE_UNIT] reveal-sequencer.ts:skipReveal
**agent:** reveal-sequencer-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:114-121
weight: 3
description: Cancels all pending timers in revealTimers[], calls clearEffects() and clearAllTweens(), then finishReveal(). This is the only playback interruption mechanism -- instant skip to end.

---

### [SURFACE_UNIT] reveal-sequencer.ts:setRevealSpeed
**agent:** reveal-sequencer-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:65-67
weight: 2
description: Sets module-level revealSpeed variable used to divide all setTimeout delays in startReveal() and animateEvent(). Accepts any number. No UI wiring -- BattleHUD.tsx does not call setRevealSpeed or expose a speed slider.

---

### [SURFACE_UNIT] reveal-sequencer.ts:groupByPhase
**agent:** reveal-sequencer-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:132-154
weight: 3
description: Groups BattleEvent[] into contiguous PhaseGroup[] by pipelinePhase field. Preserves emission order from the pipeline. Each group animates concurrently with stagger, then pauses before the next group starts.

---

### [SURFACE_UNIT] reveal-sequencer.ts:animateEvent
**agent:** reveal-sequencer-auditor
**phase:** 2

unit_type: module.function
location: packages/client/src/renderer/reveal-sequencer.ts:162-316
weight: 5
description: Switch on event.type to schedule visual effects via setTimeout. Returns duration in ms. Handles 16 event types: move (tweenUnitTo 800ms + fog callback at 50%), intercept (damage number 400ms), damage (tracer + damage number + hit/attack anims 800ms), kill (tracer + damage number + death anim + death marker 1000ms), counter (orange tracer + damage number 800ms), heal (broken stub 600ms), reveal (sound only 600ms), capture/recapture (damage number at city 1000ms), capture-damage (sound only 500ms), capture-death (death anim 800ms), objective-change/koth-progress (no-op 300ms), round-end/game-end (no-op 2000ms), melee (melee anims both units 1200ms).

---

### [GAP] GAP-R1: Phase 3 timing does not achieve spec's 6-8s total duration
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 2
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Overall Reveal Flow ("Phase 3: units move along their existing planned lines (6-8s)")
code_location: packages/client/src/renderer/reveal-sequencer.ts:33-34
what_exists: Phase 3 timing: perEventMs=900, staggerMs=50, pauseAfterMs=400. Total Phase 3 duration = max(maxEventEnd, 900) + 400. With N move events, maxEventEnd = (N-1)*50 + 800 (move duration). For 1 unit: max(800, 900)+400 = 1300ms. For 10 units: max(450+800, 900)+400 = 1650ms. For 20 units: max(950+800, 900)+400 = 2150ms.
what_missing: Spec says Phase 3 should be 6-8 seconds total. The code produces 1.3-2.2s for realistic unit counts (1-20 units). This is 3-6x shorter than spec. The code has no mechanism to stretch Phase 3 to a fixed total duration -- each move event is only 800ms with 50ms stagger. Multi-step paths (units moving multiple hexes) would need per-hex tweens to fill 6-8s.
risk: Movement phase will feel extremely rushed. Units zip to their destinations in ~1-2 seconds instead of the spec's intended 6-8 second cinematic movement.

---

### [GAP] GAP-R2: Playback controls -- pause, step, rewind not implemented
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 1
severity: STRUCTURAL
spec_source: REVEAL_ANIMATION_SPEC.md §Playback Controls
code_location: packages/client/src/renderer/reveal-sequencer.ts:56-67
what_exists: `setRevealSpeed(speed)` exists but is not wired to any UI. `skipReveal()` exists. No pause state, no step mechanism, no rewind capability. The architecture uses one-shot setTimeout chains -- once scheduled, timers cannot be paused or rewound.
what_missing: Spec requires: (1) Speed slider with 0.5x/1x/2x presets -- `setRevealSpeed` exists but no UI calls it. (2) Pause on spacebar -- not implemented; spacebar currently calls `skipReplay()` from the non-existent legacy module (see GAP-R10/GAP-T5). (3) Step forward/backward with arrow keys, one phase at a time -- not implemented. (4) Rewind button, jump back 5 seconds -- not implemented. The setTimeout architecture makes pause/step/rewind fundamentally impossible without a rewrite to a tick-based timeline.
risk: Players cannot slow down, pause, or step through combat. The spec calls this implementation item #1 in priority. Core legibility feature missing.

---

### [GAP] GAP-R3: "REVEAL" flash banner not rendered
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 1
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Overall Reveal Flow ("Planning ends -> 'REVEAL' flash"), §Planning -> Reveal Continuity
code_location: packages/client/src/renderer/reveal-sequencer.ts:88-92, packages/client/src/components/BattleHUD.tsx:255-257
what_exists: `onPhaseStart` callback fires at each phase boundary. BattleHUD.tsx handler (line 255-257) logs `"[REVEAL] Phase ${phase}"` to console. No DOM element, overlay, or Three.js effect renders a "REVEAL" flash.
what_missing: A visual "REVEAL" flash/banner that fires once before Phase 3 begins. This is the single visual seam between planning and reveal.
risk: The planning-to-reveal transition has no visual punctuation. Players may not realize when reveal starts.

---

### [GAP] GAP-R4: Phase 4 engagement detection -- no event type exists, no visuals
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 1
severity: STRUCTURAL
spec_source: REVEAL_ANIMATION_SPEC.md §Phase 4 -- Engagement Detection ("0.3s per clash, both hexes flash white, 'ENGAGED' label")
code_location: not implemented
what_exists: The BattleEvent union in packages/engine/src/types.ts:438-454 has 16 event types. None represents engagement detection. The resolution pipeline has a Phase 4 (engagement detection) that produces `Engagement[]` data structures (types.ts:258-265), but these are internal pipeline state -- never emitted as BattleEvents. PHASE_TIMING in reveal-sequencer.ts:33-41 has no entry for phase 4. The animateEvent switch (lines 171-315) has no engagement-detection case.
what_missing: (1) A `BattleEventEngagement` type in the BattleEvent union. (2) Pipeline Phase 4 emitting engagement events into pendingEvents. (3) reveal-sequencer animateEvent case for engagement flash (white hex flash + "ENGAGED" label). (4) PHASE_TIMING entry for phase 4 with 300ms per clash per spec.
risk: Players get no visual warning about which units are about to fight. Initiative fire begins without any engagement flash to draw the eye to pending clashes.

---

### [GAP] GAP-R5: Planning paths persist during reveal but do not animate (line-eating missing)
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 2
severity: STRUCTURAL
spec_source: REVEAL_ANIMATION_SPEC.md §Planning -> Reveal Continuity, §Visual Language ("The line eats itself from the tail as the unit moves")
code_location: packages/client/src/renderer/selection-renderer.ts:398-504, packages/client/src/renderer/reveal-sequencer.ts:172-188, packages/client/src/App.tsx:71-93
what_exists: BattleHUD.tsx stores pre-reveal positions (lines 133-139) into the store via `setPreRevealUnitPositions`. App.tsx passes `store.preRevealUnitPositions` to `renderSelectionHighlights` (line 91). selection-renderer.ts uses these positions to compute and draw paths from pre-resolution start to target (lines 402-406, 432). Planning paths, ROE icons, and target highlights ARE visible during reveal. This correctly implements "Planning visuals do NOT clear at reveal start."
what_missing: The spec says lines "eat themselves from the tail as the unit moves." selection-renderer.ts recomputes full static paths from pre-reveal position to target every frame. As the unit model tweens forward (via reveal-sequencer's tweenUnitTo at line 177), the path does NOT shorten. No mechanism exists to progressively consume path geometry. The reveal-sequencer has no reference to path mesh objects and no callback to update path start position as the unit moves.
risk: The core visual metaphor -- "watching the plan execute" -- is half-implemented. Paths are visible but static. The unit moves along the path but the path stays fully drawn behind it, creating visual clutter.

---

### [GAP] GAP-R6: Dynamic order transitions not implemented (hunt tracking, retreat redraw, ambush spawn)
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 1
severity: STRUCTURAL
spec_source: REVEAL_ANIMATION_SPEC.md §Order Transition System (all Dynamic mode orders: #3 Probe, #4 Search & Destroy, #8 Feint Left, #9 Pursue Left, #13 Feint Right, #14 Pursue Right, #18 Recon, #19 Track, #23 Tripwire, #24 Ambush)
code_location: not implemented
what_exists: reveal-sequencer.ts animates events by type (move, damage, kill, etc.) with generic effects. It has no concept of directive mode (static/dynamic/procedural). selection-renderer.ts draws static planning visuals based on unit.movementDirective/attackDirective but does not modify them in response to reveal events. No communication channel exists between reveal-sequencer and selection-renderer during playback.
what_missing: Three categories of dynamic behavior specified but absent: (1) **Hunt crosshair tracking** -- arrow/lock icon should snap from target hex to acquired enemy and track in real time. (2) **Retreat-on-contact line redraw** -- forward segment fades cleanly, retreat line draws from contact point toward deployment zone. (3) **Ambush/Tripwire line spawn** -- movement line appears for the first time mid-reveal when hold+hunt or hold+retreat triggers. None implemented.
risk: 10 of 25 orders (all Dynamic mode) render identically to Static orders during reveal. The most dramatic moments -- hunt lock-on, retreat spring, ambush trigger -- have no visual expression. The spec estimates this as 1.5 days of work and calls it "the hardest single piece."

---

### [GAP] GAP-R7: Divergence visuals not implemented (line truncation, dimming, collision)
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 1
severity: STRUCTURAL
spec_source: REVEAL_ANIMATION_SPEC.md §Planning -> Reveal Continuity (divergence table)
code_location: not implemented
what_exists: reveal-sequencer.ts handles intercept/kill events with damage numbers and death markers/anims. selection-renderer.ts draws full planning paths from pre-reveal positions to targets. No path manipulation occurs during reveal playback.
what_missing: Three divergence cases: (1) **Intercepted/stopped early** -- line truncates at stop point, remainder dims to alpha 0.2. (2) **Collision resolution** -- both units' lines truncate at adjacent hex. (3) **Hunt target killed before lock-on** -- arrow fades, unit falls back to static. No path geometry is modified during reveal. Paths remain fully drawn regardless of events.
risk: When a unit is intercepted, stopped, or killed, the planning path stays fully drawn to the original target. The spec's core dramatic device -- "visuals deforming as reality overrides the plan" -- does not exist.

---

### [GAP] GAP-R8: Camera nudges not implemented
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 1
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Camera Nudge Rules
code_location: not implemented
what_exists: reveal-sequencer.ts has no camera-related imports or code. RevealCallbacks (line 49-54) has no camera callback. camera-controller.ts is imported in App.tsx but not wired to reveal events.
what_missing: Spec requires: 0.5s ease-in/out push-in + 8-degree tilt toward the action. Triggers: kill (Phase 5), counter kill (Phase 6), melee resolution (Phase 7), city capture (Phase 9). Never on Phase 3, 4, 8, 10. Fully interruptible by player input.
risk: Kill moments and city captures lack visual emphasis. Camera remains static during entire reveal.

---

### [GAP] GAP-R9: Scout procedural orbit animation not implemented
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 1
severity: STRUCTURAL
spec_source: REVEAL_ANIMATION_SPEC.md §Order Transition System (orders #16-20, Procedural mode)
code_location: not implemented
what_exists: selection-renderer.ts renders a static dotted ring at radius 3 around scout target hex (lines 471-496). During reveal, this ring stays static. reveal-sequencer.ts animates scout units with the same move tween as all other units.
what_missing: Spec says scout patrol ring is "always live, always orbiting" during reveal. Highlighted ring segment should follow unit clockwise. Track (order #19) should transition from orbit to pursuit -- ring fades over 0.5s when unit breaks orbit to chase enemy.
risk: Scout units move like advance units during reveal. The patrol visual -- core identity of the scout directive -- is absent.

---

### [GAP] GAP-R10: Legacy replay-sequencer.ts import broken -- file does not exist on disk
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 5
severity: OPERATIONAL
spec_source: EVENT_LOG_SPEC.md §Consumer Contract
code_location: packages/client/src/components/BattleHUD.tsx:13, packages/client/src/store/game-store.ts:4
what_exists: BattleHUD.tsx line 13 imports `{ skipReplay, diffTurnEvents, startReplay }` from `'../renderer/replay-sequencer'`. game-store.ts line 4 imports `type { TurnEvent }` from the same path. The file `packages/client/src/renderer/replay-sequencer.ts` does NOT exist on disk (confirmed via glob). BattleHUD.tsx spacebar handler (line 294) calls `skipReplay()`. The "Skip Replay" button (line 430) also calls `skipReplay()`. Both should call `skipReveal()` which is imported on line 14 but never used for skip. game-store.ts carries dead state: `turnReplayEvents: TurnEvent[]` (line 90), `setTurnReplayEvents` (line 137, 394). Note: this overlaps with GAP-T4 and GAP-T5 from the transport-store-auditor, confirming the same issue from the sequencer perspective.
what_missing: Either replay-sequencer.ts needs to exist (was it deleted prematurely?) or the imports need to be updated to use reveal-sequencer.ts exports. The skip calls must switch from `skipReplay()` to `skipReveal()`.
risk: **Build failure.** Two source files import from a missing module. Skip button and spacebar handler call a function that does not exist instead of `skipReveal()`.

---

### [GAP] GAP-R11: Phase 10 round-end/game-end produce 2s dead time with no visual
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 2
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Phase 10 -- Round End
code_location: packages/client/src/renderer/reveal-sequencer.ts:301-304
what_exists: `round-end` and `game-end` cases return 2000ms duration but schedule no setTimeout -- no visual, no sound, no banner. The reveal sits idle for 2 seconds before onComplete fires.
what_missing: Spec requires victory/defeat banner and income breakdown popup during Phase 10. The RoundResult component handles this AFTER reveal via applyFinalState (BattleHUD.tsx:169-213), but the 2s within the reveal is dead air.
risk: Minor. The round result appears after reveal. But 2 seconds of visual freeze during what should be Phase 10 feels broken.

---

### [GAP] GAP-R12: Fog-edge "from fog" tracer not implemented in reveal-sequencer
**agent:** reveal-sequencer-auditor
**phase:** 7

type: 1
severity: SEMANTIC
spec_source: REVEAL_ANIMATION_SPEC.md §Visibility Rule (D-VIS-5), EVENT_LOG_SPEC.md §Fog Filtering point 3
code_location: packages/client/src/renderer/reveal-sequencer.ts:201-248
what_exists: The damage case (lines 201-214) unconditionally draws tracers from `event.attackerPosition` to `event.defenderPosition`. The kill case (lines 217-232) and counter case (lines 234-248) do the same. The `observingPlayer` parameter is passed to animateEvent but only used for color via `getPlayerColor()`, never for LOS checking. No visibility/LOS set is available to animateEvent -- it is not passed as a parameter.
what_missing: Spec says own-unit damage events are always included even when the attacker is outside LOS, but the client must render the tracer as originating from the fog boundary. No code checks attacker visibility. No fog-edge intersection calculation exists. Overlaps with GAP-F3 from the fog-visibility-auditor.
risk: Information leak. Players see exact enemy positions through fog when their units are attacked by out-of-LOS enemies.

---

# REPORT — Reveal Animation & Visual Language Contract Gap Audit

**agent:** lead
**time:** 2026-03-06 21:45
**phase:** 8

## Coverage Summary

**Scope:** `REVEAL_ANIMATION_SPEC.md` + `VISUAL_LANGUAGE.md` + `EVENT_LOG_SPEC.md` vs client implementation (`renderer/`, `store/`, `network/`, `components/BattleHUD.tsx`) and server event transport (`game-loop.ts`, `state-filter.ts`).

**Auditable units examined:** 24 SURFACE_UNITs across 4 domains
**Gaps found:** 32 (after deduplication of overlapping findings)
**Confirmed matches (no gap):** 5 (death marker, HP bar colors, fog colors, event ordering, friendly-only fog tracking)

## Deduplicated Gap List

Cross-auditor overlaps consolidated:
- GAP-F1 + GAP-T2 + partially GAP-R12 → **same gap** (no server event filtering). Counted once.
- GAP-F5 + GAP-T6 → **same gap** (calculateVisibility arg mismatch). Counted once.
- GAP-T5 + GAP-R10 → **same gap** (skip calls wrong function / missing module). Counted once.
- GAP-F3 + GAP-R12 → **same gap** ("from fog" tracer not implemented). Counted once.

**Unique gaps after dedup: 26**

## Gaps by Severity

### FIX NOW (3 gaps)

| # | Gap | Location | Issue |
|---|-----|----------|-------|
| 1 | **GAP-F1/F2** | `game-loop.ts:374-382`, `state-filter.ts` | **Server sends unfiltered events to both players.** No `filterEventsForPlayer()` exists. Full enemy movement/combat data leaks via network payload. Fog of war is defeated by reading socket messages. |
| 2 | **GAP-T1** | `game-loop.ts:363-415` | **Final turn events lost on round end.** When round ends, `turn-result` is never emitted — `round-end`/`game-over` messages carry no events. The decisive turn of every round has no reveal animation. |
| 3 | **GAP-T5/R10** | `BattleHUD.tsx:13,294,433` | **Skip button/spacebar call wrong function.** Import `skipReplay()` from legacy `replay-sequencer.ts`. Should call `skipReveal()`. `replay-sequencer.ts` may not exist on disk → possible build failure. User cannot skip the 18-22s reveal. |

### FIX BEFORE PLAYTEST (6 gaps)

| # | Gap | Location | Issue |
|---|-----|----------|-------|
| 4 | **GAP-V6** | `reveal-sequencer.ts:251-252` | **Heal effect is broken stub.** Renders "CAPTURED" text at world origin (0,0,0). Wrong text, wrong position. Actively misleading. |
| 5 | **GAP-V7** | `reveal-sequencer.ts:259-265` | **Reveal effect has no visual.** Sound-only stub. Scout reveal — core intelligence mechanic — has zero visual feedback. |
| 6 | **GAP-R4** | Not implemented | **Phase 4 engagement detection missing.** No `BattleEventEngagement` type, no pipeline emission, no visual. Players get no warning about pending fights. |
| 7 | **GAP-R5** | `selection-renderer.ts`, `reveal-sequencer.ts` | **Line-eating animation missing.** Planning paths stay fully drawn during reveal. The core "plan comes to life" metaphor is half-implemented. |
| 8 | **GAP-F3/R12** | `reveal-sequencer.ts:201-248` | **No "from fog" tracer rendering.** Tracers always draw from true attacker position, leaking enemy locations through fog. |
| 9 | **GAP-R2** | `reveal-sequencer.ts:56-67` | **No playback controls.** Pause, step, rewind, speed slider — none implemented. setTimeout architecture blocks pause/rewind. Spec calls this implementation item #1. |

### IMPLEMENT DURING SPRINT 5 (10 gaps)

| # | Gap | Location | Issue |
|---|-----|----------|-------|
| 10 | **GAP-R6** | Not implemented | **Dynamic order transitions missing.** Hunt crosshair tracking, retreat-on-contact line redraw, ambush/tripwire line spawn — 10 of 25 orders render as static. |
| 11 | **GAP-R7** | Not implemented | **Divergence visuals missing.** Intercepted line truncation + α0.2 dim, collision truncation — not implemented. |
| 12 | **GAP-R9** | Not implemented | **Scout procedural orbit missing.** Patrol ring stays static during reveal. |
| 13 | **GAP-R8** | Not implemented | **Camera nudges missing.** No push-in/tilt on kills or captures. |
| 14 | **GAP-R3** | `reveal-sequencer.ts:88-92` | **"REVEAL" flash banner missing.** Only console.log. |
| 15 | **GAP-V8** | `reveal-sequencer.ts:267-277` | **City capture incomplete.** No color flip, no flag animation, "CAPTURED" instead of "CITY CAPTURED", rust instead of white. |
| 16 | **GAP-V9** | `reveal-sequencer.ts:191-199` | **Intercept visual incomplete.** No red pulse, no "INTERCEPT" text. |
| 17 | **GAP-V1** | `effects-renderer.ts:51` | **Damage number font/size/outline wrong.** Monospace 16px, no outline vs spec's Inter Black 28px with 2px outline. |
| 18 | **GAP-V2** | `effects-renderer.ts:57-63` | **Damage number animation model wrong.** Linear 0.67s vs spec's pop-hold-fade 1.3s. |
| 19 | **GAP-R1** | `reveal-sequencer.ts:33-34` | **Phase 3 too fast.** 1.3-2.2s vs spec's 6-8s. Movement phase is 3-6x rushed. |

### LOW PRIORITY (7 gaps)

| # | Gap | Location | Issue |
|---|-----|----------|-------|
| 20 | **GAP-V3** | `effects-renderer.ts:51` | Damage number color hardcoded rust instead of attacker faction color. |
| 21 | **GAP-V4** | `reveal-sequencer.ts:243` | Counter-fire text missing "COUNTER" prefix. |
| 22 | **GAP-V5** | `constants.ts:30-33` | Tracer color always yellow — spec self-contradicts (§Effects says yellow, §Reveal Effects says faction color). Needs design decision. |
| 23 | **GAP-V11** | `reveal-sequencer.ts:226` | Kill damage number has no skull icon. |
| 24 | **GAP-V14** | Not implemented | No muzzle flash VFX at attacker position. |
| 25 | **GAP-V10** | `selection-renderer.ts:294` | ROE icon color hardcoded blue — no enemy red variant. |
| 26 | **GAP-F4** | `network-manager.ts:271-288`, `BattleHUD.tsx:234-254` | Spec says fog frozen at tick-start LOS; code progressively updates. Needs design decision. |

### CLEANUP (4 gaps — not counted in priority tiers)

| # | Gap | Location | Issue |
|---|-----|----------|-------|
| — | **GAP-T4** | `game-store.ts:4,90,137` | Dead state: `turnReplayEvents`, `setTurnReplayEvents` (legacy). |
| — | **GAP-T7** | `replay-sequencer.ts`, `types.ts` | Parallel `TurnEvent`/`BattleEvent` type systems. Migration acknowledged in spec. |
| — | **GAP-T8** | `game-loop.ts:366` | `actingPlayer` defaults to `'player1'` on draw. Semantic only. |
| — | **GAP-R11** | `reveal-sequencer.ts:301-304` | Phase 10: 2s dead time, no banner/visual during reveal. |

## Design Decisions Resolved

1. **GAP-V5 / tracer color:** RESOLVED — Blue (`0x5599bb`) for P1, Red (`0x9a4a3a`) for P2. Faction colors are a future feature. Update `REVEAL_COLORS` tracer values from `0xffff88` to match path colors. Update VISUAL_LANGUAGE §Effects to remove yellow tracer spec.

2. **GAP-F4 / fog during reveal:** RESOLVED — Progressive fog is correct. Code stays, specs update. Remove "frozen at tick-start LOS" from VISUAL_LANGUAGE.md line 114 and REVEAL_ANIMATION_SPEC.md line 30.

## Architecture Note

The reveal-sequencer uses a **fire-and-forget setTimeout chain**. This makes pause, step, and rewind fundamentally impossible without a rewrite to a **tick-based timeline** (e.g., a playhead position + requestAnimationFrame loop). GAP-R2 cannot be fixed by patching — it requires architectural change. The spec estimates playback controls as 1 day; the setTimeout→timeline rewrite is the prerequisite.

---

*End of report.*
