# Engineer Unit & Building System Design

## Overview

Add a new **Engineer** unit type and a **Building** system to HexWar. Engineers are cheap, weak support units whose value comes from constructing persistent structures on the hex grid. Buildings provide vision, area denial, firepower, and defensive bonuses.

## Engineer Unit

### Stats

| Stat | Value |
|------|-------|
| Cost | 75 |
| HP | 2 |
| ATK | 1 |
| DEF | 1 |
| Move Range | 3 |
| Attack Range | 1 |
| Min Attack Range | 1 |
| Vision Range | 3 |

Cheapest unit in the game. Fragile, weak in combat, standard mobility. Value comes entirely from building placement.

### Type Advantages

Engineer is weak against everything and threatens nothing:

| Matchup | Multiplier |
|---------|-----------|
| infantry vs engineer | 1.5 |
| tank vs engineer | 1.5 |
| artillery vs engineer | 1.2 |
| recon vs engineer | 1.2 |
| engineer vs infantry | 0.5 |
| engineer vs tank | 0.3 |
| engineer vs artillery | 0.8 |
| engineer vs recon | 0.5 |
| engineer vs engineer | 1.0 |

### Directives

Engineers use all existing directives (advance, hold, flank-left, flank-right, scout, support, hunt, capture). No new directive type. Building is always a deliberate player command (costs 1 CP).

## Building System

### Data Model

```typescript
type BuildingType = 'recon-tower' | 'mortar' | 'mines' | 'defensive-position'

interface BuildingStats {
  cost: number
  visionRange?: number       // recon-tower
  attackRange?: number        // mortar
  minAttackRange?: number     // mortar
  atk?: number               // mortar
  damage?: number            // mines
  defenseBonus?: number      // defensive-position
}

interface Building {
  id: string
  type: BuildingType
  owner: PlayerId
  position: CubeCoord
  isRevealed: boolean        // false for mines (hidden from enemy)
}
```

### Building Types

| Type | Cost | Effect |
|------|------|--------|
| Recon Tower | 75 | Grants +4 vision range from its hex. Passive. |
| Mortar | 150 | Attacks nearest enemy within range 3 (min 2) for 2 ATK each turn. |
| Mines | 50 | Hidden. Deals 2 damage when enemy moves onto hex. Destroyed on trigger. |
| Defensive Position | 100 | Friendly unit on hex gets +0.5 terrain defense modifier. |

All buildings have 1 HP and are destroyed by any attack.

### Build Action

Engineers build on **any adjacent hex** (not their own position).

New action variant:
```typescript
{ type: 'build'; buildingType: BuildingType; targetHex: CubeCoord }
```

New command variant:
```typescript
{ type: 'direct-build'; unitId: string; buildingType: BuildingType; targetHex: CubeCoord }
```

Costs 1 CP like any other command.

### Build Validation

- Only engineers can build
- Engineer has not acted this turn (`hasActed === false`)
- Target hex must be adjacent to the engineer's position
- No existing building on the target hex
- Target hex is not a deployment zone hex
- Target hex is not a mountain
- Player has enough resources to pay the building cost
- Mutually exclusive with move: engineer either moves OR builds per turn

### Attacking Buildings

Any unit can attack a building using:
```typescript
{ type: 'attack'; targetBuildingId: string }
```

Buildings have 1 HP and are destroyed by any attack. Buildings do not fight back.

## Integration

### Vision

- Recon towers are added as vision sources during visibility calculation, with range 4.
- Mines are hidden from enemy vision (`isRevealed: false`). Always visible to the owner.

### Combat

- **Defensive Position**: Adds +0.5 to terrain defense modifier for friendly units on that hex.
- **Mortar**: Simplified damage formula, no type multiplier, no random variance: `max(1, floor(atk - DEF * terrainDefense))`.

### Mine Triggering

During any unit movement (commanded or directive), after each hex step:
1. Check if a mine exists on that hex owned by the opponent
2. If so, deal 2 damage to the moving unit
3. Destroy the mine
4. Movement continues (unit doesn't stop unless killed)

### Turn Execution Order (Updated)

1. Player spends CP (0-4 points)
2. Commanded units act (move, attack, or direct-build)
3. Directive units act (scouts first, then others)
4. **Mortar buildings fire** (after all units have moved, targets final positions)
5. City ownership update
6. Objective tracking
7. Switch to opponent

### Round Lifecycle

- Buildings persist for the duration of a round
- All buildings are cleared when a new round starts
- Buildings do NOT carry over between rounds

### GameState Addition

Add `buildings: Building[]` to `GameState`.
