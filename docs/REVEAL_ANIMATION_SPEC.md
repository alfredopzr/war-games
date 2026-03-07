# Reveal Animation — Legibility Spec

The 10-phase pipeline runs instantly in the engine. The reveal playback is a deliberately slowed, sequenced show that presents the result as a story the player can follow without a tutorial.

**Core rule:** Show the story in the exact order the engine ran it — one beat at a time.

Cross-references: Pipeline phases in `RESOLUTION_PIPELINE.md`. Event schema in `EVENT_LOG_SPEC.md`.

---

## Visibility Rule (D-VIS-5)

**Enemy order visuals are gated by active line-of-sight.**

During reveal, both players' units move, fight, and die simultaneously. The player sees their own units' paths, ROE icons, and engagements unconditionally. Enemy visuals — paths, ROE icons, movement lines, intercept flashes, engagement tracers — **only render on hexes where the observing player had active LOS during that tick.**

Three fog states exist: unexplored, explored, and LOS (active vision this tick from a friendly unit). Only LOS counts. Explored hexes show terrain but no enemy activity. Unexplored hexes show nothing.

**What this means in practice:**

- An enemy unit moving through your scout's vision cone: you see the unit, its path, its ROE icon, and any intercept flashes. Full information.
- An enemy unit moving through explored-but-unobserved territory: you see nothing. The unit is invisible. If it enters LOS later this tick, it pops into existence at that point.
- An enemy unit that fought and died entirely outside your vision: you never see it. You only learn about it from ghost markers if it was previously spotted, or from the post-round summary.
- A friendly unit that gets intercepted by an enemy outside its own vision: the friendly unit's damage/death is visible (it's your unit), but the attacker is shown as "from fog" — tracer originates from the fog edge, not from the enemy's position. The attacker's identity is unknown until you gain LOS on their hex.

**Scout placement is the primary intelligence mechanic.** A scout on hold is a dedicated vision asset — the player spends a unit's entire turn buying LOS coverage for the reveal. Park a scout on a ridge: the reveal shows everything that crossed that corridor. No scout: that flank is dark.

Ghost markers remain the only intel available outside LOS during reveal. The reveal does not upgrade explored hexes.

**Implementation:** The server filters `BattleEvent[]` per player before sending in the `turn-result` payload. Each event is checked against the observing player's vision set for that tick (computed from their unit positions at Phase 1 snapshot). Events involving only enemy units outside LOS are stripped. Events involving the observing player's own units are always included. See `EVENT_LOG_SPEC.md §Fog Filtering` for the filtering contract.

---

## TL;DR

Planning visuals (blue paths, ROE icons, target markers) stay on screen when reveal starts. Units move along the lines already drawn. The plan comes to life — or deforms when reality hits.

- **Static orders** (advance/flank/hold with shoot-on-sight, skirmish, ignore): visuals complete as drawn. No changes unless intercepted or killed.
- **Dynamic orders** (hunt, retreat-on-contact, ambush, tripwire): visuals update live. Crosshairs track enemies, retreat lines spring from contact points, ambush lines appear when the trap springs.
- **Procedural orders** (all patrol combinations): orbit ring was never a fixed destination. Always live, always animating.
- **Divergence** (any order): intercept truncates the line, collision stops both, kill drops the unit. The plan breaks visibly.
- **Squad casualties** (future): infantry renders as a 4-5 member squad. Members fall one by one as HP drops. Damage stays at 100% until the mechanical unit dies — this is cosmetic only, not a gameplay mechanic.

Four visual tools carry the entire system: line style (solid/dashed/dotted/none), ROE icon at the tip, pulse on collision, floating combat text. No tutorial needed.

**Visibility:** All enemy visuals are gated by active LOS. Dark flanks stay dark. Scout placement buys reveal coverage. See §Visibility Rule above.

---

## Overall Reveal Flow

Total duration: ~18–22 seconds at 1× speed.

```
Planning ends → "REVEAL" flash
→ Phase 3: units move along their existing planned lines (6–8s)
→ Phase 4: clash detection flashes (0.3s per clash)
→ Phase 5: initiative fire with floating damage (0.8–1.2s per shot)
→ Phase 6: counter-fire in orange (0.8–1.2s per shot)
→ Phase 7: melee sparks (when added, 1.2s)
→ Phase 8: heal glows + patrol reveals (0.6s total)
→ Phase 9: city color flip + flag animation (1.0s)
→ Phase 10: round-end banner + income breakdown (2.0s)
```

---

## Planning → Reveal Continuity

**The commander never loses his picture.**

Planning visuals do not clear at reveal start. Blue paths, directive icons, and target hex markers stay exactly where they are as movement begins. The "REVEAL" flash is the only seam — then units start moving along the lines that are already on screen.

The player should not feel a gap. They should feel their plan coming to life.

There are three execution modes. The full per-order transition table is in the Order Transition System section below.

**Static execution** — unit moves to its planned hex, visuals complete as drawn. No changes. `advance` with no contact, `hold`, `flank` with clear path.

**Dynamic execution** — the plan works exactly as intended, but the visuals update in real time to reflect live state. This is the plan succeeding as intended, but visuals update live. The key example is `hunt`: the crosshair lifts off the planned hex and snaps to the acquired enemy unit, then tracks it as it moves. The waypoint follows the enemy. The player feels satisfaction — their directive is alive and working.

**Divergence** — the engine's reality overrides the plan. The visuals deform to show what actually happened. The player feels friction.

| Divergence type | What the visuals do |
|-----------------|-------------------|
| Intercepted / stopped early | Line truncates at stop point. Remainder dims to α0.2. |
| Collision resolution | Both units' lines truncate at adjacent hex. |
| Hunt target killed before lock-on | Arrow fades. Unit continues toward original target hex (falls back to static). |

**Retreat-on-contact is dynamic, not divergence.** The retreat IS the plan working. The forward segment fades cleanly as the contact event consumes it — no dimming, no α0.2. The retreat line draws from the contact point. No alarm read. The player feels the probe spring and retract. This applies to Probe (advance), Feint Left/Right (flank), and Recon (patrol).

**Patrol is a special case — procedural execution.** The dotted ring was never a fixed destination. It is always live, always orbiting. No divergence is possible because there was no fixed plan to diverge from. The ring simply animates throughout reveal.

The "shit hitting the fan" moment is not the planning visuals disappearing. It is the planned visuals deforming in real time as the engine's reality overrides them.

---

## Order Transition System

Each of the 25 orders (5 directives × 5 ROEs) has a defined transition mode and visual behavior across the planning → reveal boundary.

**Execution modes:**
- **Static** — visuals complete as drawn. Unit did exactly what the line showed.
- **Dynamic** — plan succeeds but visuals update in real time. Crosshair tracks, waypoint follows, retreat springs.
- **Procedural** — no fixed destination. Visual is always live. Patrol orbit.
- **Procedural → Dynamic** — starts procedural, transitions to dynamic on trigger (e.g. patrol orbit → hunt pursuit).

**Color convention:**
- Friendly paths + icons = **blue** (`0x5599bb`)
- Enemy paths + icons = **red** (`0x9a4a3a`) — only visible on active LOS hexes
- Counter-fire tracers = **orange** (`0xdd8833`)
- When 3-5 player mode is introduced, each player gets a distinct color from `PLAYER_COLORS` in constants.ts. The renderer resolves color via `getPlayerColor(unitOwner, observingPlayer)`, not hardcoded blue/red.

**Planning visual key:**
- Solid line = A* path (blue if friendly, red if enemy)
- Dashed arc = simulated multi-turn flanking trajectory
- Dotted ring = hex ring at radius 3 + dashed path to center
- No line = hold, unit stationary
- ⊕ = crosshair (shoot-on-sight), ⟫ = inward chevrons (skirmish), ⟪ = outward chevrons (retreat-on-contact), → = arrow/lock (hunt), — = no icon (ignore)
- Friendly orders show blue target hex highlight, enemy orders show red target hex highlight

**LOS gating applies to all tables below.** Friendly unit visuals render unconditionally. Enemy unit visuals — paths, ROE icons, movement lines, engagement effects — only render on hexes within the observing player's active LOS this tick. Enemy segments outside LOS are invisible. An enemy tracer that originates from fog renders as a "from fog" tracer (source = fog edge, not enemy position). See §Visibility Rule.

### Advance

| # | ROE | Order | Mode | Planning Visual | Reveal Behavior | Divergence Case |
|---|-----|-------|------|-----------------|-----------------|-----------------|
| 1 | shoot-on-sight | **Assault** | Static | Solid line + ⊕ | Line eats itself. On contact: unit stops, ⊕ snaps to engaged enemy. Muzzle flash. | Intercepted → line truncates, remainder dims α0.2. Collision → both truncate at adjacent hexes. |
| 2 | skirmish | **Advance in Contact** | Static | Solid line + ⟫ | Line eats itself. On intercept: brief muzzle flash mid-stride, floating damage, unit keeps moving. One shot cap — subsequent threat zones passed silently. | Killed mid-path → unit drops, line freezes. Collision → truncate. |
| 3 | retreat-on-contact | **Probe** | Dynamic | Solid line + ⟪ | Line eats itself forward. On contact: forward segment fades cleanly (no α0.2 dim). Retreat line draws from contact point toward deployment zone. ⟪ pulses once at turn point. Floating damage `response: 'none'` if intercepted. | No contact → completes as static (probed safely). |
| 4 | hunt | **Search & Destroy** | Dynamic | Solid line + → | Line eats itself toward target hex. On acquisition: → lifts off target hex and snaps to enemy, tracking in real time. Remaining path bends toward enemy position. Prior-tick lock-on: line draws directly toward enemy from start. | Target killed before lock-on → → fades, continues toward original target (static fallback). Intercepted by non-target → truncate. Lock-on expires after 4 ticks without reacquisition. |
| 5 | ignore | **March** | Static | Solid line, — | Line eats itself. Intercept damage shown as floating number (`response: 'none'`), unit keeps marching. Line unchanged. | Killed mid-march → drops. Collision → truncate. |

### Flank-Left

| # | ROE | Order | Mode | Planning Visual | Reveal Behavior | Divergence Case |
|---|-----|-------|------|-----------------|-----------------|-----------------|
| 6 | shoot-on-sight | **Envelop Left** | Static | Dashed arc + ⊕ | Arc eats itself. On contact: unit stops, ⊕ snaps to enemy. | Intercepted → arc truncates, remainder dims. Collision → truncate. |
| 7 | skirmish | **Harass Left** | Static | Dashed arc + ⟫ | Arc eats itself. On intercept: muzzle flash mid-arc, one shot, keeps curving. | Killed → drops. Collision → truncate. |
| 8 | retreat-on-contact | **Feint Left** | Dynamic | Dashed arc + ⟪ | Arc eats itself. On contact: arc fades cleanly, retreat line draws toward deployment. The feint sprung and retracted. | No contact → completes as static. |
| 9 | hunt | **Pursue Left** | Dynamic | Dashed arc + → | Arc eats itself. On acquisition: → snaps to enemy, arc deforms toward enemy position. Transitions from flanking approach to direct pursuit. | Target killed → → fades, arc continues to original target. Intercepted → truncate. 4-tick lock-on cap. |
| 10 | ignore | **Bypass Left** | Static | Dashed arc, — | Arc eats itself. Takes intercept damage silently (`response: 'none'`), keeps curving. | Killed → drops. Collision → truncate. |

### Flank-Right

| # | ROE | Order | Mode | Planning Visual | Reveal Behavior | Divergence Case |
|---|-----|-------|------|-----------------|-----------------|-----------------|
| 11 | shoot-on-sight | **Envelop Right** | Static | Dashed arc + ⊕ | Mirror of #6. | Same. |
| 12 | skirmish | **Harass Right** | Static | Dashed arc + ⟫ | Mirror of #7. | Same. |
| 13 | retreat-on-contact | **Feint Right** | Dynamic | Dashed arc + ⟪ | Mirror of #8. | Same. |
| 14 | hunt | **Pursue Right** | Dynamic | Dashed arc + → | Mirror of #9. | Same. |
| 15 | ignore | **Bypass Right** | Static | Dashed arc, — | Mirror of #10. | Same. |

### Patrol

| # | ROE | Order | Mode | Planning Visual | Reveal Behavior | Divergence Case |
|---|-----|-------|------|-----------------|-----------------|-----------------|
| 16 | shoot-on-sight | **Recon in Force** | Procedural | Dashed path + ring + ⊕ | Unit approaches orbit center, enters clockwise orbit. Ring highlighted segment follows unit. On contact: stops, ⊕ snaps to enemy, ring persists as context. | Intercepted during approach → stops early, never enters orbit. |
| 17 | skirmish | **Armed Recon** | Procedural | Dashed path + ring + ⟫ | Unit orbits. On intercept: muzzle flash mid-orbit, one shot, keeps orbiting. | Killed during orbit → drops. |
| 18 | retreat-on-contact | **Recon** | Procedural | Dashed path + ring + ⟪ | Unit orbits. On contact: breaks orbit, ring fades, retreat line draws toward deployment. | No contact → orbits for full movement budget. |
| 19 | hunt | **Track** | Procedural → Dynamic | Dashed path + ring + → | Unit enters orbit. If enemy spotted: → snaps to enemy, ring fades over 0.5s, unit breaks orbit to pursue. If target killed mid-pursuit: lock-on breaks, unit navigates to nearest point on original orbit ring and resumes clockwise. Ring reappears as unit approaches. | No enemy spotted → pure procedural orbit. |
| 20 | ignore | **Silent Recon** | Procedural | Dashed path + ring, — | Unit orbits. Takes intercept damage silently (`response: 'none'`), keeps orbiting. | Killed → drops. |

### Hold

| # | ROE | Order | Mode | Planning Visual | Reveal Behavior | Divergence Case |
|---|-----|-------|------|-----------------|-----------------|-----------------|
| 21 | shoot-on-sight | **Defend** | Static | No line, ⊕ at facing target | Unit stays put. ⊕ persists. Enemy enters range → muzzle flash + tracer from stationary position. | None — can't be intercepted during movement. Takes Phase 5/6 damage normally. |
| 22 | skirmish | **Harassing Defense** | Static | No line, ⟫ at facing target | Unit stays put. Fires once at first enemy entering range, then holds fire. One-shot turret. Forward-compatible with future concealment system (firing reveals position). | None. |
| 23 | retreat-on-contact | **Tripwire** | Dynamic | No line, ⟪ at facing target | Unit stays put. On contact: breaks hold. Retreat line draws from unit toward deployment. ⟪ pulses at break point. First time a line appears — the tripwire snapping. | No contact → unit sits there (static). |
| 24 | hunt | **Ambush** | Dynamic | No line, → at facing target | Unit stays put. → points toward facing. When target enters vision: → snaps to enemy and tracks. Unit breaks hold — movement line appears for the first time as pursuit begins. The moment the line appears IS the ambush springing. | No target enters vision → unit sits there (static, → points impotently toward facing). Target retreats out of vision → pursues last known position (4-tick lock-on cap). |
| 25 | ignore | **Dig In** | Static | No line, — | Unit stays put. Does nothing. Takes Phase 5 damage without firing back. Pure DEF bonus play. | None. |

### Resolved Design Decisions

**D-VIS-1: Probe / Feint / Recon retreat is Dynamic, not Divergence.**
The retreat is the plan working. Forward segment fades cleanly — no dimming, no α0.2 alarm. Retreat line draws from contact point. Player feels the probe spring and retract. Applies to orders #3, #8, #13, #18.

**D-VIS-2: Track (patrol + hunt) orbit break — ring fades, patrol resumes on target death.**
Ring fades over 0.5s when unit breaks orbit to pursue. Once in pursuit, the story is the arrow and the path only. If hunt target dies mid-pursuit: lock-on breaks, unit navigates to nearest point on original orbit ring and resumes clockwise. Ring reappears as unit approaches.

**D-VIS-3: Ambush (hold + hunt) — hunt overrides hold on acquisition.**
Unit holds position until target enters vision. On acquisition, unit breaks hold and pursues. Hold was the waiting posture — hunt is the trigger. This separates Ambush from Defend. If hold always anchored, Ambush and Defend would be the same order with different icons. The moment the movement line appears is the ambush springing — that's the drama.

**D-VIS-4: Harassing Defense (hold + skirmish) — one shot, stay put.**
Kept as defined. Currently dominated by Defend (one-shot cap is pure downside). Forward-compatible with future concealment system where firing reveals position — at that point, the one-shot cap becomes an upside (fire once, stay hidden). Monitor usage in playtests.

---

## Playback Controls

Always visible at the bottom of screen during reveal. Auto-hide after 4 seconds of inactivity.

| Control | Input | Behavior |
|---------|-------|----------|
| Speed | Slider | 0.5× / 1× / 2× — default 1× |
| Pause | Spacebar | Freeze at current moment |
| Step | ← → arrows | One phase at a time |
| Rewind | Button | Jump back 5 seconds |

Camera is fully player-controlled at all times. Soft nudges are suggestions only — player can zoom/pan to override immediately.

---

## Visual Language

Four tools make every mechanic self-explanatory without text.

| What the player sees | What it instantly communicates |
|----------------------|-------------------------------|
| Styled movement line (solid / dashed arc / dotted ring / none) | Advancing / flanking / patrolling / holding |
| ROE icon at the tip of the line | Will shoot / skirmish / hunt / retreat / ignore |
| Pulse + slowdown on collision | Something important is happening here |
| Floating combat text (0.8s lifetime) | Damage dealt, city captured, unit revealed |

### Movement Line Styles

| Directive | Line style |
|-----------|-----------|
| `advance` | Solid line |
| `flank-left` / `flank-right` | Dashed curving arc |
| `patrol` | Dotted patrol ring |
| `hold` | No line |

The line "eats itself" from the tail as the unit moves — you watch the plan execute in real time.

### ROE Icons

Rides at the very tip of every movement line.

| ROE | Icon |
|-----|------|
| `shoot-on-sight` | Crosshair |
| `skirmish` | Chevrons |
| `hunt` | Target / lock |
| `retreat-on-contact` | Arrow curving back |
| `ignore` | — (no icon) |

---

## Phase-by-Phase Treatment

### Phase 3 — Movement (6–8 seconds)

All units move simultaneously. No floating text. Pure motion. Enemy units and their visuals only appear on hexes within the player's active LOS (§Visibility Rule).

- Friendly lines draw and eat themselves as units step
- Enemy lines draw only on LOS hexes — an enemy entering vision mid-path pops into existence at the LOS boundary, path draws from that point forward
- ROE icon rides the tip of each visible line
- **Intercept flash:** when a unit enters an enemy threat zone → red pulse + "INTERCEPT" ping for 0.4s. If the intercepting enemy is outside LOS, the player sees their unit take damage "from fog" (tracer from fog edge, attacker unknown)
- No camera nudge during movement

### Phase 4 — Engagement Detection (0.3s per clash)

- Both hexes involved in a potential fight flash white once
- Tiny "ENGAGED" label above the clash for 1 second
- No camera nudge — just draws the player's eye to every pending fight

### Phase 5 — Initiative Fire (0.8–1.2s per shot)

- Muzzle flash + tracer line from shooter to target
- Floating damage number pops at the target
- If a unit dies, it ragdolls immediately
- **Camera nudge:** soft 0.5-second ease-in/out push-in + 8° tilt toward the clash. Fully interruptible.

### Phase 6 — Counter Fire (0.8–1.2s per shot)

Identical to Phase 5 visually, but:
- Muzzle flash color: **orange** (Phase 5 = blue/faction color, Phase 6 = orange)
- Floating text prefixed with "COUNTER" tag
- Same camera nudge on a counter kill

### Phase 7 — Melee (when added, 1.2s)

- Units lean in toward each other + spark VFX on contact
- Floating damage number with sword icon prefix
- Camera nudge on resolution

### Phase 8 — Directive Effects (0.6s total)

- **Support:** soft green heal glow + green "+1 HP" float
- **Patrol reveal:** expanding dotted circle that reveals hidden enemies, "REVEALED" text in white
- No camera nudge

**Future specialties** (open — plug in once unit definitions exist):

- **Engineer:** not yet defined. Expected: construction/fortification VFX on target hex (e.g., barricade rising, trench outline). Will need its own floating text and possibly a short build animation.
- **Sniper:** not yet defined. Expected: precision shot VFX distinct from normal fire (scope glint, single high-damage tracer). May overlap with Phase 5/6 visuals — boundary TBD when the unit is specced.

Additional support sub-types (e.g., resupply, repair) may emerge. Phase 8 is the catch-all for non-combat directive resolution visuals; each new specialty gets a subsection here when its mechanics are locked.

### Phase 9 — Territory (1.0s)

- City instantly changes to capturing faction's color
- Flag-raise animation
- "CITY CAPTURED" or "CITY LOST" text in white bold
- If capturing unit dies from HP cost: model dramatically collapses on the city hex
- 0.5-second gentle camera push-in toward the city

### Phase 10 — Round End (2.0s)

- Victory/defeat banner slides in, or "ROUND 2 BEGINS" if continuing
- Income breakdown pops in top-right for 1.5s then fades
- No camera nudge

---

## Floating Text — Full Style Guide

| Property | Value |
|----------|-------|
| Font | Bold sans-serif (Inter Black or Roboto Condensed Bold) |
| Size | 28px world-space (scales with zoom) |
| Color | Attacker's faction color (P1 yellow / P2 blood red) |
| Position | 0.6 units above target hex, centered |
| Animation | Pop 0.2s → hold 0.8s → fade 0.3s |
| Outline | 2px black (readability on any background) |

**Variants:**

| Situation | Text example | Modification |
|-----------|-------------|--------------|
| Standard hit | `-14` | Base style |
| Critical hit | `-14` + `(CRITICAL)` | 18px secondary text below |
| Counter-fire | `COUNTER` tag + `-9` | Orange color |
| Melee | ⚔ `-18 (MELEE)` | Sword icon prefix |
| Kill | `-14` + skull icon | Skull appended |
| Heal | `+1 HP` | Green color |
| Reveal | `REVEALED` | White color |
| City captured | `CITY CAPTURED` | White bold, larger |

---

## Camera Nudge Rules

| Property | Value |
|----------|-------|
| Duration | Exactly 0.5 seconds |
| Style | Soft 0.5-second ease-in/out push-in + 8° tilt toward the action |
| Interruptible | Fully interruptible by player input. Player zoom/pan overrides immediately. |
| Triggers | Kill (Phase 5), counter kill (Phase 6), melee resolution (Phase 7), city capture (Phase 9) |
| Never triggers | Phase 3 (pure movement), Phase 4 (detection), Phase 8 (effects), Phase 10 (round end) |

---

## Optional: "Explain on Demand" Layer

Not required for launch. High value for streamers.

**Hover during reveal:** Any unit → tooltip for 2 seconds showing full order name.
Example: `ENVELOP RIGHT + HUNT` — "Curving to chase visible enemies"

**Click floating damage number:** 1-second mini-replay of just that engagement.

**Toggle in top bar:** "Show Order Names" — on = hover tooltips active, off = clean screen. Streamers on, casual players off.

---

## Event → Reveal Coherence Matrix

Every event type maps to a formatter (battle log text), a reveal animation, VFX, a sound stub, and a fog filter. This table is the source of truth for whether a new event type is fully wired end-to-end.

| Event | Phase | Formatter | Reveal Anim | VFX | Sound Stub | Fog Filter |
|-------|-------|-----------|-------------|-----|------------|------------|
| `move` | 3 | ✅ | ✅ tween + 'move' anim | — | ✅ `move` | ✅ from/to |
| `intercept` | 3 | ✅ | ✅ attack/hit anim, tracer, dmg number | ✅ tracer + number | ✅ `intercept` | ✅ attackerPos/hex |
| `damage` | 5 | ✅ | ✅ attack/hit anim, tracer, dmg number | ✅ tracer + number | ✅ `damage` | ✅ atk/def pos |
| `kill` | 5 | ✅ | ✅ attack/death anim, tracer, dmg number, death X | ✅ full | ✅ `kill` | ✅ atk/def pos |
| `counter` | 6 | ✅ | ✅ attack/hit anim, orange tracer, dmg number | ✅ tracer + number | ✅ `counter` | ✅ atk/def pos |
| `melee` | 7 | ✅ | ✅ melee anim both units | ✅ anim | ✅ `melee` | ✅ hex |
| `heal` | 8 | ✅ | ✅ green "+N HP" number | ✅ green number | ✅ `heal` | ✅ targetPosition |
| `reveal` | 8 | ✅ | ✅ ring + "REVEALED" text | ✅ ring + text | ✅ `reveal` | ✅ hexes |
| `capture` | 9 | ✅ | ✅ "CAPTURED" at city | ✅ number | ✅ `capture` | ✅ cityKey |
| `recapture` | 9 | ✅ | ✅ shares capture anim | ✅ same | ✅ `capture` | ✅ cityKey |
| `capture-damage` | 9 | ✅ | ✅ hit anim + damage number at city | ✅ number | ✅ `capture-damage` | ✅ cityKey |
| `capture-death` | 9 | ✅ | ✅ death anim | ✅ anim | ✅ `capture-death` | ✅ cityKey |
| `objective-change` | 10 | ✅ | ⬜ 300ms pause (no VFX) | — | — | ✅ structural |
| `koth-progress` | 10 | ✅ | ⬜ 300ms pause (no VFX) | — | — | ✅ structural |
| `round-end` | 10 | ✅ | ⬜ 2s pause (no VFX) | — | — | ✅ structural |
| `game-end` | 10 | ✅ | ⬜ 2s pause (no VFX) | — | — | ✅ structural |

**Legend:** ✅ = implemented, ⬜ = no-op by design (visual handled by HUD/toast, not scene VFX)

**Sound stubs:** All `callbacks.onSound?.(id)` calls are wired in `reveal-sequencer.ts`. No audio system exists yet — stubs are extensibility points. When audio lands, each sound ID maps to an audio clip.

---

## Unit Animation Requirements

The reveal sequencer calls `playUnitAnimation(unitId, action)` during playback. Each action maps to a clip in the GLB file via `clipMap` in `constants.ts`. Source: `reveal-sequencer.ts`, `unit-model.ts`.

**AnimAction type:** `'idle' | 'move' | 'attack' | 'melee' | 'hit' | 'death' | 'climb'`

### Event → Animation Mapping

Which events trigger which `AnimAction` on which unit role during reveal:

| Event | Unit Role | Animation |
|-------|-----------|-----------|
| `move` | moving unit | `move` |
| `intercept` | attacker (interceptor) | `attack` |
| `intercept` | defender (moving unit) | `hit` |
| `damage` | attacker | `attack` |
| `damage` | defender | `hit` |
| `kill` | attacker | `attack` |
| `kill` | defender | `death` |
| `counter` | attacker (counter-firer) | `attack` |
| `counter` | defender (original attacker) | `hit` |
| `melee` | unit A | `melee` |
| `melee` | unit B | `melee` |
| `capture-damage` | capturing unit | `hit` |
| `capture-death` | capturing unit | `death` |

**Animations NOT yet triggered by any event:**
- `idle` — default animation, plays when no other action is active
- `climb` — intended for elevation changes during movement, not yet wired

### Clip Mapping Status Per Unit GLB

| Faction | Unit | Has clipMap | Clips |
|---------|------|------------|-------|
| Engineer | Infantry | ✅ 7 actions, 13 clips | idle(1), move(2), attack(3), melee(2), hit(1), death(3), climb(1) |
| Engineer | Tank | ❌ no clipMap | GLB exists, needs rigging |
| Engineer | Artillery | ❌ no clipMap | GLB exists, needs rigging |
| Engineer | Recon | ❌ no clipMap | GLB exists, needs rigging |
| Caravaner | Infantry | ✅ 7 actions, 14 clips | idle(1), move(2), attack(4), melee(2), hit(3), death(1), climb(1) |
| Caravaner | Tank | ❌ no clipMap | GLB exists, needs rigging |
| Caravaner | Artillery | ❌ no clipMap | GLB exists, needs rigging |
| Caravaner | Recon | ❌ no clipMap | GLB exists, needs rigging |

### Priority (for Diego)

Tank, Artillery, and Recon GLBs for both factions need skeletal animations for at minimum: **`idle`, `move`, `attack`, `hit`, `death`**. `melee` and `climb` are lower priority (melee blocked on OD-1, climb not yet wired to movement events).

### How clipMap Works

When a GLB has no `clipMap` entry in `constants.ts`, `playUnitAnimation` falls back to matching clip names directly against the `AnimAction` string. If the GLB has embedded clips named exactly `idle`, `move`, `attack`, etc., they will play automatically.

The `clipMap` exists to map arbitrary Meshy/Blender clip names (e.g., `'Run_and_Shoot'`, `'Spartan_Kick'`) to game actions. Multiple clips per action = random selection on each play. Example from Engineer Infantry:

```typescript
clipMap: {
  idle:   ['Idle_02'],
  move:   ['Walking', 'Running'],
  attack: ['Run_and_Shoot', 'Walk_Forward_While_Shooting', 'Side_Shot'],
  melee:  ['Spartan_Kick', 'Weapon_Combo_2'],
  hit:    ['Hit_Reaction_1'],
  death:  ['Dead', 'dying_backwards', 'Shot_in_the_Back_and_Fall'],
  climb:  ['climbing_up_wall'],
}
```

When Diego exports new GLBs from Blender, he can either: (a) name clips to match `AnimAction` strings exactly and skip the clipMap, or (b) use any names and add a `clipMap` entry in `constants.ts`.

---

## Implementation Order

Ship in this sequence. Each step is independently testable.

| # | What | Est. |
|---|------|------|
| 1 | Playback controls (speed / pause / step / rewind) | 1 day |
| 2 | Phase 3 movement with static line-eating animation and ROE icons | 1 day |
| 3 | Dynamic order transitions: hunt lock-on tracking (crosshair snaps to acquired target), retreat-on-contact line redraw (new path from contact point), Ambush/Tripwire line spawn (path appears mid-reveal on acquisition) | 1.5 days |
| 4 | Intercept flash (red pulse) during movement | 0.5 day |
| 5 | Phase 4 engagement flash ("ENGAGED" ping) | 0.5 day |
| 6 | Phase 5 muzzle flash + tracer + floating damage numbers | 1 day |
| 7 | Phase 6 counter-fire in orange | 0.5 day |
| 8 | 0.5s soft camera nudge on kills | 0.5 day |
| 9 | Phase 8 heal glow + patrol reveal circle | 0.5 day |
| 10 | Phase 9 city color flip + "CITY CAPTURED" text | 0.5 day |
| 11 | Phase 10 round-end banner + income breakdown | 0.5 day |

**Total: ~8.5 days.** Playback controls + movement animation are the highest-value items. Step 3 is the hardest single piece — it requires runtime event data to drive visual state changes mid-animation. Everything after step 3 is additive.

---

## Legibility Test

Before shipping, run this test:

1. Sit someone down who has never seen the game
2. Say: "Just watch what happens"
3. Play one full reveal at 1× speed
4. Ask: "Could you tell what each unit was trying to do?"

If they can answer without explanation, the system is working.
