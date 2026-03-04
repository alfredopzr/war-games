# HexWar

A hex-based tactical strategy game built with TypeScript. Two players deploy armies, assign directives, and battle for control of the central objective across multiple rounds. Play hot-seat, vs AI, or online multiplayer.

## Quick Start

```bash
# Prerequisites: Node >= 20, pnpm >= 9

# Install dependencies
pnpm install

# Run in development mode (engine + client + server)
pnpm dev

# Open http://localhost:5173 in your browser
# Server runs on http://localhost:3001
```

For local play (hot-seat or vs AI), the server is not required. For online multiplayer, both the client and server must be running.

```bash
# Run only the client
pnpm dev:client

# Run only the server
pnpm dev:server
```

## Project Structure

```
packages/
  engine/   # Pure TypeScript game engine (zero dependencies)
  client/   # React + Canvas renderer with Zustand state management
  server/   # Express + Socket.io multiplayer server
```

### Engine (`@hexwar/engine`)

The engine is a standalone, framework-agnostic TypeScript library. It handles all game logic and can be used independently of the client (e.g., for simulations or testing).

**Key modules:**

| Module | Purpose |
|--------|---------|
| `hex.ts` | Cube coordinate system, distance, neighbors, line-of-sight drawing |
| `terrain.ts` | 4 terrain types with move cost, defense, vision modifiers |
| `units.ts` | 4 unit types (infantry, tank, artillery, recon) with stats and type advantages |
| `combat.ts` | Damage calculation with type multipliers and terrain defense |
| `pathfinding.ts` | A* pathfinding with terrain-aware movement costs |
| `vision.ts` | Fog of war with line-of-sight raycasting and forest concealment |
| `directives.ts` | 8 autonomous unit behaviors (advance, hold, flank, scout, support, hunt, capture) with parameterized targeting |
| `commands.ts` | Command point system (4 CP per turn) |
| `economy.ts` | Income, carryover, maintenance, catch-up bonus |
| `map-gen.ts` | Procedural symmetric map generation with seeded PRNG |
| `game-state.ts` | Full game state machine (build -> battle -> scoring -> game-over) |
| `ai.ts` | Basic AI opponent for build and battle phases |
| `serialization.ts` | JSON-safe serialization of GameState (Map/Set to Record/Array) for network transport |

### Client (`@hexwar/client`)

React app rendering the game on an HTML Canvas. Uses Zustand for state management. In online mode, the client becomes a thin input layer — all actions are routed through a `NetworkManager` singleton (wrapping socket.io-client) instead of calling engine functions directly.

### Server (`@hexwar/server`)

Authoritative multiplayer server built on Express and Socket.io. The server holds the real `GameState`, validates all player actions via engine functions, and sends each player a **fog-of-war-filtered view** so hidden information is never leaked.

**Key modules:**

| Module | Purpose |
|--------|---------|
| `rooms.ts` | Room lifecycle: create (6-char codes), join, leave, disconnect/reconnect |
| `game-loop.ts` | Full game orchestration: build phase, battle phase, round/game-end flow |
| `state-filter.ts` | Fog-of-war filtering — strips hidden enemies and enemy directives |
| `timers.ts` | Build timer (120s) and turn timer (60s) with auto-timeout |

**Architecture:**

- **Server-authoritative**: The server owns the game state. Clients send intentions (place unit, submit commands); the server validates and executes them.
- **Fog of war enforcement**: During build phase, enemy units are completely hidden (blind deployment). During battle, only enemies within the player's vision range are included in the state sent to that player. Enemy directives are never revealed.
- **Reconnection**: Players get a reconnect token on join. If disconnected, they have 30 seconds to reconnect with the same token. The server pauses the forfeit timer, restores the player, and sends the full filtered game state.
- **Room codes**: 6-character uppercase codes generated from `crypto.randomUUID()`. Rooms are cleaned up when both players leave or the game ends.

**Online game flow:**

1. Player 1 creates a room, gets a 6-char code
2. Player 2 joins with the code
3. Server creates game state, sends filtered views to both players
4. Build phase: players place units (each sees only their own side)
5. Both confirm build (or 120s timer expires) — server transitions to battle
6. Battle phase: players submit commands on their turn; server executes, diffs state for battle events, sends filtered results
7. Round end → scoring → next build phase (or game over)

## Game Mechanics

### Rounds and Win Condition

- **Best of 3 rounds.** First to win 2 rounds wins the match.
- Each round has a **build phase** and a **battle phase**.

### Build Phase (90 seconds)

Each player starts with **500 gold** (plus income from previous rounds). Purchase and deploy units into your deployment zone (the top 2 rows for Player 1, bottom 2 rows for Player 2).

| Unit | Cost | HP | ATK | DEF | Move | Range | Vision |
|------|------|----|-----|-----|------|-------|--------|
| Infantry | 100 | 3 | 2 | 2 | 3 | 1 | 3 |
| Tank | 250 | 4 | 4 | 3 | 4 | 1 | 3 |
| Artillery | 200 | 2 | 5 | 1 | 2 | 2-3 | 3 |
| Recon | 100 | 2 | 1 | 1 | 5 | 1 | 6 |

Assign each unit a **directive** that controls its autonomous behavior:

- **Advance** — Push toward objective or target, attack enemies en route
- **Hold** — Move to target, then dig in (+1 DEF). Attacks enemies in range
- **Flank Left/Right** — Arc around the target from the side
- **Scout** — Reconnoiter target area, retreat from adjacent foes
- **Support** — Follow and heal a target friendly unit
- **Hunt** — Pursue and destroy a specific enemy unit
- **Capture** — Move to a city, occupy it, then hold position

All directives accept an optional **target** (city, enemy unit, friendly unit, or hex). Without a target, they default to the central objective.

### Battle Phase

Players alternate turns. Each turn:

1. **Spend up to 4 Command Points** to override unit behavior:
   - **Direct Move** — Move a specific unit to a hex
   - **Direct Attack** — Attack a specific enemy
   - **Redirect** — Change a unit's directive
   - **Retreat** — Pull a unit back toward your deployment zone
2. **All remaining units execute their directive** autonomously

### Round End Conditions

A round ends when any of these occur:

- **King of the Hill** — A player holds the central hex for 2 consecutive turns **and** controls at least 2 city hexes
- **Elimination** — All of one player's units are destroyed
- **Turn Limit** — After 8 turns per side, tiebreaker: objective control > proximity > total HP

> **Tip:** Capturing city hexes is not just an economic bonus — you need to hold 2 cities before your objective hold counter starts ticking.

### Economy Between Rounds

| Source | Amount |
|--------|--------|
| Base income | 500 |
| Per city hex held | +100 |
| Per enemy unit killed | +25 |
| Round win bonus | +150 |
| Catch-up bonus (loser) | +200 |
| Resource carryover | 50% of unspent gold |
| Unit maintenance | -20% of surviving unit costs |

Surviving units carry over to the next round and cannot be removed during build.

### Fog of War

- Each unit has a vision range. Mountains grant +2 vision; forests grant -1.
- Mountains block line of sight for hexes behind them.
- Units in forests are only visible to adjacent enemies.
- Last-known enemy positions appear as ghost markers when they leave visibility.

### Type Advantages

Damage multipliers (attacker vs defender):

|  | vs Infantry | vs Tank | vs Artillery | vs Recon |
|--|-------------|---------|-------------|----------|
| **Infantry** | 1.0x | 0.5x | 1.2x | 1.0x |
| **Tank** | 1.5x | 1.0x | 1.2x | 1.5x |
| **Artillery** | 1.3x | 1.3x | 1.0x | 1.3x |
| **Recon** | 0.8x | 0.3x | 1.5x | 1.0x |

### Terrain

| Type | Move Cost | Defense | Vision | Notes |
|------|-----------|---------|--------|-------|
| Plains | 1 | 1.0x | +0 | Default terrain |
| Forest | 2 | 1.5x | -1 | Conceals units, blocks LoS |
| Mountain | Inf (infantry: 3) | 2.0x | +2 | Only infantry can enter |
| City | 1 | 1.3x | +0 | Generates income |

### Online Multiplayer

Click "Online" on the start screen. Create a room to get a 6-character code, then share it with your opponent. Both players deploy blind (you can't see enemy placements), and the server enforces fog of war throughout the battle.

Disconnections are handled gracefully — you have 30 seconds to reconnect before forfeiting. The game state is fully restored on reconnect.

### AI Opponent

Toggle "vs AI" on the start screen. The AI uses a greedy strategy:

- **Build:** Allocates budget across unit types (40% tanks, 30% infantry, 20% artillery, 10% recon)
- **Battle:** Prioritizes kill shots, retreats endangered units, redirects others toward the objective

## Controls

| Action | Input |
|--------|-------|
| Place unit | Select unit type in shop, click deployment zone |
| Remove placed unit | Right-click on own unit during build |
| Select unit | Click on a unit |
| Assign directive | Select unit, choose from directive panel |
| Direct move | Select unit, click Move in command menu, click target hex |
| Direct attack | Select unit, click Attack in command menu, click enemy |
| End turn | Click "End Turn" button |

## Development

```bash
# Run all tests (312 tests)
pnpm test

# Run engine tests only (242 tests)
pnpm --filter @hexwar/engine test

# Run server tests only (70 tests, including integration)
pnpm --filter @hexwar/server test

# Run tests in watch mode
pnpm --filter @hexwar/engine test -- --watch

# Build all packages
pnpm build

# Format code
pnpm format
```

## Tech Stack

- **Engine:** Pure TypeScript, zero runtime dependencies
- **Client:** React 19, Vite, Zustand, HTML Canvas, socket.io-client
- **Server:** Express 5, Socket.io 4, @hexwar/engine
- **Testing:** Vitest (312 tests across engine and server)
- **Monorepo:** pnpm workspaces
