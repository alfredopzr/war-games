# HexWar Phases 1-3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete single-device HexWar game with core engine, canvas renderer, build phase, economy, and multi-round gameplay.

**Architecture:** Monorepo with a pure TypeScript game engine package (zero dependencies, runs on client and server) and a React + Canvas client package. The engine is the source of truth — all game rules, combat, vision, pathfinding, and state transitions live there. The client is a thin rendering and input layer. TDD throughout — engine has 90%+ test coverage.

**Tech Stack:**
- **Monorepo**: pnpm workspaces
- **Engine**: Pure TypeScript (zero deps), Vitest for testing
- **Client**: React 18, HTML Canvas (no PixiJS for MVP), Zustand for UI state
- **Build**: Vite
- **Linting**: ESLint + Prettier
- **Node**: 20+

**Reference:** Full game design in `/DESIGN.md`. TypeScript conventions from knowledge-hub (`reference/typescript-react-standards.md`).

**MVP Scope (from DESIGN.md Section 11):**
- 10x8 hex grid, 4 terrain types (plains, forest, mountain, city)
- 4 unit types (infantry, tank, artillery, recon) — no aircraft/anti-air
- 6 directives, 3 CP/round
- King of the Hill win condition (2-turn hold)
- 3-round best-of format
- Fog of war, resource economy
- Single-player vs AI (medium) + hot-seat local multiplayer
- Procedural symmetric maps

---

## Phase 1: Core Engine

Everything runs in tests. Zero UI. Pure TypeScript module.

---

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/vitest.config.ts`
- Create: `packages/engine/src/index.ts`
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `.gitignore`
- Create: `.prettierrc`
- Create: `CLAUDE.md` (project-level)

**Step 1: Initialize monorepo root**

```json
// package.json
{
  "name": "hexwar",
  "private": true,
  "scripts": {
    "test": "pnpm --filter @hexwar/engine test",
    "test:watch": "pnpm --filter @hexwar/engine test:watch",
    "test:coverage": "pnpm --filter @hexwar/engine test:coverage",
    "dev": "pnpm --filter @hexwar/client dev",
    "build": "pnpm --filter @hexwar/client build",
    "lint": "eslint packages/*/src --ext .ts,.tsx",
    "format": "prettier --write 'packages/*/src/**/*.{ts,tsx}'"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  }
}
```

**Step 2: Initialize engine package**

```json
// packages/engine/package.json
{
  "name": "@hexwar/engine",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "typescript": "^5.7.0"
  }
}
```

```json
// packages/engine/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "@engine/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"]
}
```

```ts
// packages/engine/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, 'src'),
    },
  },
});
```

**Step 3: Initialize client package (placeholder)**

```json
// packages/client/package.json
{
  "name": "@hexwar/client",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@hexwar/engine": "workspace:*",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

**Step 4: Create .gitignore, .prettierrc, project CLAUDE.md**

```
# .gitignore
node_modules/
dist/
coverage/
.env
.env.local
*.tgz
.DS_Store
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

The project `CLAUDE.md` should reference `/DESIGN.md` as the game spec, list the monorepo structure, and specify: strict TypeScript, Vitest, TDD, no `any`, explicit return types on public functions, path alias `@engine/` for engine imports.

**Step 5: Install dependencies**

Run: `pnpm install`

**Step 6: Verify engine test runner works**

Create a smoke test `packages/engine/src/smoke.test.ts`:
```ts
describe('engine smoke test', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `pnpm test`
Expected: 1 test passes. Delete smoke test after verification.

**Step 7: Initialize git and commit**

```bash
git init
git add -A
git commit -m "chore: monorepo scaffolding with engine and client packages"
```

---

### Task 2: Hex Grid — Coordinates, Neighbors, Distance

**Files:**
- Create: `packages/engine/src/hex.ts`
- Create: `packages/engine/src/hex.test.ts`
- Create: `packages/engine/src/types.ts`

**Context:** Use cube coordinates (q, r, s where q + r + s = 0). Flat-top hexagons. See DESIGN.md Section 2.1.

**Step 1: Define core types in `types.ts`**

```ts
/** Cube coordinate for hex grid. Invariant: q + r + s === 0 */
export interface CubeCoord {
  readonly q: number;
  readonly r: number;
  readonly s: number;
}

/** Axial coordinate (derived from cube, drops s) */
export interface AxialCoord {
  readonly q: number;
  readonly r: number;
}

/** Grid dimensions */
export interface GridSize {
  readonly width: number;
  readonly height: number;
}
```

**Step 2: Write failing tests for hex utilities**

```ts
// hex.test.ts
import { describe, it, expect } from 'vitest';
import {
  createHex,
  cubeDistance,
  hexNeighbors,
  hexAdd,
  hexSubtract,
  isValidHex,
} from './hex';

describe('createHex', () => {
  it('creates valid cube coord from q and r', () => {
    const hex = createHex(1, -1);
    expect(hex).toEqual({ q: 1, r: -1, s: 0 });
  });

  it('computes s = -q - r', () => {
    const hex = createHex(2, -3);
    expect(hex.s).toBe(1);
  });
});

describe('cubeDistance', () => {
  it('returns 0 for same hex', () => {
    const a = createHex(0, 0);
    expect(cubeDistance(a, a)).toBe(0);
  });

  it('returns 1 for adjacent hexes', () => {
    const a = createHex(0, 0);
    const b = createHex(1, 0);
    expect(cubeDistance(a, b)).toBe(1);
  });

  it('returns correct distance for far hexes', () => {
    const a = createHex(0, 0);
    const b = createHex(3, -3);
    expect(cubeDistance(a, b)).toBe(3);
  });
});

describe('hexNeighbors', () => {
  it('returns 6 neighbors', () => {
    const hex = createHex(0, 0);
    const neighbors = hexNeighbors(hex);
    expect(neighbors).toHaveLength(6);
  });

  it('all neighbors are distance 1', () => {
    const hex = createHex(2, -1);
    const neighbors = hexNeighbors(hex);
    neighbors.forEach((n) => {
      expect(cubeDistance(hex, n)).toBe(1);
    });
  });
});

describe('hexAdd / hexSubtract', () => {
  it('adds two hex coords', () => {
    const a = createHex(1, 2);
    const b = createHex(-1, 0);
    expect(hexAdd(a, b)).toEqual(createHex(0, 2));
  });

  it('subtracts two hex coords', () => {
    const a = createHex(3, -1);
    const b = createHex(1, -1);
    expect(hexSubtract(a, b)).toEqual(createHex(2, 0));
  });
});

describe('isValidHex', () => {
  it('returns true for hex within 10x8 grid', () => {
    expect(isValidHex(createHex(0, 0), { width: 10, height: 8 })).toBe(true);
    expect(isValidHex(createHex(9, 0), { width: 10, height: 8 })).toBe(true);
  });

  it('returns false for hex outside grid', () => {
    expect(isValidHex(createHex(-1, 0), { width: 10, height: 8 })).toBe(false);
    expect(isValidHex(createHex(10, 0), { width: 10, height: 8 })).toBe(false);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd packages/engine && pnpm test`
Expected: FAIL — module `./hex` doesn't exist.

**Step 4: Implement hex.ts**

```ts
import type { CubeCoord, GridSize } from './types';

const CUBE_DIRECTIONS: readonly CubeCoord[] = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
] as const;

export function createHex(q: number, r: number): CubeCoord {
  return { q, r, s: -q - r };
}

export function cubeDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

export function hexNeighbors(hex: CubeCoord): CubeCoord[] {
  return CUBE_DIRECTIONS.map((d) => hexAdd(hex, d));
}

export function hexAdd(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}

export function hexSubtract(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { q: a.q - b.q, r: a.r - b.r, s: a.s - b.s };
}

export function hexToKey(hex: CubeCoord): string {
  return `${hex.q},${hex.r}`;
}

export function isValidHex(hex: CubeCoord, grid: GridSize): boolean {
  // Using offset coordinates for grid bounds: col = q, row = r + floor(q/2)
  const col = hex.q;
  const row = hex.r + Math.floor(hex.q / 2);
  return col >= 0 && col < grid.width && row >= 0 && row < grid.height;
}

export function getAllHexes(grid: GridSize): CubeCoord[] {
  const hexes: CubeCoord[] = [];
  for (let col = 0; col < grid.width; col++) {
    for (let row = 0; row < grid.height; row++) {
      const q = col;
      const r = row - Math.floor(col / 2);
      hexes.push(createHex(q, r));
    }
  }
  return hexes;
}

export { CUBE_DIRECTIONS };
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/hex.ts packages/engine/src/hex.test.ts
git commit -m "feat(engine): hex grid with cube coordinates, neighbors, distance"
```

---

### Task 3: Hex Line Drawing & Line-of-Sight

**Files:**
- Modify: `packages/engine/src/hex.ts`
- Create: `packages/engine/src/hex-line.test.ts`

**Context:** Hex line draw is needed for LoS raycasting. Uses linear interpolation in cube space, rounding to nearest hex. See DESIGN.md Section 6.1 — forests block LoS.

**Step 1: Write failing tests**

```ts
// hex-line.test.ts
import { describe, it, expect } from 'vitest';
import { hexLineDraw } from './hex';
import { createHex, cubeDistance } from './hex';

describe('hexLineDraw', () => {
  it('returns single hex for same start and end', () => {
    const hex = createHex(0, 0);
    expect(hexLineDraw(hex, hex)).toEqual([hex]);
  });

  it('returns correct line for adjacent hexes', () => {
    const a = createHex(0, 0);
    const b = createHex(1, 0);
    const line = hexLineDraw(a, b);
    expect(line).toHaveLength(2);
    expect(line[0]).toEqual(a);
    expect(line[1]).toEqual(b);
  });

  it('returns correct number of hexes for longer line', () => {
    const a = createHex(0, 0);
    const b = createHex(3, -3);
    const line = hexLineDraw(a, b);
    // Distance is 3, so line has 4 hexes (distance + 1)
    expect(line).toHaveLength(4);
  });

  it('each consecutive pair is adjacent (distance 1)', () => {
    const a = createHex(0, 0);
    const b = createHex(4, -2);
    const line = hexLineDraw(a, b);
    for (let i = 0; i < line.length - 1; i++) {
      expect(cubeDistance(line[i]!, line[i + 1]!)).toBe(1);
    }
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement hexLineDraw**

Add to `hex.ts`:
```ts
function cubeRound(q: number, r: number, s: number): CubeCoord {
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  } else {
    rs = -rq - rr;
  }

  return { q: rq, r: rr, s: rs };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function hexLineDraw(a: CubeCoord, b: CubeCoord): CubeCoord[] {
  const dist = cubeDistance(a, b);
  if (dist === 0) return [a];

  const results: CubeCoord[] = [];
  const nudge = 1e-6;
  for (let i = 0; i <= dist; i++) {
    const t = i / dist;
    results.push(
      cubeRound(
        lerp(a.q + nudge, b.q + nudge, t),
        lerp(a.r - nudge, b.r - nudge, t),
        lerp(a.s - nudge, b.s - nudge, t),
      ),
    );
  }
  return results;
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -am "feat(engine): hex line drawing for LoS raycasting"
```

---

### Task 4: Terrain System

**Files:**
- Create: `packages/engine/src/terrain.ts`
- Create: `packages/engine/src/terrain.test.ts`
- Modify: `packages/engine/src/types.ts`

**Context:** DESIGN.md Section 2.2. MVP has 4 terrain types: plains, forest, mountain, city. Desert is post-MVP.

**Step 1: Add terrain types to `types.ts`**

```ts
export type TerrainType = 'plains' | 'forest' | 'mountain' | 'city';

export interface TerrainDefinition {
  readonly type: TerrainType;
  readonly moveCost: number; // 1 = normal, Infinity = impassable
  readonly defenseModifier: number; // 0.0 = no bonus, 0.25 = +25%
  readonly visionModifier: number; // 0 = normal, +N = bonus range
  readonly blocksLoS: boolean;
  readonly infantryOnly: boolean; // true = vehicles cannot enter
}

export interface HexTile {
  readonly coord: CubeCoord;
  readonly terrain: TerrainType;
}
```

**Step 2: Write failing tests**

```ts
// terrain.test.ts
import { describe, it, expect } from 'vitest';
import { TERRAIN, getMoveCost, getDefenseModifier } from './terrain';

describe('TERRAIN definitions', () => {
  it('plains has move cost 1 and no defense bonus', () => {
    expect(TERRAIN.plains.moveCost).toBe(1);
    expect(TERRAIN.plains.defenseModifier).toBe(0);
    expect(TERRAIN.plains.blocksLoS).toBe(false);
  });

  it('forest blocks LoS and has +25% defense', () => {
    expect(TERRAIN.forest.moveCost).toBe(2);
    expect(TERRAIN.forest.defenseModifier).toBe(0.25);
    expect(TERRAIN.forest.blocksLoS).toBe(true);
  });

  it('mountain is infantry-only with +40% defense', () => {
    expect(TERRAIN.mountain.infantryOnly).toBe(true);
    expect(TERRAIN.mountain.defenseModifier).toBe(0.4);
  });

  it('city has +30% defense and move cost 1', () => {
    expect(TERRAIN.city.moveCost).toBe(1);
    expect(TERRAIN.city.defenseModifier).toBe(0.3);
  });
});

describe('getMoveCost', () => {
  it('returns Infinity for vehicles on mountains', () => {
    expect(getMoveCost('mountain', 'tank')).toBe(Infinity);
    expect(getMoveCost('mountain', 'recon')).toBe(Infinity);
  });

  it('returns normal cost for infantry on mountains', () => {
    expect(getMoveCost('mountain', 'infantry')).toBe(TERRAIN.mountain.moveCost);
  });
});
```

**Step 3: Run tests — expect FAIL**

**Step 4: Implement terrain.ts**

```ts
import type { TerrainType, TerrainDefinition } from './types';

// Forward-reference UnitType here to avoid circular deps.
// We only need the string union for move cost checks.
type UnitCategory = 'infantry' | 'tank' | 'artillery' | 'recon';

export const TERRAIN: Record<TerrainType, TerrainDefinition> = {
  plains: {
    type: 'plains',
    moveCost: 1,
    defenseModifier: 0,
    visionModifier: 0,
    blocksLoS: false,
    infantryOnly: false,
  },
  forest: {
    type: 'forest',
    moveCost: 2,
    defenseModifier: 0.25,
    visionModifier: 0,
    blocksLoS: true,
    infantryOnly: false,
  },
  mountain: {
    type: 'mountain',
    moveCost: 3,
    defenseModifier: 0.4,
    visionModifier: 2,
    blocksLoS: false,
    infantryOnly: true,
  },
  city: {
    type: 'city',
    moveCost: 1,
    defenseModifier: 0.3,
    visionModifier: 0,
    blocksLoS: false,
    infantryOnly: false,
  },
} as const;

export function getMoveCost(terrain: TerrainType, unitType: string): number {
  const def = TERRAIN[terrain];
  if (def.infantryOnly && unitType !== 'infantry') {
    return Infinity;
  }
  return def.moveCost;
}

export function getDefenseModifier(terrain: TerrainType): number {
  return TERRAIN[terrain].defenseModifier;
}

export function getVisionModifier(terrain: TerrainType): number {
  return TERRAIN[terrain].visionModifier;
}
```

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```bash
git commit -am "feat(engine): terrain system with 4 types and modifiers"
```

---

### Task 5: Unit System — Types, Stats, Creation

**Files:**
- Create: `packages/engine/src/units.ts`
- Create: `packages/engine/src/units.test.ts`
- Modify: `packages/engine/src/types.ts`

**Context:** DESIGN.md Section 3.1. MVP has 4 unit types: infantry, tank, artillery, recon.

**Step 1: Add unit types to `types.ts`**

```ts
export type UnitType = 'infantry' | 'tank' | 'artillery' | 'recon';

export interface UnitStats {
  readonly type: UnitType;
  readonly cost: number;
  readonly maxHp: number;
  readonly atk: number;
  readonly def: number;
  readonly moveRange: number;
  readonly attackRange: number;
  readonly minAttackRange: number; // artillery has min range of 2
  readonly visionRange: number;
}

export type DirectiveType = 'advance' | 'hold' | 'flank-left' | 'flank-right' | 'scout' | 'support';

export type PlayerId = 'player1' | 'player2';

export interface Unit {
  readonly id: string;
  readonly type: UnitType;
  readonly owner: PlayerId;
  hp: number;
  position: CubeCoord;
  directive: DirectiveType;
  hasActed: boolean;
}
```

**Step 2: Write failing tests**

Test unit creation, stat lookup, and the type advantage matrix.

```ts
// units.test.ts
import { describe, it, expect } from 'vitest';
import { UNIT_STATS, createUnit, getTypeAdvantage } from './units';

describe('UNIT_STATS', () => {
  it('infantry costs 100 with expected stats', () => {
    const inf = UNIT_STATS.infantry;
    expect(inf.cost).toBe(100);
    expect(inf.maxHp).toBe(3);
    expect(inf.atk).toBe(2);
    expect(inf.def).toBe(2);
    expect(inf.moveRange).toBe(2);
    expect(inf.attackRange).toBe(1);
    expect(inf.visionRange).toBe(2);
  });

  it('artillery has min attack range of 2', () => {
    expect(UNIT_STATS.artillery.minAttackRange).toBe(2);
    expect(UNIT_STATS.artillery.attackRange).toBe(3);
  });

  it('recon has vision range 5', () => {
    expect(UNIT_STATS.recon.visionRange).toBe(5);
  });
});

describe('createUnit', () => {
  it('creates a unit with full HP and given position', () => {
    const unit = createUnit('infantry', 'player1', { q: 0, r: 0, s: 0 });
    expect(unit.type).toBe('infantry');
    expect(unit.owner).toBe('player1');
    expect(unit.hp).toBe(3);
    expect(unit.position).toEqual({ q: 0, r: 0, s: 0 });
    expect(unit.directive).toBe('advance'); // default directive
    expect(unit.hasActed).toBe(false);
    expect(unit.id).toBeTruthy();
  });
});

describe('getTypeAdvantage', () => {
  it('tank vs infantry = 1.5', () => {
    expect(getTypeAdvantage('tank', 'infantry')).toBe(1.5);
  });

  it('infantry vs tank = 0.5', () => {
    expect(getTypeAdvantage('infantry', 'tank')).toBe(0.5);
  });

  it('recon vs artillery = 1.5', () => {
    expect(getTypeAdvantage('recon', 'artillery')).toBe(1.5);
  });

  it('same type vs same type = 1.0', () => {
    expect(getTypeAdvantage('infantry', 'infantry')).toBe(1.0);
    expect(getTypeAdvantage('tank', 'tank')).toBe(1.0);
  });
});
```

**Step 3: Run tests — expect FAIL**

**Step 4: Implement units.ts**

```ts
import type { UnitType, UnitStats, Unit, PlayerId, CubeCoord, DirectiveType } from './types';

let unitIdCounter = 0;

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: {
    type: 'infantry',
    cost: 100,
    maxHp: 3,
    atk: 2,
    def: 2,
    moveRange: 2,
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 2,
  },
  tank: {
    type: 'tank',
    cost: 250,
    maxHp: 4,
    atk: 4,
    def: 3,
    moveRange: 3,
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 2,
  },
  artillery: {
    type: 'artillery',
    cost: 200,
    maxHp: 2,
    atk: 5,
    def: 1,
    moveRange: 1,
    attackRange: 3,
    minAttackRange: 2,
    visionRange: 2,
  },
  recon: {
    type: 'recon',
    cost: 100,
    maxHp: 2,
    atk: 1,
    def: 1,
    moveRange: 4,
    attackRange: 1,
    minAttackRange: 1,
    visionRange: 5,
  },
} as const;

// MVP type advantage matrix (4 unit types only, from DESIGN.md Section 3.3)
const TYPE_ADVANTAGE: Record<UnitType, Record<UnitType, number>> = {
  infantry: { infantry: 1.0, tank: 0.5, artillery: 1.2, recon: 1.0 },
  tank:     { infantry: 1.5, tank: 1.0, artillery: 1.2, recon: 1.5 },
  artillery:{ infantry: 1.3, tank: 1.3, artillery: 1.0, recon: 1.3 },
  recon:    { infantry: 0.8, tank: 0.3, artillery: 1.5, recon: 1.0 },
};

export function createUnit(
  type: UnitType,
  owner: PlayerId,
  position: CubeCoord,
  directive: DirectiveType = 'advance',
): Unit {
  unitIdCounter++;
  return {
    id: `${owner}-${type}-${unitIdCounter}`,
    type,
    owner,
    hp: UNIT_STATS[type].maxHp,
    position,
    directive,
    hasActed: false,
  };
}

export function getTypeAdvantage(attacker: UnitType, defender: UnitType): number {
  return TYPE_ADVANTAGE[attacker][defender];
}

export function resetUnitIdCounter(): void {
  unitIdCounter = 0;
}
```

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```bash
git commit -am "feat(engine): unit system with 4 types, stats, type advantage matrix"
```

---

### Task 6: Combat Resolution

**Files:**
- Create: `packages/engine/src/combat.ts`
- Create: `packages/engine/src/combat.test.ts`

**Context:** DESIGN.md Section 3.2. Deterministic formula with small random variance (±15%). `Base Damage = ATK × Type Multiplier × Terrain Modifier × random(0.85, 1.15)`. `Final Damage = max(1, Base Damage - DEF × Terrain Defense)`.

**Step 1: Write failing tests**

```ts
// combat.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDamage, canAttack } from './combat';
import { createUnit } from './units';
import { createHex, cubeDistance } from './hex';

describe('calculateDamage', () => {
  it('deals at least 1 damage', () => {
    const attacker = createUnit('recon', 'player1', createHex(0, 0));
    const defender = createUnit('tank', 'player2', createHex(1, 0));
    // recon (ATK 1, multiplier 0.3) vs tank (DEF 3) on plains
    const result = calculateDamage(attacker, defender, 'plains', () => 1.0);
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('applies type advantage multiplier', () => {
    const attacker = createUnit('tank', 'player1', createHex(0, 0));
    const defender = createUnit('infantry', 'player2', createHex(1, 0));
    // Tank ATK=4, multiplier=1.5 vs infantry DEF=2 on plains (no terrain def)
    // Base = 4 * 1.5 * 1.0 * 1.0 = 6.0, Final = max(1, 6.0 - 2*0) = 6
    const result = calculateDamage(attacker, defender, 'plains', () => 1.0);
    expect(result).toBe(6);
  });

  it('applies terrain defense modifier', () => {
    const attacker = createUnit('tank', 'player1', createHex(0, 0));
    const defender = createUnit('infantry', 'player2', createHex(1, 0));
    // Same but defender in forest (+25% def)
    // Base = 4 * 1.5 * 1.0 = 6.0, Final = max(1, 6.0 - 2*0.25) = max(1, 5.5) = 5 (floored)
    const result = calculateDamage(attacker, defender, 'forest', () => 1.0);
    expect(result).toBe(5);
  });

  it('uses random factor within ±15%', () => {
    const attacker = createUnit('infantry', 'player1', createHex(0, 0));
    const defender = createUnit('infantry', 'player2', createHex(1, 0));
    const low = calculateDamage(attacker, defender, 'plains', () => 0.85);
    const high = calculateDamage(attacker, defender, 'plains', () => 1.15);
    expect(high).toBeGreaterThanOrEqual(low);
  });
});

describe('canAttack', () => {
  it('returns true when target is in range', () => {
    const attacker = createUnit('infantry', 'player1', createHex(0, 0));
    const defender = createUnit('infantry', 'player2', createHex(1, 0));
    expect(canAttack(attacker, defender)).toBe(true);
  });

  it('returns false when target is out of range', () => {
    const attacker = createUnit('infantry', 'player1', createHex(0, 0));
    const defender = createUnit('infantry', 'player2', createHex(3, 0));
    expect(canAttack(attacker, defender)).toBe(false);
  });

  it('artillery cannot attack adjacent hexes (min range 2)', () => {
    const attacker = createUnit('artillery', 'player1', createHex(0, 0));
    const defender = createUnit('infantry', 'player2', createHex(1, 0));
    expect(canAttack(attacker, defender)).toBe(false);
  });

  it('artillery can attack at range 2-3', () => {
    const attacker = createUnit('artillery', 'player1', createHex(0, 0));
    const target2 = createUnit('infantry', 'player2', createHex(2, 0));
    const target3 = createUnit('infantry', 'player2', createHex(3, 0));
    expect(canAttack(attacker, target2)).toBe(true);
    expect(canAttack(attacker, target3)).toBe(true);
  });

  it('cannot attack own units', () => {
    const a = createUnit('infantry', 'player1', createHex(0, 0));
    const b = createUnit('infantry', 'player1', createHex(1, 0));
    expect(canAttack(a, b)).toBe(false);
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement combat.ts**

```ts
import type { Unit } from './types';
import type { TerrainType } from './types';
import { UNIT_STATS, getTypeAdvantage } from './units';
import { cubeDistance } from './hex';
import { getDefenseModifier } from './terrain';

type RandomFn = () => number;

function defaultRandom(): number {
  return 0.85 + Math.random() * 0.3; // range [0.85, 1.15]
}

export function calculateDamage(
  attacker: Unit,
  defender: Unit,
  defenderTerrain: TerrainType,
  randomFn: RandomFn = defaultRandom,
): number {
  const atkStats = UNIT_STATS[attacker.type];
  const defStats = UNIT_STATS[defender.type];
  const typeMultiplier = getTypeAdvantage(attacker.type, defender.type);
  const terrainDef = getDefenseModifier(defenderTerrain);
  const roll = randomFn();

  const baseDamage = atkStats.atk * typeMultiplier * roll;
  const finalDamage = Math.max(1, Math.floor(baseDamage - defStats.def * terrainDef));
  return finalDamage;
}

export function canAttack(attacker: Unit, defender: Unit): boolean {
  if (attacker.owner === defender.owner) return false;
  const distance = cubeDistance(attacker.position, defender.position);
  const stats = UNIT_STATS[attacker.type];
  return distance >= stats.minAttackRange && distance <= stats.attackRange;
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -am "feat(engine): combat resolution with type advantages and terrain modifiers"
```

---

### Task 7: A* Pathfinding

**Files:**
- Create: `packages/engine/src/pathfinding.ts`
- Create: `packages/engine/src/pathfinding.test.ts`

**Context:** A* pathfinding with movement cost weighting. Needs to consider terrain costs and unit type (vehicles can't cross mountains). Used by directive AI for movement.

**Step 1: Write failing tests**

```ts
// pathfinding.test.ts
import { describe, it, expect } from 'vitest';
import { findPath } from './pathfinding';
import { createHex } from './hex';
import type { CubeCoord, TerrainType } from './types';

// Helper: create a simple terrain map
function makePlainsTerrain(width: number, height: number): Map<string, TerrainType> {
  const terrain = new Map<string, TerrainType>();
  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      const q = col;
      const r = row - Math.floor(col / 2);
      terrain.set(`${q},${r}`, 'plains');
    }
  }
  return terrain;
}

describe('findPath', () => {
  it('returns direct path on open plains', () => {
    const terrain = makePlainsTerrain(10, 8);
    const start = createHex(0, 0);
    const end = createHex(2, 0);
    const path = findPath(start, end, terrain, 'infantry', new Set());
    expect(path).not.toBeNull();
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('returns null when no path exists', () => {
    const terrain = new Map<string, TerrainType>();
    terrain.set('0,0', 'plains');
    // No neighbors are valid terrain
    const path = findPath(createHex(0, 0), createHex(5, 0), terrain, 'infantry', new Set());
    expect(path).toBeNull();
  });

  it('avoids mountains for vehicles', () => {
    const terrain = makePlainsTerrain(5, 5);
    // Place a mountain wall that blocks direct path
    terrain.set('1,0', 'mountain');
    terrain.set('1,-1', 'mountain');
    const path = findPath(createHex(0, 0), createHex(2, 0), terrain, 'tank', new Set());
    // Path should exist but go around
    expect(path).not.toBeNull();
    const pathKeys = path!.map((h) => `${h.q},${h.r}`);
    expect(pathKeys).not.toContain('1,0');
    expect(pathKeys).not.toContain('1,-1');
  });

  it('infantry can cross mountains', () => {
    const terrain = makePlainsTerrain(5, 5);
    terrain.set('1,0', 'mountain');
    const path = findPath(createHex(0, 0), createHex(2, 0), terrain, 'infantry', new Set());
    expect(path).not.toBeNull();
  });

  it('avoids hexes occupied by other units', () => {
    const terrain = makePlainsTerrain(5, 5);
    const occupied = new Set(['1,0']);
    const path = findPath(createHex(0, 0), createHex(2, 0), terrain, 'infantry', occupied);
    expect(path).not.toBeNull();
    const pathKeys = path!.map((h) => `${h.q},${h.r}`);
    // Occupied hex should not be in the path (except possibly destination)
    expect(pathKeys.slice(1, -1)).not.toContain('1,0');
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement pathfinding.ts (A*)**

```ts
import type { CubeCoord, TerrainType } from './types';
import { hexNeighbors, hexToKey, cubeDistance } from './hex';
import { getMoveCost } from './terrain';

interface PathNode {
  coord: CubeCoord;
  g: number;
  f: number;
  parent: PathNode | null;
}

export function findPath(
  start: CubeCoord,
  end: CubeCoord,
  terrainMap: Map<string, TerrainType>,
  unitType: string,
  occupiedHexes: Set<string>,
): CubeCoord[] | null {
  const startKey = hexToKey(start);
  const endKey = hexToKey(end);

  if (!terrainMap.has(startKey) || !terrainMap.has(endKey)) return null;

  const openSet = new Map<string, PathNode>();
  const closedSet = new Set<string>();

  const startNode: PathNode = { coord: start, g: 0, f: cubeDistance(start, end), parent: null };
  openSet.set(startKey, startNode);

  while (openSet.size > 0) {
    // Find node with lowest f
    let current: PathNode | null = null;
    let currentKey = '';
    for (const [key, node] of openSet) {
      if (current === null || node.f < current.f) {
        current = node;
        currentKey = key;
      }
    }

    if (current === null) return null;

    if (currentKey === endKey) {
      // Reconstruct path
      const path: CubeCoord[] = [];
      let node: PathNode | null = current;
      while (node !== null) {
        path.unshift(node.coord);
        node = node.parent;
      }
      return path;
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const neighbor of hexNeighbors(current.coord)) {
      const neighborKey = hexToKey(neighbor);

      if (closedSet.has(neighborKey)) continue;

      const terrain = terrainMap.get(neighborKey);
      if (terrain === undefined) continue; // Off map

      const moveCost = getMoveCost(terrain, unitType);
      if (moveCost === Infinity) continue; // Impassable

      // Can't move through occupied hexes (but can move TO destination even if occupied for attack)
      if (occupiedHexes.has(neighborKey) && neighborKey !== endKey) continue;

      const g = current.g + moveCost;
      const existing = openSet.get(neighborKey);
      if (existing && existing.g <= g) continue;

      const node: PathNode = {
        coord: neighbor,
        g,
        f: g + cubeDistance(neighbor, end),
        parent: current,
      };
      openSet.set(neighborKey, node);
    }
  }

  return null;
}

/** Returns the movement cost of a full path */
export function pathCost(
  path: CubeCoord[],
  terrainMap: Map<string, TerrainType>,
  unitType: string,
): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const terrain = terrainMap.get(hexToKey(path[i]!));
    if (!terrain) return Infinity;
    cost += getMoveCost(terrain, unitType);
  }
  return cost;
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -am "feat(engine): A* pathfinding with terrain costs and occupied hex avoidance"
```

---

### Task 8: Vision System & Fog of War

**Files:**
- Create: `packages/engine/src/vision.ts`
- Create: `packages/engine/src/vision.test.ts`

**Context:** DESIGN.md Section 6. Each unit has a vision range. Forest blocks LoS. Mountain grants +2 vision. Recon reveals for all friendlies. Units in forest only visible when adjacent.

**Step 1: Write failing tests**

```ts
// vision.test.ts
import { describe, it, expect } from 'vitest';
import { calculateVisibility, isUnitVisible } from './vision';
import { createUnit } from './units';
import { createHex, hexToKey } from './hex';
import type { TerrainType } from './types';

function makePlainsTerrain(): Map<string, TerrainType> {
  const terrain = new Map<string, TerrainType>();
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 8; row++) {
      const q = col;
      const r = row - Math.floor(col / 2);
      terrain.set(`${q},${r}`, 'plains');
    }
  }
  return terrain;
}

describe('calculateVisibility', () => {
  it('infantry at origin sees hexes within range 2', () => {
    const terrain = makePlainsTerrain();
    const unit = createUnit('infantry', 'player1', createHex(3, 0));
    const visible = calculateVisibility([unit], terrain);
    // Origin should be visible
    expect(visible.has(hexToKey(createHex(3, 0)))).toBe(true);
    // Adjacent should be visible
    expect(visible.has(hexToKey(createHex(4, 0)))).toBe(true);
    // 2 away should be visible
    expect(visible.has(hexToKey(createHex(5, 0)))).toBe(true);
    // 3 away should NOT be visible (vision range 2)
    expect(visible.has(hexToKey(createHex(6, 0)))).toBe(false);
  });

  it('recon sees hexes within range 5', () => {
    const terrain = makePlainsTerrain();
    const unit = createUnit('recon', 'player1', createHex(5, 0));
    const visible = calculateVisibility([unit], terrain);
    expect(visible.has(hexToKey(createHex(5, 0)))).toBe(true);
    // 5 away should be visible
    const farHex = createHex(5, -5);
    // Only if within map bounds
    if (terrain.has(hexToKey(farHex))) {
      expect(visible.has(hexToKey(farHex))).toBe(true);
    }
  });

  it('forest blocks LoS to hexes behind it', () => {
    const terrain = makePlainsTerrain();
    terrain.set(hexToKey(createHex(4, 0)), 'forest');
    const unit = createUnit('recon', 'player1', createHex(3, 0));
    const visible = calculateVisibility([unit], terrain);
    // The forest hex itself should be visible
    expect(visible.has(hexToKey(createHex(4, 0)))).toBe(true);
    // Hex directly behind forest (along same line) should be blocked
    expect(visible.has(hexToKey(createHex(5, 0)))).toBe(false);
  });

  it('mountain grants +2 vision to infantry on it', () => {
    const terrain = makePlainsTerrain();
    terrain.set(hexToKey(createHex(3, 0)), 'mountain');
    const unit = createUnit('infantry', 'player1', createHex(3, 0));
    const visible = calculateVisibility([unit], terrain);
    // Infantry vision is 2, mountain gives +2 = 4
    const hex4away = createHex(7, 0);
    if (terrain.has(hexToKey(hex4away))) {
      expect(visible.has(hexToKey(hex4away))).toBe(true);
    }
  });
});

describe('isUnitVisible', () => {
  it('unit in forest is only visible when adjacent', () => {
    const terrain = makePlainsTerrain();
    terrain.set(hexToKey(createHex(5, 0)), 'forest');
    const hidden = createUnit('infantry', 'player2', createHex(5, 0));
    const observer = createUnit('recon', 'player1', createHex(3, 0));
    expect(isUnitVisible(hidden, [observer], terrain)).toBe(false);
    // Adjacent observer
    const adjacent = createUnit('infantry', 'player1', createHex(4, 0));
    expect(isUnitVisible(hidden, [adjacent], terrain)).toBe(true);
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement vision.ts**

The implementation should:
1. For each friendly unit, compute vision range (base + terrain modifier).
2. For each hex within that range, do LoS check using `hexLineDraw` — if any intermediate hex is forest, block LoS.
3. Special rule: units in forest are hidden unless observer is adjacent (distance 1).
4. Return a `Set<string>` of visible hex keys.

```ts
import type { Unit, TerrainType } from './types';
import { UNIT_STATS } from './units';
import { TERRAIN } from './terrain';
import { cubeDistance, hexToKey, hexLineDraw, getAllHexes, createHex } from './hex';
import type { CubeCoord, GridSize } from './types';

export function calculateVisibility(
  friendlyUnits: Unit[],
  terrainMap: Map<string, TerrainType>,
): Set<string> {
  const visible = new Set<string>();

  for (const unit of friendlyUnits) {
    const stats = UNIT_STATS[unit.type];
    const standingTerrain = terrainMap.get(hexToKey(unit.position));
    const visionBonus = standingTerrain ? TERRAIN[standingTerrain].visionModifier : 0;
    const visionRange = stats.visionRange + visionBonus;

    // Check all hexes on the map within vision range
    for (const [key, _terrain] of terrainMap) {
      const parts = key.split(',');
      const target = createHex(parseInt(parts[0]!, 10), parseInt(parts[1]!, 10));
      const dist = cubeDistance(unit.position, target);

      if (dist > visionRange) continue;
      if (dist === 0) {
        visible.add(key);
        continue;
      }

      // LoS check: draw line, check if any intermediate hex is forest
      const line = hexLineDraw(unit.position, target);
      let blocked = false;
      for (let i = 1; i < line.length - 1; i++) {
        const midTerrain = terrainMap.get(hexToKey(line[i]!));
        if (midTerrain && TERRAIN[midTerrain].blocksLoS) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        visible.add(key);
      }
    }
  }

  return visible;
}

export function isUnitVisible(
  target: Unit,
  observingUnits: Unit[],
  terrainMap: Map<string, TerrainType>,
): boolean {
  const targetTerrain = terrainMap.get(hexToKey(target.position));

  // Units in forest are only visible if an observer is adjacent
  if (targetTerrain === 'forest') {
    return observingUnits.some(
      (observer) => cubeDistance(observer.position, target.position) <= 1,
    );
  }

  // Otherwise, target is visible if its hex is in the visibility set
  const visibleHexes = calculateVisibility(observingUnits, terrainMap);
  return visibleHexes.has(hexToKey(target.position));
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -am "feat(engine): vision system with LoS, forest blocking, mountain bonus"
```

---

### Task 9: Economy System

**Files:**
- Create: `packages/engine/src/economy.ts`
- Create: `packages/engine/src/economy.test.ts`

**Context:** DESIGN.md Section 5.2-5.3. Base income 500/round, +100 per city held, +25 per kill, +150 round win bonus, 50% carryover cap, +200 catch-up bonus for loser, 20% maintenance cost for surviving units.

**Step 1: Write failing tests**

```ts
// economy.test.ts
import { describe, it, expect } from 'vitest';
import { calculateIncome, applyCarryover, applyMaintenance, canAfford } from './economy';

describe('calculateIncome', () => {
  it('base income is 500', () => {
    expect(calculateIncome({ citiesHeld: 0, unitsKilled: 0, wonRound: false, lostRound: false })).toBe(500);
  });

  it('adds 100 per city held', () => {
    expect(calculateIncome({ citiesHeld: 2, unitsKilled: 0, wonRound: false, lostRound: false })).toBe(700);
  });

  it('adds 25 per unit killed', () => {
    expect(calculateIncome({ citiesHeld: 0, unitsKilled: 3, wonRound: false, lostRound: false })).toBe(575);
  });

  it('adds 150 for round win', () => {
    expect(calculateIncome({ citiesHeld: 0, unitsKilled: 0, wonRound: true, lostRound: false })).toBe(650);
  });

  it('adds 200 catch-up bonus for round loss', () => {
    expect(calculateIncome({ citiesHeld: 0, unitsKilled: 0, wonRound: false, lostRound: true })).toBe(700);
  });
});

describe('applyCarryover', () => {
  it('carries over max 50% of unspent', () => {
    expect(applyCarryover(200)).toBe(100);
  });

  it('returns 0 for 0 unspent', () => {
    expect(applyCarryover(0)).toBe(0);
  });
});

describe('applyMaintenance', () => {
  it('deducts 20% of surviving unit costs', () => {
    // 2 infantry (100 each) + 1 tank (250) = 450 total, 20% = 90
    const costs = [100, 100, 250];
    expect(applyMaintenance(costs)).toBe(90);
  });
});

describe('canAfford', () => {
  it('returns true if resources >= cost', () => {
    expect(canAfford(500, 250)).toBe(true);
  });

  it('returns false if resources < cost', () => {
    expect(canAfford(100, 250)).toBe(false);
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement economy.ts**

```ts
export interface IncomeParams {
  readonly citiesHeld: number;
  readonly unitsKilled: number;
  readonly wonRound: boolean;
  readonly lostRound: boolean;
}

const BASE_INCOME = 500;
const CITY_INCOME = 100;
const KILL_BONUS = 25;
const ROUND_WIN_BONUS = 150;
const CATCH_UP_BONUS = 200;
const CARRYOVER_RATE = 0.5;
const MAINTENANCE_RATE = 0.2;

export function calculateIncome(params: IncomeParams): number {
  let income = BASE_INCOME;
  income += params.citiesHeld * CITY_INCOME;
  income += params.unitsKilled * KILL_BONUS;
  if (params.wonRound) income += ROUND_WIN_BONUS;
  if (params.lostRound) income += CATCH_UP_BONUS;
  return income;
}

export function applyCarryover(unspentResources: number): number {
  return Math.floor(unspentResources * CARRYOVER_RATE);
}

export function applyMaintenance(survivingUnitCosts: number[]): number {
  const totalCost = survivingUnitCosts.reduce((sum, c) => sum + c, 0);
  return Math.floor(totalCost * MAINTENANCE_RATE);
}

export function canAfford(currentResources: number, cost: number): boolean {
  return currentResources >= cost;
}

export { BASE_INCOME, CITY_INCOME, KILL_BONUS, ROUND_WIN_BONUS, CATCH_UP_BONUS, CARRYOVER_RATE, MAINTENANCE_RATE };
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -am "feat(engine): economy system with income, carryover, maintenance, catch-up"
```

---

### Task 10: Map Generation

**Files:**
- Create: `packages/engine/src/map-gen.ts`
- Create: `packages/engine/src/map-gen.test.ts`

**Context:** DESIGN.md Section 2.3. 10x8 grid. Symmetric mirrored. 2-4 city hexes in neutral zone. Central hex is always city. Deployment zones (back 2 rows) = plains/forest only. Mountains/forests create chokepoints.

**Step 1: Write failing tests**

```ts
// map-gen.test.ts
import { describe, it, expect } from 'vitest';
import { generateMap, validateMap } from './map-gen';
import { hexToKey, createHex } from './hex';

describe('generateMap', () => {
  it('generates 80 hexes for 10x8 grid', () => {
    const map = generateMap();
    expect(map.terrain.size).toBe(80);
  });

  it('central hex is always city', () => {
    const map = generateMap();
    expect(map.terrain.get(hexToKey(map.centralObjective))).toBe('city');
  });

  it('has 2-4 city hexes in neutral zone (including central)', () => {
    const map = generateMap();
    let cityCount = 0;
    for (const [_key, terrain] of map.terrain) {
      if (terrain === 'city') cityCount++;
    }
    expect(cityCount).toBeGreaterThanOrEqual(2);
    expect(cityCount).toBeLessThanOrEqual(4);
  });

  it('deployment zones contain only plains and forest', () => {
    const map = generateMap();
    for (const hex of map.player1Deployment) {
      const terrain = map.terrain.get(hexToKey(hex));
      expect(['plains', 'forest']).toContain(terrain);
    }
    for (const hex of map.player2Deployment) {
      const terrain = map.terrain.get(hexToKey(hex));
      expect(['plains', 'forest']).toContain(terrain);
    }
  });

  it('map is symmetric', () => {
    const map = generateMap();
    // For each hex on the left half, the mirrored hex should have the same terrain
    // Symmetry is across the center axis
    expect(validateMap(map).isSymmetric).toBe(true);
  });
});

describe('validateMap', () => {
  it('validates a generated map passes all checks', () => {
    const map = generateMap();
    const result = validateMap(map);
    expect(result.valid).toBe(true);
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement map-gen.ts**

The map generator should:
1. Create a 10x8 grid of all plains.
2. Place the central objective hex (center of map) as city.
3. Place 1-3 additional cities symmetrically in the neutral zone.
4. Scatter forests and mountains symmetrically in the neutral zone (creating chokepoints).
5. Optionally place some forests in deployment zones.
6. Validate symmetry and playability.
7. Return the terrain map, deployment zone hexes, and central objective coordinate.

The implementation needs a `GameMap` interface:

```ts
// Add to types.ts
export interface GameMap {
  readonly terrain: Map<string, TerrainType>;
  readonly centralObjective: CubeCoord;
  readonly player1Deployment: CubeCoord[];
  readonly player2Deployment: CubeCoord[];
  readonly gridSize: GridSize;
}
```

The generator should use a seeded random (accept optional seed) and mirror terrain across the horizontal center axis. Use `getAllHexes` from hex.ts to enumerate the grid. Determine deployment zones as the back 2 rows for each player (rows 0-1 for player1, rows 6-7 for player2 in offset coords). Neutral zone is rows 2-5.

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -am "feat(engine): procedural symmetric map generation with validation"
```

---

### Task 11: Directive AI System

**Files:**
- Create: `packages/engine/src/directives.ts`
- Create: `packages/engine/src/directives.test.ts`

**Context:** DESIGN.md Section 4.1. Six directives: Advance, Hold, Flank Left, Flank Right, Scout, Support. Each is a function: `(unit, gameState) => Action`. Actions are either move-to-hex or attack-target.

**Step 1: Define Action type in types.ts**

```ts
export type UnitAction =
  | { type: 'move'; targetHex: CubeCoord }
  | { type: 'attack'; targetUnitId: string }
  | { type: 'hold' }; // do nothing
```

**Step 2: Write failing tests**

```ts
// directives.test.ts
import { describe, it, expect } from 'vitest';
import { executeDirective } from './directives';
import { createUnit } from './units';
import { createHex, hexToKey } from './hex';
import type { TerrainType, Unit, CubeCoord, GridSize } from './types';

// Helper to build a simple battle context
function makeContext(overrides: Partial<{
  friendlyUnits: Unit[];
  enemyUnits: Unit[];
  terrain: Map<string, TerrainType>;
  centralObjective: CubeCoord;
  gridSize: GridSize;
}> = {}) {
  const terrain = new Map<string, TerrainType>();
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 8; row++) {
      terrain.set(`${col},${row - Math.floor(col / 2)}`, 'plains');
    }
  }
  return {
    friendlyUnits: overrides.friendlyUnits ?? [],
    enemyUnits: overrides.enemyUnits ?? [],
    terrain: overrides.terrain ?? terrain,
    centralObjective: overrides.centralObjective ?? createHex(5, -1),
    gridSize: overrides.gridSize ?? { width: 10, height: 8 },
  };
}

describe('executeDirective', () => {
  it('Advance: moves toward central objective', () => {
    const unit = createUnit('infantry', 'player1', createHex(2, 2));
    unit.directive = 'advance';
    const ctx = makeContext();
    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
  });

  it('Hold: produces hold action', () => {
    const unit = createUnit('artillery', 'player1', createHex(2, 2));
    unit.directive = 'hold';
    const ctx = makeContext();
    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('hold');
  });

  it('Advance: attacks enemy in range instead of moving', () => {
    const unit = createUnit('infantry', 'player1', createHex(2, 0));
    unit.directive = 'advance';
    const enemy = createUnit('infantry', 'player2', createHex(3, 0));
    const ctx = makeContext({ enemyUnits: [enemy] });
    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('attack');
  });

  it('Scout: retreats if enemy is adjacent', () => {
    const unit = createUnit('recon', 'player1', createHex(3, 0));
    unit.directive = 'scout';
    const enemy = createUnit('tank', 'player2', createHex(4, 0));
    const ctx = makeContext({ enemyUnits: [enemy] });
    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
    // Should move away from enemy, not attack
  });

  it('Support: follows nearest friendly unit', () => {
    const leader = createUnit('tank', 'player1', createHex(4, 0));
    const unit = createUnit('artillery', 'player1', createHex(1, 0));
    unit.directive = 'support';
    const ctx = makeContext({ friendlyUnits: [leader] });
    const action = executeDirective(unit, ctx);
    expect(action.type).toBe('move');
  });
});
```

**Step 3: Run tests — expect FAIL**

**Step 4: Implement directives.ts**

Each directive function should:
- `advance`: Find shortest path to central objective via A*. Take next step along path. If enemy in attack range, attack instead.
- `hold`: Return hold action. If enemy in attack range, attack.
- `flank-left` / `flank-right`: Like advance but bias pathfinding left/right of center.
- `scout`: Move toward nearest fog/unexplored hex. If enemy adjacent, move away.
- `support`: Find nearest friendly unit within 3 hexes, path toward them. If enemy in range, attack.

Use `findPath` from pathfinding.ts and `canAttack` from combat.ts.

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```bash
git commit -am "feat(engine): directive AI system with 6 directive behaviors"
```

---

### Task 12: Command Point System

**Files:**
- Create: `packages/engine/src/commands.ts`
- Create: `packages/engine/src/commands.test.ts`

**Context:** DESIGN.md Section 4.2. 3 CP per round, no carryover. 1 CP per action. Actions: Redirect (change directive), Direct Move, Direct Attack, Retreat. One command per unit per turn.

**Step 1: Write failing tests**

```ts
// commands.test.ts
import { describe, it, expect } from 'vitest';
import { createCommandPool, spendCommand, canIssueCommand } from './commands';
import type { Command } from './types';

describe('createCommandPool', () => {
  it('starts with 3 CP', () => {
    const pool = createCommandPool();
    expect(pool.remaining).toBe(3);
    expect(pool.commandedUnitIds).toEqual(new Set());
  });
});

describe('spendCommand', () => {
  it('decrements CP by 1', () => {
    const pool = createCommandPool();
    const cmd: Command = { type: 'direct-move', unitId: 'u1', targetHex: { q: 1, r: 0, s: -1 } };
    const result = spendCommand(pool, cmd);
    expect(result.remaining).toBe(2);
    expect(result.commandedUnitIds.has('u1')).toBe(true);
  });

  it('throws when no CP remaining', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, { type: 'direct-move', unitId: 'u1', targetHex: { q: 1, r: 0, s: -1 } });
    pool = spendCommand(pool, { type: 'direct-move', unitId: 'u2', targetHex: { q: 1, r: 0, s: -1 } });
    pool = spendCommand(pool, { type: 'direct-move', unitId: 'u3', targetHex: { q: 1, r: 0, s: -1 } });
    expect(() =>
      spendCommand(pool, { type: 'direct-move', unitId: 'u4', targetHex: { q: 1, r: 0, s: -1 } }),
    ).toThrow();
  });

  it('throws when unit already commanded this turn', () => {
    const pool = createCommandPool();
    const cmd: Command = { type: 'direct-move', unitId: 'u1', targetHex: { q: 1, r: 0, s: -1 } };
    const result = spendCommand(pool, cmd);
    expect(() => spendCommand(result, cmd)).toThrow();
  });
});

describe('canIssueCommand', () => {
  it('returns true when CP available and unit not commanded', () => {
    const pool = createCommandPool();
    expect(canIssueCommand(pool, 'u1')).toBe(true);
  });

  it('returns false when unit already commanded', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, { type: 'direct-move', unitId: 'u1', targetHex: { q: 1, r: 0, s: -1 } });
    expect(canIssueCommand(pool, 'u1')).toBe(false);
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Define Command types in types.ts and implement commands.ts**

```ts
// Add to types.ts:
export type Command =
  | { type: 'redirect'; unitId: string; newDirective: DirectiveType }
  | { type: 'direct-move'; unitId: string; targetHex: CubeCoord }
  | { type: 'direct-attack'; unitId: string; targetUnitId: string }
  | { type: 'retreat'; unitId: string };

export interface CommandPool {
  remaining: number;
  commandedUnitIds: Set<string>;
}
```

```ts
// commands.ts
import type { Command, CommandPool } from './types';

const CP_PER_ROUND = 3;

export function createCommandPool(): CommandPool {
  return { remaining: CP_PER_ROUND, commandedUnitIds: new Set() };
}

export function spendCommand(pool: CommandPool, command: Command): CommandPool {
  if (pool.remaining <= 0) {
    throw new Error('No command points remaining');
  }
  if (pool.commandedUnitIds.has(command.unitId)) {
    throw new Error(`Unit ${command.unitId} already commanded this turn`);
  }
  const newCommanded = new Set(pool.commandedUnitIds);
  newCommanded.add(command.unitId);
  return { remaining: pool.remaining - 1, commandedUnitIds: newCommanded };
}

export function canIssueCommand(pool: CommandPool, unitId: string): boolean {
  return pool.remaining > 0 && !pool.commandedUnitIds.has(unitId);
}

export { CP_PER_ROUND };
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -am "feat(engine): command point system with pool, spending, validation"
```

---

### Task 13: Game State Machine

**Files:**
- Create: `packages/engine/src/game-state.ts`
- Create: `packages/engine/src/game-state.test.ts`

**Context:** DESIGN.md Sections 4.3, 5.1, 5.4. This is the main state machine that ties everything together. Phases: BUILD → BATTLE → SCORING. Battle has alternating turns. Win conditions: King of the Hill (2-turn hold), Elimination, Turn Limit Tiebreaker. Best of 3 rounds.

**Step 1: Define GameState in types.ts**

```ts
export type GamePhase = 'build' | 'battle' | 'scoring' | 'game-over';

export interface ObjectiveState {
  occupiedBy: PlayerId | null;
  turnsHeld: number;
}

export interface PlayerState {
  readonly id: PlayerId;
  resources: number;
  units: Unit[];
  roundsWon: number;
}

export interface RoundState {
  roundNumber: number;
  turnNumber: number;
  currentPlayer: PlayerId;
  maxTurnsPerSide: number;
  turnsPlayed: Record<PlayerId, number>;
  commandPool: CommandPool;
  objective: ObjectiveState;
  unitsKilledThisRound: Record<PlayerId, number>;
}

export interface GameState {
  phase: GamePhase;
  players: Record<PlayerId, PlayerState>;
  round: RoundState;
  map: GameMap;
  maxRounds: number;
  winner: PlayerId | null;
}
```

**Step 2: Write failing tests**

Test the following scenarios:
- `createGame()` produces a valid initial state in BUILD phase.
- Transitioning from BUILD to BATTLE phase.
- Turn execution: commanded units act, then directive units act.
- King of the Hill: unit holds central hex for 2 turns → round win.
- Elimination: all enemy units destroyed → round win.
- Turn limit tiebreaker: closest to center wins.
- Round transition: scoring → new build phase with resource awards.
- Game over: first to 2 round wins.

```ts
// game-state.test.ts
import { describe, it, expect } from 'vitest';
import {
  createGame,
  startBattlePhase,
  executeTurn,
  checkRoundEnd,
  scoreRound,
  getWinner,
} from './game-state';
import { createUnit } from './units';
import { createHex, hexToKey } from './hex';

describe('createGame', () => {
  it('starts in build phase with round 1', () => {
    const game = createGame();
    expect(game.phase).toBe('build');
    expect(game.round.roundNumber).toBe(1);
    expect(game.maxRounds).toBe(3);
  });

  it('both players start with 500 resources', () => {
    const game = createGame();
    expect(game.players.player1.resources).toBe(500);
    expect(game.players.player2.resources).toBe(500);
  });
});

describe('startBattlePhase', () => {
  it('transitions from build to battle', () => {
    const game = createGame();
    // Manually place some units for each player
    game.players.player1.units = [
      createUnit('infantry', 'player1', createHex(2, 2)),
    ];
    game.players.player2.units = [
      createUnit('infantry', 'player2', createHex(7, -3)),
    ];
    const result = startBattlePhase(game);
    expect(result.phase).toBe('battle');
    expect(result.round.currentPlayer).toBe('player1');
    expect(result.round.commandPool.remaining).toBe(3);
  });
});

describe('checkRoundEnd', () => {
  it('detects King of the Hill win after 2 turns', () => {
    const game = createGame();
    game.phase = 'battle';
    const centralKey = hexToKey(game.map.centralObjective);
    // Place unit on objective
    const unit = createUnit('infantry', 'player1', game.map.centralObjective);
    game.players.player1.units = [unit];
    game.players.player2.units = [
      createUnit('infantry', 'player2', createHex(8, -3)),
    ];
    game.round.objective = { occupiedBy: 'player1', turnsHeld: 2 };
    const result = checkRoundEnd(game);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('king-of-the-hill');
  });

  it('detects elimination', () => {
    const game = createGame();
    game.phase = 'battle';
    game.players.player1.units = [
      createUnit('infantry', 'player1', createHex(2, 2)),
    ];
    game.players.player2.units = []; // all destroyed
    const result = checkRoundEnd(game);
    expect(result.roundOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('elimination');
  });
});

describe('getWinner', () => {
  it('returns winner when a player has 2 round wins', () => {
    const game = createGame();
    game.players.player1.roundsWon = 2;
    expect(getWinner(game)).toBe('player1');
  });

  it('returns null when no winner yet', () => {
    const game = createGame();
    game.players.player1.roundsWon = 1;
    game.players.player2.roundsWon = 1;
    expect(getWinner(game)).toBeNull();
  });
});
```

**Step 3: Run tests — expect FAIL**

**Step 4: Implement game-state.ts**

This is the largest module. It orchestrates:
1. `createGame()` — initializes GameState with generated map, players, round 1.
2. `startBattlePhase(state)` — transitions BUILD → BATTLE, resets turn counters and CP.
3. `executeTurn(state, commands)` — resolves one turn: apply commands, run directive AI, handle attacks, update positions, check captures.
4. `checkRoundEnd(state)` — checks KotH, elimination, turn limit. Returns `{ roundOver, winner, reason }`.
5. `scoreRound(state, roundWinner)` — awards resources, applies maintenance/carryover, transitions to next round's BUILD or game-over.
6. `getWinner(state)` — checks if any player has reached 2 (of 3) round wins.

The turn execution order (from DESIGN.md 4.3):
1. Apply CP commands to units
2. Commanded units act (move or attack per their command)
3. Non-commanded units act via directive AI
4. Capture check (infantry on city hex)
5. Update objective state (KotH counter)

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```bash
git commit -am "feat(engine): game state machine with phases, turns, win conditions"
```

---

### Task 14: Engine Integration Test & Public API

**Files:**
- Modify: `packages/engine/src/index.ts`
- Create: `packages/engine/src/integration.test.ts`

**Context:** DESIGN.md Phase 1 deliverable: "You should be able to run: createGame() → placeUnits() → assignDirectives() → loop { spendCP(), resolveTurn() } → getWinner() entirely in code."

**Step 1: Write integration test**

```ts
// integration.test.ts
import { describe, it, expect } from 'vitest';
import {
  createGame,
  startBattlePhase,
  executeTurn,
  checkRoundEnd,
  scoreRound,
  getWinner,
} from './game-state';
import { createUnit } from './units';
import { createHex } from './hex';

describe('Full game simulation', () => {
  it('can simulate a complete 3-round game', () => {
    const game = createGame();

    // Simulate 3 rounds
    for (let round = 0; round < 3; round++) {
      expect(game.phase).toBe('build');

      // Build phase: place units in deployment zones
      const p1Deploy = game.map.player1Deployment[0]!;
      const p2Deploy = game.map.player2Deployment[0]!;
      game.players.player1.units.push(
        createUnit('infantry', 'player1', p1Deploy),
        createUnit('tank', 'player1', game.map.player1Deployment[1]!),
      );
      game.players.player2.units.push(
        createUnit('infantry', 'player2', p2Deploy),
        createUnit('tank', 'player2', game.map.player2Deployment[1]!),
      );

      // Transition to battle
      const battleState = startBattlePhase(game);
      Object.assign(game, battleState);
      expect(game.phase).toBe('battle');

      // Run battle turns until round ends
      let turnsRun = 0;
      while (turnsRun < 16) { // max 8 turns per side
        executeTurn(game, []);
        const roundCheck = checkRoundEnd(game);
        if (roundCheck.roundOver) {
          scoreRound(game, roundCheck.winner);
          break;
        }
        turnsRun++;
      }

      // Check if game is over
      const winner = getWinner(game);
      if (winner) {
        expect(game.phase).toBe('game-over');
        return; // game finished
      }
    }

    // If we get here, game should have a winner after 3 rounds
    expect(getWinner(game)).not.toBeNull();
  });
});
```

**Step 2: Set up public API in index.ts**

```ts
// packages/engine/src/index.ts
// Core types
export type {
  CubeCoord, AxialCoord, GridSize,
  TerrainType, TerrainDefinition, HexTile,
  UnitType, UnitStats, Unit, DirectiveType, PlayerId,
  UnitAction, Command, CommandPool,
  GamePhase, ObjectiveState, PlayerState, RoundState, GameState, GameMap,
} from './types';

// Hex grid
export { createHex, cubeDistance, hexNeighbors, hexAdd, hexSubtract, hexToKey, hexLineDraw, isValidHex, getAllHexes } from './hex';

// Terrain
export { TERRAIN, getMoveCost, getDefenseModifier, getVisionModifier } from './terrain';

// Units
export { UNIT_STATS, createUnit, getTypeAdvantage } from './units';

// Combat
export { calculateDamage, canAttack } from './combat';

// Pathfinding
export { findPath, pathCost } from './pathfinding';

// Vision
export { calculateVisibility, isUnitVisible } from './vision';

// Economy
export { calculateIncome, applyCarryover, applyMaintenance, canAfford } from './economy';

// Map generation
export { generateMap, validateMap } from './map-gen';

// Directives
export { executeDirective } from './directives';

// Commands
export { createCommandPool, spendCommand, canIssueCommand } from './commands';

// Game state
export { createGame, startBattlePhase, executeTurn, checkRoundEnd, scoreRound, getWinner } from './game-state';
```

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

Run: `pnpm test:coverage`
Expected: 90%+ coverage.

**Step 4: Commit**

```bash
git commit -am "feat(engine): public API and integration test for full game simulation"
```

---

## Phase 2: Map & Renderer

Get the game visual. Canvas-rendered hex grid, unit display, click interaction, fog of war rendering, and a basic battle HUD.

---

### Task 15: Client Scaffolding (Vite + React)

**Files:**
- Create: `packages/client/index.html`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/tsconfig.json` (update)
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/App.tsx`
- Create: `packages/client/src/styles/global.css`

**Step 1: Set up Vite config**

```ts
// packages/client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src'),
      '@hexwar/engine': path.resolve(__dirname, '../engine/src'),
    },
  },
});
```

**Step 2: Create index.html, main.tsx, App.tsx, global.css**

Standard Vite React bootstrap. `App.tsx` renders a `<canvas>` element that fills the viewport. `global.css` has minimal reset: `margin: 0; padding: 0; overflow: hidden; background: #1a1a2e;` (dark theme for war game).

**Step 3: Install dependencies and verify dev server starts**

Run: `cd packages/client && pnpm install && pnpm dev`
Expected: Blank dark page with canvas element visible in browser.

**Step 4: Commit**

```bash
git commit -am "feat(client): Vite + React scaffolding with canvas element"
```

---

### Task 16: Hex-to-Pixel Conversion & Grid Rendering

**Files:**
- Create: `packages/client/src/renderer/hex-render.ts`
- Create: `packages/client/src/renderer/constants.ts`
- Create: `packages/client/src/renderer/camera.ts`
- Modify: `packages/client/src/App.tsx`

**Context:** DESIGN.md Section 7.2 — flat-top hexagons. Need hex-to-pixel and pixel-to-hex conversion for click detection.

**Step 1: Define rendering constants**

```ts
// renderer/constants.ts
export const HEX_SIZE = 40; // pixels from center to corner
export const GRID_WIDTH = 10;
export const GRID_HEIGHT = 8;

// Colors per terrain type
export const TERRAIN_COLORS: Record<string, string> = {
  plains: '#4a7c59',
  forest: '#2d5a3f',
  mountain: '#8b7355',
  city: '#6b6b8d',
};

export const GRID_LINE_COLOR = '#333';
export const FOG_COLOR = 'rgba(0, 0, 0, 0.6)';
```

**Step 2: Implement hex-to-pixel and pixel-to-hex**

```ts
// renderer/hex-render.ts
import type { CubeCoord } from '@hexwar/engine';
import { createHex } from '@hexwar/engine';
import { HEX_SIZE } from './constants';

/** Flat-top hex: pixel center from cube coord */
export function hexToPixel(hex: CubeCoord): { x: number; y: number } {
  const x = HEX_SIZE * (3 / 2 * hex.q);
  const y = HEX_SIZE * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

/** Pixel to cube coord (for click detection) */
export function pixelToHex(x: number, y: number): CubeCoord {
  const q = (2 / 3 * x) / HEX_SIZE;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / HEX_SIZE;
  return cubeRound(q, r, -q - r);
}

/** Draw a single flat-top hexagon */
export function drawHex(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  fillColor: string,
  strokeColor: string,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = centerX + size * Math.cos(angle);
    const py = centerY + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.stroke();
}
```

**Step 3: Implement camera offset (centering the grid)**

```ts
// renderer/camera.ts
export interface Camera {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export function createCamera(canvasWidth: number, canvasHeight: number): Camera {
  // Center the grid in the canvas
  // Calculate grid pixel bounds and center accordingly
  return {
    offsetX: canvasWidth / 2 - 300, // rough center for 10-wide grid
    offsetY: canvasHeight / 2 - 200,
    zoom: 1,
  };
}
```

**Step 4: Render the hex grid in App.tsx**

Update `App.tsx` to:
1. Create a game with `createGame()`.
2. On canvas mount, render all hexes with terrain colors using `hexToPixel` + `drawHex`.
3. Use `useRef` for canvas, `useEffect` for rendering.

**Step 5: Verify grid renders in browser**

Run: `pnpm dev`
Expected: 10x8 hex grid with colored terrain visible.

**Step 6: Commit**

```bash
git commit -am "feat(client): hex grid rendering with terrain colors"
```

---

### Task 17: Unit Rendering

**Files:**
- Create: `packages/client/src/renderer/unit-render.ts`
- Modify: `packages/client/src/App.tsx`

**Step 1: Define unit rendering**

Draw units as colored circles on their hex with a letter abbreviation (I/T/A/R). Player 1 = blue tones, Player 2 = red tones. Show HP as small pips below the unit. Show directive as a small arrow/icon on the unit.

```ts
// renderer/unit-render.ts
import type { Unit, PlayerId } from '@hexwar/engine';

const PLAYER_COLORS: Record<PlayerId, { fill: string; stroke: string }> = {
  player1: { fill: '#4488cc', stroke: '#2266aa' },
  player2: { fill: '#cc4444', stroke: '#aa2222' },
};

const UNIT_LABELS: Record<string, string> = {
  infantry: 'I',
  tank: 'T',
  artillery: 'A',
  recon: 'R',
};

export function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  centerX: number,
  centerY: number,
): void {
  const colors = PLAYER_COLORS[unit.owner];
  const radius = 16;

  // Unit circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Unit label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(UNIT_LABELS[unit.type] ?? '?', centerX, centerY);

  // HP pips below
  const stats = { infantry: 3, tank: 4, artillery: 2, recon: 2 };
  const maxHp = stats[unit.type as keyof typeof stats] ?? 3;
  const pipStartX = centerX - (maxHp * 5) / 2;
  for (let i = 0; i < maxHp; i++) {
    ctx.beginPath();
    ctx.arc(pipStartX + i * 6 + 3, centerY + radius + 6, 2, 0, Math.PI * 2);
    ctx.fillStyle = i < unit.hp ? '#4f4' : '#444';
    ctx.fill();
  }
}
```

**Step 2: Render units on the grid**

Update the render loop to iterate through all player units and draw them at their hex positions.

**Step 3: Verify units appear on the grid**

Place some test units in `createGame()` or after it, verify they render.

**Step 4: Commit**

```bash
git commit -am "feat(client): unit rendering with player colors, labels, HP pips"
```

---

### Task 18: Click Interaction & Unit Selection

**Files:**
- Create: `packages/client/src/hooks/useCanvasClick.ts`
- Create: `packages/client/src/components/UnitInfoPanel.tsx`
- Create: `packages/client/src/store/game-store.ts`
- Modify: `packages/client/src/App.tsx`

**Step 1: Create Zustand game store**

```ts
// store/game-store.ts
import { create } from 'zustand';
import type { GameState, Unit } from '@hexwar/engine';

interface GameStore {
  gameState: GameState | null;
  selectedUnit: Unit | null;
  hoveredHex: { q: number; r: number } | null;
  setGameState: (state: GameState) => void;
  selectUnit: (unit: Unit | null) => void;
  setHoveredHex: (hex: { q: number; r: number } | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  selectedUnit: null,
  hoveredHex: null,
  setGameState: (state) => set({ gameState: state }),
  selectUnit: (unit) => set({ selectedUnit: unit }),
  setHoveredHex: (hex) => set({ hoveredHex: hex }),
}));
```

**Step 2: Implement canvas click handler**

Hook that converts pixel click to hex coord using `pixelToHex`, finds the unit at that hex (if any), and selects it.

**Step 3: Build UnitInfoPanel component**

A `"use client"` React component that shows selected unit's stats: type, HP, ATK, DEF, move range, attack range, vision, directive. Positioned as a fixed panel on the right side of the screen.

**Step 4: Highlight selected hex and show movement range**

When a unit is selected, highlight its hex with a glow and show movement-reachable hexes with a subtle overlay.

**Step 5: Commit**

```bash
git commit -am "feat(client): click interaction, unit selection, info panel"
```

---

### Task 19: Fog of War Rendering

**Files:**
- Modify: `packages/client/src/renderer/hex-render.ts`
- Create: `packages/client/src/renderer/fog-render.ts`
- Modify: `packages/client/src/App.tsx`

**Step 1: Implement fog rendering**

After rendering terrain and units, overlay non-visible hexes with a semi-transparent dark layer. Use `calculateVisibility` from the engine to get the current player's visible hex set.

```ts
// renderer/fog-render.ts
export function drawFog(
  ctx: CanvasRenderingContext2D,
  allHexes: CubeCoord[],
  visibleHexes: Set<string>,
  hexToPixelFn: (hex: CubeCoord) => { x: number; y: number },
  hexSize: number,
): void {
  for (const hex of allHexes) {
    const key = hexToKey(hex);
    if (!visibleHexes.has(key)) {
      const { x, y } = hexToPixelFn(hex);
      drawHex(ctx, x, y, hexSize, 'rgba(0, 0, 0, 0.6)', 'transparent');
    }
  }
}
```

**Step 2: Implement "last known" ghost markers**

Track previously-seen enemy unit positions. When an enemy was visible but is now in fog, show a faded ghost icon at their last known position.

Add `lastKnownEnemies: Map<string, { type: UnitType; position: CubeCoord }>` to the game store.

**Step 3: Hide enemy units outside visibility**

Only render enemy units whose hex is in the current player's visible set.

**Step 4: Commit**

```bash
git commit -am "feat(client): fog of war rendering with ghost markers"
```

---

### Task 20: Battle Phase UI — CP Spending & Commands

**Files:**
- Create: `packages/client/src/components/BattleHUD.tsx`
- Create: `packages/client/src/components/CommandMenu.tsx`
- Modify: `packages/client/src/store/game-store.ts`

**Step 1: Build BattleHUD**

Fixed panel showing:
- Current player's turn indicator
- CP remaining (show as 3 dots/pips)
- Turn number (e.g., "Turn 3/8")
- Central objective status (who holds it, turns held)
- "End Turn" button

**Step 2: Build CommandMenu**

When a friendly unit is selected during the battle phase and CP > 0, show a command menu:
- Direct Move (click target hex)
- Direct Attack (click target enemy)
- Redirect (choose new directive from dropdown)
- Retreat

Each command costs 1 CP. After issuing, update the command pool and mark the unit as commanded.

**Step 3: Wire up turn execution**

"End Turn" button triggers `executeTurn()` with the queued commands. Animate the results (units moving/attacking). Then switch to the other player's turn.

**Step 4: Commit**

```bash
git commit -am "feat(client): battle HUD with CP display, command menu, turn execution"
```

---

### Task 21: Directive Visualization & Auto-Play Animation

**Files:**
- Create: `packages/client/src/renderer/animation.ts`
- Modify: `packages/client/src/renderer/unit-render.ts`

**Step 1: Show directive indicators on units**

Draw a small arrow/icon on each unit showing its directive direction:
- Advance: arrow pointing toward center
- Hold: shield icon (small square)
- Flank Left/Right: angled arrow
- Scout: eye icon (small circle)
- Support: follow arrow

**Step 2: Animate turn resolution**

When a turn resolves, animate unit movements (smooth lerp between hexes) and attacks (flash/shake effect on targeted units). Use `requestAnimationFrame` for smooth 60fps animation.

```ts
// renderer/animation.ts
interface Animation {
  unitId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startTime: number;
  duration: number;
}

export function animateMove(/* ... */): void {
  // Lerp unit position from start to end over duration
  // Call render callback each frame
}
```

**Step 3: Sequence the turn**

After clicking "End Turn":
1. Show commanded units acting (animate one by one, ~300ms each)
2. Show directive units acting (animate, ~200ms each)
3. Show damage numbers / destruction effects
4. Update game state
5. Switch to other player

**Step 4: Commit**

```bash
git commit -am "feat(client): directive indicators and turn animation"
```

---

### Task 22: Central Objective & Map Generator Visualization

**Files:**
- Modify: `packages/client/src/renderer/hex-render.ts`
- Create: `packages/client/src/renderer/objective-render.ts`

**Step 1: Render central objective hex distinctly**

Draw the central hex with a gold/yellow border, a crown or flag icon in the center, and a pulsing glow effect. Show the occupation status: "P1 holds (1/2 turns)" or "Contested".

**Step 2: Render deployment zones**

During build phase, highlight the current player's deployment zone hexes with a subtle tint (blue for P1, red for P2).

**Step 3: Add minimap (optional but recommended)**

Small map in the corner showing the full grid with unit positions as colored dots.

**Step 4: Commit**

```bash
git commit -am "feat(client): central objective rendering, deployment zone highlights"
```

---

### Task 23: Hot-Seat Mode & Turn Switching

**Files:**
- Create: `packages/client/src/components/TurnTransition.tsx`
- Modify: `packages/client/src/App.tsx`

**Context:** Phase 2 deliverable is a hot-seat game where two players alternate turns on one screen. No build phase yet — units are pre-placed.

**Step 1: Build turn transition screen**

When switching players, show a full-screen overlay: "Player 2's Turn — Click to Continue". This prevents the incoming player from seeing the opponent's view.

**Step 2: Pre-place units for testing**

For the Phase 2 deliverable, auto-place a predefined army for each player with default directives:
- Player 1: 2 infantry, 1 tank, 1 recon, 1 artillery in deployment zone
- Player 2: same composition in their deployment zone

**Step 3: Implement hot-seat game loop**

1. Show Player 1's turn (their units visible, fog applied)
2. Player 1 spends CP (0-3 commands), clicks End Turn
3. Turn resolves with animation
4. Turn transition screen
5. Show Player 2's turn
6. Repeat until round ends
7. Show round results

**Step 4: End-to-end playtest**

Verify two players can play a full round by alternating at the keyboard.

**Step 5: Commit**

```bash
git commit -am "feat(client): hot-seat mode with turn transitions and pre-placed units"
```

---

## Phase 3: Build Phase & Economy

Add the strategic layer: shopping, deployment, directive assignment, resource management, multi-round flow.

---

### Task 24: Unit Shop UI

**Files:**
- Create: `packages/client/src/components/UnitShop.tsx`
- Create: `packages/client/src/components/UnitCard.tsx`
- Modify: `packages/client/src/store/game-store.ts`

**Step 1: Build UnitCard component**

A card for each purchasable unit type showing: icon, name, cost, and key stats (HP/ATK/DEF/Move/Range/Vision). Grayed out if player can't afford it. Shows quantity already purchased this round.

**Step 2: Build UnitShop panel**

Left-side panel visible during BUILD phase. Lists all 4 unit types as UnitCards. Shows current resources at the top. Clicking a UnitCard enters "placement mode" — the cursor changes to show the unit type, and the player clicks a deployment zone hex to place it.

**Step 3: Add to game store**

```ts
// Add to game store:
interface GameStore {
  // ... existing
  placementMode: UnitType | null;
  pendingPlacements: Array<{ type: UnitType; position: CubeCoord }>;
  enterPlacementMode: (type: UnitType) => void;
  placeUnit: (position: CubeCoord) => void;
  removeUnit: (unitId: string) => void;
}
```

**Step 4: Validate placement**

- Only place on deployment zone hexes
- Only place on unoccupied hexes (one unit per hex)
- Must have enough resources
- Deduct cost immediately on placement
- Allow undo (right-click to remove placed unit, refund cost)

**Step 5: Commit**

```bash
git commit -am "feat(client): unit shop with purchase and placement"
```

---

### Task 25: Directive Assignment UI

**Files:**
- Create: `packages/client/src/components/DirectiveSelector.tsx`
- Create: `packages/client/src/renderer/directive-preview.ts`
- Modify: `packages/client/src/components/UnitInfoPanel.tsx`

**Step 1: Build DirectiveSelector**

When a unit is selected during BUILD phase, show a radial or dropdown menu with 6 directives. Each option shows the directive name and a brief description. The selected directive is highlighted.

**Step 2: Show directive preview on map**

When hovering a directive option, render a translucent arrow/path on the map showing the intended movement direction:
- Advance: arrow toward center
- Flank Left/Right: curved arrow
- Scout: radiating circles (vision)
- Support: arrow toward nearest friendly
- Hold: shield icon on current hex

Use the actual pathfinding to show the first ~3 steps of the path.

**Step 3: Apply directive to surviving units**

Surviving units from previous rounds appear in the deployment zone. They keep their previous directive but the player can reassign. Show a small directive icon on each surviving unit.

**Step 4: Commit**

```bash
git commit -am "feat(client): directive assignment UI with preview paths"
```

---

### Task 26: Build Phase Timer

**Files:**
- Create: `packages/client/src/components/BuildTimer.tsx`
- Modify: `packages/client/src/store/game-store.ts`
- Modify: `packages/client/src/App.tsx`

**Step 1: Implement countdown timer**

90-second timer displayed prominently. Visual urgency: normal color for >30s, yellow for 10-30s, red + pulse for <10s. When timer expires, auto-confirm placements and directives (unassigned units get "advance" as default).

**Step 2: Add "Ready" button**

Player can click "Ready" to end their build phase early. In hot-seat mode, show build phases sequentially (P1 builds, transition screen, P2 builds). The opponent should not see P1's build — fog of war during build is honor-system in hot-seat.

**Step 3: Handle unspent resources**

Show the carryover calculation: "Unspent: 150. Carrying over: 75 (50%)".

**Step 4: Commit**

```bash
git commit -am "feat(client): build phase timer with auto-confirm and ready button"
```

---

### Task 27: Resource System Integration

**Files:**
- Create: `packages/client/src/components/ResourceBar.tsx`
- Modify: `packages/client/src/store/game-store.ts`

**Step 1: Build ResourceBar**

Always-visible bar at the top showing:
- Current resources (animated when changing)
- Income breakdown tooltip: "Base: 500 + Cities: 200 + Kills: 75 - Maintenance: 90 + Carryover: 50 = 735"
- Round number and rounds won (e.g., "Round 2/3 — P1: 1 win, P2: 0 wins")

**Step 2: Wire economy to game state**

At round start:
1. Calculate income (base + cities + kills + round bonus + catch-up)
2. Subtract maintenance for surviving units
3. Add carryover from previous round
4. Set as available resources

Ensure resources flow correctly through the multi-round loop.

**Step 3: Commit**

```bash
git commit -am "feat(client): resource bar and economy integration"
```

---

### Task 28: Multi-Round Game Loop

**Files:**
- Create: `packages/client/src/components/RoundTransition.tsx`
- Create: `packages/client/src/components/GameOverScreen.tsx`
- Modify: `packages/client/src/App.tsx`

**Step 1: Build RoundTransition screen**

After battle phase scoring, show a full-screen results panel:
- Round winner and reason (KotH / Elimination / Tiebreaker)
- Units surviving per player
- Resources awarded breakdown
- Score: "Player 1: 1 | Player 2: 0"
- "Continue to Round N" button

**Step 2: Build GameOverScreen**

When a player reaches 2 round wins:
- Show winner announcement
- Final stats: total units built, total kills, total resources earned
- "Play Again" button (resets to new game)

**Step 3: Wire the full game loop**

The App component manages the top-level flow:
```
[Game Start] → [Build Phase P1] → [Build Phase P2] → [Battle Phase]
    → [Round Scoring] → repeat or → [Game Over]
```

**State machine in App.tsx or game-store.ts:**
1. BUILD: Show UnitShop + DirectiveSelector + Timer. On both players ready → BATTLE.
2. BATTLE: Alternating turns with CP spending, directive AI, animations. On round end → SCORING.
3. SCORING: Show RoundTransition. On continue → BUILD (next round) or GAME_OVER.
4. GAME_OVER: Show GameOverScreen. On play again → new game.

**Step 4: Commit**

```bash
git commit -am "feat(client): multi-round game loop with transitions and game over"
```

---

### Task 29: AI Opponent (Basic)

**Files:**
- Create: `packages/engine/src/ai.ts`
- Create: `packages/engine/src/ai.test.ts`
- Modify: `packages/client/src/store/game-store.ts`

**Context:** DESIGN.md Phase 4 specifies full AI, but we need at least a basic AI for single-player in the MVP. This task implements "Medium" difficulty: greedy best-move selection.

**Step 1: Write AI tests**

```ts
// ai.test.ts
import { describe, it, expect } from 'vitest';
import { aiBuildPhase, aiBattlePhase } from './ai';
import { createGame } from './game-state';

describe('aiBuildPhase', () => {
  it('spends resources on units', () => {
    const game = createGame();
    const placements = aiBuildPhase(game, 'player2');
    expect(placements.length).toBeGreaterThan(0);
    // Total cost should not exceed resources
    const totalCost = placements.reduce((sum, p) => sum + p.cost, 0);
    expect(totalCost).toBeLessThanOrEqual(game.players.player2.resources);
  });

  it('assigns directives to all placed units', () => {
    const game = createGame();
    const placements = aiBuildPhase(game, 'player2');
    placements.forEach((p) => {
      expect(p.directive).toBeTruthy();
    });
  });
});

describe('aiBattlePhase', () => {
  it('returns 0-3 valid commands', () => {
    const game = createGame();
    // Set up a battle scenario
    game.phase = 'battle';
    // ... place units
    const commands = aiBattlePhase(game, 'player2');
    expect(commands.length).toBeLessThanOrEqual(3);
  });
});
```

**Step 2: Implement AI**

**Build phase AI:** Allocate budget across unit types with a ratio (e.g., 40% tanks, 30% infantry, 20% artillery, 10% recon). Place units in deployment zone. Assign directives: tanks/infantry get advance or flank, artillery gets support/hold, recon gets scout.

**Battle phase AI:** For each CP, find the highest-impact command:
- If a unit can kill an enemy this turn, direct attack.
- If a key unit is in danger, retreat.
- Otherwise, redirect units toward the objective.

Score each possible command by: kill value, survival value, objective proximity.

**Step 3: Wire AI to game loop**

Add a "vs AI" toggle to the game. When enabled, player 2's build and battle phases are handled by the AI automatically (with a brief delay for readability).

**Step 4: Commit**

```bash
git commit -am "feat(engine): basic AI opponent with build and battle logic"
```

---

### Task 30: Polish & Playtesting Pass

**Files:**
- Various tweaks across client and engine

**Step 1: Visual polish**

- Ensure hex grid is properly centered on all screen sizes
- Add hover effects on hexes (highlight border)
- Smooth transitions between phases
- Consistent color palette across all UI elements
- Proper font sizing and readability

**Step 2: Gameplay validation**

- Play 5+ complete games against AI
- Verify: resources calculate correctly, units persist between rounds, fog of war works
- Check edge cases: 0 units placed, all units killed turn 1, timer expires with no placements

**Step 3: Bug fixes from playtesting**

Fix any issues discovered. Common suspects:
- Off-by-one in turn counting
- Pathfinding edge cases (no valid path)
- Vision calculation with multiple units
- Resource carryover math

**Step 4: Final commit**

```bash
git commit -am "fix: polish and playtesting fixes"
```

---

## Summary

| Phase | Tasks | What You Get |
|-------|-------|-------------|
| Phase 1 (Engine) | Tasks 1-14 | Pure TS game engine, full test coverage, simulates games programmatically |
| Phase 2 (Renderer) | Tasks 15-23 | Visual hex grid, unit rendering, fog of war, hot-seat battle mode |
| Phase 3 (Build + Economy) | Tasks 24-30 | Unit shop, directives, timers, economy, multi-round, AI, complete game |

**Total: 30 tasks.** Each task is independently committable and testable.
