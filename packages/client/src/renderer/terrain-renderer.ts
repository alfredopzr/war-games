import { Graphics } from 'pixi.js';
import type { GameState, CubeCoord } from '@hexwar/engine';
import { getAllHexes, hexToKey } from '@hexwar/engine';
import { terrainLayer, objectiveLayer } from './layers';
import { hexToPixel } from './hex-render';
import { HEX_SIZE, ASH_EMBER_TERRAIN, OBJECTIVE_COLOR, PLAYER_COLORS } from './constants';

/** Build a flat-top hexagon point array centered at (cx, cy). */
function hexPoints(cx: number, cy: number, size: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(cx + size * Math.cos(angle));
    points.push(cy + size * Math.sin(angle));
  }
  return points;
}

/** Parse CSS hex color string to numeric value. */
function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Render all terrain hexes, objective glow, and city ownership borders. */
export function renderTerrain(state: GameState): void {
  terrainLayer.removeChildren();
  objectiveLayer.removeChildren();

  const allHexes = getAllHexes(state.map.gridSize);
  const sortedHexes = [...allHexes].sort((a: CubeCoord, b: CubeCoord) => a.r - b.r);

  // Single Graphics for all terrain hexes
  const g = new Graphics();
  for (const hex of sortedHexes) {
    const { x, y } = hexToPixel(hex, HEX_SIZE);
    const hexKey = hexToKey(hex);
    const terrain = state.map.terrain.get(hexKey) ?? 'plains';
    const fill = ASH_EMBER_TERRAIN[terrain] ?? 0x6A6A58;

    const pts = hexPoints(x, y, HEX_SIZE);
    g.poly(pts, true);
    g.fill({ color: fill, alpha: 1 });
    g.stroke({ color: 0x0a0a10, width: 1 });
  }
  terrainLayer.addChild(g);

  // Objective hex golden glow
  const objG = new Graphics();
  const objPixel = hexToPixel(state.map.centralObjective, HEX_SIZE);

  // Fill with objective color
  const objPts = hexPoints(objPixel.x, objPixel.y, HEX_SIZE);
  objG.poly(objPts, true);
  objG.fill({ color: OBJECTIVE_COLOR, alpha: 0.6 });

  // Golden border
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
        const { x, y } = hexToPixel(hex, HEX_SIZE);
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
