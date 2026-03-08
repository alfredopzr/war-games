# Gold Economy & Meta-Progression Design

## Overview

HexWar's meta-economy sits on top of the tactical game, creating a persistent progression loop: **Campaign (earn gold) -> Shop (equip consumables) -> PvP (risk/multiply gold, earn medals) -> repeat.**

Three currencies serve distinct purposes:

| Currency | Earned From | Spent On | Tradeable |
|---|---|---|---|
| **Manpower** | In-match income (base, cities, kills) | Deploying troops within a match | No (match-scoped) |
| **Gold** | Campaign, PvP winnings, daily rewards | Consumables, competitive tickets, wagers | No |
| **Medals** | Competitive PvP wins only | Exclusive cosmetics (skins, themes, titles) | No |

---

## PvE: Campaign Chapters

The campaign is a series of themed chapters, each containing 3-5 battles against AI of increasing difficulty, ending with a boss fight.

### Structure

- **Linear progression** — complete Chapter 1 to unlock Chapter 2, etc.
- **Target**: 10-15 chapters at launch (~50-75 battles of content).
- **Difficulty curve**: each chapter introduces harder AI (better directive selection, smarter CP usage, type-counter awareness) and map constraints (unfavorable terrain, fewer deployment slots).

### Gold Rewards

| Source | Amount | Notes |
|---|---|---|
| First-clear (normal battle) | 500g | One-time bonus per battle |
| First-clear (chapter boss) | 2,000g | One-time bonus per boss |
| Replay (1st-5th replay) | 20% of first-clear | Diminishing but worthwhile |
| Replay (6th+ replay) | 10% of first-clear | Steep drop to push progression |

### Design Intent

First-clear bonuses are the primary gold source for new players. Diminishing replay returns force players to progress through new chapters rather than farming easy content.

---

## PvP Modes

### Casual PvP

- **No gold wager.** Free to enter, no risk.
- **No rank impact.** For practice, testing compositions, or playing with friends.
- **Gold reward**: 50g per win, capped at 500g/day.
- **Daily chest**: winning 1 casual match awards a Common Chest.

### Competitive PvP

Competitive PvP combines tactical gameplay with a poker-style wagering system.

#### Access

- **Unlocks after completing Campaign Chapter 3** (ensures players understand the game and have a starting bankroll).
- **3 free tickets per day**, resetting at midnight UTC.
- **Additional tickets cost 300g each.** No daily cap on purchased tickets.

#### Wagering System

**Ante:**
- Both players pay a mandatory ante to enter. Ante is determined by matchmaking tier:

| Tier | Ante | Min Gold to Queue |
|---|---|---|
| Bronze | 100g | 100g |
| Silver | 500g | 500g |
| Gold | 2,000g | 2,000g |
| Diamond | 5,000g | 5,000g |

**Raises (between rounds):**
- After each round's scoring phase, before the next build phase, either player can **raise**.
- The opponent must **call** (match the raise), **re-raise**, or **fold**.
- **All-in cap**: a player can never be asked to put in more gold than they currently have. If the opponent raises 1,000g but you only have 400g, you go all-in for 400g and the excess is returned.

**Folding:**
- Folding forfeits the match. The folding player loses their ante plus all committed raises, plus a **10% fold tax** on the current pot.
- Discourages serial folding while still making it a valid escape.

**Match resolution:**
- Winner takes the entire pot (both antes + all raises).

#### Rank System

- **ELO-style rating.** Wins increase rating, losses decrease it.
- **Tier is determined by rating bracket** (Bronze, Silver, Gold, Diamond, Master).
- **Demotion pressure**: at the end of each weekly cycle, the bottom 70% of Master players are demoted to Diamond. Top 30% retain Master status.
- **Seasonal resets**: rank partially decays each season, forcing active play to maintain leaderboard position.
- **Leaderboard** shows top players by rank. Separate from gold — a skilled player with modest gold can still top the leaderboard.

#### Medal Rewards

| Tier | Medals per Win |
|---|---|
| Bronze | 5 |
| Silver | 10 |
| Gold | 20 |
| Diamond | 40 |
| Master | 75 |

Medals are never lost. Pure accumulation — they represent lifetime competitive achievement.

---

## Shop: Consumables

Consumables are the primary gold sink. Players bring a **loadout of 3 consumable slots** into each match. Max 1 Epic per loadout.

Consumables are used during your turn, before or after CP spending. They cost no CP to activate. Consumed on use — gone from inventory.

### Consumable Catalog

| Tier | Item | Effect | Gold Cost |
|---|---|---|---|
| Common | Field Rations | Heal 1 HP to one unit between rounds | 100g |
| Common | Flare | Reveal a 2-hex radius area for 2 turns | 100g |
| Common | Forced March | +1 movement to one unit for 1 turn | 150g |
| Rare | Command Surge | +1 CP for one round | 500g |
| Rare | Entrench | +2 DEF to one unit for the round | 400g |
| Rare | Sabotage | Reduce one visible enemy's movement by 1 for the round | 450g |
| Epic | Artillery Strike | Deal 2 damage to all units in a 1-hex radius | 1,500g |
| Epic | Fog Bomb | Remove all enemy vision in a 3-hex radius for 2 turns | 1,200g |
| Epic | Reinforcement | Deploy one free Infantry mid-battle adjacent to a friendly unit | 1,000g |

### Loadout Rules

- 3 slots per match. Any combination of tiers.
- Max 1 Epic per loadout.
- Both players can see how many consumable slots the opponent has filled (but not which items). Adds a bluffing layer.

---

## Daily Rewards & Chests

Chests provide consumables as engagement rewards, reducing the need to spend gold for casual players.

| Trigger | Reward |
|---|---|
| Daily login | 1 Common Chest (1-2 random Common consumables) |
| Win 1 casual PvP match | 1 Common Chest |
| Win 1 competitive PvP match | 1 Rare Chest (1 random Rare + chance at Epic) |
| Complete daily challenge | 1 Rare Chest + 200g |

**Daily challenges** are specific win conditions that rotate daily (e.g., "win with no Artillery," "win using only 1 CP," "capture all cities"). They apply to any mode (campaign, casual, or competitive).

---

## Exclusive Cosmetics (Medals Only)

Medal-exclusive cosmetics cannot be purchased with gold. They signal competitive achievement.

### Categories

- **Unit Skins** — alternate visual appearances for unit types (e.g., "Veteran Infantry," "Shadow Tank").
- **Hex Grid Themes** — custom terrain color palettes and visual styles applied to your side of the map.
- **Victory Animations** — custom animations that play when you win a match.
- **Player Titles** — displayed next to your name in matchmaking and leaderboards (e.g., "Strategist," "Warlord," "Grandmaster").
- **Player Borders/Frames** — decorative frames around your player card.

### Pricing Tiers

| Item Type | Medal Cost | Approximate Competitive Wins to Earn (at Gold tier) |
|---|---|---|
| Player Title | 200 | ~10 wins |
| Player Border | 500 | ~25 wins |
| Unit Skin | 1,000 | ~50 wins |
| Hex Grid Theme | 2,000 | ~100 wins |
| Victory Animation | 3,000 | ~150 wins |

Higher-tier cosmetics serve as visible proof of sustained competitive play.

---

## Anti-Inflation Controls

The economy must prevent gold from inflating endlessly. These mechanisms ensure gold retains value:

| Mechanism | Effect |
|---|---|
| Campaign replay diminishing returns | 20% payout drops to 10% after 5 replays |
| Casual PvP daily gold cap | Max 500g/day from casual wins |
| Consumable destruction on use | Constant gold drain from active players |
| Competitive ticket cost | 300g per ticket beyond the 3 free daily |
| Epic consumable pricing | 1,000-1,500g per item drains large bankrolls |
| Fold tax | 10% of pot lost on fold, gold exits the system |

### Gold Flow Summary

**Gold enters the system from:** campaign first-clears, campaign replays (diminished), casual PvP wins (capped), daily challenge rewards.

**Gold exits the system from:** consumable purchases, competitive ticket purchases, fold taxes, wager losses (gold transfers between players, but fold tax removes a portion permanently).

**Net effect:** gold supply grows slowly through PvE, circulates through PvP, and drains through the shop. Players who wager aggressively and lose will need to return to campaign or casual play to rebuild.

---

## Implementation Considerations

This system requires backend infrastructure not yet in the project:

- **Player accounts** with persistent gold/medal balances.
- **Campaign progress tracking** (which battles cleared, replay counts).
- **Inventory system** for consumables.
- **Matchmaking service** with tier filtering and ticket validation.
- **Wager escrow** — gold is locked when ante is paid, held during the match, distributed on resolution.
- **Rank calculation service** — ELO updates, weekly demotion processing, seasonal resets.
- **Daily reset system** — ticket refresh, chest availability, challenge rotation.

This is a post-multiplayer feature (after Phase 5 in DESIGN.md) that builds on the server infrastructure.
