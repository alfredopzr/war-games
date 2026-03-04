# ChackAttacc — Vision Doc

## Core Shift

Move from top-down full-map view to a horizontal/isometric camera (LoL-style). The player sees a portion of the map at a time, not the whole thing. The grid is larger than the viewport — you scroll/pan to explore.

## Camera & Viewport

- Camera shows a limited region of the hex grid, not the full map
- Pan via edge scrolling, drag, or WASD/arrow keys
- Zoom levels (close-up for combat detail, zoomed-out for positioning)
- Height matters visually — mountains/elevation render taller, valleys lower
- 3D-ish perspective: hexes closer to camera appear larger (isometric or 2.5D)

## Minimap

- Small minimap in corner showing full grid at a glance
- Fog of war reflected on minimap (unseen hexes dimmed/hidden)
- Camera viewport rectangle shown on minimap
- Click minimap to jump camera to that location
- Unit dots on minimap (friendly = blue/red, enemy = only if visible)

## Fog of War (Enhanced)

- Current fog system stays (vision range per unit)
- Now actually impactful because you can't see the full map anyway
- Previously-seen terrain stays revealed but units vanish when out of vision
- Ghost markers for last-known enemy positions (already partially implemented)

## Turn Model & Balance

### Current problem

P1 always acts first. P2 always reacts to P1's resolved moves. This creates a structural first-mover advantage.

### Fix: Alternating first-mover

Alternate who goes first each round. P1 starts round 1, P2 starts round 2, etc. Per-round first-mover edge still exists but is shared over the game.

**Engine change needed** (Fred's domain): `startBattlePhase()` and `scoreRound()` in `game-state.ts` hardcode `currentPlayer: 'player1'`. Change to alternate based on `round.roundNumber % 2`.

## Combat Feedback & Animations

### Always-on effects (visible during your own turn)

- **HP bars**: `PIXI.Graphics` bar above each unit sprite, green→red proportional to HP
- **Selection highlight**: yellow hex outline on selected unit
- **Move/attack range**: tinted hex overlays showing valid targets
- **Directive arrows**: dashed line from unit toward directive target

### Turn replay (plays back opponent's turn before yours starts)

When the opponent ends their turn, the game plays a ~2-3 second animated replay of what happened before your turn begins. This solves the "units teleported/vanished" problem.

**Event log**: The engine already diffs state before/after via `diffBattleLog()` in `BattleHUD.tsx`. Extend this to capture a structured timeline:

```
TurnEvent[]  — ordered list of what happened
  | { type: 'move',    unitId, from: CubeCoord, to: CubeCoord }
  | { type: 'attack',  attackerId, defenderId, damage: number }
  | { type: 'kill',    unitId, position: CubeCoord, killedBy: string }
  | { type: 'capture', cityHex: CubeCoord, newOwner: PlayerId }
```

**Replay sequence** (effectsLayer in PixiJS):

1. **Moves** (~0.3s each): Unit sprite tweens from old position to new position
2. **Attacks** (~0.4s each):
   - Attack tracer line flashes between attacker → defender
   - Floating damage number rises from defender: red text showing `-{damage} HP`
   - Defender's on-map HP bar animates down to new value
   - If unit panel is open for that unit, panel HP updates live during replay
3. **Kills** (~0.5s): Unit sprite fades out, death marker (skull/explosion) appears at position, fades over 3s
4. **City captures**: City hex border flashes to new owner's color

Events that happened simultaneously (e.g. directive-driven moves) can animate in parallel. Direct commands animate sequentially.

**Skip button**: Player can press Space or click "Skip" to jump to final state immediately.

**Implementation**:
- Snapshot game state BEFORE `executeTurn()` runs (positions, HP of all units)
- Run `executeTurn()` as normal
- Diff the before/after to generate `TurnEvent[]`
- Store events in Zustand: `turnReplayEvents: TurnEvent[]`
- PixiJS ticker plays through events sequentially, then clears replay state and enables input

### Persistent markers (linger after replay)

- **Death markers**: skull/explosion sprite at death location, fades over ~5s
- **Damage numbers**: float up and fade (already gone by end of replay)
- **Kill feed**: React DOM overlay, scrolling log of kill/capture events (existing `BattleLog` component, make more prominent)

### Unit Info Panel (enhanced)

Current panel (`UnitInfoPanel.tsx`) already shows: Owner, HP, ATK, DEF, Move, Range, Vision, Directive. All plain text rows.

**Upgrade**:
- **HP bar**: Visual bar (green→yellow→red) next to the `HP 65/100` text. Same style as the on-map HP bar for consistency.
- **Damage output**: Show effective damage as `ATK {atk}` plus a computed `~{dmg}` estimate vs standard target (so the player understands how hard the unit hits, not just raw ATK stat).
- **Movement**: Show `Move {range}` with a small hex-count indicator. When the unit is selected, the move range highlights on the map (already works in battle phase — extend to show in build phase too so players understand reach before committing).
- **HP delta during replay**: If the panel is open for a unit that takes damage during turn replay, the HP value and bar animate down in real-time so you see the hit land.

## Stats & History

- Post-round stats screen: kills, damage dealt, damage taken, cities captured per player
- Per-unit stats tracking: total kills, damage dealt across the game
- Turn replay data enables future round replay feature (stretch goal)

## 3D Elements

- Terrain height rendered visually (mountains are tall hexes, plains are flat)
- Units have subtle shadow/depth
- Elevation affects line-of-sight (high ground sees farther, blocked by mountains)
- Water/rivers as impassable or costly terrain with visual depth

## Factions

### Shared Unit Classes

All four unit types (Infantry, Tank, Scout, Artillery) share the same stats and behavior across factions. Faction identity is purely visual — silhouette, palette, and material language.

### Engineers (Faction A)

**Visual grammar**: industrial construction
**Palette**: yellow, steel grey, black
**Material language**: cranes, scaffolding, hydraulic arms, hazard stripes

| Unit | Name | Visual Markers | Silhouette Cue |
|------|------|---------------|----------------|
| Infantry | Combat Engineers | Hard hats, tool backpacks, welding goggles | Bulky gear packs |
| Tank | Siege Construction Vehicle | Bulldozer blade, crane arm, reinforced panels | Front blade shape |
| Scout | Survey Drone | Quad drone, antenna array | Small cross-shaped drone |
| Artillery | Construction Crane Cannon | Crane base, long mounted barrel | Tall vertical frame |

### Caravaners (Faction B)

**Visual grammar**: mobile convoy culture
**Palette**: copper, turquoise, sand
**Material language**: trucks, cloth banners, welded scrap armor

| Unit | Name | Visual Markers | Silhouette Cue |
|------|------|---------------|----------------|
| Infantry | Convoy Riders | Scarves, light armor, bandoliers | Slimmer profile |
| Tank | War Rig Truck | Armored semi-truck, exhaust stacks, welded plates | Long horizontal body |
| Scout | Motorbike | Dirt bike, goggles | Thin bike shape |
| Artillery | Rocket Truck | Truck bed rocket rack | Angled launcher array |

### Readability Rules

At RTS zoom:
- **Engineers** = vertical shapes
- **Caravaners** = horizontal shapes

Color reinforcement:
- Yellow/steel = Engineers
- Copper/turquoise = Caravaners

### Unit Icons

4 pixel art icons — one per unit type. Faction identity comes from palette swap only, not different sprites.

- `infantry.png` — combat engineer / convoy rider silhouette
- `tank.png` — vehicle with treads / rig shape
- `scout.png` — small fast unit (drone / bike)
- `artillery.png` — long-range heavy frame

Palette swap at render time:
- Engineers: yellow (#F2C94C), steel grey (#828282), black (#1A1A1A)
- Caravaners: copper (#D4845A), turquoise (#4ECDC4), sand (#E8D5B7)

### Asset Strategy

4 base models + 2 skin sets. Production-minimal while preserving faction identity.

```
tank_base.model     →  tank_engineer.skin  /  tank_caravan.skin
infantry_base.model →  infantry_engineer.skin  /  infantry_caravan.skin
scout_base.model    →  scout_engineer.skin  /  scout_caravan.skin
artillery_base.model → artillery_engineer.skin / artillery_caravan.skin
```

## Isometric Rendering — Technical Plan

### Problem (Fred's Earlier Attempt)

Squashing the Y axis or hacking tile visuals without changing the projection math produces distorted pentagons instead of proper isometric hexes. The hex shape is fine — the coordinate transform is wrong.

### What Changes

Only **two functions** need rewriting. Everything else (`drawHex`, `drawHexTile`, `drawFog`, camera, engine math) consumes `hexToPixel` and works automatically.

| File | Function | Change |
|------|----------|--------|
| `renderer/hex-render.ts` | `hexToPixel()` | New isometric formula |
| `renderer/hex-render.ts` | `pixelToHex()` | Inverse of new formula |
| `App.tsx` render loop | Unit draw order | Sort units by depth before drawing |

### Current (flat 2D) hexToPixel

```
x = hexSize * 1.5 * q
y = hexSize * (√3/2 * q + √3 * r)
```

### Correct isometric hexToPixel

```
x = hexSize * (√3 * q + √3/2 * r)
y = hexSize * 1.5 * r
```

### pixelToHex inverse

Solve the linear system:
```
q = (x * √3/3 - y / 3) / hexSize
r = (y * 2/3) / hexSize
```
Then round to nearest cube coordinate (existing rounding logic stays).

### Draw order fix

Current terrain sort by `r` ascending is already correct for isometric (higher r = further down screen = drawn first → occluded by closer hexes drawn later).

Units need sorting too — sort by `q + r` (or equivalently screen Y) before drawing so closer units overlap farther ones.

### What does NOT change

- `drawHex()` — draws a regular hexagon at given (cx, cy), unchanged
- `drawHexTile()` — clips tile image to hex polygon, unchanged
- `drawFog()`, `drawObjective()`, `drawUnit()` — all receive coords from hexToPixel
- Engine hex math (cube coords, pathfinding, combat) — completely decoupled from rendering
- Camera system — just offsets; works with any projection

## WebGL Migration via PixiJS

### What is PixiJS

A 2D rendering library backed by WebGL. We write high-level code (sprites, containers, text), PixiJS translates it to GPU draw calls. No raw shader writing. Not Three.js (3D overkill). Not raw WebGL (months of boilerplate). Version: **PixiJS v8** (current stable, modern API, better tree-shaking).

### Why now

Canvas 2D redraws the entire map every frame with no batching. Every feature in this doc (bigger maps, zoom/pan, floating damage numbers, attack tracers, HP bars, particle effects, minimap) compounds the problem. Migrating later means rewriting everything twice.

### Layer Architecture

PixiJS uses a **scene graph** — a tree of containers. We render in layer order, each layer is a `PIXI.Container`:

```
PIXI.Application.stage
├── terrainLayer        ← hex tiles (cached as RenderTexture, re-render only on state change)
├── deployZoneLayer     ← build phase tinted hex overlays
├── fogLayer            ← semi-transparent overlay on non-visible hexes
├── unitLayer           ← pixel art unit sprites (sorted by depth each frame)
├── effectsLayer        ← damage numbers, attack tracers, death markers, HP bars
├── objectiveLayer      ← pulsing glow on objective hex
└── uiLayer             ← minimap, selection highlights, hovered hex
```

### How each ChackAttacc feature maps to PixiJS

| Feature (from this doc) | Layer | PixiJS implementation |
|------------------------|-------|----------------------|
| Isometric hex grid | terrainLayer | `hexToPixel()` feeds isometric coords → `PIXI.Sprite` positioned at those coords |
| Tile art | terrainLayer | `PIXI.Sprite` per hex, masked to hex shape with `PIXI.Graphics` polygon |
| Deployment zone tints | deployZoneLayer | `PIXI.Graphics` hex polygons with alpha fill |
| Fog of war | fogLayer | `PIXI.Graphics` dark hex polygons over non-visible hexes |
| Ghost markers | fogLayer | `PIXI.Sprite` with reduced alpha on last-known positions |
| Pixel art units | unitLayer | `PIXI.Sprite` from spritesheet, tinted with faction palette via `sprite.tint` |
| HP bars | effectsLayer | `PIXI.Graphics` green/red bar above each unit sprite |
| Damage numbers | effectsLayer | `PIXI.BitmapText` that floats up and fades (tweened) |
| Attack tracers | effectsLayer | `PIXI.Graphics` line that flashes and fades |
| Death markers | effectsLayer | `PIXI.Sprite` (skull/explosion) that fades over ~3s |
| Objective glow | objectiveLayer | `PIXI.Sprite` with pre-baked radial glow, alpha pulsed via ticker |
| Minimap | uiLayer | `PIXI.RenderTexture` of full map at tiny scale, updated on state change |
| Camera pan/zoom | stage | `stage.position` for pan, `stage.scale` for zoom |
| Viewport culling | all layers | `container.cullable = true` — PixiJS skips off-screen sprites automatically |
| Selection highlight | uiLayer | `PIXI.Graphics` hex outline, yellow stroke |
| Directive arrows | uiLayer | `PIXI.Graphics` dashed line + arrowhead |
| Particle effects | effectsLayer | `@pixi/particle-emitter` for explosions, smoke |

### Migration sequence

Each step produces a working game. No big-bang rewrite.

**Step 1: Foundation**
- Install `pixi.js` v8
- Create `renderer/pixi-app.ts` — init `PIXI.Application`, mount to DOM
- Create `renderer/layers.ts` — set up the layer container tree
- App.tsx creates PixiJS app instead of raw `<canvas>`
- Old Canvas 2D render loop still runs (both exist temporarily)

**Step 2: Terrain**
- Port hex tile rendering to terrainLayer
- `hexToPixel()` stays in `hex-render.ts` (same math, just feeds PixiJS sprite positions)
- Each hex = `PIXI.Sprite` with tile texture, masked to hex polygon
- Cache terrain as `PIXI.RenderTexture` (only re-render when map state changes)
- Remove `drawHex()` and `drawHexTile()` Canvas 2D calls

**Step 3: Units**
- Port unit rendering to unitLayer
- Each unit = `PIXI.Sprite` from pixel art spritesheet
- Faction palette via `sprite.tint = 0xF2C94C` (Engineers) or `0xD4845A` (Caravaners)
- Sort unitLayer children by screen Y (isometric depth) each frame
- Add HP bar as `PIXI.Graphics` child of each unit sprite
- Remove `drawUnit()` Canvas 2D calls

**Step 4: Fog + overlays**
- Port fog to fogLayer — `PIXI.Graphics` hex polygons with dark fill + alpha
- Port deployment zone tints to deployZoneLayer
- Port objective glow to objectiveLayer — pre-baked sprite, alpha pulsed
- Port selection highlight + directive arrows to uiLayer
- Remove `drawFog()`, `drawObjective()` Canvas 2D calls

**Step 5: Camera**
- Replace static centering camera with pan/zoom on `stage`
- WASD/arrow keys for pan, scroll wheel for zoom
- Edge-of-screen scrolling
- Clamp to map bounds
- `pixelToHex()` now accounts for stage transform (inverse of pan + zoom + isometric)

**Step 6: Input**
- PixiJS interaction: set `eventMode: 'static'` on hex sprites and unit sprites
- Click hex → placement (build) or selection (battle)
- Hover hex → highlight
- Right-click unit → remove (build phase)
- Remove manual pixel-to-hex coordinate math from App.tsx mouse handlers

**Step 7: Effects**
- Damage numbers: `PIXI.BitmapText` spawned at unit position, tweened upward + fade
- Attack tracers: `PIXI.Graphics` line between attacker/target, flash and fade
- Death markers: `PIXI.Sprite` at death position, fade over 3 seconds
- Kill feed: stays as React DOM overlay (not in PixiJS — HTML text is better for scrolling logs)

**Step 8: Minimap**
- Render full map to small `PIXI.RenderTexture` (terrain + unit dots + fog)
- Display as `PIXI.Sprite` in corner of screen
- Draw camera viewport rectangle on minimap
- Click minimap → set camera position
- Update on state change, not every frame

**Step 9: Cleanup**
- Delete all Canvas 2D renderer files (`hex-render.ts` draw functions, `unit-render.ts`, `fog-render.ts`, `objective-render.ts`)
- Remove `requestAnimationFrame` manual loop from App.tsx
- `hex-render.ts` keeps only `hexToPixel()` and `pixelToHex()` (pure math, no rendering)
- `asset-loader.ts` replaced by PixiJS `PIXI.Assets.load()` (built-in async loader with caching)
- `camera.ts` replaced by stage transform logic

### What stays the same

- `hexToPixel()` / `pixelToHex()` — pure math, decoupled from renderer
- Engine (`packages/engine/`) — completely untouched
- Zustand store — PixiJS reads from store, same as Canvas 2D did
- React UI components (HUD, shop, panels, menus) — stay as DOM overlays on top of PixiJS canvas
- Fred's multiplayer/NetworkManager — pushes to `setGameState`, renderer doesn't care about source

## Multiplayer Coordination (Fred's Domain)

### Fred's architecture

- New `packages/server/` — Express + Socket.io
- **Server-authoritative**: server holds real GameState, validates actions via engine functions, sends fog-filtered views to each client
- Client becomes thin input layer in online mode — actions route through NetworkManager instead of calling engine directly
- New `serialization.ts` in engine for JSON transport of Map/Set state
- Protocol types added to engine `types.ts`
- **No engine changes** for multiplayer — same functions, just called on server

### Why this doesn't conflict with our work

- Our changes are **purely client-side rendering** (renderer/, components/, styles)
- The store already mediates between engine and renderer — NetworkManager just becomes another state source
- Whether gameState comes from local engine or server WebSocket, the renderer reads it the same way
- **Confirmed**: NetworkManager uses existing `setGameState` for all state updates (game-start, state-update, battle-start, turn-result, round-end, game-over). No separate network state action. Same Zustand flow for local, AI, and online modes.

### Boundaries — do not touch

| File | Owner | Reason |
|------|-------|--------|
| `engine/src/types.ts` | Fred | Adding protocol types |
| `engine/src/serialization.ts` | Fred | New file for Map/Set JSON transport |
| `packages/server/` | Fred | Entire new package |
| `store/game-store.ts` (network actions) | Fred | Adding NetworkManager integration |

### Our safe zone

| Area | Safe to modify |
|------|---------------|
| `renderer/*` | All files — WebGL/PixiJS migration |
| `components/*` | All UI components |
| `styles/*` | All CSS |
| `App.tsx` | Render loop, canvas setup (not input routing) |
| `ChackAttacc.md` | This doc |

## Art Direction

### World Tone: Hyper-Expansion → Sudden Collapse

A global construction boom stopped overnight. Civilization built infrastructure at extreme speed — megaprojects, highways, rail, power grids — then something triggered an abrupt systemic failure. The landscape is full of unfinished systems.

Everywhere: highways that stop in midair, rail lines ending in empty plains, half-finished cities, giant cranes frozen in place.

- **Engineers** are trying to restart construction
- **Caravaners** use the unfinished infrastructure as mobile trade routes

**Visual tone**: dust, scaffolding, exposed steel, incomplete bridges, skeletal skyscrapers, abandoned construction zones.

### Terrain Palette: Ash & Ember

| Terrain | Hex | Description |
|---------|-----|-------------|
| Plains | #6A6A58 | Ashen olive, scorched |
| Forest | #3A4030 | Charred green |
| Mountain | #505058 | Dark iron ore |
| City | #7A6048 | Ember orange-grey |
| Objective | #C88A20 | Molten gold |
| Fog | #141418 | Near-black |

Mood: burned out, embers still glow. Darkest option, maximum grit. Infrastructure smoldering.

### Terrain Tile Style: Tiled Sprites (Geological to Urban)

Pre-made isometric tile sprites, 2-3 variants per terrain type. Human presence scales from none (mountain) to heavy (city):

- **Mountain**: raw stone, wind erosion marks, no human trace — pure geology
- **Plains**: flat packed dirt, scattered pebbles, maybe a cracked road stripe
- **Forest**: dense tree canopy, a forgotten road sign half-buried in roots
- **City**: multi-story concrete shells, hanging cables, rusted dumpster, graffiti
- **Objective**: command tower, antenna array, last working power source on the grid

### Unit Models: 3D Low-Poly, Vertex Colored

- **Poly count**: ~300-800 tris per unit
- **Shading**: vertex colored — colors baked into mesh vertices, no texture files
- **Style**: clean recognizable shapes, flat shaded, no smoothing. A tank has distinct hull, turret, barrel, treads
- **Faction identity**: vertex color regions swapped per faction (Engineers yellow/steel/black, Caravaners copper/turquoise/sand)

### Fog of War: Desaturated Fade

- Unseen hexes aren't fully hidden — drained of color and darkened
- **Never-seen**: fully dark (#141418)
- **Previously-seen**: terrain shape visible but ghostly/desaturated grey — units vanish
- **Currently visible**: full color
- Most informational approach — player always sees map shape, just not what's there now

### UI Chrome: Blueprint/Schematic

- Dark background with blue-white wireframe aesthetic
- Grid lines, technical labels, measurement marks
- Like looking at construction plans — fits the builder theme
- Monospace font, thin precise borders
- Panels feel like overlays on a schematic drawing

### Selection & Interaction: Blueprint Glow

- **Hover**: thin cyan wireframe outline, gentle pulse
- **Selected hex**: faint grid/crosshatch overlay
- **Move range**: cyan wireframe hex outlines
- **Attack target**: red wireframe outline
- Everything feels like a targeting system on a blueprint

### Background: Void Black

Pure dark. The map floats in nothing. Maximum focus on the game board. Like a war room table.

### Reference

- Kenney City Builder kit for isometric angle/tile sizing, but too plastic/vanilla
- Target: rougher, grittier, weathered, functional, lived-in
- Not neon, not clean

### Asset Pipeline: AI-Generated → Pre-Rendered Sprite Sheets

**3D models**: AI-generated (using Kenney kit as style reference), vertex colored, ~300-800 tris. 4 unit types × 2 faction skins = 8 model variants.

**Terrain tiles**: AI-generated isometric hex tile sprites. 4 terrain types × 2-3 variants each + 1 objective = ~13 tiles.

**Rendering pipeline**: 3D models rendered to 2D isometric sprite sheets at build time. Fixed camera angle, pre-baked lighting. Ship flat PNGs — zero runtime 3D cost, perfect PixiJS sprite batching.

**Pixel art icons**: 4 unit type icons for shop/HUD, palette-swapped at render time via `sprite.tint`.

## Implementation Team

### Dependency Graph

```
asset-forge (independent)
     ↓ (produces sprite sheets)
pixi-core ──────────────────────┐
     ↓                          ↓
terrain-fog              ui-blueprint
     ↓                          ↓
units-effects ←─────────────────┘
     ↓
replay-fx
```

### Agent 1: `pixi-core`

**Specialty**: PixiJS foundation, isometric math, camera system
**Blocks**: everything else (this is the scaffold)

**System prompt**: You are the rendering core agent. You set up the PixiJS v8 application, layer architecture, and isometric coordinate system. You replace the Canvas 2D render loop with PixiJS. You do NOT render terrain tiles, units, fog, or UI — other agents handle those. You provide the foundation they build on. Read ChackAttacc.md sections: "WebGL Migration via PixiJS" (foundation, layer architecture), "Isometric Rendering — Technical Plan", and "Camera & Viewport". Follow CLAUDE.md rules strictly.

**File scope**:
- CREATE: `renderer/pixi-app.ts`, `renderer/layers.ts`
- MODIFY: `renderer/hex-render.ts` (hexToPixel, pixelToHex only), `App.tsx` (replace canvas with PixiJS app, remove old render loop)
- DELETE: `renderer/camera.ts` (replaced by stage transforms)
- DO NOT TOUCH: `renderer/unit-render.ts`, `renderer/fog-render.ts`, `renderer/objective-render.ts`, `components/*`, `styles/*`, `store/*`, `engine/*`

**Tasks**:
1. Install `pixi.js` v8
2. Create `pixi-app.ts` — init PIXI.Application, mount to DOM, export app instance
3. Create `layers.ts` — terrainLayer, deployZoneLayer, fogLayer, unitLayer, effectsLayer, objectiveLayer, uiLayer
4. Rewrite `hexToPixel()` to isometric formula
5. Rewrite `pixelToHex()` as inverse (accounting for stage pan/zoom transform)
6. Replace `<canvas>` in App.tsx with PixiJS app view
7. Implement camera pan (WASD/arrows/edge scroll/drag) via stage.position
8. Implement camera zoom (scroll wheel) via stage.scale
9. Clamp camera to map bounds
10. Remove old `requestAnimationFrame` loop from App.tsx

---

### Agent 2: `terrain-fog`

**Specialty**: Terrain tile rendering, fog of war, deployment zones in PixiJS
**Depends on**: `pixi-core` (needs layers + isometric coords)

**System prompt**: You render the hex map. Terrain tiles go on terrainLayer as PIXI.Sprites masked to hex polygons. Fog goes on fogLayer as a desaturated fade (never-seen=dark, previously-seen=grey, visible=full color). Deployment zone tints go on deployZoneLayer. You load terrain tile sprite assets and apply the Ash & Ember palette. Read ChackAttacc.md sections: "Terrain Palette: Ash & Ember", "Terrain Tile Style", "Fog of War: Desaturated Fade", and PixiJS migration Steps 2 and 4. Follow CLAUDE.md rules strictly.

**File scope**:
- CREATE: `renderer/terrain-renderer.ts`, `renderer/fog-renderer.ts`
- MODIFY: `renderer/layers.ts` (if terrain caching logic needed)
- DELETE: old `drawHex()`, `drawHexTile()` from `hex-render.ts`, old `fog-render.ts`
- ASSETS: load terrain tile PNGs from `assets/tiles/`
- DO NOT TOUCH: `renderer/unit-render.ts`, `components/*`, `store/*`, `engine/*`

**Tasks**:
1. Load terrain tile sprites via PIXI.Assets (plains, forest, mountain, city, objective — 2-3 variants each)
2. For each hex: create PIXI.Sprite, position via hexToPixel(), mask to hex polygon (PIXI.Graphics)
3. Cache terrain as PIXI.RenderTexture (re-render only on map state change)
4. Apply Ash & Ember palette colors as fallback when tile sprites aren't available
5. Implement deployment zone tints on deployZoneLayer (alpha-filled hex polygons, faction-colored)
6. Implement desaturated fog: never-seen hexes = #141418 fill, previously-seen = desaturated + darkened, visible = full color
7. Port objective glow to objectiveLayer (pre-baked sprite, alpha pulse on ticker)
8. Delete old Canvas 2D fog/terrain rendering code

---

### Agent 3: `units-effects`

**Specialty**: Unit sprites, HP bars, damage numbers, attack tracers, death markers
**Depends on**: `pixi-core` (needs layers + isometric coords), `asset-forge` (needs sprite sheets)

**System prompt**: You render units and combat effects. Units go on unitLayer as PIXI.Sprites from pre-rendered sprite sheets, sorted by screen Y for depth. HP bars are PIXI.Graphics children of each unit sprite. Combat effects (damage numbers, attack tracers, death markers) go on effectsLayer. Faction palette is applied via sprite.tint. Read ChackAttacc.md sections: "Unit Models", "Factions", "Combat Feedback & Animations", and PixiJS migration Steps 3 and 7. Follow CLAUDE.md rules strictly.

**File scope**:
- CREATE: `renderer/unit-renderer.ts`, `renderer/effects-renderer.ts`, `renderer/hp-bar.ts`
- DELETE: old `renderer/unit-render.ts`, old `renderer/objective-render.ts`
- MODIFY: none outside renderer/
- ASSETS: load unit sprite sheets from `assets/units/`
- DO NOT TOUCH: `components/*`, `store/*`, `engine/*`

**Tasks**:
1. Load unit sprite sheets via PIXI.Assets (infantry, tank, scout, artillery — each faction variant)
2. Create PIXI.Sprite per unit, positioned via hexToPixel(), added to unitLayer
3. Sort unitLayer children by screen Y each frame (isometric depth order)
4. Apply faction tint: Engineers = 0xF2C94C, Caravaners = 0xD4845A
5. Create HP bar as PIXI.Graphics child of each unit sprite (green→yellow→red proportional to HP)
6. Implement floating damage numbers (PIXI.BitmapText, tween upward + fade)
7. Implement attack tracers (PIXI.Graphics line between attacker→target, flash and fade)
8. Implement death markers (PIXI.Sprite skull/explosion at death position, fade over 3-5s)
9. Delete old Canvas 2D unit rendering code

---

### Agent 4: `ui-blueprint`

**Specialty**: Blueprint/schematic UI, selection highlights, minimap, input system
**Depends on**: `pixi-core` (needs layers + camera for minimap/input)

**System prompt**: You build the UI layer. Blueprint/schematic styled React components (HUD, shop, panels) as DOM overlays. Selection highlights and minimap in PixiJS uiLayer. Input migration from manual canvas events to PixiJS interaction system. Read ChackAttacc.md sections: "UI Chrome: Blueprint/Schematic", "Selection & Interaction: Blueprint Glow", "Minimap", and PixiJS migration Steps 6 and 8. Follow CLAUDE.md rules strictly.

**File scope**:
- MODIFY: `components/BattleHUD.tsx`, `components/UnitShop.tsx`, `components/UnitInfoPanel.tsx`, `components/CommandMenu.tsx`, `components/DirectiveSelector.tsx`, `styles/components.css`
- CREATE: `renderer/minimap.ts`, `renderer/selection-renderer.ts`, `renderer/input-handler.ts`
- MODIFY: `App.tsx` (input migration — replace manual mouse handlers with PixiJS interaction)
- DO NOT TOUCH: `store/*`, `engine/*`, `renderer/terrain-renderer.ts`, `renderer/unit-renderer.ts`

**Tasks**:
1. Restyle all UI components to blueprint/schematic aesthetic (dark bg, cyan/white wireframe, monospace, thin borders, grid lines)
2. Implement selection highlight on uiLayer (cyan wireframe hex outline, gentle pulse)
3. Implement move range display (cyan wireframe hex outlines)
4. Implement attack target highlight (red wireframe outline)
5. Implement minimap: render full map to small PIXI.RenderTexture, show camera viewport rect, click to jump
6. Migrate input: set eventMode on hex/unit sprites, replace App.tsx mouse handler math
7. Implement enhanced UnitInfoPanel (visual HP bar, damage estimate, movement range indicator)
8. Background: void black (#000) behind PixiJS stage

---

### Agent 5: `replay-fx`

**Specialty**: Turn replay system, event timeline, animation sequencer
**Depends on**: `units-effects` (needs damage numbers, tracers, death markers to exist)

**System prompt**: You build the turn replay system. When the opponent ends their turn, the game plays a ~2-3s animated replay showing moves, attacks, kills, and captures before the current player's turn begins. You generate TurnEvent[] by diffing game state before/after executeTurn(), store in Zustand, and play through events via PixiJS ticker. Read ChackAttacc.md section: "Combat Feedback & Animations" (turn replay subsection). Follow CLAUDE.md rules strictly.

**File scope**:
- CREATE: `renderer/replay-sequencer.ts`
- MODIFY: `store/game-store.ts` (add turnReplayEvents state + actions), `components/BattleHUD.tsx` (skip button, replay state awareness)
- MODIFY: `renderer/effects-renderer.ts` (call existing effect functions during replay)
- DO NOT TOUCH: `engine/*`, `renderer/terrain-renderer.ts`, `renderer/pixi-app.ts`

**Tasks**:
1. Define TurnEvent type (move, attack, kill, capture) in a shared types location
2. In BattleHUD handleEndTurn: snapshot state before executeTurn, diff after, generate TurnEvent[]
3. Store events in Zustand: `turnReplayEvents`, `isReplayPlaying`
4. Build replay sequencer: PixiJS ticker plays events sequentially (move tweens, attack tracers, damage numbers, death markers, city capture flashes)
5. Parallel events for directive moves, sequential for direct commands
6. Skip button (Space or click) jumps to final state immediately
7. Replay blocks input until complete, then enables current player's turn

---

### Agent 6: `asset-forge`

**Specialty**: AI art generation prompts, sprite sheet pipeline, asset organization
**Depends on**: nothing (fully independent)

**System prompt**: You produce all visual assets for the game. You write detailed AI image generation prompts following the art direction in ChackAttacc.md. You create scripts to process generated images into game-ready sprite sheets. You organize assets in the project directory. You use the Kenney City Builder kit as a style/sizing reference. Read ChackAttacc.md sections: "Factions", "Unit Icons", "Asset Pipeline", "Terrain Tile Style", "Art Direction". Follow CLAUDE.md rules strictly.

**File scope**:
- CREATE: `assets/` directory structure, `scripts/render-sprites.ts` (if build-time processing needed)
- CREATE: `assets/prompts/` — text files with AI generation prompts for each asset
- CREATE: `assets/units/`, `assets/tiles/`, `assets/icons/`, `assets/effects/`
- DO NOT TOUCH: any source code in `src/`, `engine/`, `store/`, `components/`

**Tasks**:
1. Create `assets/` directory structure (units/, tiles/, icons/, effects/)
2. Write AI generation prompts for 4 unit types × 2 factions (8 model prompts) — referencing Kenney style, vertex-colored low-poly, Ash & Ember world
3. Write AI generation prompts for terrain tiles (plains, forest, mountain, city, objective — 2-3 variants each, isometric hex shape)
4. Write AI generation prompts for 4 pixel art unit icons (infantry, tank, scout, artillery)
5. Write prompts for effect sprites (explosion/death marker, damage number font)
6. Create sprite sheet packing script (if needed — arrange rendered sprites into atlas)
7. Document asset naming conventions and directory layout

### Execution Order

```
Phase 0 (parallel):  asset-forge  |  pixi-core
Phase 1 (parallel):  terrain-fog  |  ui-blueprint     (after pixi-core)
Phase 2:             units-effects                     (after pixi-core + asset-forge)
Phase 3:             replay-fx                         (after units-effects)
```

Each agent works in its own git worktree branch. Merge order follows dependency graph.

## Resolved Decisions

- **Default zoom**: ~50% of map visible. See your half, pan to see enemy territory.
- **Minimap**: Top-right corner.
- **Elevation**: Separate property per hex (0-3), independent of terrain type.
- **Animations**: Animated replay of opponent's turn plays before yours starts. Skippable.
- **First-mover**: Alternating — P1 goes first in odd rounds, P2 in even rounds.
- **NetworkManager**: Uses existing `setGameState` — renderer fully decoupled from state source.
- **Rendering**: PixiJS v8 (WebGL-backed 2D renderer).
- **Camera angle**: True isometric (30°).

## Open Questions

None — all resolved. See Resolved Decisions above.
