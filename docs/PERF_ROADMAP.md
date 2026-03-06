# Rendering Performance Roadmap

Ordered from simplest/highest-impact to most complex. Each item is independent — no ordering dependencies.

## P1: Dirty-flag map rebuild (static vs dynamic split)

**Problem**: `renderTerrain()` and `renderProps()` rebuild every mesh on every `gameState` change, even when only a unit moved or a command was issued. The map (terrain, elevation, modifiers, props) is static after the build phase.

**Fix**: Track a `mapVersion` (derived from `map.seed`). Skip terrain/prop rebuild when mapVersion hasn't changed. Only re-render units, fog, selection, commands on turn-by-turn state updates.

**Files**: `App.tsx` (render gating), `terrain-renderer.ts`, `prop-renderer.ts`
**Effort**: Small
**Impact**: Eliminates ~80% of redundant GPU work during battle phase

---

## P2: Viewport/frustum culling for props

**Problem**: Every hex gets props placed regardless of camera position. At 3.5x zoom the camera sees maybe 30-50 hexes, but we instance all ~2800.

**Fix**: Before the instancing pass, compute the ortho camera frustum in world XZ coords. Skip hexes whose center falls outside the frustum + 1 hex padding. InstancedMesh counts shrink to only visible hexes.

**Files**: `prop-renderer.ts`, `three-scene.ts` (expose frustum bounds)
**Effort**: Small-medium
**Impact**: ~90% fewer instances at typical zoom levels

---

## P3: Object pooling for render-hot paths

**Problem**: `buildMatrix()` allocates `new THREE.Matrix4()` per prop instance per rebuild. `hexToWorld()` returns a new object per call. These create GC pressure during scene construction.

**Fix**: Pre-allocate scratch objects for matrix composition (the linter already started this with `_pos`, `_quat` etc — finish it by reusing the output matrix). Cache `hexToWorld` results in a per-frame Map cleared at frame start.

**Files**: `prop-renderer.ts`, possibly a shared `render-cache.ts`
**Effort**: Small
**Impact**: Reduces GC pauses during scene rebuild. Most noticeable on lower-end hardware.

---

## P4: Per-frame hexToWorld cache

**Problem**: The same hex gets converted to world coords multiple times across terrain-renderer, prop-renderer, fog-renderer, selection-renderer, unit-renderer — all in the same frame.

**Fix**: A simple `Map<string, WorldCoord>` created at the start of `renderScene()`, passed to each renderer or stored as a module-level cache cleared per frame.

**Files**: `App.tsx` (cache lifecycle), all renderers (consume cache)
**Effort**: Medium (touches many files but each change is trivial)
**Impact**: Modest — hexToWorld is cheap arithmetic, but called thousands of times

---

## P5: Replace getAllHexes with terrain.keys() everywhere

**Problem**: `ai.ts` and some client code use `getAllHexes(gridSize)` which returns a rectangular bounding box. With hex-of-hexes maps (~2800 real hexes in a ~8400-cell bounding box), ~67% of iterations are wasted checking `terrain.has()`.

**Fix**: Replace `getAllHexes()` calls with iteration over `state.map.terrain.keys()` (already done in renderers, not yet in AI).

**Files**: `ai.ts`, any remaining `getAllHexes` call sites
**Effort**: Small
**Impact**: ~3x faster AI turns, minor render improvement

---

## P6: TypedArray buffers for instancing data

**Problem**: Instance matrices stored as `Matrix4[]` (JS object array). Each matrix is 16 floats wrapped in an object with prototype chain.

**Fix**: Pre-allocate a `Float32Array(maxInstances * 16)` per prop type. Write matrix elements directly into the typed buffer. Pass to `InstancedMesh.instanceMatrix.array` without copying.

**Files**: `prop-renderer.ts`
**Effort**: Medium
**Impact**: Lower memory, faster buffer upload to GPU, less GC

---

## P7: Web Worker for visibility/pathfinding

**Problem**: `calculateVisibility()` iterates all hexes × all units with LoS checks. Currently runs on the main thread, blocking render.

**Fix**: Move visibility calculation to a Web Worker. Post unit positions + map data, receive visible hex set back. Use SharedArrayBuffer if elevation/terrain data is large enough to warrant zero-copy.

**Files**: New `visibility-worker.ts`, `App.tsx` (async visibility)
**Effort**: Large
**Impact**: Unblocks main thread during turn resolution. Only matters if visibility calc exceeds ~8ms (profile first).
