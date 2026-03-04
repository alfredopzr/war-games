import { Graphics } from 'pixi.js';
import type { GameState, CubeCoord } from '@hexwar/engine';
import { getAllHexes, hexToKey } from '@hexwar/engine';
import { terrainLayer, objectiveLayer } from './layers';
import { hexToPixel, hexPoints } from './hex-render';
import { HEX_SIZE, ASH_EMBER_TERRAIN, OBJECTIVE_COLOR, PLAYER_COLORS, ELEVATION_PX } from './constants';

/** Parse CSS hex color string to numeric value. */
function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Darken a 0xRRGGBB color by a factor (0–1). */
function darkenColor(color: number, factor: number): number {
  const r = ((color >> 16) & 0xff) * factor;
  const g = ((color >> 8) & 0xff) * factor;
  const b = (color & 0xff) * factor;
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

/** Draw isometric side faces for an elevated hex. */
function drawSideFaces(
  g: Graphics,
  cx: number,
  cy: number,
  elevation: number,
  fillColor: number,
): void {
  const sideColor = darkenColor(fillColor, 0.6);
  const drop = elevation * ELEVATION_PX;

  // Get top-face vertex positions
  const top = hexPoints(cx, cy, HEX_SIZE);

  // Front-facing edges (screen-bottom): vertex 0→1 (right wall), 1→2 (front wall), 2→3 (left wall)
  const edges = [[0, 1], [1, 2], [2, 3]];

  for (const [a, b] of edges) {
    const ax = top[a! * 2]!;
    const ay = top[a! * 2 + 1]!;
    const bx = top[b! * 2]!;
    const by = top[b! * 2 + 1]!;

    // Quad: top-a, top-b, bottom-b, bottom-a
    g.poly([ax, ay, bx, by, bx, by + drop, ax, ay + drop], true);
    g.fill({ color: sideColor, alpha: 1 });
  }
}

/** Render all terrain hexes, objective glow, and city ownership borders. */
export function renderTerrain(state: GameState): void {
  terrainLayer.removeChildren();
  objectiveLayer.removeChildren();

  const allHexes = getAllHexes(state.map.gridSize);

  // Sort by base screen Y (back-to-front) for correct elevation overlap
  const sortedHexes = [...allHexes].sort((a: CubeCoord, b: CubeCoord) => {
    return hexToPixel(a, HEX_SIZE).y - hexToPixel(b, HEX_SIZE).y;
  });

  const g = new Graphics();
  for (const hex of sortedHexes) {
    const hexKey = hexToKey(hex);
    const terrain = state.map.terrain.get(hexKey) ?? 'plains';
    const elev = state.map.elevation.get(hexKey) ?? 0;
    const fill = ASH_EMBER_TERRAIN[terrain] ?? 0x6A6A58;
    const { x, y } = hexToPixel(hex, HEX_SIZE, elev);

    // Side faces first (behind top face)
    if (elev > 0) {
      drawSideFaces(g, x, y, elev, fill);
    }

    // Top face
    const pts = hexPoints(x, y, HEX_SIZE);
    g.poly(pts, true);
    g.fill({ color: fill, alpha: 1 });
    g.stroke({ color: 0x0a0a10, width: 1 });
  }
  terrainLayer.addChild(g);

  // Objective hex golden glow
  const objKey = hexToKey(state.map.centralObjective);
  const objElev = state.map.elevation.get(objKey) ?? 0;
  const objPixel = hexToPixel(state.map.centralObjective, HEX_SIZE, objElev);

  const objG = new Graphics();
  const objPts = hexPoints(objPixel.x, objPixel.y, HEX_SIZE);
  objG.poly(objPts, true);
  objG.fill({ color: OBJECTIVE_COLOR, alpha: 0.6 });

  const outerPts = hexPoints(objPixel.x, objPixel.y, HEX_SIZE + 2);
  objG.poly(outerPts, true);
  objG.fill({ color: 0x000000, alpha: 0 });
  objG.stroke({ color: OBJECTIVE_COLOR, width: 2 });
  objectiveLayer.addChild(objG);

  // City ownership borders
  if (state.cityOwnership) {
    const cityG = new Graphics();
    for (const hex of allHexes) {
      const key = hexToKey(hex);
      const owner = state.cityOwnership.get(key);
      if (owner) {
        const elev = state.map.elevation.get(key) ?? 0;
        const { x, y } = hexToPixel(hex, HEX_SIZE, elev);
        const ownerColor = parseColor(PLAYER_COLORS[owner].light);
        const pts = hexPoints(x, y, HEX_SIZE);
        cityG.poly(pts, true);
        cityG.fill({ color: 0x000000, alpha: 0 });
        cityG.stroke({ color: ownerColor, width: 3 });
      }
    }
    terrainLayer.addChild(cityG);
  }
}
