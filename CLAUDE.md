# HexWar — Project Instructions

## Overview

HexWar is a hex-based tactical strategy game. See `docs/DESIGN.md` for the full game design document.

## Documentation

- All design docs, reference materials, and non-code markdown files belong in `docs/`.
- Only `CLAUDE.md` and `README.md` stay in the project root.

## Monorepo Structure

- `packages/engine/` — Pure game logic, zero UI dependencies. Runs on both client and server.
- `packages/client/` — React + Vite frontend with Zustand state management.

## Coding Standards

- **Strict TypeScript, always.** No `any`. Enable `noUncheckedIndexedAccess`.
- **Explicit return types** on all public/exported functions.
- **Interface** for object shapes, **type** for unions and aliases.
- **PascalCase** for types/interfaces, **camelCase** for functions/variables, **UPPER_SNAKE_CASE** for constants.
- No inline styles. Ever.
- Delete dead code — don't comment it out.
- Prefer simple solutions. Three similar lines > premature abstraction.
- Server Components by default in Next.js (client uses Vite, not Next — but keep this habit).
- `"use client"` only when needed.

## Testing

- **Vitest** for all tests. TDD preferred — write tests before implementation.
- Target 90%+ coverage on the engine package.
- Test files live alongside source: `src/foo.test.ts` next to `src/foo.ts`.
- Use `describe`/`it` blocks with clear test names.

## Types

- All shared types live in `packages/engine/src/types.ts`.
- Do NOT add types to other files unless they are purely internal to that module.
- Import types from `@engine/types` in engine code, or from `@hexwar/engine` in client code.

## Key Algorithms

- Hex grid uses **cube coordinates** (q, r, s where q + r + s = 0).
- Pathfinding uses **A\*** with terrain-weighted movement costs.
- Combat is **deterministic with ±15% variance**: `BaseDamage = ATK * TypeMultiplier * TerrainModifier * random(0.85, 1.15)`.
- Line-of-sight uses **hex line drawing** algorithm.

## Commits

Keep each commit scoped to a single feature or fix. Do not bundle unrelated changes into one commit.

## Commands

- `pnpm test` — run all tests
- `pnpm dev` — start all packages in dev mode
- `pnpm build` — build all packages
- `pnpm format` — format all source files with Prettier
