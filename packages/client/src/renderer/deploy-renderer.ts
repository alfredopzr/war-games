import { Graphics } from 'pixi.js';
import type { GameState, PlayerId } from '@hexwar/engine';
import { getAllHexes, hexToKey } from '@hexwar/engine';
import { deployZoneLayer } from './layers';
import { hexToPixel, hexPoints } from './hex-render';
import { HEX_SIZE } from './constants';

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
    // Deploy zones always have elevation 0
    const { x, y } = hexToPixel(hex, HEX_SIZE);
    const pts = hexPoints(x, y, HEX_SIZE);

    if (friendlyKeys.has(hexKey)) {
      const tint = currentPlayerView === 'player1' ? 0x4a5a3a : 0x6a3a2a;
      const stroke = currentPlayerView === 'player1' ? 0x8a9a7a : 0xaa7a6a;
      g.poly(pts, true);
      g.fill({ color: tint, alpha: 0.45 });
      g.stroke({ color: stroke, width: 2.5 });
    } else if (enemyKeys.has(hexKey)) {
      const tint = currentPlayerView === 'player1' ? 0x5a2a1a : 0x2a3a1a;
      const stroke = currentPlayerView === 'player1' ? 0x8a5a4a : 0x6a7a5a;
      g.poly(pts, true);
      g.fill({ color: tint, alpha: 0.35 });
      g.stroke({ color: stroke, width: 1.5 });
    }
  }

  deployZoneLayer.addChild(g);
}
