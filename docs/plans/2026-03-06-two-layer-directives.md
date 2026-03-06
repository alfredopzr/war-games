# Two-Layer Directive System — Implementation Plan

Branch: `layered-directives` (off `Chack-Atacc`)
Spec: GAME_MATH_ENGINE.md §A10, §0.1 | RESOLUTION_PIPELINE.md §Two-Layer Directive Model

---

## Context

The current engine uses a single flat `DirectiveType` with 8 values. The design spec calls for two independent directive layers plus an optional specialty modifier. This is task 0.1 from the implementation plan — "Do this first. It is a type change that cascades everywhere."

---

## Current → Target

**Current:** `directive: DirectiveType` = `'advance' | 'hold' | 'flank-left' | 'flank-right' | 'scout' | 'support' | 'hunt' | 'capture'`

**Target:**
```
movementDirective: MovementDirective = 'advance' | 'flank-left' | 'flank-right' | 'hold' | 'retreat'
engagementROE: EngagementROE = 'assault' | 'skirmish' | 'cautious' | 'ignore'
specialtyModifier: SpecialtyModifier | null = 'capture' | 'support' | 'scout' | 'fortify' | null
```

## Migration Mapping

| Old Directive | movementDirective | engagementROE | specialtyModifier |
|---------------|-------------------|---------------|-------------------|
| `advance`     | `advance`         | `assault`     | `null`            |
| `hold`        | `hold`            | `cautious`    | `null`            |
| `flank-left`  | `flank-left`      | `assault`     | `null`            |
| `flank-right` | `flank-right`     | `assault`     | `null`            |
| `scout`       | `advance`         | `cautious`    | `scout`           |
| `support`     | `advance`         | `cautious`    | `support`         |
| `hunt`        | `advance`         | `assault`     | `null` (target: enemy-unit) |
| `capture`     | `advance`         | `ignore`      | `capture`         |

`hunt` is eliminated as a distinct concept — it's `advance` + `assault` with an `enemy-unit` target.
`retreat` is new as a movement directive (was only a CP command before).
`fortify` is new (no-op for now, exists as valid value).

---

## Design Decisions

- **Hold DEF bonus stays on `movementDirective === 'hold'`**, not ROE. It's a positional bonus (dug in), not an engagement posture.
- **ROE is stored but mostly unused** until the combat timeline (0.4) is built. For now it flows through types and serialization but doesn't affect game logic beyond being set.
- **Hunt behavior preserved**: `executeAdvance()` checks if `directiveTarget.type === 'enemy-unit'` and attacks that specific enemy first (not just closest). This preserves old hunt behavior without a separate directive.
- **`retreat` as movement directive**: New function `executeRetreatDirective()` in `directives.ts`. Moves toward deployment zone.
- **`fortify` specialty**: No-op for now. Falls through to movement directive.

---

## Part 1: Engine (`packages/engine/src/`)

### File order: types → units → terrain → pathfinding → combat → commands → directives → game-state → ai → serialization → index → tests

### 1. types.ts

**Line 77** — Replace `DirectiveType`:
```typescript
export type MovementDirective = 'advance' | 'flank-left' | 'flank-right' | 'hold' | 'retreat';
export type EngagementROE = 'assault' | 'skirmish' | 'cautious' | 'ignore';
export type SpecialtyModifier = 'capture' | 'support' | 'scout' | 'fortify';
```

**Lines 90-99** — `Unit` interface: replace `directive: DirectiveType` with:
```
movementDirective: MovementDirective;
engagementROE: EngagementROE;
specialtyModifier: SpecialtyModifier | null;
```

**Line 111** — `Command` redirect variant:
```
{ type: 'redirect'; unitId: string;
  newMovementDirective: MovementDirective;
  newEngagementROE: EngagementROE;
  newSpecialtyModifier: SpecialtyModifier | null;
  target?: DirectiveTarget }
```

**Lines 279-293** — `ClientPlaceUnit`, `ClientSetDirective`: replace `directive: DirectiveType` with three fields.

### 2. units.ts

**Lines 92-110** — `createUnit()`: change params from `directive: DirectiveType = 'advance'` to:
```
movementDirective: MovementDirective = 'advance',
engagementROE: EngagementROE = 'assault',
specialtyModifier: SpecialtyModifier | null = null,
```
Update returned object.

### 3. terrain.ts

**Line 35** — `directive?: DirectiveType` → `movementDirective?: MovementDirective`
**Lines 53-54** — Check `movementDirective` instead of `directive` for flank cost reduction.

### 4. pathfinding.ts

**Lines 37, 96, 133, 146, 167, 197** — Rename `directive` param to `movementDirective`, change type to `MovementDirective`. Pass through to `getMoveCost`.

### 5. combat.ts

**Line 33** — `defender.directive === 'hold'` → `defender.movementDirective === 'hold'`

### 6. commands.ts

**Lines 40-50** — `validateDirectiveTarget()`: change signature to `(specialtyModifier: SpecialtyModifier | null, target: DirectiveTarget)`. Remove `hunt` check. Keep `capture` → city validation.

### 7. directives.ts

**Lines 78-97** — Restructure `executeDirective()`:
```typescript
export function executeDirective(unit: Unit, context: DirectiveContext): UnitAction {
  // Specialty modifiers with custom behavior
  if (unit.specialtyModifier === 'scout') return executeScout(unit, context);
  if (unit.specialtyModifier === 'support') return executeSupport(unit, context);
  if (unit.specialtyModifier === 'capture') return executeCapture(unit, context);
  // 'fortify' = no-op, falls through to movement

  switch (unit.movementDirective) {
    case 'advance': return executeAdvance(unit, context);
    case 'hold': return executeHold(unit, context);
    case 'flank-left': return executeFlank(unit, context, 'left');
    case 'flank-right': return executeFlank(unit, context, 'right');
    case 'retreat': return executeRetreatDirective(unit, context);
  }
}
```

- Add `executeRetreatDirective()` — move toward deployment zone (reuse retreat pattern from game-state.ts).
- Remove `executeHunt()` — preserved via `executeAdvance` checking `directiveTarget.type === 'enemy-unit'`.
- All `findPath`/`getMoveCost` calls: `unit.directive` → `unit.movementDirective`.

### 8. game-state.ts

- **Line 90** — `placeUnit()` signature: three directive params.
- **Line 242** — `unit.directive !== 'scout'` → `unit.specialtyModifier !== 'scout'`
- **Line 248** — `unit.directive === 'scout'` → `unit.specialtyModifier === 'scout'`
- **Line 295** — `unit.directive === 'support'` → `unit.specialtyModifier === 'support'`
- **Lines 410-419** — Redirect handler: set all three fields from command.
- **Lines 355, 370, 458, 470** — `unit.directive` → `unit.movementDirective` in findPath/getMoveCost calls.

### 9. ai.ts

- **Lines 31-36** — `AiBuildAction`: replace `directive: DirectiveType` with three fields.
- **Lines 44-48** — `BuildPreset.directiveFn` return type: `{ movementDirective, engagementROE, specialtyModifier }`.
- **Lines 50-138** — All 6 presets: map old directive strings to three-field objects per migration table.

### 10. serialization.ts

Spread operator on units handles new fields automatically. Add `MovementDirective, EngagementROE, SpecialtyModifier` to type imports. `SerializableGameState` unit shape inherits from updated `Unit` interface.

### 11. index.ts

**Line 9** — Replace `DirectiveType` export with `MovementDirective, EngagementROE, SpecialtyModifier`.

### 12. Tests

All test files need `createUnit` call signatures updated per migration table:
- `directives.test.ts` — largest: every createUnit call, remove hunt-specific tests (replace with advance+assault+enemy-target tests)
- `combat.test.ts` — `makeUnit` helper: `.movementDirective` instead of `.directive`
- `game-state.test.ts` — redirect command tests, placeUnit tests, scout ordering, support healing
- `units.test.ts` — createUnit defaults
- `commands.test.ts` — validateDirectiveTarget signature
- `terrain.test.ts` — flank cost tests use `movementDirective` param
- `ai.test.ts` — check `.movementDirective` not `.directive`
- `serialization.test.ts` — placeUnit calls

---

## Part 2: Server (`packages/server/src/`)

### 1. state-filter.ts

**Lines 211-222** — `stripDirective()`: replace `directive: 'advance'` with:
```
movementDirective: 'advance', engagementROE: 'assault', specialtyModifier: null
```

### 2. game-loop.ts

- **Lines 190-218** — `handlePlaceUnit()`: three directive params passed to engine `placeUnit()`.
- **Lines 257-293** — `handleSetDirective()`: set three fields on unit.

### 3. Server socket handlers (index.ts)

Update `'place-unit'` and `'set-directive'` event data shapes to carry three fields.

---

## Part 3: Client (`packages/client/src/`)

### 1. DirectiveSelector.tsx — Full rewrite

Three sections: **Movement** (5 card-style buttons), **ROE** (4 toggle buttons), **Specialty** (4 toggles + None).
- Movement: primary selection, large cards with name + description
- ROE: compact toggle row
- Specialty: compact toggle row with None option
- Target selection flow: `capture` → city target, `support` → friendly unit target

### 2. CommandMenu.tsx — Sectioned redirect

Replace flat dropdown with sectioned form: Movement section, ROE section, Confirm button.
Local state tracks `redirectMovement`, `redirectROE`, `redirectSpecialty` initialized from selected unit.

### 3. game-store.ts

- `setUnitDirective()`: accepts three fields, mutates all three on unit
- `setUnitDirectiveTarget()`: same + directiveTarget
- `confirmBuild()`: defaults to `advance`/`assault`/`null`
- `targetSelectionDirective` → `targetSelectionSpecialty`

### 4. unit-model.ts — Icon maps

```
MOVEMENT_ICONS: advance=▲, flank-left=◄, flank-right=►, hold=■, retreat=▼
SPECIALTY_ICONS: capture=⚑, support=◆, scout=●, fortify=⌂
```
Display: movement icon primary, specialty icon when set. ROE visible in info panel only.

### 5. UnitInfoPanel.tsx

Three-row display: Movement info, ROE info, Specialty info (if set).

### 6. command-renderer.ts

**Line 58** — `unit.directive` → `unit.movementDirective`

### 7. BattleHUD.tsx

Update log string to `[${u.movementDirective}/${u.engagementROE}]`.

### 8. network-manager.ts

`placeUnit()` and `setDirective()`: three-field signatures and emit payloads.

### 9. components.css

Add `.directive-toggle-group`, `.directive-toggle`, `.directive-toggle.active`, `.directive-dropdown-section`, `.directive-dropdown-label` classes.

---

## Verification

1. `pnpm test` — all engine tests pass (303+)
2. `pnpm test` — all server tests pass
3. `pnpm dev` — start vsAI game, place units with directive selector, verify three-layer picker works
4. Play through a full battle: verify movement directives work, redirect commands work, unit icons display correctly
5. Verify fog stripping: enemy units show `advance/assault/null` (not real directives)

---

## Risks

1. **Hunt removal**: Preserved via `executeAdvance` checking `directiveTarget.type === 'enemy-unit'`. If behavior diverges, add explicit check.
2. **`retreat` as directive**: New code, not just a refactor. Needs `executeRetreatDirective()` implementation.
3. **`fortify` is a no-op**: Exists as valid type but has no behavior until combat timeline.
4. **Client UI complexity**: Three-section picker is more complex than flat list. Keep functional, not pretty — this branch may PR later.
