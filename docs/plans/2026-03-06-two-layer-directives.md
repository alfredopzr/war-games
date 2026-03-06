# Two-Layer Directive System — Implementation Plan (v3)

Branch: `layered-directives` (off `Chack-Atacc`)
Supersedes: GAME_MATH_ENGINE.md §A10, RESOLUTION_PIPELINE.md §Two-Layer Directive Model (where they conflict with this plan)

---

## Context

The current engine uses a single flat `DirectiveType` with 8 values and 4 command types (direct-move, direct-attack, redirect, retreat). The design calls for two independent directive layers plus a locked specialty layer, and collapsing all commands into a single "redirect" that opens the same two-layer picker used in planning.

This is task 0.1 from the implementation plan — "Do this first. It is a type change that cascades everywhere."

---

## Directives vs Commands

**Directive** = persistent standing order set during planning. Encoded as a combination of Move layer + Attack layer + Special layer. Defines IF/THEN behavior: "if you encounter an enemy, do X" is the attack layer; "move toward Y" is the move layer. Directives persist across turns until changed.

**Command** = a mid-battle redirect that costs 1 CP. It opens the same two-layer picker from planning and changes the unit's directive combo. There is only one command type: **redirect**. The unit then executes its new directive via normal directive AI this turn.

Commands exist only as "I read the opponent wrong, so I pay the tax to change my directive right now." Everything a unit can do is expressible as a directive combo. There are no standalone move/attack/retreat commands.

Ref: DESIGN.md:168 — "Redirect: Change a unit's directive mid-battle. The unit follows the new directive for the rest of the round."
Ref: DESIGN.md:175 — "Commands are issued during your turn before directive AI resolves."

### Spec divergence: commands

DESIGN.md:167-171 defines four command types: Direct Move, Direct Attack, Redirect, and Retreat. This plan **deliberately eliminates three of them**. The rationale: the two-layer directive model makes every possible unit behavior expressible as a directive combo. Separate move/attack/retreat commands are redundant with redirect, and having both creates a confusing UI where there are two ways to do the same thing. This is a design decision, not a bug.

---

## Current -> Target

**Current:** `directive: DirectiveType` = `'advance' | 'hold' | 'flank-left' | 'flank-right' | 'scout' | 'support' | 'hunt' | 'capture'`
**Current commands:** `'direct-move' | 'direct-attack' | 'redirect' | 'retreat'`

**Target:**
```
movementDirective: MovementDirective = 'advance' | 'flank-left' | 'flank-right' | 'scout' | 'hold' | 'capture'
attackDirective: AttackDirective = 'shoot-on-sight' | 'skirmish' | 'retreat-on-contact' | 'hunt' | 'ignore'
specialtyModifier: SpecialtyModifier | null = 'support' | 'engineer' | 'sniper' | null
```
**Target commands:** `'redirect'` only (carries all three directive fields + optional target)

### Layer definitions

**Move layer** — WHERE you go and HOW you move (6 values):

| Value | Behavior |
|-------|----------|
| `advance` | Move toward target hex via shortest path |
| `flank-left` | Move toward target via left-offset flanking arc |
| `flank-right` | Move toward target via right-offset flanking arc |
| `scout` | Probe target area, reveal terrain/enemies, keep 2-3 hex distance. Ref: DESIGN.md:138 |
| `hold` | Move to target, then dig in (+DEF bonus) |
| `capture` | Move to target city, occupy, auto-hold after capture. Ref: DESIGN.md:141 |

**Attack layer** — WHAT you do when you encounter enemies (5 values, default: `ignore`):

| Value | Behavior |
|-------|----------|
| `shoot-on-sight` | Aggressive — fire at anything in range, stop to engage. Maps to spec `assault`. Ref: RESOLUTION_PIPELINE.md:55 |
| `skirmish` | Hit once, keep moving (fire while passing). Ref: RESOLUTION_PIPELINE.md:56 |
| `retreat-on-contact` | Back off when enemy contact occurs. Ref: DESIGN.md:138 scout retreat behavior |
| `hunt` | Pursue visible targets only. Conditioned on LoS/scout reveal — no blind chasing. Ref: DESIGN.md:140 |
| `ignore` | Complete movement regardless of contact, do not fire. Default. Ref: RESOLUTION_PIPELINE.md:58 |

Ref: RESOLUTION_PIPELINE.md:81 — only `shoot-on-sight` (assault) and `skirmish` units generate intercept events.

### Spec divergence: attack layer names

RESOLUTION_PIPELINE.md uses `assault`, `skirmish`, `cautious`, `ignore`. This plan renames `assault` -> `shoot-on-sight` (clearer for players), replaces `cautious` with `retreat-on-contact` (different behavior: flee vs stop), and adds `hunt` (resurrected from DESIGN.md:140). The spec's `cautious` ("stop if threatened, do not initiate") has no direct equivalent — see counter-fire gap in Open Debt.

**Special layer** — locked/placeholder until buff system (3 values + null):

| Value | Behavior |
|-------|----------|
| `support` | Follow/heal friendly (current behavior). Ref: RESOLUTION_PIPELINE.md:293 |
| `engineer` | Build structures (locked, no-op) |
| `sniper` | Mountain perch, long-range shot (locked, no-op) |

## Flank Design

The spec (RESOLUTION_PIPELINE.md line 48) defines a single `flank(target)`. This plan keeps `flank-left` and `flank-right` as separate values — the player chooses which side to arc around. Direction choice is a meaningful tactical decision (terrain on one side, open ground on the other).

The current flank offset calculation is broken: hardcoded q-offsets `[-5, -4, -3]` / `[5, 4, 3]` assume a ~20-wide rectangular map. On hex-of-hexes (mapRadius ~18, diameter ~36) these offsets are too small to create a meaningful arc.

**Fix in this PR:** Replace hardcoded offsets with `floor(mapDiameter * 0.25)` per GAME_MATH_ENGINE.md §A6 (`flankOffset = floor(width * 0.25)`). This requires adding `mapRadius` to `DirectiveContext` so the directive AI can compute the scaled offset.

The flank waypoint calculation also needs rework: the current code offsets only in `q` direction (`createHex(objective.q + offset, objective.r)`), which is axis-aligned on cube coords. On the hex-of-hexes map centered at origin, this creates asymmetric arcs. The fix: compute the flank waypoint perpendicular to the unit->target vector, not along a fixed axis.

---

## Migration Mapping

### Directives (old 8 -> new three-layer)

| Old Directive | movementDirective | attackDirective | specialtyModifier |
|---------------|-------------------|-----------------|-------------------|
| `advance`     | `advance`         | `ignore`        | `null`            |
| `hold`        | `hold`            | `ignore`        | `null`            |
| `flank-left`  | `flank-left`      | `ignore`        | `null`            |
| `flank-right` | `flank-right`     | `ignore`        | `null`            |
| `scout`       | `scout`           | `ignore`        | `null`            |
| `support`     | `advance`         | `ignore`        | `support`         |
| `hunt`        | `advance`         | `hunt`          | `null`            |
| `capture`     | `capture`         | `ignore`        | `null`            |

Default attackDirective is `ignore`, not `shoot-on-sight`. Old advance had implicit "attack enemies along the way" behavior — that was directive AI calling `tryAttackClosest()` unconditionally. The attack layer now makes this explicit: set `shoot-on-sight` if you want a unit to engage.

### Commands (old 4 -> redirect only)

| Old Command | New Equivalent |
|-------------|----------------|
| `direct-move` to hex X | Redirect -> `advance`(target: hex X) + keep attack layer |
| `direct-attack` enemy Y | Redirect -> keep movement + `hunt`(target: enemy Y) |
| `redirect` to directive D | Redirect -> D (two-layer version) |
| `retreat` | Redirect -> `advance`(target: deployment-zone) + `retreat-on-contact` |

### Retreat target: `deployment-zone` target type

The old `retreat` command (game-state.ts:421-485) computes nearest unoccupied deployment hex at execution time. With retreat-as-redirect, the target must be specified. But forcing the player to manually pick a deployment hex is bad UX.

**Solution:** Add `'deployment-zone'` to `DirectiveTargetType`. When the client issues a retreat-like redirect, it sets `target: { type: 'deployment-zone' }`. The engine's `resolveTarget()` computes the nearest unoccupied deployment hex at execution time, reusing the existing logic from the retreat command handler.

```typescript
export type DirectiveTargetType = 'central-objective' | 'city' | 'enemy-unit' | 'friendly-unit' | 'hex' | 'deployment-zone';
```

In `resolveTarget()`:
```typescript
case 'deployment-zone': {
  const deployZone = context.deploymentZone; // added to DirectiveContext
  const nearest = deployZone
    .filter(hex => !context.occupied.has(hexToKey(hex)))
    .sort((a, b) => cubeDistance(unit.position, a) - cubeDistance(unit.position, b))[0];
  return nearest ?? unit.position; // fallback: stay put if all occupied
}
```

`DirectiveContext` needs `deploymentZone: CubeCoord[]` added.

---

## Design Decisions

- **Hold DEF bonus stays on `movementDirective === 'hold'`**, not attack layer. It's a positional bonus (dug in), not an engagement posture.
- **Attack layer defaults to `ignore`** — units don't engage unless explicitly told to. This strengthens the "commitment under uncertainty" design: you must plan engagement behavior, not just movement.
- **Attack layer gates `tryAttackClosest()`** — see "Attack Layer Wiring" section below. Every movement directive function checks the attack layer before engaging. This is the core of the two-layer model: movement and engagement are independent.
- **Capture auto-hold** — when `executeCapture()` detects the unit is on a captured city, it mutates `unit.movementDirective = 'hold'` and returns `{ type: 'hold' }`. One-time state transition: capture fulfills its purpose, unit switches to hold with DEF bonus. Ref: DESIGN.md:141 "occupy it...then hold position with DEF bonus."
- **Hunt conditioned on visibility.** Hunt only pursues units in LoS or revealed by scout. Ref: DESIGN.md:140 "pursue a specific enemy unit" (implies known target). Temporary: hunt behaves like shoot-on-sight until vision checks are implemented in directive execution.
- **Scout is a movement directive**, not a specialty modifier. It defines HOW the unit moves (probe, keep distance, reveal). Ref: DESIGN.md:138.
- **Capture is a movement directive** — it defines WHERE you go (city) and WHAT happens on arrival (occupy, auto-hold). Ref: DESIGN.md:141.
- **Engineer/sniper are locked no-ops.** Valid type values, no behavior until buff system exists.

### Behavioral change: redirect no longer consumes action

**Current code** (game-state.ts:417): `unit.hasActed = true` after redirect. Redirected units do NOT run directive AI — they change directive but don't act until next turn.

**New behavior:** Redirect changes directive fields but does NOT set `hasActed`. Directive AI runs the unit with its new directive this same turn. The unit acts immediately with the new directive.

**Rationale:** DESIGN.md:168 says "follows the new directive for the rest of the round" (implies acting this turn). DESIGN.md:175 says "commands issued before directive AI resolves" (implies directive AI still runs). The CP cost is the penalty, not action loss.

**Impact:** Redirect becomes more powerful (change plan + act in same turn). The only cost is 1 CP. Monitor for abuse in playtesting.

### Specialty as Override (Temporary)

The spec says specialties are "modifiers on these two layers, not a third category" — meaning a support unit should MOVE (per its movement directive) AND HEAL (per its specialty) in the same turn.

The current engine does not support dual actions per turn. `executeSupport()` returns a heal action and movement doesn't happen. This plan **preserves that behavior**: specialty checks run first in `executeDirective()` and return immediately.

**This is temporary.** When the combat timeline (0.4) lands, specialty effects move to Phase 8 (directive effects after movement+combat). At that point, `executeDirective()` returns a movement action, and specialty effects are resolved separately in Phase 8. Do not design around the current override behavior — it will change.

---

## Attack Layer Wiring

Currently, `executeAdvance()`, `executeHold()`, `executeFlank()`, and `executeScout()` all call `tryAttackClosest()` unconditionally — any enemy in range gets attacked regardless of directives. This makes the attack layer decorative.

**Fix:** Replace all `tryAttackClosest()` calls with `resolveAttackBehavior()`, which checks the attack layer:

```typescript
function resolveAttackBehavior(unit: Unit, context: DirectiveContext): UnitAction | null {
  if (unit.attackDirective === 'ignore') return null;

  const nearest = findClosestEnemy(unit, context);
  if (!nearest) return null;

  switch (unit.attackDirective) {
    case 'shoot-on-sight':
    case 'hunt':  // temporary: same as shoot-on-sight until vision gating
    case 'skirmish':  // temporary: same as shoot-on-sight until combat timeline
      if (canAttack(unit, nearest)) return { type: 'attack', targetUnitId: nearest.id };
      return null;
    case 'retreat-on-contact':
      // Enemy in detection range -> flee toward deployment zone
      return retreatFrom(unit, context, nearest);
  }
}
```

Then every movement function:
```typescript
function executeAdvance(unit: Unit, context: DirectiveContext): UnitAction {
  const attackBehavior = resolveAttackBehavior(unit, context);
  if (attackBehavior) return attackBehavior;
  // ... movement logic unchanged
}
```

This pattern applies to: `executeAdvance`, `executeHold`, `executeFlank`, `executeScout`, `executeCapture`. All replace `tryAttackClosest()` with `resolveAttackBehavior()`.

`retreatFrom()` already exists in `directives.ts` (used by current `executeScout`). It computes a flee path away from the enemy. With the `deployment-zone` target type, `retreat-on-contact` can flee toward the deployment zone instead of just "away from enemy."

---

## Part 1: Engine (`packages/engine/src/`)

### File order: types -> units -> terrain -> pathfinding -> combat -> commands -> directives -> game-state -> ai -> serialization -> index -> tests

### 1. types.ts

Replace `DirectiveType` (line 77):
```typescript
export type MovementDirective = 'advance' | 'flank-left' | 'flank-right' | 'scout' | 'hold' | 'capture';
export type AttackDirective = 'shoot-on-sight' | 'skirmish' | 'retreat-on-contact' | 'hunt' | 'ignore';
export type SpecialtyModifier = 'support' | 'engineer' | 'sniper';
```

`DirectiveTargetType` (line 79): add `'deployment-zone'`:
```typescript
export type DirectiveTargetType = 'central-objective' | 'city' | 'enemy-unit' | 'friendly-unit' | 'hex' | 'deployment-zone';
```

`Unit` interface (lines 90-99): replace `directive: DirectiveType` with:
```
movementDirective: MovementDirective;
attackDirective: AttackDirective;
specialtyModifier: SpecialtyModifier | null;
```

`Command` type (lines 110-114): collapse to single variant:
```typescript
export type Command = {
  type: 'redirect';
  unitId: string;
  newMovementDirective: MovementDirective;
  newAttackDirective: AttackDirective;
  newSpecialtyModifier: SpecialtyModifier | null;
  target?: DirectiveTarget;
};
```

`ClientPlaceUnit` (line 279), `ClientSetDirective` (line 291): replace `directive: DirectiveType` with three fields:
```
movementDirective: MovementDirective;
attackDirective: AttackDirective;
specialtyModifier: SpecialtyModifier | null;
```

`DirectiveContext` (line 211): add `mapRadius: number` and `deploymentZone: CubeCoord[]`.

### 2. units.ts

`createUnit()`: change params from `directive: DirectiveType = 'advance'` to:
```
movementDirective: MovementDirective = 'advance',
attackDirective: AttackDirective = 'ignore',
specialtyModifier: SpecialtyModifier | null = null,
```
Update returned object.

### 3. terrain.ts

`getMoveCost()` signature: `directive?: DirectiveType` -> `movementDirective?: MovementDirective`
Flank cost reduction check: `movementDirective` instead of `directive`.

### 4. pathfinding.ts

All `directive` params -> `movementDirective: MovementDirective`. Six call sites: `findPath`, `pathCost`, `getReachableHexes`, and their internal `getMoveCost` calls.

### 5. combat.ts

Hold bonus: `defender.directive === 'hold'` -> `defender.movementDirective === 'hold'`

### 6. commands.ts

`validateDirectiveTarget()`: change signature to `(movementDirective: MovementDirective, target: DirectiveTarget)`. Keep `capture` -> city validation. Remove `hunt` check (hunt target validated on the Command's DirectiveTarget, not here).

`validateCommand` / `canIssueCommand`: remove `direct-move` range check, `direct-attack` range check, `retreat` case. Only `redirect` remains — just check unit exists and hasn't been commanded this turn.

### 7. directives.ts

**New function: `resolveAttackBehavior()`** — see Attack Layer Wiring section above.

**Updated `resolveTarget()`** — add `deployment-zone` case that computes nearest unoccupied deployment hex from `context.deploymentZone`.

Restructure `executeDirective()`:
```typescript
export function executeDirective(unit: Unit, context: DirectiveContext): UnitAction {
  // Specialty modifiers with custom behavior (TEMPORARY: overrides movement.
  // When combat timeline lands, these move to Phase 8 and movement always runs.)
  if (unit.specialtyModifier === 'support') return executeSupport(unit, context);
  // 'engineer' and 'sniper' are no-ops, fall through to movement

  switch (unit.movementDirective) {
    case 'advance': return executeAdvance(unit, context);
    case 'hold': return executeHold(unit, context);
    case 'flank-left': return executeFlank(unit, context, 'left');
    case 'flank-right': return executeFlank(unit, context, 'right');
    case 'scout': return executeScout(unit, context);
    case 'capture': return executeCapture(unit, context);
  }
}
```

All movement functions (`executeAdvance`, `executeHold`, `executeFlank`, `executeScout`, `executeCapture`): replace `tryAttackClosest()` with `resolveAttackBehavior()`.

- `executeScout`: movement directive function (probe area, keep distance, reveal). Inherent scout behavior (keep distance) is movement logic, NOT attack layer. The old "retreat if enemy adjacent" is still scout-specific movement — if you also set `retreat-on-contact` in the attack layer, both apply (scout keeps distance AND flees on engagement).
- `executeCapture`: when unit is on a captured city, mutate `unit.movementDirective = 'hold'` and return `{ type: 'hold' }`. One-time transition.
- Hunt is attack layer, handled by `resolveAttackBehavior()`. Remove `executeHunt()` as standalone function.
- All `findPath`/`getMoveCost` calls: `unit.directive` -> `unit.movementDirective`.

**Fix `executeFlank()` — replace hardcoded offsets with scaled, vector-perpendicular waypoint:**

Current broken code (`directives.ts:139`):
```typescript
const offsets = side === 'left' ? [-5, -4, -3] : [5, 4, 3];
const candidate = createHex(objective.q + offset, objective.r);
```

New approach:
```typescript
function executeFlank(unit: Unit, context: DirectiveContext, side: 'left' | 'right'): UnitAction {
  const attackBehavior = resolveAttackBehavior(unit, context);
  if (attackBehavior) return attackBehavior;

  const resolved = resolveTarget(unit, context);
  const objective = resolved.hex;
  const mapDiameter = context.mapRadius * 2;
  const flankOffset = Math.max(2, Math.floor(mapDiameter * 0.25));

  // Vector from unit to objective
  const dq = objective.q - unit.position.q;
  const dr = objective.r - unit.position.r;

  // Perpendicular in cube coords: rotate 60 degrees left or right
  // Left rotation: (q,r,s) -> (-r,-s,-q)
  // Right rotation: (q,r,s) -> (-s,-q,-r)
  const ds = -dq - dr;
  let pq: number, pr: number;
  if (side === 'left') {
    pq = -dr; pr = -ds;
  } else {
    pq = -ds; pr = -dq;
  }

  // Normalize perpendicular to unit length, scale by flankOffset
  const len = Math.max(Math.abs(pq), Math.abs(pr), Math.abs(pq + pr)) || 1;
  const scale = flankOffset / len;

  // Validate waypoint is on map, fall back to progressively closer offsets
  let intermediateTarget = objective;
  for (let f = 1.0; f >= 0.25; f -= 0.25) {
    const cq = Math.round(objective.q + pq * scale * f);
    const cr = Math.round(objective.r + pr * scale * f);
    const candidate = createHex(cq, cr);
    if (context.terrain.has(hexToKey(candidate))) {
      intermediateTarget = candidate;
      break;
    }
  }

  return moveToward(unit, context, intermediateTarget);
}
```

This computes a waypoint perpendicular to the unit->objective axis, scaled to 25% of map diameter. Falls back to closer offsets if the waypoint is off-map. Works on any map shape/size.

### 8. game-state.ts

**Command execution (lines 325-485):** Delete `case 'direct-move'`, `case 'direct-attack'`, `case 'retreat'`. Only `case 'redirect'` remains:
```typescript
case 'redirect': {
  const unit = findUnitById(friendlyUnits, command.unitId);
  if (!unit) return;
  unit.movementDirective = command.newMovementDirective;
  unit.attackDirective = command.newAttackDirective;
  unit.specialtyModifier = command.newSpecialtyModifier;
  if (command.target) {
    unit.directiveTarget = command.target;
  }
  // DO NOT set hasActed — directive AI runs this unit with new directive this turn.
  // This is a behavioral change from current code (which sets hasActed = true).
  // Rationale: DESIGN.md:168 + 175 imply the unit acts on new directive same turn.
  break;
}
```

**Command validation (lines 165-200):** Simplify. Remove direct-move range/terrain checks, direct-attack range checks, retreat case. Only redirect: verify unit exists and hasn't been commanded.

- `placeUnit()` signature: three directive params.
- Scout pass: `unit.movementDirective === 'scout'` (was `unit.directive === 'scout'`)
- Non-scout pass: `unit.movementDirective !== 'scout'`
- Support heal check: `unit.specialtyModifier === 'support'`
- All `findPath`/`getMoveCost` calls: `unit.directive` -> `unit.movementDirective`.
- `DirectiveContext` construction (line ~279): add `mapRadius: state.map.mapRadius`, `deploymentZone: currentPlayer === 'player1' ? state.map.player1Deployment : state.map.player2Deployment`.

### 9. ai.ts

- `AiBuildAction`: replace `directive: DirectiveType` with three fields.
- `BuildPreset.directiveFn` return type: `{ movementDirective, attackDirective, specialtyModifier }`.
- All 6 presets: map old directive strings to three-field objects per migration table. **Aggressive presets must use `shoot-on-sight`**, not `ignore` — otherwise AI units walk past enemies.

### 10. serialization.ts

Spread operator on units handles new fields automatically. Add `MovementDirective, AttackDirective, SpecialtyModifier` to type imports. `SerializableGameState` unit shape inherits from updated `Unit` interface.

### 11. index.ts (engine barrel export)

Replace `DirectiveType` export with `MovementDirective, AttackDirective, SpecialtyModifier`.

### 12. Tests

All test files need `createUnit` call signatures updated per migration table:
- `directives.test.ts` — largest: every createUnit call, remove hunt-specific tests (hunt is attack layer now), update scout tests as movement directive tests, add `mapRadius` and `deploymentZone` to `makeContext()`, add flank offset scaling tests, **add resolveAttackBehavior tests** (verify ignore skips attack, shoot-on-sight attacks, retreat-on-contact flees)
- `combat.test.ts` — `makeUnit` helper: `.movementDirective` instead of `.directive`
- `game-state.test.ts` — **delete direct-move, direct-attack, retreat command tests** (those command types no longer exist). Update redirect tests to three-field form. **Add test: redirect does not set hasActed** (verify unit runs directive AI after redirect). Update placeUnit, scout ordering, support healing tests.
- `units.test.ts` — createUnit defaults: verify `attackDirective: 'ignore'`, `specialtyModifier: null`
- `commands.test.ts` — validateDirectiveTarget signature, remove direct-move/direct-attack validation tests
- `terrain.test.ts` — flank cost tests use `movementDirective` param
- `ai.test.ts` — check `.movementDirective` not `.directive`, check AI presets set `shoot-on-sight` for aggressive builds
- `serialization.test.ts` — placeUnit calls
- `pathfinding.test.ts` — `directive` param -> `movementDirective`

---

## Part 2: Server (`packages/server/src/`)

### 1. state-filter.ts

`serializeUnit()` (line 174): copy three new fields instead of `directive: unit.directive`.

`stripDirective()` (lines 211-222): replace `directive: 'advance'` with:
```
movementDirective: 'advance', attackDirective: 'ignore', specialtyModifier: null
```

### 2. state-filter.test.ts

All directive assertions need updating:
- Line 73: `.directive` -> `.movementDirective` (own unit check)
- Line 126: `enemyUnit.directive = 'flank-left'` -> set three fields
- Line 149: `.directive` -> `.movementDirective` (stripped enemy check)
- Line 153: `.directive` -> `.movementDirective` (raw state check)
- Line 164: `(u) => u.directive` -> `(u) => u.movementDirective`
- Lines 328-351: all directive mapping assertions

### 3. game-loop.ts

- `handlePlaceUnit()`: three directive params passed to engine `placeUnit()`.
- `handleSetDirective()`: set three fields on unit.

### 4. game-loop.test.ts

- Line 243: `.directive` -> `.movementDirective`

### 5. integration.test.ts

- Line 160: `data.directive` -> three fields in place-unit message
- Line 193: `data.directive` -> three fields in set-directive message

### 6. Server socket handlers (index.ts)

Update `'place-unit'` and `'set-directive'` event data shapes to carry three fields.

---

## Part 3: Client (`packages/client/src/`)

### 1. CommandMenu.tsx — Rewrite to single Redirect button

Delete Move, Attack, Retreat buttons. Delete `handleMoveMode`, `handleAttackMode`, `handleRetreat`. Delete `commandMode` move/attack state.

One button: **Redirect (1 CP)**. Opens two-layer picker:
- **Move layer**: 6 card-style buttons (advance, flank-L, flank-R, scout, hold, capture)
- **Attack layer**: 5 toggle buttons (shoot-on-sight, skirmish, retreat-on-contact, hunt, ignore)
- **Special**: locked display (support available, engineer/sniper grayed)
- **Confirm** button dispatches redirect command

Initial state of picker: populated from selected unit's current directive values.

Target selection flow: `capture` -> city target picker, `hunt` -> enemy unit target picker (visible only).

### 2. DirectiveSelector.tsx — Same two-layer picker for planning phase

Three sections matching CommandMenu picker. Same component, different context (planning vs battle).

### 3. App.tsx

- **Delete move command mode logic** (lines ~420-445): no more `commandMode === 'move'` click handling, no `direct-move` command creation.
- **Delete attack command mode logic** (lines ~450-460): no more `commandMode === 'attack'` click handling, no `direct-attack` command creation.
- Keep selection-based range display (move range on select, attack range on select) — informational, not command interaction.
- `findPath` calls (lines ~399, ~493): `unit.directive` -> `unit.movementDirective`.

### 4. game-store.ts

- Remove `commandMode: 'move' | 'attack' | 'none'` state. No command modes needed.
- `setUnitDirective()`: accepts three fields, mutates all three on unit.
- `setUnitDirectiveTarget()`: same + directiveTarget.
- `confirmBuild()`: defaults to `advance`/`ignore`/`null`.
- Remove `highlightedHexes` tied to command modes (keep for selection info display).

### 5. unit-model.ts — Icon maps

```
MOVEMENT_ICONS: advance=triangle-up, flank-left=triangle-left, flank-right=triangle-right, scout=circle, hold=square, capture=flag
ATTACK_ICONS: shoot-on-sight=crosshair, skirmish=slash, retreat-on-contact=triangle-down, hunt=eye, ignore=(none)
```
Display: movement icon primary, attack icon secondary (when not ignore). Specialty icon overlay when set.

### 6. UnitInfoPanel.tsx

Three-row display: Movement info, Attack info (if not ignore), Specialty info (if set).

### 7. command-renderer.ts

**Delete `direct-move` path polyline rendering** (lines 48-87). **Delete `direct-attack` crosshair rendering** (lines 89-130). Redirect commands have no spatial visualization.

(Future: visualize directive target as waypoint marker. Not this PR.)

### 8. BattleHUD.tsx

Update command display. Only one command type now:
```
`redirect:${c.unitId} -> ${c.newMovementDirective}/${c.newAttackDirective}`
```

### 9. network-manager.ts

`placeUnit()` and `setDirective()`: three-field signatures and emit payloads.
Remove `directMove()`, `directAttack()`, `retreat()` methods if they exist.

### 10. App.tsx (selection highlights)

Selection highlighting lives in App.tsx (there is no selection-renderer.ts file). Remove command-mode-driven highlights (`direct-move` destinations). Keep selection-info highlights (move range, attack range on unit select — informational only).

### 11. components.css

Remove `.command-btn` active states for move/attack modes. Add `.directive-layer-group`, `.directive-layer-btn`, `.directive-layer-btn.active` for two-layer picker. Add `.directive-layer-label` for section headers.

---

## Verification

1. `pnpm test` — all engine tests pass (update count after test changes)
2. `pnpm test` — all server tests pass
3. `pnpm dev` — start vsAI game, place units with two-layer directive selector
4. Battle phase: single Redirect button opens two-layer picker, redirect works
5. Verify no Move/Attack/Retreat buttons exist in command menu
6. Verify fog stripping: enemy units show `advance/ignore/null`
7. Verify redirect does NOT consume unit action — unit acts with new directive same turn
8. Verify attack layer: unit with `advance` + `ignore` walks past enemies without attacking
9. Verify attack layer: unit with `advance` + `shoot-on-sight` stops to engage enemies in range
10. Verify attack layer: unit with `advance` + `retreat-on-contact` flees when enemy detected

---

## Open Debt

1. **Flank collapse**: `flank-left`/`flank-right` should become single `flank(target)` per spec. This plan keeps them separate with improved offset calculation. Collapse when flank offset is rewritten for target-relative direction. Separate task.
2. **Specialty as modifier**: Specialty currently overrides movement in `executeDirective()`. When combat timeline (0.4) lands, specialty effects move to Phase 8 and movement always runs. Do not design client UI or tests around the override behavior — it is temporary.
3. **Counter-fire gap**: RESOLUTION_PIPELINE.md Phase 6 (line 248) defines counter-fire for `cautious` ROE ("units that survived Phase 5 fire back"). This plan replaces `cautious` with `retreat-on-contact`, which has different behavior (flee, not return fire). No attack layer value maps to "don't initiate, but return fire when attacked." Counter-fire does not exist in the current engine — it's combat timeline (0.4) work. When 0.4 lands, either add a 6th attack value (`cautious`/`defensive`) or assign counter-fire to `retreat-on-contact` (flee AND shoot back). Defer decision until then.
4. **Engineer/sniper behavior**: No-op until buff system exists.
5. **Hunt visibility check**: Hunt should only pursue units in LoS or revealed by scout. Requires checking vision state during directive execution. Temporary: hunt behaves like shoot-on-sight.
6. **Command path visualization**: Old direct-move showed path polyline, old direct-attack showed crosshair. Redirect has no spatial visualization. Future: show directive target as waypoint marker.
7. **Default attack = ignore behavioral change**: Current advance attacks in range. New advance + ignore walks past enemies. AI presets must explicitly set shoot-on-sight for aggressive behavior. Monitor AI in playtesting.
8. **Skirmish temporary equivalence**: Skirmish ("fire once, keep moving") requires the combat timeline to resolve mid-movement fire. Until then, skirmish behaves identically to shoot-on-sight (stop and attack). Distinguish in 0.4.
9. **RESOLUTION_PIPELINE.md stale**: Still uses old terminology (assault, cautious) and old directive model. Needs updating to match this plan's taxonomy. Separate doc task, not blocking implementation.

## Risks

1. **Behavioral change from ignore default**: Current advance attacks anything in range. New advance + ignore walks past enemies. AI presets must set shoot-on-sight explicitly.
2. **No standalone move/attack commands**: Players lose click-to-move, click-to-attack. Redirect-only is intentional but untested. If playtesting reveals this feels bad, consider "force fire" as a rare one-turn exception.
3. **Client UI complexity**: Two-layer picker in both planning and battle. Keep functional, iterate on UX later.
4. **Redirect doesn't consume action**: Redirected units act immediately with new directive. This makes redirect powerful — change plan + act in same turn. The 1 CP cost is the only penalty. Monitor for abuse.
