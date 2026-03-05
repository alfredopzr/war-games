# Economy & Progression

Archetype system design forks. What is decided, what is deliberately left open, and what needs playtest data before closing.

Cross-references: Archetype decisions D8, D9 in `DESIGN_DECISIONS.md`. Kill bonus and economy constants in `GAME_MATH_ENGINE.md` §5. Sprint 7 scope in `ROADMAP.md`.

---

## ARCHETYPE SYSTEM — OPEN DESIGN FORKS

*This section documents what is known, what is decided, and what is deliberately left open. Do not collapse these forks until there is playtest data. The wrong commitment here is harder to undo than almost any other design decision.*

---

### What Is Decided

**Archetypes exist.** Players develop a strategic identity through in-match behavior. Upgrades are earned through objectives, not purchased with gold (see D8).

**Four archetypes for 1v1 MVP:**

| Archetype | Identity | Trigger behavior |
|-----------|----------|-----------------|
| Conqueror | Expansion | City capture and control |
| Predator | Aggression | Kill accumulation |
| Ghost | Information | Vision, scouting, ambush |
| Fortress | Defense | Holding ground, surviving pressure |

**Counter cycle (1v1):**
```
Conqueror → beats → Fortress
Predator  → beats → Conqueror
Ghost     → beats → Predator
Fortress  → beats → Ghost
```

**Upgrade triggers are visible to both players as signals. Specific unlocks are hidden.** The opponent knows you hit a threshold. Not what you got. This is the poker layer at archetype level.

**Complexity scales with match length.** Short matches see Tier 1 only. Long, close matches see both players fully developed. Endgame complexity is earned by the match staying competitive.

**Layered reveal timing.** Archetypes should not be fully active from turn 1.
```
Match start  → directives and ROE only
Mid game     → Tier 1 archetype unlocks
Late game    → Tier 2-3 abilities
```

---

### Fork 1 — Commitment Structure

**The decision:** When a player earns their first archetype trigger, how locked in are they?

**Option A — Hard Lock**
First trigger permanently sets archetype. Cannot change.

```
Pros: strong mind-games, highly readable, archetypes feel meaningful
Cons: early mistake is fatal, early map RNG matters too much, weak in FFA
Best for: 1v1 ranked where both players know what they're doing
```

**Option B — Free Pivot**
Triggers accumulate across archetypes simultaneously. Mixed bonuses.

```
Pros: flexible, forgiving, easier to balance
Cons: archetypes dissolve into meta builds, everyone converges,
      strategic identity disappears
Risk: becomes a deck-builder, not an identity system
```

**Option C — Soft Lock**
First trigger opens a tree. Switching is possible but costs reset progress.

```
active_archetype = current tree
switching → loses earned tier progress, starts new tree from zero

Pros: commitment pressure, bluff potential, recovery if misread
Cons: more state to track, UI must communicate progress clearly
Best for: both 1v1 and FFA
```

**Fred's recommendation:** Soft Lock (C). Most modern strategy games use this model.

**Status: OPEN.** Do not decide until 1v1 is playtested. Hard Lock may feel better in practice than it reads on paper. Soft Lock adds UI complexity that may not be worth it at MVP.

---

### Fork 2 — Graph Structure (1v1 vs FFA)

**The 4-unit cycle works because each archetype has exactly 1 predator and 1 prey.** Clean, learnable, meaningful.

**The 1v1 counter cycle is locked (see above).** This is a chain. Simple and readable.

**For FFA, a chain breaks.** A 7-way chain produces a dominant archetype in any given lobbies depending on composition. The correct structure for FFA is a **sparse directed graph** where each archetype:

```
beats 2 others
loses to 2 others
neutral vs remaining
```

No archetype dominates the table regardless of what the other 4 players are doing.

**Status: OPEN.** FFA graph topology cannot be designed until the 6-archetype set is finalized and the 1v1 cycle is playtested. Designing the web before understanding how archetypes play in practice will produce the wrong graph.

---

### Fork 3 — Archetype Count for FFA

**Minimum for 1v1:** 4 (decided, above)

**Candidates for FFA expansion:**

*Raider* — economic disruption. Razes cities, sabotages supply lines, blocks income. Doesn't build — destroys. Counters expansion players. Fred: strong addition, FFA needs this role.

*Warlord* — vertical scaling. Invests in unit quality over quantity. Elite squads, unit veterancy, morale effects. Fewer but stronger units. Counters attrition strategies. Fred: very good, introduces vertical vs horizontal as a strategic axis.

*Tactician* — CP efficiency and command control. Extra directive slots, faster redeployment, reaction bonuses. Fred's concern: "CP efficiency tends to become the mathematically best archetype." Reframe as Command Control to avoid economic optimization trap. Status: weakest of the three candidates.

**Fred's recommendation:** 6 archetypes (4 existing + Raider + Warlord). Tactician becomes a directive mechanic, not an archetype. 7 risks cognitive overload.

**Status: OPEN.** 6 vs 7 archetypes is a FFA-only question. Do not design FFA until 1v1 with 4 archetypes is stable.

---

### Fork 4 — Tier Structure

**Three tiers is decided.** Shallow enough to learn in one match, deep enough that late-game play feels meaningfully different from early game.

**What triggers tier advancement — two candidate models:**

**Model A — Achievement repetition**
```
Tier 1: threshold met once
Tier 2: threshold met twice
Tier 3: threshold met three times
```
Simple. Easy to communicate. Brittle — players farm the easiest trigger mechanically.

**Model B — Scaling thresholds**
```
Predator example:
Tier 1: first ambush kill
Tier 2: 3 ambush kills total
Tier 3: 5 ambush kills OR wipe an enemy army
```
Harder to farm. Tier 3 requires sustained commitment or a decisive moment. Fred: scaling thresholds are easier for players to understand than repetition counting.

**Status: OPEN. Lean toward Model B.** But the specific thresholds per archetype cannot be set until the archetype ability trees are designed. Thresholds must be calibrated against how frequently the trigger behavior naturally occurs in a match.

---

### Fork 5 — Escalation Gating

**Hard time gate:**
```
Tier 2 requires minimum round 2
Tier 3 requires minimum round 4
```
Prevents rush metas definitively. Feels arbitrary. Players who earn 5 ambush kills in round 1 wait for a timer.

**Soft cost gate:**
```
Tier 3 achievement requirement decreases over time:
Round 2: requires 6 kills
Round 4: requires 5 kills
Round 6: requires 4 kills
```
Natural pressure against rushing without hard rules. Rush metas punished by higher requirements, not blocked entirely.

**Fred's recommendation:** Soft cost gate. More elegant, same effect.

**Status: OPEN.** Cannot finalize until match length data exists from playtests. Gating that feels right on a 5-round match may be wrong on a 3-round match.

---

### What Needs To Happen Before Any Fork Is Closed

1. **1v1 playtests with 4 archetypes and Tier 1 only.** Does the counter cycle actually play out? Do players naturally signal which archetype they're pursuing? Does the Ghost vs Predator read work in practice?

2. **At minimum 20 competitive matches.** Not AI vs AI — human players who understand the system.

3. **Log archetype trigger frequency.** How often does each trigger fire per match? If Ghost triggers fire 3× more often than Predator triggers, the thresholds are wrong.

4. **Only then: design the full Tier 1-3 ability trees.** Fred offered to design the actual upgrade trees. Hold that until the above data exists.

---

### The Hidden Risk (Fred's Warning)

This design stacks three complexity systems:

```
1. Directives (movement + ROE)
2. Combat resolution (initiative, counter-fire, melee)
3. Archetype progression (tiers, triggers, abilities)
```

If all three mature simultaneously in the same match, the game becomes opaque. The layered reveal timing above (directives first, archetypes mid, tier 3 late) is the mitigation. But it must be enforced in implementation — not assumed.
