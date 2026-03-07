# Resolution Pipeline

Simultaneous turn resolution specification. The 10-phase combat timeline, order system, approach angle model, event log format, and implementation notes.

Cross-references: Response time and damage formula math in `GAME_MATH_ENGINE.md`. Event schema in `EVENT_LOG_SPEC.md`. Sprint schedule in `ROADMAP.md`.

---

## TL;DR — The 10 Phases

| Phase | Name | One sentence |
|-------|------|-------------|
| 1 | Snapshot | Freeze world state — all phases reference this baseline, nothing mutates it. |
| 2 | Intent Collection | Every unit generates a movement path + facing from its order and CP commands. |
| 3 | Movement | Step-by-step along paths simultaneously; intercept checks per step; collision resolution. |
| 4 | Engagement Detection | Scan all cross-faction pairs in range after movement; compute approach angle (rear/flank/front). |
| 5 | Initiative Fire | Offensive units fire in response-time order; dead defenders cancel their pending attacks. |
| 6 | Counter Fire | Surviving defenders with offensive ROE fire back at their attacker. |
| 7 | Melee | *Deferred (OD-1).* Adjacent contact after movement — uses meleeRating, not ATK/DEF. |
| 8 | Effects | Support heals, scout reveals, hold DEF modifier *(value deferred, OD-9)*. |
| 9 | Territory | Cities flip ownership; capturing unit pays HP cost. |
| 10 | Round End | Check KotH / elimination / turn limit; increment turn counters. |

Resolution is determined by **order** (one of 25) + **position** (approach angle) + **unit type** (response time).

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

### The Order System

Every unit carries an **order** — the product of `movementDirective × attackDirective`. These are set during the planning phase and cannot change mid-tick.

**Movement Directive** — defines destination and path behavior:

| Directive | Behavior |
|-----------|----------|
| `advance` | Move toward target hex via shortest path |
| `flank-left` | Move toward target via flanking arc, offset left of approach vector |
| `flank-right` | Move toward target via flanking arc, offset right of approach vector |
| `scout` | Orbit `targetHex` at radius 2-3 hexes. If no target, `targetHex` defaults to current position (orbit in place). Movement pattern: advance toward targetHex until within radius, then circle it clockwise. Reverses direction if blocked. |
| `hold` | Do not move. Unit receives passive DEF modifier while stationary. Modifier value deferred to S4 balance pass (OD-9). |

Flank direction is an explicit player choice — terrain on one side of the approach may be favorable while the other is exposed. The flanking waypoint is computed perpendicular to the unit→target vector, offset by `floor(mapDiameter × 0.25)` hexes (§A6).

**Attack Directive (Rules of Engagement)** — defines behavior when enemy contact occurs:

| ROE | Behavior |
|-----|----------|
| `shoot-on-sight` | Stop movement immediately and engage |
| `skirmish` | Fire once while passing, continue moving |
| `retreat-on-contact` | Disengage and move away from threat |
| `hunt` | Actively seek and pursue enemy units |
| `ignore` | Complete movement regardless of contact |

**Specialty Modifiers** (`support`, `engineer`, `sniper`) modify these two layers. Not a third category.

#### The 25 Orders

The order name is the unit's behavioral identity for the tick. Pipeline phases reference orders, not raw directive components.

| | shoot-on-sight | skirmish | retreat-on-contact | hunt | ignore |
|---|---|---|---|---|---|
| **advance** | Assault | Advance in Contact | Probe | Search & Destroy | March |
| **flank-left** | Envelop Left | Harass Left | Feint Left | Pursue Left | Bypass Left |
| **flank-right** | Envelop Right | Harass Right | Feint Right | Pursue Right | Bypass Right |
| **scout** | Recon in Force | Armed Recon | Recon | Track | Silent Recon |
| **hold** | Defend | Harassing Defense | Tripwire | Ambush | Dig In |

Source of truth: `BEHAVIOR_NAMES` in `directives.ts`.

#### Directive Parameters

All movement directives accept a `targetHex` parameter. This is already true for advance and flank-left/flank-right. It now applies universally:

| Directive | Required Param | Optional Param | Default |
|-----------|---------------|----------------|---------|
| `advance` | targetHex | — | — |
| `flank-left` | targetHex | — | — |
| `flank-right` | targetHex | — | — |
| `scout` | targetHex | — | Current position (orbits in place) |
| `hold` | — | — | — |

Attack directives accept an optional `priorityType` parameter:

| Directive | Optional Param | Default |
|-----------|---------------|---------|
| `hunt` | `priorityType: UnitType` | Nearest visible enemy |
| all others | — | — |

`hunt(priorityType)` seeks the specified unit type first among visible enemies. Falls back to nearest visible enemy if none of that type are in vision. **Lock-on behavior:** once a hunt target is acquired, the unit pursues it even if it retreats out of initial vision range, until the target dies, leaves the map, **or 4 turns elapse since lock-on** — whichever comes first. After lock-on expires, the unit re-evaluates visible enemies and may acquire a new target. The 4-turn cap prevents hunt from being dominant on large maps where a fast unit could chase indefinitely.

**UI implication:** Directive picker renders a secondary dropdown when `hunt` is selected. All directives that take `targetHex` use the existing hex-click to confirm target. No other directives require UI changes.

**Scout movement pattern in Phase 3:** The scout advances toward `targetHex` until within orbit radius (2-3 hexes), then circles clockwise at that radius. If the orbit path is blocked (terrain, occupied hex), the scout reverses direction. If `targetHex` is not set, it defaults to the unit's current position — the scout orbits in place. The client visualization (dotted circle at radius 3) matches this: the circle IS the orbit path.

**Hold + DEF bonus:** `hold` is the only directive where a unit is fully committed to position. A DEF increase is the right reward — it makes hold a genuine strategic choice, not just "I have nowhere to go." The modifier value is deferred to S4 balance pass (OD-9) because it must be sized against the ATK/HP/DEF ratios from the math model's kill timing targets. Guessing now risks breaking the 2-hit counter relationship.

#### Order Classification for Pipeline Resolution

Orders are classified by how they interact with each pipeline phase. Classification is by attack directive component:

**Fires during intercept (Phase 3):** `shoot-on-sight`, `skirmish`, `hunt`

**Stops on contact (Phase 3):** `shoot-on-sight`, `hunt`

**Fires once and keeps moving (Phase 3):** `skirmish`

**Flees on contact (Phase 3):** `retreat-on-contact` — reverses path toward deployment zone for remaining movement budget. Takes intercept hit, does not fire back.

**Ignores threats (Phase 3):** `ignore` — continues movement. Takes intercept hit, does not engage.

**Fires in initiative (Phase 5):** `shoot-on-sight`, `skirmish`, `hunt`

**Counter-fires if surviving (Phase 6):** `shoot-on-sight`, `skirmish`, `hunt`

**Does NOT counter-fire:** `retreat-on-contact` (fleeing), `ignore` (passive)

> **Design note:** `retreat-on-contact` units do not counter-fire. They are running. If they get hit during movement (intercept), they take the hit and keep fleeing. If hit during engagement (Phase 5), they do not fire back — their ROE is to disengage, not trade shots. This makes retreat-on-contact a genuine commitment to information-gathering over combat.

---

### Approach Angle

Resolution depends on **order + position**. Two units with identical orders resolve differently depending on relative positioning.

**Facing:** A unit's facing is derived from its movement intent.

- Moving units face their movement direction (vector from current position to intended destination)
- `hold` units face their directive target
- Fallback: toward the nearest enemy

**Approach angle categories:**

| Category | Condition | Effect |
|----------|-----------|--------|
| **Rear (critical)** | Attacker approaches from behind the defender's facing (within ~60° of directly behind) | Attacker response time −2. **Damage bonus: deferred.** |
| **Flank (side)** | Attacker approaches from the side of the defender's facing (~60°-120° off facing) | Attacker response time −1. **Damage bonus: deferred.** |
| **Front** | Attacker approaches from within ~60° of the defender's facing | No positional modifier. Resolved by unit type + order modifiers. |

**Hex discretization:** On a hex grid, facing maps to one of the 6 hex directions. "Rear" = the 1-2 hex directions opposite the facing. "Flank" = the 2 directions perpendicular. "Front" = the 1-2 directions aligned with facing.

**Implementation:** To determine approach angle between attacker A and defender D:

```
defenderFacing = D.facingDirection  // unit vector from Phase 2
approachVector = normalize(A.position - D.position)
dot = dotProduct(defenderFacing, approachVector)

if dot < -0.5:  rear     // attacker behind defender
elif dot < 0.5: flank    // attacker to the side
else:           front    // attacker ahead of defender
```

In hex coordinates, this is the angle between the defender's facing hex direction and the hex direction from defender to attacker. Adjacent hex directions = 60° apart.

**Infrastructure requirement:** Phase 4 computes approach angle for every engagement pair. Phase 5 uses it for initiative ordering. Bonus damage (critical hit, flank damage bonus, high-ground bonus) is structurally supported but numeric values are deferred to playtest tuning.

---

### Global Invariants

These rules cannot be broken by any order combination:

1. **Movement locks before combat.** No unit changes its path because another unit died or moved in the same tick.
2. **No same-tick chain reactions.** A hex freed by a kill in tick N is available in tick N+1, not N.
3. **One intercept cap per unit per tick.** Each unit may generate maximum 1 intercept event as a source or target per movement phase. Tunable. MVP = 1.
4. **Intercept eligibility requires offensive ROE.** An enemy unit only fires during movement (Phase 3) if its attack directive is `shoot-on-sight`, `skirmish`, or `hunt`. Units with `retreat-on-contact` or `ignore` do not generate intercept events.
5. **Skirmish attack cap.** A skirmishing unit may fire maximum 1 offensive shot during Phase 3 movement, regardless of how many threat zones it passes through. Intercept fire *received* from enemies does not count against this cap.

---

### Phase 1 — Snapshot

Freeze world state. All calculations in this tick reference this baseline.

```
snapshot = clone(gameState)
```

Snapshot contains: units, hp, positions, orders (movement + attack directives + specialty modifier), directive targets, terrain, elevation, cities, vision state.

Nothing mutates the snapshot during resolution.

---

### Phase 2 — Intent Collection

Each unit generates a composite intent from its order plus any active CP commands.

```typescript
interface TurnIntent {
  unitId: string;
  owner: PlayerId;
  movementDirective: MovementDirective;
  attackDirective: AttackDirective;
  specialtyModifier: SpecialtyModifier | null;
  cpOverride: Command | null;
  targetHex: CubeCoord;          // resolved from directive target
  path: CubeCoord[];             // A* path toward targetHex
  facing: CubeCoord;             // unit vector of movement direction
}
```

CP `redirect` commands update the unit's directives before intent generation. The unit then acts under its new order for the rest of this tick.

All intents generated simultaneously from snapshot state. No unit sees another unit's intent.

**Path computation:** Each unit's path is computed from its movement directive using A* with terrain costs. Movement budget = `unitStats[type].moveRange` (cost-based). `hold` directive units get an empty path.

**Facing computation:**

- Moving units: vector from `position` toward first path step (or toward target if path is empty)
- `hold` units: vector from `position` toward directive target hex
- Fallback: vector from `position` toward nearest enemy

---

### Phase 3 — Movement Phase

**Movement is step-by-step along the path. Decisions are local to the moving unit. Other units never reroute.**

**Both players' units move simultaneously.** All paths were computed from snapshot positions (Phase 2). All intercept checks evaluate against snapshot positions. All destination reservations are collected. Collision resolution runs on the full destination map. No player's movement resolves before the other's.

**Step 1 — Path Determination**

Each unit's path was computed in Phase 2. Movement budget = `moveRange` (cost-based, not step-based).

**Step 2 — Intercept Check (per step)**

At each step along the path, check for enemies whose attack range covers this hex:

```
for each enemy unit with attackRange covering this hex:
  if enemy.attackDirective in [shoot-on-sight, skirmish, hunt]:
    if enemy has not used intercept cap this tick:
      queue interceptEvent(enemy → moving unit)
      enemy.interceptsUsed += 1

      // Moving unit's response depends on its attack directive:
      if movingUnit.attackDirective in [shoot-on-sight, hunt]:
        movement stops here
        queue engagementEvent(movingUnit ↔ enemy)

      if movingUnit.attackDirective is skirmish:
        if movingUnit.skirmishShotsFired < 1:
          queue engagementEvent(movingUnit → enemy)
          movingUnit.skirmishShotsFired += 1
        movement continues

      if movingUnit.attackDirective is retreat-on-contact:
        movement reverses — unit paths toward deployment zone
        // takes the intercept hit, does not fire back

      if movingUnit.attackDirective is ignore:
        movement continues
        // takes the intercept hit, does not engage
```

**Intercept cap:** Each unit may be the *source* of maximum 1 intercept event per tick. First eligible enemy fires. Subsequent threats along the path from the same enemy do not fire again.

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
| Multiple claimants, enemy factions | Both stop one hex short (adjacent). Engagement flagged for Phase 4. |
| Head-on collision (A→B, B→A, same path) | Both stop one hex short of each other. Now adjacent. |
| Same-hex after step resolution | Cannot occur — collision resolution prevents it. No stacking. |

**Movement decisions are now locked. No rerouting for remainder of tick.**

---

### Phase 4 — Engagement Detection

After all movement is resolved, determine which units are in combat range.

For each unit pair (A, B) where A.owner ≠ B.owner:

```
check: cubeDistance(A.position, B.position) ≤ A.attackRange
check: line of sight from A to B
check: A.attackDirective ≠ ignore
```

For each eligible pair, compute approach angle:

```
approachCategory = computeApproachAngle(
  A.position,           // attacker position
  B.position,           // defender position
  B.facing,             // defender's facing from Phase 2
)
// rear:  attacker behind defender's facing
// flank: attacker to the side of defender's facing
// front: attacker ahead of defender's facing
```

Generate engagement events:

```typescript
interface EngagementEvent {
  attacker: Unit;
  defender: Unit;
  distance: number;
  approachCategory: 'rear' | 'flank' | 'front';
  isInterceptEvent: boolean;  // flagged from Phase 3
}
```

If multiple enemies in range, target selection: closest first, lowest HP tiebreak (existing engine behavior).

---

### Phase 5 — Initiative Resolution (First Strike)

All units with offensive attack directives (`shoot-on-sight`, `skirmish`, `hunt`) fire. Order determined by response time.

**Response time** (lower = fires first):

| Unit | Base Response Time |
|------|--------------------|
| Recon | 1 |
| Infantry | 2 |
| Tank | 3 |
| Artillery | 4 |

**Modifiers (additive):**

| Condition | Modifier | Source |
|-----------|----------|--------|
| Rear approach (critical) | Attacker −2 | Phase 4 approach angle |
| Flank approach (side) | Attacker −1 | Phase 4 approach angle |
| Defender on mountain | Defender −1 | Terrain elevation |
| Defender in forest | Attacker +1 | Terrain concealment |
| `shoot-on-sight` or `hunt` ROE | −0.5 | Attack directive |
| `skirmish` ROE | −0.25 | Attack directive |

**Resolution:**

```
sort engagementEvents by attacker.responseTime (ascending)

for each engagementEvent:
  if attacker.hp > 0:
    damage = calculateDamage(attacker, defender, terrain)
    defender.hp -= damage
    emit damageEvent or killEvent
    if defender.hp <= 0:
      removeUnit(defender)
      cancel all pending engagementEvents where source = defender
      cancel melee entry for defender
```

Intercept events from Phase 3 are included in this queue with the moving unit as attacker or defender depending on who initiated.

**Tiebreaker:** When two units have identical final response times, resolve with seeded RNG: `seededRng(turnSeed, engagementId)`. Initiative winner fires first for this engagement. Single roll per engagement — not re-rolled per hit.

---

### Phase 6 — Counter Fire

Units that **survived Phase 5**, were **targeted by an attack**, and have an offensive attack directive (`shoot-on-sight`, `skirmish`, or `hunt`) fire back at their attacker.

Units with `retreat-on-contact` or `ignore` do **not** counter-fire.

Same initiative ordering as Phase 5 (response time + modifiers).

```
for each surviving defender with attackDirective in [shoot-on-sight, skirmish, hunt]:
  if originalAttacker still alive AND in range:
    damage = calculateDamage(defender, originalAttacker, terrain)
    originalAttacker.hp -= damage
    emit counterEvent
    if originalAttacker.hp <= 0:
      removeUnit(originalAttacker)
      cancel that unit's remaining engagements
```

**Note on Phases 5+6:** Two sub-steps of one Engagement Resolution phase. Phase 5 = initiative fire. Phase 6 = counter fire. Separated for clarity and animation mapping, but logically one event stream.

---

### Phase 7 — Melee Resolution

**Deferred.** Needs numeric `meleeRating` values (OD-1). Infrastructure defined; implementation blocked.

Units in contact after movement and ranged engagement enter melee.

**Contact conditions:**
- Adjacent hex after Phase 3 movement locked
- Head-on collision result (both stopped one hex short, now adjacent)
- Collision on enemy hex (both stopped adjacent)

**Melee does NOT require same hex.** The stacking invariant is preserved. Melee = adjacent contact, not co-occupation.

**Melee damage uses `meleeRating`, not ATK/DEF.**

| Unit | Melee Rating |
|------|-------------|
| Recon | S (fastest, close-quarters) |
| Infantry | A |
| Tank | D (turret rotation penalty) |
| Artillery | F (it's a cannon) |

Melee persists until one unit dies or one unit retreats (costs 1 CP next planning phase to break melee).

---

### Phase 8 — Directive Effects

Non-combat directive actions execute. These occur after combat so they cannot undo lethal damage.

| Directive / Specialty | Effect |
|-----------------------|--------|
| `hold` (movement) | Apply DEF modifier for this tick. Value: OD-9, deferred to S4 balance pass. |
| `support` (specialty) | Heal adjacent friendly with lowest HP |
| `engineer` (specialty) | *Deferred* |
| `sniper` (specialty) | *Deferred* |

Scout units with `scout` movement directive emit `reveal` events for enemy units within visionRange.

---

### Phase 9 — Territory Resolution

Cities update ownership.

```
for each city hex:
  if unit standing on city AND city.owner ≠ unit.owner:
    city.owner = unit.owner
    captureCost = ceil(maxHp × 0.1)
    unit.hp -= captureCost
    emit captureEvent / captureDeathEvent
    if unit.hp ≤ 0:
      removeUnit(unit)  // city still flips
```

City capture HP cost represents the cost of securing and holding a position.

---

### Phase 10 — Round End Check

Evaluate win conditions in priority order:

1. **KotH / City majority:** Current: `turnsHeld >= 2` with `citiesHeld >= 2` gate. Future (Sprint 6): `victoryCities = floor(totalCities × 0.6)`.
2. **Elimination:** one side has 0 units.
3. **Turn limit:** `turnsPlayed >= maxTurns`. Tiebreaker: unit on central hex > closest to central hex > total surviving HP > player1.

If none triggered → next planning phase begins.

---

### Event Log

See `EVENT_LOG_SPEC.md` for the full schema contract. Key event types per phase:

| Phase | Events |
|-------|--------|
| Phase 3 (movement) | `move`, `intercept` |
| Phase 5 (initiative) | `damage`, `kill` |
| Phase 6 (counter) | `counter`, `damage`, `kill` |
| Phase 7 (melee) | `melee` |
| Phase 8 (effects) | `heal`, `reveal` |
| Phase 9 (territory) | `capture`, `recapture`, `capture-damage`, `capture-death` |
| Phase 10 (round end) | `objective-change`, `koth-progress`, `round-end`, `game-end` |

---

### The System in One Sentence

```
snapshot → intents (order + position) → movement (step + intercept) → engagement detection (range + approach angle) → initiative fire → counter fire → melee → effects → territory → round check
```

Every mechanic plugs into one of those layers. Resolution is determined by **order** (one of 25) **+ position** (approach angle: rear/flank/front) **+ unit type** (response time).

---

### Implementation Notes & Watchlist

**N1 — Intercept Cap Is The Primary Balance Lever**

`INTERCEPT_CAP = 1` (per unit per tick). Determines how dangerous movement is.

- Cap = 1 → movement relatively safe. Flanking viable. Aggressive play rewarded.
- Cap = 2 → contested movement costly. Defensive positioning strengthens.
- Cap = 3+ → movement extremely dangerous. Turtling dominates.

Start at 1. Raise only based on match data. Do not change based on theory.

**N2 — Head-On Stall Exploit**

Two units with movement directives toward each other and passive ROE (`retreat-on-contact` or `ignore`) stop adjacent every tick. Permanent mutual block.

Monitor for this. Fix if it becomes a pattern:

> If two enemy units have been adjacent for N consecutive ticks without either engaging, both automatically enter `shoot-on-sight` for the next tick.

N = 2 is probably right. Do not implement until confirmed in playtests.

**N3 — Event Log Is Load-Bearing Infrastructure**

Done. See `EVENT_LOG_SPEC.md`. 16-variant `BattleEvent` union emitted inline during resolution. 4 future types (intercept, counter, melee, reveal) defined, not yet emitted.

**N4 — Deferred Bonuses (Infrastructure Ready)**

The approach angle system computes rear/flank/front for every engagement. The following bonuses are structurally supported but **not implemented** until playtest data exists:

| Bonus | Trigger | Proposed Effect | Status |
|-------|---------|-----------------|--------|
| Critical hit | Rear approach | +50% damage | Deferred |
| Flank damage | Flank approach | +25% damage | Deferred |
| High ground | Attacker elevation > defender | −1 initiative | Deferred |

These are tuning knobs, not structural changes. The pipeline computes the data; bonuses are multiplied in when values are decided.

**N5 — CP Commands in the Pipeline**

Currently only `redirect` exists. Redirect updates the unit's directives before Phase 2 intent generation. The unit acts under its new order for the rest of the tick.

Future CP commands (`direct-move`, `direct-attack`, `retreat`) would slot into Phase 2 as intent overrides:

- `direct-move`: override path. Intercept checks still apply.
- `direct-attack`: override Phase 4 target selection.
- `retreat`: override movement directive to path toward deployment zone.

These are not yet implemented. `redirect` is the only command type.

**N6 — Simultaneous Movement Execution**

Both players' units move in the same Phase 3. Movement is processed **simultaneously**:

1. All paths computed from snapshot (Phase 2)
2. All intercept checks evaluated against snapshot positions
3. All destination reservations collected from both players
4. Collision resolution runs on the full destination map

No player's movement resolves before the other's. This is the architectural change from the current sequential `executeTurn()` calls.
