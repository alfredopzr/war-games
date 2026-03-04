import { Graphics } from 'pixi.js';
import type { GameState, PlayerId } from '@hexwar/engine';
import { getAllHexes, hexToKey } from '@hexwar/engine';
import { deployZoneLayer } from './layers';
import { hexToPixel } from './hex-render';
import { HEX_SIZE } from './constants';

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

/** Render deployment zone overlays during build phase. */
export function renderDeployZones(state: GameState, currentPlayerView: PlayerId): void {
  deployZoneLayer.removeChildren();

  if (state.phase !== 'build') return;

  const friendlyZone = currentPlayerView === 'player1'
    ? state.map.player1Deployment
    : state.map.player2Deployment;
  const enemyZone = currentPlayerView === 'player1'
    ? state.map.player2Deployment
    : state.map.player1Deployment;

  const friendlyKeys = new Set<string>();
  for (const h of friendlyZone) {
    friendlyKeys.add(hexToKey(h));
  }

  const enemyKeys = new Set<string>();
  for (const h of enemyZone) {
    enemyKeys.add(hexToKey(h));
  }

  const allHexes = getAllHexes(state.map.gridSize);
  const g = new Graphics();

  for (const hex of allHexes) {
    const hexKey = hexToKey(hex);
    const { x, y } = hexToPixel(hex, HEX_SIZE);
    const pts = hexPoints(x, y, HEX_SIZE);

    if (friendlyKeys.has(hexKey)) {
      const tint = currentPlayerView === 'player1' ? 0x1e5ab4 : 0xb41e1e;
      const stroke = currentPlayerView === 'player1' ? 0x50a0ff : 0xff5050;
      g.poly(pts, true);
      g.fill({ color: tint, alpha: 0.45 });
      g.stroke({ color: stroke, width: 2.5 });
    } else if (enemyKeys.has(hexKey)) {
      const tint = currentPlayerView === 'player1' ? 0x8c1e1e : 0x1e46a0;
      const stroke = currentPlayerView === 'player1' ? 0xc83c3c : 0x3c78dc;
      g.poly(pts, true);
      g.fill({ color: tint, alpha: 0.35 });
      g.stroke({ color: stroke, width: 1.5 });
    }
  }

  deployZoneLayer.addChild(g);
}
