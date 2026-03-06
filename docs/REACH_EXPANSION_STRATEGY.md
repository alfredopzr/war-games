# REACH EXPANSION PLAN

**Version:** 1.0
**Date:** 2026-03-06
**Status:** Recommended for immediate implementation (post-MVP core lock)

**Goal:** Dramatically widen audience without compromising the core fantasy.

**Core Fantasy Reminder:** Blind-map prediction + simultaneous plan/commit/reveal + limited CP interventions.

**Rule:** Nothing in this doc is allowed to touch that loop. If it does, kill the idea.

---

## Philosophy

Go hard on the niche.

The poker/crypto/competitive-strategy crowd is small but insanely high-LTV and evangelistic.
Pure niche = almost certain multiplayer death (liquidity cliff).
Smart niche + surgical reach tweaks = sustainable ladder and 40-80k sales first year (realistic expected case).

---

## RANKED TWEAKS

Impact-to-effort ratio for a two-man team. Implement in this order.

| Priority | Tweak | Why it works | Implementation cost | Core compromise? |
|----------|-------|-------------|---------------------|-----------------|
| 1 | Async (turn-based) multiplayer | Matches can span hours/days. Queue is instant because opponent doesn't need to be online. Polytopia proved this exact model at 20M+ downloads. | Tiny (change submission trigger in game-loop.ts + add "match resolves in X hours" UI) | None |
| 2 | Auto clip + share system | Every reveal becomes a 15-second viral clip. Slow-mo on collisions + overlay "Player A completely misread the bridge". One-click Twitter/TikTok/YouTube Shorts button. | Low (record last 30s of reveal + simple camera script) | None |
| 3 | Rock-solid singleplayer + AI bots on day 1 | Monte Carlo bots already exist. Add 5-7 hand-crafted tutorial maps. Players practice blind prediction before ever queuing live. | Medium (UI + campaign maps) | None |
| 4 | Blitz queue (10-15 min matches) | Separate queue: smaller maps, fewer turns, 4 CP total. Same rules, same blind fog. Streamers and casuals jump in instantly. | Low (just another map preset + queue) | None |
| 5 | Mobile port (cross-play) | Hex + touch = perfect. Polytopia is the proof. Opens millions of phone players who already love strategy. | Medium-high (post-async stable) | None |

---

## WHAT NOT TO DO (these kill the soul)

| Idea | Why it's tempting | Why we reject it |
|------|-------------------|-----------------|
| Real-time elements | "Feels more dynamic" | Destroys simultaneous prediction fantasy |
| Visible map from turn 1 | "Easier onboarding" | Removes the entire "commitment under uncertainty" hook |
| Micro controls | "Players want agency" | Turns prediction duel into generic tactics slop |
| Heavy economy / crafting | "More progression" | Adds spreadsheets, kills the poker purity |
| Betting/crypto integration | "Poker community will love it" | Legal nightmare + changes the product into gambling |

---

## REALISTIC OUTCOME PROJECTION

| Scenario | Sales (first 12 months) | What it looks like |
|----------|------------------------|-------------------|
| Pure niche (do nothing) | 5-15k lifetime | Dead matchmaking after week 2 |
| Niche + these 4 tweaks | 40-80k first year | Sustainable ranked ladder, active Discord, profitable |
| Breakout (one viral clip + mobile) | 150k+ | Poker streamers adopt it as their "side game" |

Multiplayer liquidity fix: Async + bots on day 1 removes the "no opponents" death spiral. The rest is just making the game findable.

---

## NEXT STEPS (immediate)

- **Sprint 1 (this week):** Implement async submission flow + "match will resolve in X hours" notification.
- **Sprint 2 (next week):** Add auto-clip recorder + share button (use existing reveal event log).
- **Sprint 3:** Ship singleplayer campaign mode with current AI bots.
- **Test plan:** Run 20 internal matches with async. Measure completion rate vs synchronous.

---

This is the minimum viable audience expansion plan.
It keeps the game exactly what we set out to make — a brutal prediction duel — while removing the only thing that actually kills niche multiplayer games: empty queues.
