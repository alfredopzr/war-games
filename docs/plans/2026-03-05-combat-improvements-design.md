# Combat Improvements Design

**Date**: 2026-03-05
**Status**: Draft
**Dependencies**: Backend Infrastructure Plan, Gold Economy Design

## Goal

Modify combat to create natural inflection points that feed both the wagering system (between rounds) and consumable decision-making (during rounds). No rewrites to the core combat formula — structural additions around it.

## Complete Match Flow

```
PRE-MATCH (Gold economy)
  Pay ante (gold -> escrow)
  Select consumable loadout (3 slots from inventory, max 1 Epic)

ROUND LOOP
  Deploy (manpower -> units, assign directives)
  Resolve Movement (directives execute)
  Consumable Phase (simultaneous select -> reveal -> resolve)
  Resolve Combat (existing formula + wounded penalty)
  Round Recap (visible engagements only, fog respected)
  Battle Score (opaque total for opponent, full breakdown for self)
  Wager Phase (lower score acts first -> check/raise/fold)
  Loop or match ends

POST-MATCH (Gold economy)
  Pot resolved (winner takes escrow)
  Medal rewards (competitive only)
  Match history recorded to backend
```

## 1. Battle Score & Momentum

### Problem

After a round, players only know who won (200 manpower bonus). That's insufficient to drive interesting wager decisions. A slightly-behind player might fold when they could come back; a far-behind player might call when they shouldn't.

### Solution

Calculate a **Battle Score** per player after each round. Both players see both totals.

**Score components:**

- **Unit Value Remaining**: `sum( (currentHP / maxHP) * unitCost )` for all surviving units. A full-health Tank = 250, a 1HP Tank = 62.
- **Territory Control**: 150 points per city held.
- **Kill Value**: Cumulative cost of enemy units destroyed across all rounds.

**Momentum Delta** = your score minus opponent's score. Displayed as a signed number (+340 or -120).

### Visibility Rules

- Each player sees their **own full breakdown** (unit values, cities, kills).
- Each player sees their opponent's **total score only** — a single opaque number.
- Units never in the opponent's vision contribute to the total but cannot be reverse-engineered from it.
- City control is public knowledge (both players know who holds what).
- Kill value is partially known — you know what you killed, not what your opponent killed of yours unless you tracked it.

### Design Implication

A Recon-heavy player with high vision has an informational advantage in wagering — they've seen more of the enemy army, so they can better interpret what the opponent's score means. Vision becomes valuable for wagers, not just combat.

## 2. Consumable Activation Phase

### Timing

Consumables activate **after movement resolves but before combat resolves**. Players can see where units ended up and who's in range, but damage hasn't been dealt. Full board-state information (within fog of war) for the decision.

### Mechanics

- Both players simultaneously select one consumable to play (or pass).
- Selections are locked, then **revealed at the same time**.
- Each consumable targets a specific hex or unit. Targeting respects vision — you can only target hexes/units you can currently see.
- Effects resolve immediately before combat begins.
- **One consumable per round**, from a total of 3 slots for the entire match.

### Why Simultaneous Reveal

Creates a bluff layer. Your opponent loaded 3 consumable slots (you see the slot count). They've used 0 so far. Are they saving their Epic? Do you burn Entrench defensively, or hold it because they might waste Artillery Strike on a hex you're about to vacate? Simultaneous commitment prevents reactive play and rewards reads.

### Consumable Reference

Purchased with **gold** from the shop. Added to inventory. Equipped during pre-match setup. Consumed on use, gone forever.

| Tier | Item | Effect | Gold Cost |
|------|------|--------|-----------|
| Common | Field Rations | Heal 1 HP to one unit | 100 |
| Common | Flare | Reveal 2-hex radius | 100 |
| Common | Forced March | +1 movement to one unit | 150 |
| Rare | Command Surge | +1 CP this round | 400 |
| Rare | Entrench | +2 DEF to one unit this round | 400 |
| Rare | Sabotage | -1 movement to one enemy unit | 500 |
| Epic | Artillery Strike | 2 damage in 1-hex radius | 1,000 |
| Epic | Fog Bomb | Remove enemy vision in 3-hex radius | 1,200 |
| Epic | Reinforcement | Deploy free Infantry mid-battle | 1,500 |

**Loadout rules**: 3 slots per match, max 1 Epic. Opponent sees filled slot count only.

## 3. Wounded Penalty

### Problem

With consumables in play, engagements need margins tight enough that a single consumable visibly tips the outcome. Some matchups are blowouts where no consumable matters.

### Solution

Units at **1 HP deal 75% damage** (wounded penalty).

```
damageMultiplier = currentHP === 1 ? 0.75 : 1.0
baseDamage = ATK * TypeMultiplier * damageMultiplier * randomFactor
finalDamage = max(1, floor(baseDamage - DEF * terrainDefense))
```

### Why This Works

- **Field Rations** (heal 1 HP) goes from marginal to impactful — it restores full damage output, not just survivability.
- **Entrench** (+2 DEF) becomes valuable for keeping units above 1 HP, not just alive.
- Creates more "barely surviving" moments that make the next round's consumable and wager decisions tense.
- Minimal formula change — one multiplier added to the existing calculation.

### What Doesn't Change

- Core formula (deterministic with 15% variance).
- Type advantage multipliers.
- Terrain modifiers.
- Hold directive +1 DEF bonus.
- Unit stats (HP, ATK, DEF, movement, range, vision).

## 4. Round Recap

After combat resolves, each player sees a summary of engagements involving their **visible** units only. Fog of war applies — if your unit was destroyed by something you never saw, you know it died but not what killed it.

**Recap includes:**
- Which of your units fought
- Damage dealt and taken per engagement
- Units killed (yours and enemy, if visible)
- Consumables that were played (both sides — the reveal is public)

This feeds directly into Battle Score interpretation and the wager decision that follows.

## 5. Wager Phase

### Timing

After scoring, before the next deployment. Both players have seen the round recap, updated Battle Score, momentum delta, and which consumables were revealed.

### Flow

1. Player with **lower Battle Score** acts first.
2. Options: **check** (no raise), **raise** (add gold to pot), or **fold**.
3. Opponent responds: **call**, **re-raise**, or **fold**.
4. **One re-raise maximum** per inter-round. Keeps pacing tight.

### Why Lower Score Acts First

The behind player folding early is the least interesting outcome. Giving them initiative forces the leading player to react. A behind player who raises despite the score signals confidence — maybe they have unseen units, maybe they have consumables left, maybe they're bluffing.

### Wager Economy

- Entirely **gold**. Never manpower.
- Ante deducted from gold when queuing for competitive match, held in escrow.
- Raises pull from gold balance into escrow.
- Fold tax: 10% of pot lost permanently (gold sink).
- Pot resolved at match end — winner takes escrow.

## 6. Currency Separation

| Currency | Scope | Source | Sink |
|----------|-------|--------|------|
| **Manpower** | In-match only | Round income (base + cities + kills + outcome) | Deploy troops, maintenance |
| **Gold** | Persistent | Campaign, PvP wins, daily rewards | Consumables, competitive tickets, wagers |
| **Medals** | Persistent | Competitive wins only | Cosmetics only |

Manpower and gold never mix during a match. Manpower buys troops on the battlefield. Gold is at stake in the wager and was spent on consumables before the match. The tension: "do I raise more gold on a match where my manpower economy is struggling?"

## 7. Engine Changes

| File | Change |
|------|--------|
| `combat.ts` | Add wounded penalty: 0.75x damage multiplier at 1 HP |
| `types.ts` | Add `BattleScore`, `BattleScoreView`, `ConsumableSlot`, `ConsumableActivation`, `WagerAction`, `RoundRecap` interfaces |
| `scoring.ts` | **New file** — calculate per-player score from game state; expose detailed view (own) and opaque view (opponent) |
| `consumables.ts` | **New file** — consumable definitions, activation logic, targeting validation (respects vision), effect resolution |
| `round.ts` | **New file** or extend existing — orchestrate the full round loop with consumable phase, scoring, and recap generation |
| `economy.ts` | No changes (manpower logic stays as-is) |
| `directives.ts` | No changes |
| `commands.ts` | No changes |
| `units.ts` | No changes to stats |

## 8. Backend Responsibilities (NOT Engine)

| Concern | Reason |
|---------|--------|
| Wager escrow & pot math | Gold is server-authoritative |
| Consumable inventory & deduction | Persistent player state |
| Ante deduction & validation | Must validate gold balance before match |
| Fold tax application | Permanent gold destruction, server-side only |
| Battle Score view filtering | Server decides what each player sees based on fog state |
| Match history & score storage | Leaderboards and analytics |
