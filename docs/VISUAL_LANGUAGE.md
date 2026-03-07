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

### Faction Colors (`FACTION_COLORS` in `constants.ts`)

All faction colors are electric/neon. Single source of truth — `PLAYER_COLORS`, `REVEAL_COLORS`, paths, icons, and city ownership borders all derive from this table.

| Faction | Primary | Light | Dark | CSS |
|---------|---------|-------|------|-----|
| Engineers (P1) | `0xffee00` yellow | `0xffff66` | `0xccbb00` | `#ffee00` |
| Caravaners (P2) | `0x00ffff` cyan | `0x66ffff` | `0x00cccc` | `#00ffff` |
| Greasers | `0xcc44ff` purple | `0xdd88ff` | `0x9922cc` | `#cc44ff` |
| Pistoleros | `0x00ff66` green | `0x66ff99` | `0x00cc44` | `#00ff66` |
| Wardens | `0xff8800` orange | `0xffaa44` | `0xcc6600` | `#ff8800` |

`PLAYER_FACTION` maps `PlayerId → Faction`. Currently: P1 = Engineers, P2 = Caravaners. Extend when multi-player lands.

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

| State | Color | Opacity | What renders |
|-------|-------|---------|-------------|
| LOS (active vision) | — (clear) | — | Terrain, units, enemy paths, ROE icons, all effects |
| Explored (previously seen) | `0x16160E` | 0.6 | Terrain only. No enemy visuals, no order visuals. |
| Unexplored | `0x16160E` | 1.0 (opaque) | Nothing. |

Fog covers hex top faces and side walls of elevated hexes. Props are not rendered on fogged hexes.

**During reveal:** fog state is frozen at tick-start LOS. Enemy order visuals (paths, ROE icons, engagement effects) render only on LOS hexes. Explored hexes show terrain but no enemy activity — they provide no intelligence during reveal. See `REVEAL_ANIMATION_SPEC.md §Visibility Rule`.

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

### Selection & Directive Paths — `selection-renderer.ts`
Rebuilt each frame from scratch (dispose previous group).

**Selection highlights:** Move range = beige fill+outline per reachable hex. Attack range = rust fill+outline per attackable hex. Hovered hex = white outline. Selected unit = beige outline.

**Directive path visualization (planning phase):** Per-directive rendering for all friendly units. Shown during build and battle planning phases. Persists across unit selection/deselection.

**Color convention:** Friendly paths/icons = **faction primary color** (derived from `FACTION_COLORS` via `getFactionColors()`). Enemy paths/icons = enemy's faction color, visible only during reveal on active LOS hexes. Counter-fire tracers = **orange** (`0xdd8833`). Colors resolve via `getPlayerColor(unitOwner, observingPlayer)` in `constants.ts` — scales to 3-5 players without code changes.

| Directive | Line Style | Color | Details |
|-----------|-----------|-------|---------|
| `advance` | Solid polyline | Faction color (friendly) / Enemy faction color | A* path from unit to targetHex |
| `flank-left/right` | Dashed arc | Faction / Enemy faction | Simulated multi-turn trajectory via `simulateFlankTrajectory`. Cached per unit. Dash: 0.4 on, 0.2 off. |
| `patrol` | Dashed path + dotted ring | Faction / Enemy faction | Dashed path to target. Ring of hex outlines at radius 3 around targetHex. |
| `hold` | No line | — | Unit stays put |

**ROE icons at target hex:**

| ROE | Icon | Symbol |
|-----|------|--------|
| `shoot-on-sight` | Crosshair | ⊕ |
| `skirmish` | Inward chevrons | ⟫ |
| `retreat-on-contact` | Outward chevrons | ⟪ |
| `hunt` | Arrow/lock | → |
| `ignore` | No icon | — |

Selected unit paths render at α0.9, non-selected at α0.4. Blue target hex highlight: `0x00ccff` fill (α0.2 selected, α0.1 other) + outline (α1.0 selected, α0.5 other).

### Reveal Transition — Planning → Reveal Continuity

**Planning visuals do NOT clear when reveal starts.** Directive paths, ROE icons, and target hex markers stay on screen as the "REVEAL" banner flashes. Units then move along the lines already drawn. The plan comes to life — or deforms when reality hits.

Three execution modes govern how planning visuals behave during reveal:

**Static execution** — visuals complete as drawn. Unit moves to its planned hex, line "eats itself" from the tail. No changes unless intercepted or killed. Applies to: advance/flank with shoot-on-sight/skirmish/ignore when no contact occurs.

**Dynamic execution** — the plan succeeds but visuals update in real time. Hunt crosshair snaps to acquired target and tracks. Retreat-on-contact forward segment fades cleanly (NOT dimmed — the retreat IS the plan working) and retreat line draws from contact point. Ambush/Tripwire: movement line appears for the first time when the trigger springs.

**Divergence** — the engine's reality overrides the plan. Intercepted → line truncates at stop point, remainder dims to α0.2. Collision → both lines truncate at adjacent hexes. Kill → unit drops, line freezes.

**Visibility gating:** All enemy visuals during reveal are gated by active LOS. Friendly unit visuals render unconditionally. Enemy paths, ROE icons, and engagement effects only appear on hexes within the player's vision set for this tick. Dark flanks stay dark. Scout placement buys reveal coverage. See `REVEAL_ANIMATION_SPEC.md §Visibility Rule (D-VIS-5)`.

Full per-order transition table in `REVEAL_ANIMATION_SPEC.md`.

### Reveal Effects

| Phase | Visual | Color | Duration |
|-------|--------|-------|----------|
| Phase 3 movement | Line eats itself + unit tween | `0x5599bb` blue paths | 6-8s total |
| Phase 3 intercept | Red pulse + "INTERCEPT" ping | Red | 0.4s |
| Phase 4 engagement | Both hexes flash white | White | 0.3s per clash |
| Phase 5 initiative fire | Muzzle flash + tracer + floating damage | Faction color | 0.8-1.2s per shot |
| Phase 6 counter-fire | Muzzle flash + tracer + "COUNTER" tag | **Orange** (distinguishes from Phase 5) | 0.8-1.2s per shot |
| Phase 8 heal | Green glow + "+1 HP" float | Green | 0.6s |
| Phase 8 reveal | Expanding dotted circle | White | 0.6s |
| Phase 9 city capture | Color flip + flag animation | Faction | 1.0s |
| Phase 10 round end | Victory/defeat banner | — | 2.0s |

### Pending Commands — `command-renderer.ts`
Currently a stub (redirect-only commands have no spatial visual). Reserved for future direct-move/direct-attack CP command visuals.

### Fog of War — `fog-renderer.ts`
Opaque overlay on all non-visible hexes. Covers top faces and side walls of elevated hexes. 1-2 draw calls (top batch + side batch). Active only during combat phase; build phase shows full map.

### Unit Models — `unit-model.ts`
3D GLB meshes loaded via `model-loader.ts`. Scaled per type: infantry 1.20, tank 1.80, artillery 1.50, recon 1.30. P1 rotated π (facing up), P2 rotated 0 (facing down). HP bar as CSS2DObject above model. Directive icon as CSS2DObject unicode symbol.

Directive symbols: ▲ advance, ■ hold, ◄ flank-left, ► flank-right, ● patrol, ◆ support, ♦ hunt, ⚑ capture.

**Animation system:** `playUnitAnimation(unitId, action)` plays skeletal clips from GLB files. 7 action types: `idle`, `move`, `attack`, `melee`, `hit`, `death`, `climb`. Per-model `clipMap` in `constants.ts` maps Meshy/Blender clip names to game actions. Multiple clips per action = random selection. Full event→animation mapping and clip status per unit GLB in `REVEAL_ANIMATION_SPEC.md §Unit Animation Requirements`.

### Ghost Markers — `unit-renderer.ts`
Last-known enemy positions when out of LoS. Grey translucent circle + single-letter type label (I/T/A/R from `UNIT_LABELS`).

### Effects — `effects-renderer.ts`
Transient combat visuals. Current implementation:

| Effect | Color | Animation | Lifetime |
|--------|-------|-----------|----------|
| Damage number | `#9a4a3a` rust | Rise at 0.8 u/s, fade at 1.5 α/s | ~0.67s |
| Attack tracer | `0xffff88` yellow | Fade over 0.4s | 0.4s |
| Death marker (×) | `0xff2222` red | Fade at 0.33 α/s | ~3s |

**Planned additions** (reveal animation):

| Effect | Color | Animation | Phase |
|--------|-------|-----------|-------|
| Intercept pulse | Red | Flash 0.4s | Phase 3 |
| Counter-fire tracer | **Orange** | Same as attack tracer | Phase 6 |
| Heal glow | Green | Soft pulse 0.6s | Phase 8 |
| Reveal circle | White dotted | Expand from patrol unit | Phase 8 |
| Camera nudge | — | 0.5s ease-in/out push-in + 8° tilt | Kills, captures |

### Floating Text Style (spec in `REVEAL_ANIMATION_SPEC.md`)

| Property | Value |
|----------|-------|
| Font | Bold sans-serif (Inter Black or Roboto Condensed Bold) |
| Size | 28px world-space |
| Color | Attacker's faction color |
| Outline | 2px black |
| Animation | Pop 0.2s → hold 0.8s → fade 0.3s |

---

## Planned Systems (Not Yet Implemented)

Spec in `docs/LAND_USE.md:140-162`:

**Fog gradient by elevation** — low hexes (elev 0–2) get thicker fog overlay with muted colors; high hexes (10+) are clear. Continuous gradient, applied per-hex or as post-process.

**Vision ring on selection** — selected unit's vision radius shown as ring. Larger on elevated hexes. Altitude indicators (chevrons/tick marks) distinguish bonus range from base range.

**Atmospheric haze layers** — thin horizontal haze planes at Y = 0.3, 0.6. Units below appear washed out, units above appear crisp. Edges fade to avoid hard cutoffs.
