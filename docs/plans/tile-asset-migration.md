# Tile Asset Migration Plan

Replace solid-color hex rendering with Kenney hexagon-pack tile images.

## Asset Mapping

| TerrainType | Tile Source | Notes |
|---|---|---|
| `plains` | `Terrain/Grass/grass_01.png`, `grass_02.png`, `grass_03.png` | 2-3 variants for visual variety, seeded by coord hash |
| `forest` | `Terrain/Grass/grass_05.png`, `grass_09.png` (tree variants) | Pick grass tiles that already have trees baked in |
| `mountain` | `Terrain/Stone/stone_01.png`, `stone_02.png`, `stone_03.png` | 2-3 variants |
| `city` | `Tiles/Modern/modern_largeBuilding.png` (large), `modern_houseSmall.png` (small) | Isometric — needs Y offset and draw-order sorting |

All assets live in `packages/client/src/assets/kenney_hexagon-pack/PNG/`.

## Steps

### 1. Create asset loader (`packages/client/src/renderer/asset-loader.ts`)

- Define `TERRAIN_TILE_MAP: Record<TerrainType, string[]>` mapping each terrain type to an array of image import paths.
- Use Vite static imports (`import grassTile1 from '...'`) for each tile PNG — this lets Vite hash and bundle them.
- Create `loadAllTiles(): Promise<void>` that creates `HTMLImageElement` for each and waits for all `onload` promises.
- Expose `getTileImage(terrain: TerrainType, coord: CubeCoord): HTMLImageElement` — picks a deterministic variant using a simple coord hash (`(coord.q * 7 + coord.r * 13) % variants.length`) so the same hex always gets the same tile.
- Export a `tilesReady: boolean` flag or similar for the render loop to check.

### 2. Add `drawHexTile()` to `hex-render.ts`

- New function signature:
  ```ts
  export function drawHexTile(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    centerX: number,
    centerY: number,
    size: number,
  ): void
  ```
- Compute draw dimensions from `HEX_SIZE` — the Kenney tiles are ~120x140px, so scale factor is roughly `(size * 2) / tileWidth`.
- Use `ctx.drawImage(img, x - w/2, y - h/2, w, h)` centered on the hex.
- For city tiles (isometric buildings): apply a Y offset of about `-size * 0.15` so the building base aligns with the hex center.
- Do NOT draw a stroke — the tiles include their own hex border.

### 3. Update render loop in `App.tsx`

- Import `loadAllTiles`, `getTileImage`, `tilesReady` from asset-loader.
- Call `loadAllTiles()` during initialization (before starting the game loop). Show a loading indicator until ready.
- In the terrain drawing section (currently ~line 272-304), replace:
  ```ts
  drawHex(ctx, px, py, HEX_SIZE, TERRAIN_COLORS[terrain], TERRAIN_BORDER_COLORS[terrain]);
  ```
  with:
  ```ts
  const tileImg = getTileImage(terrain, hex.coord);
  drawHexTile(ctx, tileImg, px, py, HEX_SIZE);
  ```
- **Draw-order change**: sort hexes by `r` coordinate (top to bottom) before drawing so isometric building tiles overlap correctly. Currently the iteration order comes from the map data — wrap it in a sorted copy.
- Keep all overlay draws (`drawHex` for highlights, fog, selection) unchanged — they still use semi-transparent solid fills on top.

### 4. Keep `TERRAIN_COLORS` as fallback

- Don't delete `TERRAIN_COLORS` or `TERRAIN_BORDER_COLORS` from `constants.ts`.
- If `tilesReady` is false, fall back to the current solid-color rendering.
- Useful for tests, SSR, or if an image fails to load.

### 5. Loading gate in UI

- Add a simple loading state in `App.tsx` (or the start menu component) that shows "Loading assets..." until `loadAllTiles()` resolves.
- This prevents a flash of missing tiles on first frame.

## Files Changed

| File | Change |
|---|---|
| `packages/client/src/renderer/asset-loader.ts` | **New** — tile loading, mapping, and lookup |
| `packages/client/src/renderer/hex-render.ts` | Add `drawHexTile()` function |
| `packages/client/src/App.tsx` | Import loader, add loading gate, replace terrain draw calls, sort draw order |
| `packages/client/src/renderer/constants.ts` | Keep existing colors (no changes needed) |

## Files NOT Changed

- `packages/engine/` — no engine changes, terrain types and logic stay the same.
- `packages/client/src/renderer/unit-render.ts` — units still draw as circles on top.
- `packages/client/src/renderer/fog-render.ts` — fog overlays unchanged.
- `packages/client/src/renderer/objective-render.ts` — objective rendering unchanged.

## Gotchas

1. **Isometric perspective on buildings**: City tiles stick up above the hex boundary. Draw hexes in row order (ascending `r`) so front buildings overlap back ones. Apply a small negative Y offset for building tiles.
2. **Tile sizing**: Kenney tiles are 120x140px. The game uses `HEX_SIZE = 40` (center to corner). Scale factor: `(HEX_SIZE * 2) / 120` for width. May need slight tweaking per tile category.
3. **Vite imports**: Use static imports (not dynamic `import()`) so Vite can resolve and bundle the PNGs at build time. This means the import list is hardcoded but that's fine for a fixed set of tiles.
4. **No engine coupling**: The asset loader maps `TerrainType` strings to images. If new terrain types are added in the engine, add corresponding entries in the tile map.
