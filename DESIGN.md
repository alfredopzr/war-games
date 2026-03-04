# HexWar — Game Design & Implementation Plan

**Hex-Based Tactical Strategy Game**
Target: 10–15 minute matches · 2 Players · Blind Deployment · Multi-Round

---

## 1. Design Overview

HexWar is a fast-paced, two-player tactical strategy game played on a hex grid. Each match consists of 3–5 rounds. In each round, players simultaneously spend resources to build and deploy units onto their side of the map, then battle in alternating turns. The fog of war hides enemy composition until units enter your line of sight. A full game targets 10–15 minutes.

### 1.1 Core Design Pillars

- **Speed**: Every decision should be meaningful but fast. No analysis paralysis. Small unit counts, simple combat math, tight turn limits.
- **Hidden Information**: The build phase is blind. You commit resources without knowing what the opponent is building. This creates a rock-paper-scissors metagame layer.
- **Escalation**: Each round builds on the last. Surviving units carry forward, resources grow, and the stakes increase toward a decisive final round.
- **Accessibility**: Simple enough to learn in one game, deep enough to reward repeated play. No more than 6 unit types, no more than 5 terrain types.

### 1.2 Time Budget Breakdown

To hit the 15-minute target, each phase must be tightly constrained:

| Phase | Time Per Round | Notes |
|---|---|---|
| Build & Deploy | 60–90 sec | Timer-enforced. Unspent resources carry over (max 50%). |
| Battle (Tactical) | 2–3 min | Max 8 turns per side. Auto-resolve if timer expires. |
| Scoring / Transition | 10–15 sec | Automated. Show results, award resources. |
| **Total Per Round** | **~3–4 min** | 3 rounds = 9–12 min. 5 rounds = 15–20 min. |

Recommendation: Default to 3 rounds for casual play, 5 rounds for ranked/competitive. A hard 4-minute clock per round (build + battle combined) keeps games on track.

---

## 2. Map & Terrain System

### 2.1 Hex Grid

Use cube coordinates (q, r, s where q + r + s = 0) for the hex grid. This makes distance calculation trivial: `distance = max(|dq|, |dr|, |ds|)`. The grid uses flat-top hexagons rendered with pointy-top orientation for a natural landscape feel.

| Property | Value | Rationale |
|---|---|---|
| Grid Size | 10 wide × 8 tall (80 hexes) | Large enough for tactics, small enough for fast play |
| Coordinate System | Cube (q, r, s) | Simplifies pathfinding, distance, and line-of-sight |
| Deployment Zone | Back 2 rows per player | 16 hexes per side for placement |
| Neutral Zone | Middle 4 rows | Contains objectives and contested terrain |
| Map Generation | Symmetric mirrored | Ensures fairness; mirror across center axis |

### 2.2 Terrain Types

Each terrain type modifies three axes: movement cost, defense modifier, and vision modifier. Keep terrain effects simple and memorizable.

| Terrain | Move Cost | Defense | Vision | Special |
|---|---|---|---|---|
| Plains | 1 | +0% | Normal | No modifiers. Default terrain. |
| Forest | 2 | +25% | Blocks LoS | Units inside are hidden until adjacent. |
| Mountain | Impassable* | +40% | +2 range | Infantry only. Vehicles cannot enter. |
| City | 1 | +30% | Normal | Capturable. Generates +100 resources/round. |
| Desert | 1 | -10% | +1 range | Negative defense. Good for fast advances. |

\* Mountains are impassable to all vehicle units (tanks, recon vehicles). Infantry and aircraft can traverse them. Consider adding a River terrain type post-MVP as a movement barrier with bridge chokepoints.

### 2.3 Map Layout Rules

- Each map contains exactly 2–4 city hexes in the neutral zone (objectives).
- Mountains and forests should create natural chokepoints and flanking corridors.
- Each player's deployment zone should contain only plains and forest hexes.
- Desert terrain appears in the neutral zone to create risk/reward positioning.
- Maps are generated procedurally but validated for symmetry and playability.

---

## 3. Unit System

### 3.1 Unit Roster

Six unit types organized into three roles: frontline (infantry, tanks), support (artillery, anti-air), and specialist (recon, aircraft). Every unit has: cost, HP, attack, defense, move range, attack range, and vision range.

| Unit | Cost | HP | ATK | DEF | Move | Range | Vision |
|---|---|---|---|---|---|---|---|
| Infantry | 100 | 3 | 2 | 2 | 2 | 1 | 2 |
| Tank | 250 | 4 | 4 | 3 | 3 | 1 | 2 |
| Artillery | 200 | 2 | 5 | 1 | 1 | 3 | 2 |
| Recon | 100 | 2 | 1 | 1 | 4 | 1 | 5 |
| Anti-Air | 150 | 2 | 3 | 2 | 2 | 2 | 3 |
| Aircraft | 300 | 3 | 4 | 1 | 5 | 1 | 3 |

### 3.2 Combat Resolution

Combat uses a deterministic formula with a small random variance to keep outcomes predictable but not perfectly calculable:

```
Base Damage = ATK × Type Multiplier × Terrain Modifier × random(0.85, 1.15)
Final Damage = max(1, Base Damage - DEF × Terrain Defense)
```

The random factor is intentionally narrow (±15%). Players should be able to predict outcomes with reasonable confidence. Surprise upsets happen rarely, not constantly.

### 3.3 Type Advantage Matrix

A simple rock-paper-scissors layer ensures no single unit dominates. Multiplier is applied to the attacker's ATK value:

| Attacker ↓ / Target → | Infantry | Tank | Artillery | Recon | Anti-Air | Aircraft |
|---|---|---|---|---|---|---|
| Infantry | 1.0 | 0.5 | 1.2 | 1.0 | 1.0 | 0.3 |
| Tank | 1.5 | 1.0 | 1.2 | 1.5 | 1.0 | 0.3 |
| Artillery | 1.3 | 1.3 | 1.0 | 1.3 | 1.0 | 0.0 |
| Recon | 0.8 | 0.3 | 1.5 | 1.0 | 0.8 | 0.3 |
| Anti-Air | 0.8 | 0.5 | 0.8 | 0.8 | 1.0 | 2.5 |
| Aircraft | 1.5 | 1.2 | 1.5 | 1.5 | 0.5 | 1.0 |

Key relationships: Tanks crush infantry and recon. Artillery outranges everything but is fragile. Anti-Air is the only reliable counter to Aircraft. Recon is weak in combat but excels at spotting for artillery. Aircraft ignore terrain but are expensive and vulnerable to AA.

### 3.4 Unit Behavior Rules

- Artillery cannot fire at adjacent hexes (minimum range of 2).
- Aircraft ignore terrain movement costs and can fly over all terrain.
- Recon reveals all enemy units within its vision range to all friendly units.
- Units cannot stack — one unit per hex maximum.
- HP does not regenerate between turns. Damaged units fight at full ATK but are closer to death.
- See **Section 4: Control System** for how units receive orders and act autonomously.

---

## 4. Control System

The control system is the core of HexWar's gameplay. It operates in two layers: **directives** (strategic, assigned during build phase) and **command points** (tactical, spent during battle phase). Most units act autonomously based on their directive. The player's skill lies in choosing good directives up front and spending limited command points wisely when plans go wrong.

### 4.1 Directives (Build Phase)

During the build phase, each unit is assigned exactly one directive. This is the unit's standing order — it will follow this behavior autonomously during battle until the player overrides it with a command point. Directives are assigned via drag-and-drop or click during unit placement.

| Directive | Behavior | Best For |
|---|---|---|
| **Advance** | Move toward the target (or central objective) by the shortest path. Attack enemies encountered along the way. | Tanks, Infantry pushing a position |
| **Hold** | Move to target position, then stay and dig in (+1 DEF). Attack any enemy that enters range. | Artillery, defending chokepoints or cities |
| **Flank Left** | Advance toward the target but bias pathfinding to the left side. Attack enemies in range. | Creating crossfires, flanking maneuvers |
| **Flank Right** | Same as Flank Left but biased to the right side. | Mirror of Flank Left |
| **Scout** | Reconnoiter the target area from 2-3 hex distance. Retreat if enemy is adjacent. | Recon units, shadowing enemy units |
| **Support** | Follow a targeted friendly unit (or nearest friendly) within ~2 hexes. Heals adjacent friendlies. | Artillery following tanks, medic behavior |
| **Hunt** | Aggressively pursue a specific enemy unit. Close distance every turn, attack as soon as in range. On target death, retargets nearest enemy. | Assassinating key targets, tanks chasing artillery |
| **Capture** | Move to a target city, occupy it (city ownership flips), then hold position with DEF bonus. After capturing, retargets the nearest uncaptured enemy city. | Infantry seizing objectives, territory control |

**Directive targeting:**
All directives accept an optional **target**: a specific city, enemy unit, friendly unit, or hex coordinate. Without a target, directives default to the central objective (preserving original behavior). When a target becomes invalid (e.g., targeted enemy dies, city is captured), the unit automatically retargets to the nearest similar target.

- `hunt` requires an enemy unit target.
- `capture` requires a city target.
- All other directives accept any target type.

**Directive AI behavior rules:**
- Units with directives execute one action per turn automatically: either move (following directive pathfinding) or attack (if an enemy is in range and attackable).
- Movement priority: if an enemy is in attack range, the unit attacks instead of moving (exception: Scout directive retreats instead).
- Pathfinding respects terrain costs. Units will not path through impassable terrain.
- If a directive becomes impossible (e.g., Advance but path is fully blocked), the unit defaults to Hold.
- Directive AI is intentionally imperfect — it does not perform multi-unit coordination, predict enemy movement, or optimize focus fire. This is what command points are for.

### 4.2 Command Points (Battle Phase)

During the battle phase, the player has a limited pool of **Command Points (CP)** to override directive behavior and issue direct orders. This is the tactical adaptation layer — you watch your plan unfold, then intervene where it matters most.

| Property | Value | Notes |
|---|---|---|
| CP per round | 3 | Flat amount. Does not scale with army size. |
| CP carryover | No | Unspent CP is lost at end of round. |
| CP per action | 1 | Each direct order costs 1 CP regardless of action type. |

**What a command point lets you do:**
- **Redirect**: Change a unit's directive mid-battle (e.g., switch from Advance to Hold, or from Flank Left to Support). The unit follows the new directive for the rest of the round. Costs 1 CP.
- **Direct Move**: Manually move a unit to a specific hex (within its movement range). Overrides directive for this turn only. Costs 1 CP.
- **Direct Attack**: Manually target a specific enemy for a unit to attack (must be in range). Useful for focus-firing a key target instead of letting the AI pick. Costs 1 CP.
- **Retreat**: Order a unit to move back toward your deployment zone. It will path away from enemies for the rest of the round. Costs 1 CP.

**Command point rules:**
- A unit can only receive one command per turn. You cannot move AND attack the same unit with 2 CP in one turn.
- Commands are issued during your turn before directive AI resolves. Commanded units act on your order; all other units follow their directives.
- The opponent does NOT see which units you commanded (adds to fog of war mind games).
- Aircraft can receive a command to move AND attack in the same turn (1 CP, same as other units — this is the aircraft's inherent advantage, not a CP bonus).

### 4.3 Turn Execution Order

Each player's turn resolves in this sequence:

1. **Player spends CP** (optional): Issue 0–3 commands to units.
2. **Commanded units act**: Execute their ordered move or attack.
3. **Remaining units act**: All non-commanded units execute one action based on their directive AI.
4. **Capture check**: Any infantry on a city hex that wasn't attacked this turn progresses capture (see win conditions).
5. **Turn passes** to opponent.

### 4.4 Why This System Works for 15 Minutes

- **Build phase is richer**: You're not just buying units — you're scripting an opening strategy. This makes the 60–90 second build timer feel full without needing more time.
- **Battle turns are fast**: Most units act on autopilot. Your turn is: watch what happened, decide if you need to intervene (0–3 quick decisions), hit end turn. Target: 10–15 seconds per turn.
- **Skill ceiling is high**: Good players will assign better directives, read the battle faster, and spend CP on higher-impact interventions. But the floor is low — a new player can assign "Advance" to everything and have a playable game.
- **Army size isn't limited**: Because units self-manage, you can have 6–10 units without the turn taking forever. Resource costs are the only constraint on army size.

---

## 5. Game Flow & Economy

### 5.1 Round Structure

Each round follows three phases in sequence:

1. **BUILD PHASE (60–90 sec, simultaneous):** Both players see the map and their surviving units. They purchase new units, place them in the deployment zone, and assign a directive to every unit (new and surviving). A countdown timer enforces speed. Unspent resources carry over (max 50%).
2. **BATTLE PHASE (alternating turns, max 8 per side):** Fog of war is active. Units execute their directives autonomously. Players spend Command Points (3 per round) to override directives and issue direct orders. The round ends when: a player holds the central objective for 2 consecutive turns, all enemy units are destroyed, or the turn limit is reached.
3. **SCORING PHASE (automatic, 10 sec):** Surviving units persist to the next round. Resources are awarded based on performance. Round winner is determined.

### 5.2 Resource Economy

| Source | Amount | Condition |
|---|---|---|
| Base Income | 500/round | Guaranteed every round |
| City Control | +100/city/round | Hold city at end of battle phase |
| Kill Bonus | +25/unit destroyed | Incentivizes aggression |
| Round Win Bonus | +150 | Awarded to round winner |
| Carryover Cap | 50% of unspent | Prevents hoarding without losing it all |

### 5.3 Catch-Up Mechanics

To prevent snowballing (where the round 1 winner auto-wins the game), several catch-up mechanisms are built in:

- Losing player gets a +200 resource bonus for the next round ("desperation funds").
- Surviving units cost maintenance: 20% of their build cost is deducted from your income each round. Winning big means higher upkeep.
- City ownership resets each round — cities start neutral and must be re-captured. This prevents the winner from starting with an economic lead.
- Deployment zones reset — surviving units are placed back in the deployment zone, not where they ended battle. No positional advantage carries over.

### 5.4 Win Conditions

The primary round objective is the **central hex** — a specially marked objective hex at the center of the map. This creates a natural focal point that forces engagement.

**Round win (checked in this order):**

1. **King of the Hill**: A player wins the round if they have a unit on the central objective hex for **2 consecutive turns** (their turn counts, so: occupy on your turn → still occupying at the start of your next turn = win). The unit must not be destroyed between those turns. If the occupying unit is killed or displaced, the counter resets.
2. **Elimination**: If all of one player's units are destroyed, the other player wins the round immediately.
3. **Turn Limit Tiebreaker**: If the 8-turn limit is reached with no king-of-the-hill or elimination, the round winner is determined by: (a) whoever has a unit on the central hex (if only one player does), (b) whoever has a unit closest to the central hex (fewest hexes away), (c) if still tied, whoever has more total surviving unit HP.

**Game win:**

| Mode | Condition |
|---|---|
| Casual (default) | Best of 3 rounds — first to 2 round wins |
| Competitive | Best of 5 rounds — first to 3 round wins |
| Tiebreaker | If rounds are split evenly after final round, total surviving unit value across all rounds determines winner |

**Central hex rules:**
- The central hex is always a **City** terrain type (provides +30% defense to the holder, incentivizing holding it).
- Any unit type can occupy and contest the central hex, but only infantry can capture side cities for resource bonuses.
- If both players have a unit adjacent to the central hex but neither is on it, neither player's capture timer advances.
- The capture counter (2 turns) resets if the unit is destroyed, displaced by combat, or voluntarily moved off via command point.

---

## 6. Fog of War & Vision

The fog of war system is central to HexWar's identity. During the build phase, enemy composition and placement are completely hidden. During battle, visibility is determined by unit vision ranges.

### 6.1 Vision Rules

- Each unit has a vision range (in hexes). All hexes within that range are visible.
- Forest hexes block line-of-sight. You cannot see through a forest unless you have a unit in or adjacent to it.
- Mountain hexes grant +2 vision range to units standing on them (infantry only).
- Desert hexes grant +1 vision range due to open terrain.
- Enemy units in forest hexes are only visible if a friendly unit is adjacent (1 hex away).
- Recon units are the primary scouts with 5-hex vision range. They reveal enemies for all friendly units to see.
- Aircraft have 3-hex vision and can see over forests (but not reveal hidden ground units in forests).

### 6.2 Information States

| State | What You See | When It Applies |
|---|---|---|
| Unexplored | Terrain only (no units) | Default at battle start |
| Visible | Terrain + all units | Within friendly vision range |
| Last Known | Terrain + ghost marker | Previously visible, now in fog. Shows where you last saw an enemy. |
| Hidden | Terrain only | Was never in vision range or was only in vision briefly |

The "last known" ghost marker is important for player experience. It shows a faded icon where you last saw an enemy unit, giving you imperfect information to plan with. The ghost does not update when the real unit moves.

---

## 7. Technical Architecture

### 7.1 Recommended Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + TypeScript | Component-based UI, strong typing for game state |
| Rendering | HTML Canvas or PixiJS | Canvas for MVP, PixiJS if you need animations/perf |
| State Management | Zustand or Redux Toolkit | Predictable game state, easy undo/replay |
| Multiplayer | WebSocket (Socket.io) | Real-time sync for battle phase |
| Backend | Node.js + Express | Lightweight server for matchmaking and state authority |
| Database | SQLite or PostgreSQL | Player accounts, match history, leaderboards |
| AI Opponent | Minimax with alpha-beta | Single-player mode; heuristic evaluation function |

### 7.2 Core Architecture

The game is structured as a client-server model where the server is the source of truth for all game state. The client renders and sends player actions; the server validates and broadcasts results.

**Key architectural principle:** The game engine (hex grid, combat resolution, vision calculation, unit movement) should be a pure TypeScript module with zero UI dependencies. This allows it to run on both client (for prediction/rendering) and server (for authority/validation), and enables headless testing and AI simulation.

### 7.3 Module Breakdown

| Module | Responsibility | Key Exports |
|---|---|---|
| `hex-grid` | Coordinate math, neighbors, distance, LoS, pathfinding | `HexGrid`, `cubeDistance`, `hexLineDraw`, `aStar` |
| `terrain` | Terrain definitions, movement costs, defense/vision mods | `TerrainType`, `getMoveCost`, `getDefenseModifier` |
| `units` | Unit stats, type advantages, creation, damage calc | `UnitType`, `createUnit`, `calculateDamage` |
| `game-state` | Full game state machine, phase transitions, validation | `GameState`, `applyAction`, `getValidActions` |
| `directives` | Directive AI behaviors, pathfinding biases, CP system | `DirectiveType`, `executeDirective`, `applyCommand` |
| `vision` | Fog of war calculation, LoS raycasting, ghost tracking | `calculateVisibility`, `isHexVisible` |
| `economy` | Resource calculation, build validation, carryover | `calculateIncome`, `canAfford`, `applyMaintenance` |
| `map-gen` | Procedural symmetric map generation | `generateMap`, `validateMap` |
| `ai` | Computer opponent for single-player | `AIPlayer`, `evaluatePosition`, `getBestMove` |
| `renderer` | Canvas/PixiJS hex rendering, UI overlays, animations | `GameRenderer`, `HexRenderer`, `UnitSprite` |
| `network` | WebSocket client/server, action serialization, sync | `GameServer`, `GameClient`, `syncState` |

---

## 8. Implementation Plan

The implementation is broken into 6 phases, each producing a playable milestone. Each phase builds on the previous one. Estimated total: 4–6 weeks for a solo developer.

### Phase 1: Core Engine (Week 1)

Build the foundational game logic with zero UI. Everything runs in tests and console output.

1. Implement cube coordinate hex grid with neighbor calculation, distance, and pathfinding (A* with movement cost weighting).
2. Define terrain types as a data structure with movement cost, defense modifier, and vision modifier.
3. Define unit types as a data structure with all stats from the Unit Roster table.
4. Implement combat resolution function: takes attacker, defender, terrain, returns damage dealt.
5. Implement type advantage lookup table.
6. Implement line-of-sight raycasting using hex line drawing algorithm.
7. Implement vision calculation: given a set of units, return all visible hexes.
8. Implement the directive system: each directive type (Advance, Hold, Flank Left, Flank Right, Scout, Support) as a function that takes unit + game state and returns an action (move target or attack target).
9. Implement command point system: CP pool, spending, and command application.
10. Implement turn execution order: CP commands → commanded units act → directive units act → capture check.
11. Implement central objective logic: occupation tracking, 2-turn hold counter, displacement reset.
12. Write comprehensive unit tests for all of the above. Target 90%+ coverage on the engine.

**Deliverable:** A game-engine package that can simulate a full battle programmatically. You should be able to run: `createGame()` → `placeUnits()` → `assignDirectives()` → loop `{ spendCP(), resolveTurn() }` → `getWinner()` entirely in code.

### Phase 2: Map & Renderer (Week 2)

Get something visual on screen. The goal is a playable hex grid with units you can click and move.

1. Implement hex-to-pixel and pixel-to-hex conversion functions for flat-top hexagons.
2. Build a Canvas or PixiJS renderer that draws the hex grid with terrain colors/textures.
3. Render units as colored icons/sprites on the grid. Show directive indicators (small arrow/icon on each unit showing its directive).
4. Implement click-to-select unit, show unit info panel with stats and current directive.
5. Implement battle phase UI: show CP remaining, allow click-to-command (select unit → choose command type → choose target hex/enemy).
6. Implement auto-play visualization: units executing directives should animate movement/attacks so the player can watch the battle unfold.
7. Implement fog of war rendering: dim/hide hexes outside vision, show ghost markers.
8. Build the map generator: procedural symmetric maps with terrain distribution rules and central objective hex.
9. Add a basic HUD: current player turn, CP remaining, unit info panel, central objective status (who holds it, turns held).
10. Render the central objective hex with a distinct visual indicator (flag, crown, glow).

**Deliverable:** A single-screen hot-seat game where two players can take turns watching directives execute and spending CP to intervene. No build phase yet — units are pre-placed with default directives.

### Phase 3: Build Phase & Economy (Week 3)

Add the strategic layer: resource management, unit purchasing, and deployment.

1. Build the unit shop UI: list of available units with costs, drag-to-deploy onto deployment zone.
2. Build the directive assignment UI: after placing a unit, select its directive from a dropdown/radial menu. Show directive preview (arrow showing intended path on the map).
3. Allow re-assigning directives to surviving units from previous rounds.
4. Implement the resource system: base income, city bonuses, carryover logic.
5. Implement the build phase timer (60–90 seconds with visible countdown).
6. Connect rounds: surviving units persist, resources accumulate, phase transitions work.
7. Implement maintenance cost deduction at round start.
8. Implement the catch-up bonus for the losing player.
9. Add round scoring: central objective hold check, elimination check, tiebreaker logic, game-over detection.
10. Build the round transition screen: show results, resource awards, surviving units.

**Deliverable:** A complete single-device game with build (purchase + assign directives) → battle (watch + spend CP) → score loop running for 3 rounds. Two players share a screen, honor-system fog of war (look away during build phase).

### Phase 4: AI Opponent (Week 4)

Make the game playable solo against a computer opponent.

1. Implement a position evaluation heuristic: unit value, terrain control, objective proximity, threat assessment.
2. Build phase AI: budget allocation strategy (ratio-based unit purchasing with some randomization).
3. Tactical AI: for each unit, evaluate all valid move/attack options, score them, pick the best.
4. Add difficulty levels: Easy (random moves with basic attack priority), Medium (greedy best-move), Hard (2-ply lookahead).
5. Ensure AI respects fog of war — it should only act on information it can see, not omniscient.

**Deliverable:** A single-player game against an AI opponent with selectable difficulty. The full game loop works end to end.

### Phase 5: Multiplayer (Week 5)

Add real-time online play for two players.

- Set up WebSocket server with Socket.io. Implement room creation and matchmaking.
- Server-authoritative game state: client sends actions, server validates and broadcasts.
- Implement simultaneous build phase: both players build at the same time, server collects deployments, then reveals.
- Implement alternating battle turns with server-enforced turn timer.
- Handle disconnection gracefully: 30-second reconnect window, then auto-forfeit.
- Add a simple lobby UI: create game, join game, waiting screen.

**Deliverable:** Two players can play a full game over the internet with proper fog of war (server only sends visible unit data to each client).

### Phase 6: Polish & Content (Week 6)

- Add sound effects and music (minimal: attack sounds, build sounds, round transition).
- Add unit animations: movement, attack, death.
- Add 3–5 hand-crafted maps alongside the procedural generator.
- Add match history and basic stats tracking.
- Performance optimization: ensure 60fps on mid-range hardware.
- Playtesting and balance tuning: adjust unit costs, damage values, resource amounts based on data.
- Mobile responsive layout if targeting web.

---

## 9. Recommended Project Structure

The project uses a monorepo with shared game logic between client and server:

```
hexwar/
  packages/
    engine/                  ← Pure game logic (zero dependencies)
      src/
        hex.ts               ← Cube coordinates, neighbors, distance, LoS
        terrain.ts           ← Terrain definitions and modifiers
        units.ts             ← Unit types, stats, creation
        combat.ts            ← Damage calculation, type advantages
        vision.ts            ← Fog of war, visibility calculation
        economy.ts           ← Resources, income, maintenance
        game-state.ts        ← State machine, phase transitions, actions
        directives.ts        ← Directive AI behaviors, pathfinding biases, CP
        map-gen.ts           ← Procedural map generation
        ai.ts                ← Computer opponent logic
        types.ts             ← Shared type definitions
      __tests__/             ← Unit tests for all engine modules
    client/                  ← React + Canvas frontend
      src/
        components/          ← React UI components (HUD, shop, lobby)
        renderer/            ← Canvas/PixiJS rendering
        hooks/               ← Game state hooks, input handling
        store/               ← Zustand state management
    server/                  ← Node.js game server
      src/
        rooms.ts             ← Match rooms, player pairing
        game-loop.ts         ← Server-side game loop, validation
        network.ts           ← WebSocket handlers
```

---

## 10. Balance Guidelines & Tuning

These values are starting points. Plan to iterate based on playtesting. The key metrics to track:

- **Average game length** (target: 10–15 min). If games run long, reduce turn count or increase damage.
- **Unit pick rates**: if one unit is picked >40% of the time, it's probably too strong or too cheap.
- **Win rate by first-mover**: if going first wins >55% of battles, add a small advantage to player 2 (e.g., +50 resources).
- **Round 1 winner → game winner correlation**: if >70%, catch-up mechanics are too weak. If <50%, they're too strong.
- **Most common army compositions**: look for dominant strategies. Counter them by adjusting type multipliers.
- **Aircraft dominance**: aircraft are intentionally expensive (300) because they ignore terrain. If they dominate, increase cost to 350 or reduce HP to 2.

### 10.1 Tuning Levers

When balancing, adjust these values in this priority order (easiest to hardest impact):

1. **Unit costs** — the fastest way to balance. A 50-point cost change dramatically shifts viability.
2. **Type advantage multipliers** — adjust individual matchups without touching base stats.
3. **Resource income amounts** — more resources = more units = faster/more chaotic games.
4. **Turn limits** — fewer turns favors aggressive/fast units; more turns favors defensive/ranged units.
5. **Terrain defense values** — higher defense = slower, more positional games.
6. **Base unit stats (HP/ATK/DEF)** — last resort. Changes here ripple through the entire balance.

---

## 11. MVP Scope Definition

To ship a playable game as fast as possible, the MVP should include exactly this and nothing more.

### 11.1 In Scope (MVP)

- 10×8 hex grid with 4 terrain types (plains, forest, mountain, city)
- 4 unit types (infantry, tank, artillery, recon) — save aircraft and anti-air for v1.1
- 6 directives (Advance, Hold, Flank Left, Flank Right, Scout, Support)
- 3 Command Points per round for tactical overrides
- Central objective "King of the Hill" win condition (2-turn hold)
- 3-round best-of format
- Build phase with directive assignment + timer; battle phase with directive AI + CP spending
- Fog of war with vision ranges
- Resource economy with base income + city bonuses
- Single-player vs AI (medium difficulty)
- Hot-seat local multiplayer (two players, one screen)
- Procedural symmetric map generation

### 11.2 Post-MVP (v1.1+)

- Aircraft and Anti-Air units
- Online multiplayer with WebSocket
- Desert terrain
- 5-round competitive mode
- Hand-crafted maps
- Sound effects and animations
- Match history and leaderboards
- Mobile-responsive layout

---

**This document is the complete reference for implementation. Start with Phase 1 (core engine) and proceed sequentially. Every data value, formula, and rule needed to build the game is specified above.**
