# Resolution Pipeline

Simultaneous turn resolution specification. The 10-phase combat timeline, two-layer directive model, event log format, and implementation notes.

Cross-references: Response time and damage formula math in `GAME_MATH_ENGINE.md`. Collision resolution rules in `DESIGN_DECISIONS.md` §D4-D5. Sprint 4 scope in `ROADMAP.md`.

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
