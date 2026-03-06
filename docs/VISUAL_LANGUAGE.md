# Visual Language

Single source of truth for all renderer visuals: layer ordering, Y offsets, color palette, and per-system specs.

Source files: `packages/client/src/renderer/`

---

## Render Order Stack

```
0  Terrain          hex faces, grid outlines, side walls
1  Deploy / Obj     deploy zone fills + outlines, objective markers, city ownership
2  Selection / Cmd  move/attack range highlights, hover, selected unit, command visuals
3  Fog of War       unexplored + fog-of-war overlays
4  Effects          damage numbers, attack tracers, death markers
—  Unit Models      3D GLB meshes, no explicit renderOrder (positioned in world space)
```

All overlay layers use `depthWrite: false` + `transparent: true` for correct stacking, except fog of war which is fully opaque.

---

## Y-Offset Convention

Offsets relative to terrain surface at `hexToWorld(hex, elevation).y`:

| Offset | Element | File |
|--------|---------|------|
| `+0.001` | Terrain hex outline | `terrain-renderer.ts` |
| `+0.002` | Central objective fill | `terrain-renderer.ts` |
| `+0.003` | Central objective outline, deploy zone fill | `terrain-renderer.ts`, `deploy-renderer.ts` |
| `+0.004` | City ownership border, deploy zone outline | `terrain-renderer.ts`, `deploy-renderer.ts` |
| `+0.005` | Selection range fill | `selection-renderer.ts` |
| `+0.006` | Selection range outline | `selection-renderer.ts` |
| `+0.007` | Hovered hex outline | `selection-renderer.ts` |
| `+0.008` | Selected unit outline | `selection-renderer.ts` |
| `+0.01` | Fog of war | `fog-renderer.ts` |
| `+0.02` | Ghost enemy circle | `unit-renderer.ts` |
| `+0.15` | Command path lines | `command-renderer.ts` |
| `+0.3` | Attack tracers, death markers, command crosshairs | `effects-renderer.ts`, `command-renderer.ts` |
| `+0.5` | Damage number spawn | `effects-renderer.ts` |

---

## Color Palette

### Scene

| Color | Hex | Usage |
|-------|-----|-------|
| Near-black | `0x0a0a10` | Renderer clear color, terrain grid outline |

### Terrain (`ASH_EMBER_TERRAIN` in `constants.ts`)

| Terrain | Hex |
|---------|-----|
| Plains | `0x6A6A58` |
| Forest | `0x3A4030` |
| Mountain | `0x505058` |
| City | `0x7A6048` |

Side faces: 60% darkened version of terrain color.

### Player Colors (`PLAYER_COLORS` in `constants.ts`)

| Player | Fill | Stroke | Light |
|--------|------|--------|-------|
| Player 1 | `#6a7a5a` | `#4a5a3a` | `#8a9a7a` |
| Player 2 | `#8a5a4a` | `#6a3a2a` | `#aa7a6a` |

### Deploy Zones (`deploy-renderer.ts`)

| Zone | P1 viewing | P2 viewing |
|------|-----------|-----------|
| Friendly fill | `0x4a5a3a` α0.45 | `0x6a3a2a` α0.45 |
| Friendly outline | `0x8a9a7a` | `0xaa7a6a` |
| Enemy fill | `0x5a2a1a` α0.35 | `0x2a3a1a` α0.35 |
| Enemy outline | `0x8a5a4a` | `0x6a7a5a` |

### Selection (`selection-renderer.ts`)

| Element | Color | Opacity |
|---------|-------|---------|
| Move range fill | `0xe8e4d8` beige | 0.08 |
| Move range outline | `0xe8e4d8` beige | 0.7 |
| Attack range fill | `0x9a4a3a` rust | 0.1 |
| Attack range outline | `0x9a4a3a` rust | 0.7 |
| Hovered hex outline (default) | `0xffffff` white | 0.6 |
| Hovered hex outline (move mode) | `0x00ccff` electric blue | 0.8 |
| Hovered hex fill (move mode) | `0x00ccff` electric blue | 0.1 |
| Hovered hex outline (attack mode) | `0x9a4a3a` rust | 0.8 |
| Move destination fill | `0x00ccff` electric blue | 0.15 |
| Move destination outline | `0x00ccff` electric blue | 0.9 |
| Selected unit outline | `0xe8e4d8` beige | 0.9 |

### Commands (`command-renderer.ts`)

| Element | Color | Opacity |
|---------|-------|---------|
| Move path polyline | `0x00ccff` electric blue, 4px wide (Line2) | 0.9 |
| Attack crosshair | `0xff4444` red | 0.9 |

### Fog of War (`fog-renderer.ts`)

| State | Color | Opacity |
|-------|-------|---------|
| Not visible | `0x16160E` | 1.0 (opaque) |

Fog covers hex top faces and side walls of elevated hexes. Props are not rendered on fogged hexes. No explored/unexplored distinction — binary visible or fogged.

### Objectives (`terrain-renderer.ts`)

| Element | Color | Opacity |
|---------|-------|---------|
| Objective fill | `0xA08A40` golden | 0.6 |
| Objective outline | `0xA08A40` golden | 1.0 |

### Effects (`effects-renderer.ts`)

| Element | Color | Opacity | Animation |
|---------|-------|---------|-----------|
| Damage number text | `#9a4a3a` rust | 1.0 → 0 | Rise at 0.8 u/s, fade at 1.5 α/s, lifetime ~0.67s |
| Attack tracer line | `0xffff88` yellow | 1.0 → 0 | Fade over 0.4s |
| Death marker × | `0xff2222` bright red | 1.0 → 0 | Fade at 0.33 α/s, lifetime ~3s |

### HP Bar (`unit-model.ts`)

| Range | Color |
|-------|-------|
| >60% | `#6a8a48` green |
| 30–60% | `#a08a40` yellow |
| <30% | `#9a4a3a` red |
| Background | `#333` |

### Ghost Markers (`unit-renderer.ts`)

| Element | Color | Opacity |
|---------|-------|---------|
| Circle | `0x888888` | 0.4 |
| Type label | `#aaa` | 0.5 |

---

## Systems Catalog

### Terrain — `terrain-renderer.ts`
Hex top faces (batched Float32Array BufferGeometry with vertex colors), grid outlines (batched LineSegments), side faces for elevated hexes (batched BufferGeometry quads at 60% darkened color). Objectives and city ownership rendered as overlays. 3 draw calls for terrain + a few for objectives/city borders.

### Deploy Zones — `deploy-renderer.ts`
Build phase only. Friendly zone highlighted with player color, enemy zone dimmed. Fill + outline per hex.

### Selection — `selection-renderer.ts`
Rebuilt each frame from scratch (dispose previous group). Move range = beige fill+outline per reachable hex. Attack range = rust fill+outline per attackable hex. Hovered hex = white outline. Selected unit = beige outline.

### Pending Commands — `command-renderer.ts`
Rebuilt on `pendingCommands` array reference change.
- **direct-move**: A* path polyline from unit position to target hex. Multi-point `THREE.Line`, each waypoint converted via `hexToWorld`. Blue `0x4488ff`, opacity 0.8, Y +0.15.
- **direct-attack**: `+` crosshair on target unit. Two perpendicular `THREE.Line`s at target world position. Red `0xff4444`, opacity 0.9, Y +0.3. Size 0.35 world units.
- Max 4 commands (CP_PER_ROUND = 4).

### Fog of War — `fog-renderer.ts`
Opaque overlay on all non-visible hexes. Covers top faces and side walls of elevated hexes. 1-2 draw calls (top batch + side batch). Active only during combat phase; build phase shows full map.

### Unit Models — `unit-model.ts`
3D GLB meshes loaded via `model-loader.ts`. Scaled per type: infantry 1.20, tank 1.80, artillery 1.50, recon 1.30. P1 rotated π (facing up), P2 rotated 0 (facing down). HP bar as CSS2DObject above model. Directive icon as CSS2DObject unicode symbol.

Directive symbols: ▲ advance, ■ hold, ◄ flank-left, ► flank-right, ● scout, ◆ support, ♦ hunt, ⚑ capture.

### Ghost Markers — `unit-renderer.ts`
Last-known enemy positions when out of LoS. Grey translucent circle + single-letter type label (I/T/A/R from `UNIT_LABELS`).

### Effects — `effects-renderer.ts`
Transient combat visuals. Damage numbers float up and fade. Attack tracers connect source→target and fade. Death markers (×) persist ~3s and fade.

---

## Planned Systems (Not Yet Implemented)

Spec in `docs/LAND_USE.md:140-162`:

**Fog gradient by elevation** — low hexes (elev 0–2) get thicker fog overlay with muted colors; high hexes (10+) are clear. Continuous gradient, applied per-hex or as post-process.

**Vision ring on selection** — selected unit's vision radius shown as ring. Larger on elevated hexes. Altitude indicators (chevrons/tick marks) distinguish bonus range from base range.

**Atmospheric haze layers** — thin horizontal haze planes at Y = 0.3, 0.6. Units below appear washed out, units above appear crisp. Edges fade to avoid hard cutoffs.
