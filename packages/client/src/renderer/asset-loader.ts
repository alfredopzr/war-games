import type { CubeCoord, TerrainType } from '@hexwar/engine';

// Plains: flat grass only — no trees, clearly distinct from forest
import grassTile1 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_01.png';
import grassTile2 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_02.png';
import grassTile3 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_03.png';
import grassTile4 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_04.png';

// Forest: tree variants — visually distinct from flat grass
import forestTile1 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_05.png';
import forestTile2 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_06.png';
import forestTile3 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_07.png';
import forestTile4 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_08.png';
import forestTile5 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_09.png';

// Mountain: consistent gray stone — fewer variants for visual clarity
import stoneTile1 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Stone/stone_01.png';
import stoneTile2 from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Stone/stone_02.png';

// City: modern building tiles
import cityTileLarge from '../assets/kenney_hexagon-pack/PNG/Tiles/Modern/modern_largeBuilding.png';
import cityTileSmall from '../assets/kenney_hexagon-pack/PNG/Tiles/Modern/modern_houseSmall.png';

const TERRAIN_TILE_MAP: Record<TerrainType, string[]> = {
  plains: [grassTile1, grassTile2, grassTile3, grassTile4],
  forest: [forestTile1, forestTile2, forestTile3, forestTile4, forestTile5],
  mountain: [stoneTile1, stoneTile2],
  city: [cityTileLarge, cityTileSmall],
};

const loadedImages = new Map<string, HTMLImageElement>();
export let tilesReady = false;

export async function loadAllTiles(): Promise<void> {
  const allPaths = Object.values(TERRAIN_TILE_MAP).flat();
  const unique = [...new Set(allPaths)];

  await Promise.all(
    unique.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            loadedImages.set(src, img);
            resolve();
          };
          img.onerror = () => resolve(); // fail gracefully, fallback to solid color
          img.src = src;
        }),
    ),
  );

  tilesReady = true;
}

export function getTileImage(terrain: TerrainType, coord: CubeCoord): HTMLImageElement | null {
  if (!tilesReady) return null;
  const variants = TERRAIN_TILE_MAP[terrain];
  if (!variants || variants.length === 0) return null;
  const idx = Math.abs((coord.q * 7 + coord.r * 13) % variants.length);
  const src = variants[idx] ?? variants[0];
  if (!src) return null;
  return loadedImages.get(src) ?? null;
}
