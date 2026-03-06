# Prop Asset Pipeline

## Overview

Props are 3D scatter objects placed on hex tiles (trees, rocks, barriers, etc.). They are generated as high-poly models (~50K faces), then processed through a remesh pipeline that produces game-ready low-poly GLBs (~400-2000 faces) with baked textures.

## Directory Layout

```
packages/client/public/models/
  highdef/props/          ← High-poly source models (50K faces, not shipped)
  props/                  ← Game-ready low-poly models (output of pipeline)

asset_gen_pipeline/
  6_remesh_decimate.py    ← Blender headless: remesh → decimate → UV → bake → export
  remesh_config.json      ← Per-model settings (target faces, voxel size, texture size)

packages/client/src/renderer/
  prop-manifest.ts        ← Spawn rules: which props appear on which terrain
  prop-renderer.ts        ← InstancedMesh renderer (batches all props into few draw calls)
```

## Adding New Props

### 1. Generate or obtain the model

Place the high-poly GLB (any face count) at:
```
packages/client/public/models/highdef/props/prop_<name>.glb
```

Naming convention: `prop_<descriptive_name>.glb` (snake_case, `prop_` prefix).

### 2. Add to remesh config

Add an entry to `asset_gen_pipeline/remesh_config.json`:

```json
{
  "input": "../packages/client/public/models/highdef/props/prop_<name>.glb",
  "output": "../packages/client/public/models/props/prop_<name>.glb",
  "target_faces": 500,
  "voxel_size": 0.03,
  "texture_size": 256
}
```

**Parameter guide:**

| Parameter | Small scatter | Trees/rocks | Buildings |
|-----------|--------------|-------------|-----------|
| `target_faces` | 200-400 | 600-1200 | 1000-2000 |
| `voxel_size` | 0.04 | 0.02-0.025 | 0.02 |
| `texture_size` | 256 | 512 | 512 |

- `voxel_size` — smaller = more geometric detail retained (more faces before decimate)
- `target_faces` — final triangle count after decimate. Keep under 2000
- `texture_size` — 256 for tiny props, 512 for visually important ones

### 3. Run the remesh pipeline

```bash
cd asset_gen_pipeline
"C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
  --background --python 6_remesh_decimate.py -- --config remesh_config.json
```

This processes all entries in the config (~1s per model). It will skip missing input files. The pipeline:
1. Voxel remesh — replaces mesh with clean uniform topology
2. Decimate — collapse to target face count (works cleanly on remeshed topology)
3. Smart UV — auto-generates new UV layout on the low-poly mesh
4. Bake — transfers original texture onto new UVs via Cycles (CPU, 4 samples)
5. Export — GLB with JPEG texture embedded

Output lands in `packages/client/public/models/props/`.

### 4. Register in prop-manifest.ts

Edit `packages/client/src/renderer/prop-manifest.ts`.

**Scatter prop** (randomly placed on terrain hexes):
```ts
{ id: '<name>', glbPath: '/models/props/prop_<name>.glb', probability: 0.15, maxPerHex: 1, scaleRange: [0.3, 0.5] }
```

Add to the appropriate array: `PLAINS_PROPS`, `FOREST_PROPS`, `MOUNTAIN_PROPS`, or `CITY_PROPS`.

**Modifier accent prop** (placed on hexes with a specific modifier like river/highway):

Add to `RIVER_PROPS`, `BRIDGE_PROPS`, or `HIGHWAY_PROPS`.

**Surface prop** (full-hex coverage, like water or road surface):

Add to `SURFACE_PROPS`:
```ts
<modifier>: { id: '<name>', glbPath: '/models/props/prop_<name>.glb', scale: 1.0, directional: true, xRot: Math.PI / 2 }
```

`ALL_PROP_PATHS` is built automatically from the arrays — no manual update needed.

### 5. Verify

Run `pnpm dev` and check:
- Props render on the correct terrain types
- Visual quality is acceptable at game zoom level (3.5×)
- Perf monitor shows triangle count staying under ~3M total

## Performance Budget

| Metric | Budget | Notes |
|--------|--------|-------|
| Total instances | ~2,500 | Controlled by probability × maxPerHex in manifest |
| Tris per model | 400-2000 | Set by target_faces in remesh config |
| Total triangles | <3M | Instances × avg tris. Over 5M = noticeable FPS drop |
| Textures per model | 1 | 256px or 512px JPEG baked |
| Draw calls (props) | ~80-200 | Automatic — InstancedMesh batching by chunk |

## Terrain → Prop Mapping

| Terrain | Props |
|---------|-------|
| Plains | rocks_small, road_stripe, survey_stakes, tire |
| Forest | tree_a, tree_b, tree_c, fallen_log, overgrown_footing |
| Mountain | rock_peak_a, rock_peak_c |
| City | jersey_barrier, utility_pole, dumpster |

| Modifier | Accent props | Surface prop |
|----------|-------------|--------------|
| River | water_reeds | water_surface |
| Lake | water_reeds | water_surface |
| Bridge | bridge_span | bridge_deck |
| Highway | road_guardrail | road_surface |

## Deprecated Scripts

These exist but are superseded by `6_remesh_decimate.py`:
- `4_decimate.py` — single-mesh Blender collapse decimator
- `batch_decimate.py` + `batch_decimate_config.json` — batch Blender collapse decimator

Both produce poor results on AI-generated meshes due to UV topology preventing deep decimation.
