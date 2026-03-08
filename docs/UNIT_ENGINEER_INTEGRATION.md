# Engineer Unit & Building System — Integration Decisions

## Origin

Alfredo built the engineer unit and building system on the old sequential engine (`engineer-unit` branch, merged to `origin/main` via PR #4). The engine mechanics were solid and well-tested, but targeted the old `executeTurn()` pattern. Porting to Chack-Atacc required adapting to the 10-phase simultaneous resolution pipeline (`resolveTurn()`), different stat scale, different directive system, and different command model.

## Engineer Unit

| Stat | Value | Notes |
|------|-------|-------|
| cost | 75 | Cheapest unit |
| maxHp | 20 | Same as recon/artillery |
| atk | 3 | Intentionally breaks ATK = HP * 0.35 invariant |
| def | 1 | Minimum |
| moveRange | 3 | Same as infantry |
| attackRange | 1 | Melee only |
| minAttackRange | 1 | — |
| visionRange | 3 | Standard |
| canClimb | true | Can traverse mountain terrain |
| responseTime | 4 | Slowest tier (with artillery) |

**Type Advantages**: Every combat unit gets 1.5x against engineer. Engineer hits back at 0.3-0.8x. Engineer is not a combat unit — its value comes entirely from building construction.

## Building Types

| Building | Cost | Key Stat | Behavior |
|----------|------|----------|----------|
| Recon Tower | 75 | visionRange: 4 | Provides independent LOS from tower position. Works even if the builder dies. |
| Mortar | 150 | ATK 7, range 2-3 | Auto-fires at nearest enemy in range. No type advantage. Uses terrain defense + DP bonus in damage calc. |
| Mines | 50 | damage: 20 | Hidden from enemy. Triggers during movement (step-by-step path walking). Consumed on trigger. |
| Defensive Position | 100 | defenseBonus: 0.3 | Reduces incoming damage by 30% (post-damage multiplier). Applied in Phase 5 and Phase 6. |

All buildings are **ephemeral** — cleared at round end via `scoreRound()`.

## Design Decisions

### Building placement: at engineer's position (not adjacent)

**Decision**: Build command places building at the engineer's current hex.

**Rationale**: Adjacent-hex placement adds UI complexity (which hex?) with no strategic value. Hexes are small spatial units. The engineer is already at the location where they want the building. Keeping it simple reduces both engine validation and client interaction code.

### No `validateBuild()` terrain restrictions

**Decision**: No terrain validation beyond "unit is an engineer and player can afford it."

**Rationale**: The old engine had terrain modifiers for plains, forest, mountain, and city. The new engine simplified to only forest + elevation. Since terrain restrictions were tied to the old modifier system, they don't apply. Engineers with `canClimb: true` can reach mountains, and building there is a valid tactical choice (mortar on high ground, recon tower with elevation bonus).

### Defensive position as post-damage multiplier

**Decision**: `damage * (1 - 0.3)` applied after full damage calculation, not added to `terrainDef`.

**Rationale**: Adding to `terrainDef` would mean DP only matters on hexes where terrain defense is already nonzero (only forest). As a post-damage multiplier, DP provides a consistent 30% reduction everywhere — plains, forest, mountain, city. This makes DP worth building in any position, not just forest.

### `attack-building` command type

**Decision**: Added as a third Command variant. Any unit can target enemy buildings for destruction.

**Rationale**: Without this, the only counterplay to enemy buildings is killing the engineer before they build, or surviving until round end. Mortars and recon towers are strong enough to warrant a destroy option. Costs one command point.

### Mine fog-of-war via `isRevealed` field

**Decision**: Buildings have an `isRevealed` boolean. Mines are created with `isRevealed: false`. Other buildings are `isRevealed: true`. The server state filter hides unrevealed enemy buildings regardless of LOS.

**Rationale**: Mines are traps. If the opponent has LOS to the hex, they should NOT see mines there — that defeats the purpose. Using a field on the building itself (rather than type-checking in the filter) keeps the filter generic and the hiding rule co-located with the building definition.

### Mine triggering during path walking (not after movement)

**Decision**: Mines are checked at each step of a unit's movement path, before intercept checks. If a unit walks through a mined hex, the mine triggers immediately at that hex — the unit doesn't reach its destination.

**Rationale**: Post-movement mine resolution meant mines only triggered if a unit ended on the mine hex. Units pathing through mined hexes would pass unharmed. This makes mines area denial along corridors, not just endpoint traps.

### Recon tower vision independent of engineer survival

**Decision**: Recon tower vision is computed for all towers owned by a player, regardless of whether any engineer units are alive. Towers are iterated directly in the directive effects phase, not gated on `unit.type === 'engineer'`.

**Rationale**: The building exists on the map. It has vision range. Whether the engineer who built it is still alive is irrelevant to whether the tower can see. Coupling tower function to engineer survival creates unintuitive behavior.

### Recon tower integrated into server LOS

**Decision**: `calculateVisibility` in the server state filter includes recon tower positions as virtual vision sources. This ensures fog-of-war is consistent with what towers reveal.

**Rationale**: Without this, tower reveal events are cosmetic — the server's authoritative state filter wouldn't include enemies visible only from towers, so they'd be filtered out of the state sent to the client.

## Pipeline Integration Points

| Phase | Building | Implementation |
|-------|----------|----------------|
| 2b | All | `resolveBuildCommands()` — processes build commands, deducts cost, creates building |
| 2b | All | `resolveAttackBuildingCommands()` — processes attack-building commands, removes target building |
| 3 | Mines | Inside `resolveMovement()` path loop — checked at each step before intercepts |
| 5 | Defensive Position | `applyDefensivePositionBonus()` — post-damage multiplier on initiative fire |
| 6 | Defensive Position | Same — applied on counter fire |
| 7b | Mortar | `resolveMortarFire()` — auto-targets nearest enemy in range |
| 8 | Recon Tower | `resolveReconTowerVision()` — emits reveal events, independent of engineer |

## Faction Rename

The player-1 faction was called `'engineer'` in client code (palette, constants, App). Renamed to `'iron-collective'` to avoid collision with the `'engineer'` UnitType. Client-only change — no engine or server impact.

## SpecialtyModifier Cleanup

`'engineer'` was previously a no-op SpecialtyModifier alongside `'support'` and `'sniper'`. Removed entirely to avoid naming confusion with the UnitType. The modifier can be re-added later under a different name if needed.
