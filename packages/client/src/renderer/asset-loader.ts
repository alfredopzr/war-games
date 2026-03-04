import type { TerrainType } from '@hexwar/engine';

import grassPlains from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_06.png';
import grassForest from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Grass/grass_13.png';
import dirtMountain from '../assets/kenney_hexagon-pack/PNG/Tiles/Terrain/Dirt/dirt_18.png';
import modernCity from '../assets/kenney_hexagon-pack/PNG/Tiles/Modern/modern_villa.png';
import modernSkyscraper from '../assets/kenney_hexagon-pack/PNG/Tiles/Modern/modern_skyscraper.png';

const TERRAIN_TILE_MAP: Record<TerrainType, string> = {
  plains: grassPlains,
  forest: grassForest,
  mountain: dirtMountain,
  city: modernCity,
};

const OBJECTIVE_TILE = modernSkyscraper;

const loadedImages = new Map<string, HTMLImageElement>();
export let tilesReady = false;

export async function loadAllTiles(): Promise<void> {
  const allPaths = [...Object.values(TERRAIN_TILE_MAP), OBJECTIVE_TILE];
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
          img.onerror = () => resolve();
          img.src = src;
        }),
    ),
  );

  tilesReady = true;
}

export function getTileImage(terrain: TerrainType): HTMLImageElement | null {
  if (!tilesReady) return null;
  const src = TERRAIN_TILE_MAP[terrain];
  if (!src) return null;
  return loadedImages.get(src) ?? null;
}

export function getObjectiveTileImage(): HTMLImageElement | null {
  if (!tilesReady) return null;
  return loadedImages.get(OBJECTIVE_TILE) ?? null;
}
