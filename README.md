# HexWar

A hex-based tactical strategy game built with TypeScript. Two players deploy armies, assign directives, and battle for control of the central objective across multiple rounds. Play hot-seat against a friend or vs a basic AI opponent.

## Quick Start

```bash
# Prerequisites: Node >= 20, pnpm >= 9

# Install dependencies
pnpm install

# Run in development mode (engine + client)
pnpm dev

# Open http://localhost:5173 in your browser
```

## Project Structure

```
packages/
  engine/   # Pure TypeScript game engine (zero dependencies)
  client/   # React + Canvas renderer with Zustand state management
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
| `directives.ts` | 6 autonomous unit behaviors (advance, hold, flank, scout, support) |
| `commands.ts` | Command point system (3 CP per turn) |
| `economy.ts` | Income, carryover, maintenance, catch-up bonus |
| `map-gen.ts` | Procedural symmetric map generation with seeded PRNG |
| `game-state.ts` | Full game state machine (build -> battle -> scoring -> game-over) |
| `ai.ts` | Basic AI opponent for build and battle phases |

### Client (`@hexwar/client`)

React app rendering the game on an HTML Canvas. Uses Zustand for state management.

## Game Mechanics

### Rounds and Win Condition

- **Best of 3 rounds.** First to win 2 rounds wins the match.
- Each round has a **build phase** and a **battle phase**.

### Build Phase (90 seconds)

Each player starts with **500 gold** (plus income from previous rounds). Purchase and deploy units into your deployment zone (the 2 leftmost or rightmost columns of the map).

| Unit | Cost | HP | ATK | DEF | Move | Range | Vision |
|------|------|----|-----|-----|------|-------|--------|
| Infantry | 100 | 3 | 2 | 2 | 2 | 1 | 2 |
| Tank | 250 | 4 | 4 | 3 | 3 | 1 | 2 |
| Artillery | 200 | 2 | 5 | 1 | 1 | 2-3 | 2 |
| Recon | 100 | 2 | 1 | 1 | 4 | 1 | 5 |

Assign each unit a **directive** that controls its autonomous behavior:

- **Advance** — Move toward the central objective, attack enemies in range
- **Hold** — Stay in position, attack if enemies are in range
- **Flank Left/Right** — Arc around the objective from the side
- **Scout** — Explore far from friendly units, retreat from adjacent enemies
- **Support** — Follow nearby friendly units at ~2 hex distance

### Battle Phase

Players alternate turns. Each turn:

1. **Spend up to 3 Command Points** to override unit behavior:
   - **Direct Move** — Move a specific unit to a hex
   - **Direct Attack** — Attack a specific enemy
   - **Redirect** — Change a unit's directive
   - **Retreat** — Pull a unit back toward your deployment zone
2. **All remaining units execute their directive** autonomously

### Round End Conditions

A round ends when any of these occur:

- **King of the Hill** — A player holds the central hex for 2 consecutive turns
- **Elimination** — All of one player's units are destroyed
- **Turn Limit** — After 8 turns per side, tiebreaker: objective control > proximity > total HP

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

### AI Opponent

Toggle "Play vs AI" on the start screen. The AI uses a greedy strategy:

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
# Run engine tests (210 tests)
pnpm --filter @hexwar/engine test

# Run tests in watch mode
pnpm --filter @hexwar/engine test -- --watch

# Build client
pnpm --filter @hexwar/client build

# Type check everything
pnpm build

# Format code
pnpm format
```

## Tech Stack

- **Engine:** Pure TypeScript, zero runtime dependencies
- **Client:** React 19, Vite, Zustand, HTML Canvas
- **Testing:** Vitest (210 tests, ~92% engine coverage)
- **Monorepo:** pnpm workspaces
