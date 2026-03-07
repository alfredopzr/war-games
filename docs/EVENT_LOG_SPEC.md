# Event Log Spec

Canonical schema for battle events. This document defines the data contract for all downstream consumers: replay-sequencer, battle log, server turn log, and future spectator mode.

RESOLUTION_PIPELINE.md defines the 10-phase combat timeline. This document defines the structured output of that timeline.

---

## Schema Version

**v1** -- Sprint 2 (structured event log). Sprint 3 will add intercept/counter/melee emission sites. The types are defined now but not emitted.

---

## Event Type Table

All variants extend `BattleEventBase`:

```typescript
interface BattleEventBase {
  readonly actingPlayer: PlayerId;
  readonly phase: BattleEventPhase; // 'movement' | 'combat' | 'capture' | 'objective' | 'round'
}
```

### Emitted Now

| Type | Phase | Fields | Source |
|---|---|---|---|
| `move` | movement | `unitId, unitType, from, to` | `applyDirectiveAction` case 'move' |
| `damage` | combat | `attackerId, attackerType, attackerPosition, defenderId, defenderType, defenderPosition, damage, defenderHpAfter, defenderTerrain, response?` | `applyDirectiveAction` case 'attack' (defender survives). `response: 'none'` on Phase 3 passive intercept hits (ignore/retreat-on-contact units that take damage without firing back). |
| `kill` | combat | `attackerId, attackerType, attackerPosition, defenderId, defenderType, defenderPosition, damage, defenderTerrain` | `applyDirectiveAction` case 'attack' (defender dies) |
| `capture` | capture | `unitId, unitType, cityKey, previousOwner: null` | `updateCityOwnership` (neutral city) |
| `recapture` | capture | `unitId, unitType, cityKey, previousOwner: PlayerId` | `updateCityOwnership` (enemy city) |
| `capture-damage` | capture | `unitId, unitType, cityKey, captureCost, hpAfter` | `updateCityOwnership` (unit survives capture cost) |
| `capture-death` | capture | `unitId, unitType, cityKey, captureCost` | `updateCityOwnership` (unit dies from capture cost) |
| `objective-change` | objective | `objectiveHex, previousOccupier, newOccupier, unitId?, unitType?` | `updateObjective` |
| `koth-progress` | objective | `occupier, turnsHeld, citiesHeld` | `updateObjective` |
| `round-end` | round | `winner: PlayerId \| null, reason` | Server `resolveSimultaneousTurn` / client `resolveSimultaneousLocal` |
| `game-end` | round | `winner: PlayerId` | Server / client after `scoreRound` |
| `heal` | combat | `healerId, healerType, targetId, targetType, healAmount, targetHpAfter` | `executeUnitDirective` (support specialty) |

### Defined Now, Emitted Sprint 3/4

| Type | Phase | Fields |
|---|---|---|
| `intercept` | combat | `attackerId, attackerType, defenderId, defenderType, hex, damage, defenderResponse: 'engage' \| 'skirmish' \| 'flee' \| 'none'` |
| `counter` | combat | `attackerId, attackerType, defenderId, defenderType, damage, defenderHpAfter` |
| `melee` | combat | `unitAId, unitAType, unitBId, unitBType, hex` |
| `reveal` | combat | `unitId, unitType, hexes: CubeCoord[]` |

---

## Consumer Contract

### Replay Sequencer (`replay-sequencer.ts`)

Currently uses `diffTurnEvents()` to infer events from state snapshots. Sprint 5 migrates it to consume `BattleEvent[]` from the turn result directly. The structured event schema is a superset of `TurnEvent` fields:

- `BattleEventMove` covers `TurnEvent { type: 'move' }` (adds `unitType`, `phase`)
- `BattleEventDamage` covers `TurnEvent { type: 'attack' }` (adds real `attackerId` instead of `'unknown'`)
- `BattleEventKill` covers `TurnEvent { type: 'kill' }` (adds real `killedBy` via `attackerId`)
- `BattleEventCapture` covers `TurnEvent { type: 'capture' }` (adds `unitId`, `unitType`)

### Battle Log (`BattleLog.tsx`)

Renders `BattleLogEntry { turn, event }`. Uses `formatBattleEvent(event)` for display text and `event.type` for CSS class.

### Server Turn Log (`game-loop.ts`)

Events travel in the `turn-result` socket payload as `BattleEvent[]`. Server also logs `formatBattleEvent(event)` for debugging.

### Turn Record (`room.turnLog`)

Each entry contains `events: BattleEvent[]` for the full turn.

---

## Transport

Events are emitted inline during `executeTurn()` into `state.pendingEvents`. After each player's turn resolves, the server drains `pendingEvents` into a local array. The combined array is sent in the `turn-result` payload.

`pendingEvents` is transient -- initialized to `[]` on deserialize. Events do not persist in serialized game state.

---

## Fog Filtering

OD-4 (fog during reveal) is unresolved. Events are currently sent unfiltered to both players. If fog-gated reveal is chosen later, filtering happens at the transport layer (server filters `BattleEvent[]` before sending), not in the schema. The event structure supports both models without changes.
