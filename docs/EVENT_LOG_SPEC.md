# Event Log Spec

Canonical schema for battle events. This document defines the data contract for all downstream consumers: replay-sequencer, battle log, server turn log, and future spectator mode.

RESOLUTION_PIPELINE.md defines the 10-phase combat timeline. This document defines the structured output of that timeline.

---

## Schema Version

**v2** -- Sprint 3 (resolution pipeline). Intercept and counter events now emitted from `resolution-pipeline.ts`. Melee and reveal types defined but not yet emitted (melee blocked on OD-1). Damage events gain `response?` field. Intercept events gain `defenderResponse` field.

---

## Event Type Table

All variants extend `BattleEventBase`:

```typescript
interface BattleEventBase {
  readonly actingPlayer: PlayerId;
  readonly phase: BattleEventPhase; // 'movement' | 'combat' | 'capture' | 'objective' | 'round'
}
```

### Emitted (all from `resolution-pipeline.ts`)

| Type | Phase | Fields | Pipeline Source |
|---|---|---|---|
| `move` | movement | `unitId, unitType, from, to` | Phase 3 `resolveMovement` |
| `damage` | combat | `attackerId, attackerType, attackerPosition, defenderId, defenderType, defenderPosition, damage, defenderHpAfter, defenderTerrain, response?` | Phase 3 (passive intercept, `response: 'none'`), Phase 5 `resolveInitiativeFire`, Phase 6 `resolveCounterFire` |
| `kill` | combat | `attackerId, attackerType, attackerPosition, defenderId, defenderType, defenderPosition, damage, defenderTerrain` | Phase 3/5/6 (any lethal hit) |
| `intercept` | combat | `attackerId, attackerType, defenderId, defenderType, hex, damage, defenderResponse: 'engage' \| 'skirmish' \| 'flee' \| 'none'` | Phase 3 `resolveMovement` |
| `counter` | combat | `attackerId, attackerType, defenderId, defenderType, damage, defenderHpAfter` | Phase 6 `resolveCounterFire` |
| `heal` | combat | `healerId, healerType, targetId, targetType, healAmount, targetHpAfter` | Phase 8 `resolveDirectiveEffects` |
| `reveal` | combat | `unitId, unitType, hexes: CubeCoord[]` | Phase 8 `resolveDirectiveEffects` |
| `capture` | capture | `unitId, unitType, cityKey, previousOwner: null` | Phase 9 `resolveTerritoryPhase` |
| `recapture` | capture | `unitId, unitType, cityKey, previousOwner: PlayerId` | Phase 9 `resolveTerritoryPhase` |
| `capture-damage` | capture | `unitId, unitType, cityKey, captureCost, hpAfter` | Phase 9 `resolveTerritoryPhase` |
| `capture-death` | capture | `unitId, unitType, cityKey, captureCost` | Phase 9 `resolveTerritoryPhase` |
| `objective-change` | objective | `objectiveHex, previousOccupier, newOccupier, unitId?, unitType?` | Phase 10 `resolveRoundEnd` |
| `koth-progress` | objective | `occupier, turnsHeld, citiesHeld` | Phase 10 `resolveRoundEnd` |
| `round-end` | round | `winner: PlayerId \| null, reason` | Server/client after `checkRoundEnd` |
| `game-end` | round | `winner: PlayerId` | Server/client after `scoreRound` |

### Defined, Not Yet Emitted

| Type | Phase | Fields | Blocked By |
|---|---|---|---|
| `melee` | combat | `unitAId, unitAType, unitBId, unitBType, hex` | OD-1 (meleeRating values) |

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

## Event Ordering

Events in `pendingEvents` are ordered by pipeline phase (3→5→6→8→9→10) because phases execute sequentially and each phase appends events as it runs. This emission order IS the playback order for the reveal animation — no re-sorting needed.

## Transport

Events are emitted inline during `resolveTurn()` into `state.pendingEvents`. The server drains `pendingEvents` after the call. The array is sent in the `turn-result` payload.

`pendingEvents` is transient -- initialized to `[]` on deserialize. Events do not persist in serialized game state.

---

## Fog Filtering (D-VIS-5, resolves OD-4)

**Fog-gated reveal. LOS only. No explored exception.**

The server filters `BattleEvent[]` per player before sending in the `turn-result` payload. The filtering rule:

1. Compute the observing player's **LOS set** — the set of hex keys visible to their units at the Phase 1 snapshot (tick start positions). This is the same `calculateVisibility()` call used for fog of war during gameplay.

2. For each `BattleEvent` in the array:
   - **Own-unit events** (event involves the observing player's unit as actor or target): **always include.** The player always sees what happens to their own units, even if the attacker is in fog.
   - **Enemy-only events** (event involves only enemy units): include **only if** at least one position in the event (attacker position, defender position, hex, city key) is in the LOS set.
   - **Structural events** (round-end, game-end, koth-progress, objective-change): **always include.**

3. For included events where the enemy attacker is outside LOS: the client renders the attacker as "from fog" — tracer originates from the LOS boundary, attacker identity unknown. The event data is preserved (server doesn't redact fields), but the client renderer decides how to visualize based on the player's visibility.

The schema does not change. Filtering happens at the transport layer (`state-filter.ts` or `game-loop.ts`). The client receives a subset of the full event stream and renders only what it receives.

**Explored hexes provide no intelligence during reveal.** Only active LOS counts. This makes scout placement the primary intelligence mechanic.
