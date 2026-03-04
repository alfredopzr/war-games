# Directive Targeting System — Design Document

**Date**: 2026-03-04
**Status**: Approved

## Summary

Extend the existing directive system so all directives can optionally carry a target (city, enemy unit, friendly unit, or arbitrary hex). Add two new directive types: `hunt` (aggressive pursuit of an enemy unit) and `capture` (move to city, occupy, then hold). AI improvements deferred to a later phase.

---

## Type System Changes

### DirectiveTarget

```typescript
type DirectiveTargetType = 'central-objective' | 'city' | 'enemy-unit' | 'friendly-unit' | 'hex';

interface DirectiveTarget {
  type: DirectiveTargetType;
  cityId?: string;        // for 'city'
  unitId?: string;        // for 'enemy-unit' | 'friendly-unit'
  hex?: CubeCoord;        // for 'hex'
}
```

### DirectiveType expansion

```typescript
type DirectiveType = 'advance' | 'hold' | 'flank-left' | 'flank-right'
  | 'scout' | 'support' | 'hunt' | 'capture';
```

### Unit interface

```typescript
interface Unit {
  readonly id: string;
  readonly type: UnitType;
  readonly owner: PlayerId;
  hp: number;
  position: CubeCoord;
  directive: DirectiveType;
  directiveTarget: DirectiveTarget;  // new — defaults to { type: 'central-objective' }
  hasActed: boolean;
}
```

### Command update

```typescript
type Command =
  | { type: 'redirect'; unitId: string; newDirective: DirectiveType; target?: DirectiveTarget }
  | { type: 'direct-move'; unitId: string; targetHex: CubeCoord }
  | { type: 'direct-attack'; unitId: string; targetUnitId: string }
  | { type: 'retreat'; unitId: string };
```

If `target` is omitted on redirect, the unit keeps its current `directiveTarget`.

### DirectiveContext expansion

```typescript
interface DirectiveContext {
  friendlyUnits: Unit[];
  enemyUnits: Unit[];
  terrain: Map<string, TerrainType>;
  centralObjective: CubeCoord;
  gridSize: GridSize;
  cities: City[];  // new
}
```

### Client/Server message updates

`ClientPlaceUnit` and `ClientSetDirective` gain an optional `target` field.

---

## Target Resolution & Fallback

A `resolveTarget()` function resolves the current target to a hex coordinate, with fallback when targets become invalid.

```typescript
interface ResolvedTarget {
  hex: CubeCoord;
  isValid: boolean;  // false = fallback was used
}

function resolveTarget(unit: Unit, context: DirectiveContext): ResolvedTarget;
```

### Resolution by target type

| Target Type | Resolution | Fallback |
|-------------|-----------|----------|
| `central-objective` | Returns objective hex | N/A (always valid) |
| `city` | Looks up city position by ID | Nearest uncaptured enemy city, then central objective |
| `enemy-unit` | Looks up enemy position by ID | Nearest living enemy, then central objective |
| `friendly-unit` | Looks up friendly position by ID | Nearest friendly, then hold position |
| `hex` | Returns the hex coordinate | N/A (always valid) |

When fallback triggers, the unit's `directiveTarget` is **mutated** to the new target so it persists into future turns.

---

## Directive Behaviors with Targeting

### Advance (enhanced)

Pathfinds toward the resolved target instead of always the central objective. Attacks enemies encountered en route. No other behavior change.

### Hold (enhanced)

If not at the resolved target hex, moves toward it. Once there (or adjacent), stops and holds with DEF bonus. Only attacks enemies in range. Enables "go defend that chokepoint."

### Flank-left / Flank-right (enhanced)

Computes the arc waypoint relative to the resolved target instead of the central objective. Offset logic unchanged, just recentered.

### Scout (enhanced)

Moves toward the resolved target area but keeps 2-3 hex distance. Retreats if threatened. When targeting an enemy unit, shadows from safe distance (tracking). When targeting a hex/city, reconnoiters around that area.

### Support (enhanced)

When targeting a friendly unit, follows that specific unit and heals it. When targeting a city/hex, moves there and heals nearby friendlies. Maintains ~2 hex follow distance.

### Hunt (new)

- **Requires** `enemy-unit` target
- Every turn: close distance via shortest path
- Attack as soon as in range
- Ignores other enemies unless blocking the path
- On target death: retargets nearest enemy unit
- Single-minded aggressive pursuit

### Capture (new)

- **Requires** `city` target
- Pathfinds to the city hex
- On arrival: occupies (city ownership update)
- Then switches to hold behavior — stays on city with DEF bonus
- On retarget (city invalid): picks nearest uncaptured enemy city

---

## Validation Rules

| Directive | Required Target | Allowed Targets |
|-----------|----------------|-----------------|
| `hunt` | `enemy-unit` | `enemy-unit` only |
| `capture` | `city` | `city` only |
| All others | None (defaults to `central-objective`) | Any target type |

Target references must be valid at time of issue (city must exist, unit must be alive). They can become invalid later — handled by fallback.

---

## Client UI Changes

### DirectiveSelector (build phase)

- After selecting a directive type, a secondary panel appears for target selection
- If directive requires a target (`hunt`, `capture`): map enters target-selection mode with valid targets highlighted
- If directive accepts optional targets: "Set Target" button appears; skipping defaults to `central-objective`
- Target selection mode: clickable hexes/units/cities glow. Click to confirm. ESC to cancel.

### CommandMenu (battle phase)

- Clicking Redirect shows directive dropdown (unchanged)
- After selecting directive, "Change Target" option appears (optional — skip to keep current target)
- Same map-click target selection as build phase

### Visual indicators

- Faint dashed line from unit toward its target hex (own units only)
- Different icon per target type: crosshair (hunt), flag (capture), waypoint marker (general)

No new UI panels or screens.

---

## Files Changed & Implementation Order

| Order | File | Changes |
|-------|------|---------|
| 1 | `packages/engine/src/types.ts` | Add `DirectiveTarget`, `DirectiveTargetType`, `ResolvedTarget`. Expand `DirectiveType`. Add `directiveTarget` to `Unit`. Update `Command`. Update `DirectiveContext`. Update client/server messages. |
| 2 | `packages/engine/src/directives.ts` | Add `resolveTarget()`. Update all 6 existing directive functions to use resolved target. Add `executeHunt()` and `executeCapture()`. |
| 3 | `packages/engine/src/commands.ts` | Add validation for directive+target combos. |
| 4 | `packages/engine/src/game-state.ts` | Pass cities into `DirectiveContext`. Handle `capture` city occupation. Apply target on redirect command. |
| 5 | `packages/client/src/components/DirectiveSelector.tsx` | Add target selection flow for build phase. |
| 6 | `packages/client/src/components/CommandMenu.tsx` | Add target selection to redirect command. |
| 7 | `packages/client/src/store/game-store.ts` | Store `directiveTarget` state, target selection mode. |
| 8 | `packages/server/src/game-loop.ts` | Pass target through on place/redirect, validate target references. |

### Not changed

- `combat.ts` — No combat formula changes
- `ai.ts` — AI improvements deferred (uses existing directives with default targets)
- `pathfinding.ts` — Already accepts arbitrary target hexes

### Approach

Tests alongside each step (TDD). Engine first, then client, then server.
