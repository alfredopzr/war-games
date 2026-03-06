# Unit Asset Pipeline

## Overview

Units are 3D models generated via the Meshy API, then processed through animation and decimation pipelines. The full pipeline produces game-ready GLBs with 5 embedded animation clips (idle, move, attack, hit, death).

There are two paths through the pipeline depending on unit type:

- **Non-humanoid** (tanks, artillery, some scouts): Stages 1-4 (Meshy generation) → `2_animate.py` (Blender root-transform animations)
- **Humanoid** (infantry, recon): Stages 1-4 → Stages 5-8 (Meshy rig + animate + merge + skin transfer)

Currently `humanoid_unit_types` in `config.json` is `[]`, so all units use the non-humanoid path with `2_animate.py`.

## Directory Layout

```
docs/ASSETS.md                      ← Unit definitions (prompts, colors, silhouettes)

asset_gen_pipeline/
  config.json                       ← API keys, paths, model settings, animation config
  1_generate.py                     ← Meshy API: text-to-image → multi-view → 3D → retexture
  2_animate.py                      ← Blender headless: root-transform animation (5 clips)
  3_merge_animations.py             ← Blender headless: merge single-clip GLBs into one
  4_decimate.py                     ← Blender headless: single-mesh collapse decimator
  5_apply_skin.py                   ← Pure Python: binary GLB texture transfer
  6_remesh_decimate.py              ← Blender headless: voxel remesh (props only)
  batch_decimate.py                 ← Batch wrapper for 4_decimate.py
  batch_decimate_config.json        ← Per-model decimate targets (units + props)
  previews/                         ← Stage 1 output: front-view PNGs
  raw/                              ← Stage 3 output: untextured 3D models
  final/                            ← Stage 4 output: retextured models (high-poly)
  rigged/                           ← Stage 5 output: rigged models (humanoid path)
  meshy_anims/<unit>/               ← Stage 6 output: individual clip GLBs (humanoid path)
  animated/                         ← Stage 7 output: merged animated GLBs (humanoid path)
  logs/generation_log.json          ← Per-unit stage progress tracking

packages/client/public/models/
  highdef/                          ← High-poly source models (not shipped)
  <unit_type>_<faction>.glb         ← Game-ready models (output of pipeline)
```

## ASSETS.md Format

Each unit is defined as a `### ` block in `docs/ASSETS.md` with these fields:

```markdown
### Infantry — Engineers

**File**: `infantry_engineer.glb`
**Subject**: A bipedal construction worker turned soldier...
**Visual markers**:
- Hard hat with hazard stripes
- Hydraulic arm attachment
- Welding goggles
**Colors**: Primary `#F2C94C`, Secondary `#828282`, Accent `#1A1A1A`
**Silhouette**: Tall vertical stack of gear and crane arm
```

The parser (`1_generate.py:60-107`) extracts: `File` → filename, `Subject` → base prompt, `Visual markers` → comma-joined details, `Colors` → palette, `Silhouette` → shape description. These are concatenated with the style suffix from `config.json` to form the full Meshy prompt.

Filename convention: `<unit_type>_<faction>.glb` (e.g. `infantry_engineer`, `tank_caravaner`).

## Stage 1-4: Meshy Generation Pipeline

Run via `1_generate.py`. All stages use the Meshy API with polling.

| Stage | API Endpoint | What it does |
|-------|-------------|--------------|
| S1 | `text-to-image` | Generates front-view PNG from prompt |
| S2 | `image-to-image` | Multi-view generation from S1 image |
| S3 | `multi-image-to-3d` | 3D mesh from multi-view images (100K polys) |
| S4 | `retexture` | Retextures S3 mesh using S1 image as style ref |

### Usage

```bash
cd asset_gen_pipeline

# Check progress of all units
python 1_generate.py --status

# Generate all units
python 1_generate.py --all

# Single unit
python 1_generate.py --unit infantry_engineer

# Preview only (stage 1 — front-view PNGs)
python 1_generate.py --preview-only

# Resume from previews (stages 2-4)
python 1_generate.py --from-previews

# Retry failed units
python 1_generate.py --retry-failed

# Dry run (parse prompts, no API calls)
python 1_generate.py --dry-run

# Limit concurrent processing
python 1_generate.py --all --limit 5 --workers 3
```

Progress is tracked per-unit in `logs/generation_log.json`. The pipeline resumes from the last successful stage on re-run.

## Stage 5-8: Humanoid Rigging + Animation (Meshy Path)

Only runs when `humanoid_unit_types` in `config.json` lists the unit type. Currently empty — all units use `2_animate.py` instead.

| Stage | Tool | What it does |
|-------|------|--------------|
| S4b | Blender `4_decimate.py` | Decimate to 250K faces for rigging API |
| S5 | Meshy `rigging` API | Auto-rig with skeleton |
| S6 | Meshy `animations` API | 5 clips in parallel (action IDs from config) |
| S7 | Blender `3_merge_animations.py` | Merge clip GLBs into single GLB with NLA strips |
| S8 | Python `5_apply_skin.py` | Transfer textures from S4 output onto animated GLB |

```bash
# Run stages 5-8 only (after stages 1-4 complete)
python 1_generate.py --rig-only
```

Animation action IDs are configured per-faction in `config.json`:
```json
"default_action_ids": { "idle": 0, "move": 30, "attack": 4, "hit": 178, "death": 180 },
"faction_action_ids": { "pistolero": { "attack": 232 } }
```

## Blender Animation: `2_animate.py`

The current animation path for all units. Adds 5 root-transform animation clips (location + rotation keyframes) to any single-mesh GLB. No skeleton required.

### Preset Detection

Preset is auto-detected from the filename:

| Pattern | Preset | Motion style |
|---------|--------|-------------|
| `prop_command*` | command_tower | Generator vibration idle, stubs for rest |
| `prop_*` | prop | All clips are zero-movement stubs |
| `scout_engineer`, `scout_warden`, `scout_current` | drone | Hover oscillation, pitch on move, spiral death |
| `tank*`, `artillery*`, `scout_caravaner`, `scout_greaser`, `scout_pistolero` | vehicle | Hull recoil, heavy lean, tip-over death |
| Everything else | humanoid | Bob idle, forward lean move, punch attack, stagger hit |

### Animation Clips

All keyframe values scale proportionally to model height (H) and depth (D):

| Clip | Humanoid | Vehicle | Drone |
|------|----------|---------|-------|
| idle | 60f, vertical bob H×0.018 | 24f, engine vibration H×0.012 | 60f, hover bob H×0.04 |
| move | 24f, forward lean 12deg | 32f, hull tilt 6deg | 24f, pitch 18deg |
| attack | 15f, punch D×0.08 | 15f, recoil D×0.06 | 18f, dive D×0.12 |
| hit | 10f, stagger 15deg | 12f, rock 10deg | 10f, violent wobble |
| death | 24f, face-plant 85deg | 24f, tip 88deg | 24f, spiral crash |

### Usage

```bash
"C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
  --background --python 2_animate.py -- \
  --input path/to/unit.glb \
  --output path/to/animated.glb \
  --target-tris 50000
```

Built-in decimation runs before animation if the mesh exceeds `--target-tris`.

## Decimation for Game

After generation, units need decimation from ~100K to ~3K-5K faces for real-time rendering. Use the batch decimator:

```bash
"C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
  --background --python batch_decimate.py -- --config batch_decimate_config.json
```

Target face counts from `batch_decimate_config.json`:

| Unit type | Target faces |
|-----------|-------------|
| Infantry | 3,000 |
| Scout | 3,000 |
| Tank | 5,000 |
| Artillery | 5,000 |

Output lands in `packages/client/public/models/`.

## Adding New Units

### 1. Define in ASSETS.md

Add a `### ` block under the faction section with Subject, Visual markers, Colors, Silhouette, and File fields. Filename must be `<unit_type>_<faction>.glb`.

### 2. Generate via Meshy

```bash
cd asset_gen_pipeline
python 1_generate.py --unit <unit_type>_<faction>
```

Or use `--preview-only` first to check the front-view image, then `--from-previews` to continue.

### 3. Animate

```bash
"C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
  --background --python 2_animate.py -- \
  --input final/<unit_type>_<faction>.glb \
  --output animated/<unit_type>_<faction>.glb
```

### 4. Decimate for game

Add an entry to `batch_decimate_config.json`:
```json
{ "input": "../packages/client/public/models/highdef/<name>.glb", "output": "../packages/client/public/models/<name>.glb", "target_faces": 3000 }
```

Place the animated output in `highdef/`, then run the batch decimator.

### 5. Verify

Run `pnpm dev` and check:
- Unit renders on the board
- All 5 animation clips play correctly
- Visual quality acceptable at game zoom

## Config Reference

Key fields in `asset_gen_pipeline/config.json`:

| Field | Value | Purpose |
|-------|-------|---------|
| `stage1.ai_model` | `nano-banana-pro` | Text-to-image model |
| `stage3.ai_model` | `meshy-6` | 3D generation model |
| `stage3.target_polycount` | 100,000 | Raw mesh poly budget |
| `style_suffix` | (long string) | Appended to every prompt |
| `blender_path` | `C:/Program Files/.../blender.exe` | Blender 5.0 executable |
| `unit_type_to_preset` | infantry→humanoid, tank→vehicle, etc. | Animation preset mapping |
| `meshy_animation.fps` | 24 | Animation framerate |
| `meshy_animation.decimate_target` | 250,000 | Pre-rig decimate target |

## Helper Scripts

| Script | Purpose |
|--------|---------|
| `4_decimate.py` | Single-mesh Blender collapse decimator |
| `batch_decimate.py` | Batch wrapper — reads config JSON, runs `4_decimate.py` per entry |
| `5_apply_skin.py` | Binary GLB texture transfer (no Blender needed) |
| `3_merge_animations.py` | Merges single-clip GLBs into one with NLA strips |
| `clean_glb.py` | GLB cleanup utility |
