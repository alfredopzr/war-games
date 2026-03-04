import { Graphics, Container, Application } from 'pixi.js';
import type { GameState } from '@hexwar/engine';
import { getAllHexes, hexToKey } from '@hexwar/engine';
import { hexToPixel } from './hex-render';
import { ASH_EMBER_TERRAIN, OBJECTIVE_COLOR } from './constants';
import { uiLayer } from './layers';

const MINIMAP_WIDTH = 150;
const MINIMAP_HEIGHT = 100;
const MINIMAP_PADDING = 10;
const MINIMAP_BG = 0x0a0e14;
const MINIMAP_BORDER = 0x00d4ff;
const MINIMAP_BG_ALPHA = 0.85;

let minimapContainer: Container | null = null;

interface HexBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeHexBounds(hexes: { x: number; y: number }[]): HexBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of hexes) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}

export function renderMinimap(
  state: GameState,
  visibleHexes: Set<string>,
  stage: Container,
  app: Application,
): void {
  // Remove old minimap
  if (minimapContainer) {
    uiLayer.removeChild(minimapContainer);
    minimapContainer.destroy({ children: true });
    minimapContainer = null;
  }

  minimapContainer = new Container();
  minimapContainer.label = 'minimap';

  const allHexes = getAllHexes(state.map.gridSize);
  const hexSize = 32; // matches HEX_SIZE

  // Pre-compute pixel positions
  const hexPixels = allHexes.map((hex) => ({
    hex,
    key: hexToKey(hex),
    ...hexToPixel(hex, hexSize),
  }));

  const bounds = computeHexBounds(hexPixels);
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;

  const scaleX = (MINIMAP_WIDTH - 10) / worldW;
  const scaleY = (MINIMAP_HEIGHT - 10) / worldH;
  const scale = Math.min(scaleX, scaleY);

  // Position in screen space (top-right)
  // The uiLayer follows the stage transform, so we need to position the minimap
  // accounting for stage pan/zoom to keep it fixed on screen
  const stageScale = stage.scale.x;
  const screenW = app.screen.width;
  const minimapScreenX = screenW - MINIMAP_WIDTH - MINIMAP_PADDING;
  const minimapScreenY = MINIMAP_PADDING;

  // Convert screen position to world position (inverse of stage transform)
  minimapContainer.position.set(
    (minimapScreenX - stage.position.x) / stageScale,
    (minimapScreenY - stage.position.y) / stageScale,
  );
  minimapContainer.scale.set(1 / stageScale);

  // Background panel
  const bg = new Graphics();
  bg.roundRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT, 2);
  bg.fill({ color: MINIMAP_BG, alpha: MINIMAP_BG_ALPHA });
  bg.stroke({ color: MINIMAP_BORDER, width: 1, alpha: 0.6 });
  minimapContainer.addChild(bg);

  // Draw hex dots
  const dotsGraphics = new Graphics();
  const objectiveKey = hexToKey(state.map.centralObjective);

  for (const hp of hexPixels) {
    const mx = (hp.x - bounds.minX) * scale + 5;
    const my = (hp.y - bounds.minY) * scale + 5;
    const dotSize = Math.max(1.5, scale * hexSize * 0.5);

    const terrain = state.map.terrain.get(hp.key) ?? 'plains';
    let color = ASH_EMBER_TERRAIN[terrain] ?? 0x6A6A58;

    if (hp.key === objectiveKey) {
      color = OBJECTIVE_COLOR;
    }

    const isVisible = visibleHexes.has(hp.key);
    const alpha = isVisible ? 0.9 : 0.3;

    dotsGraphics.circle(mx, my, dotSize);
    dotsGraphics.fill({ color, alpha });
  }
  minimapContainer.addChild(dotsGraphics);

  // Draw unit dots
  const unitDots = new Graphics();
  const p1Color = 0x4488cc;
  const p2Color = 0xcc4444;

  for (const unit of state.players.player1.units) {
    const { x, y } = hexToPixel(unit.position, hexSize);
    const mx = (x - bounds.minX) * scale + 5;
    const my = (y - bounds.minY) * scale + 5;
    unitDots.circle(mx, my, 2);
    unitDots.fill({ color: p1Color, alpha: 1 });
  }

  for (const unit of state.players.player2.units) {
    const key = hexToKey(unit.position);
    if (!visibleHexes.has(key)) continue;
    const { x, y } = hexToPixel(unit.position, hexSize);
    const mx = (x - bounds.minX) * scale + 5;
    const my = (y - bounds.minY) * scale + 5;
    unitDots.circle(mx, my, 2);
    unitDots.fill({ color: p2Color, alpha: 1 });
  }
  minimapContainer.addChild(unitDots);

  // Camera viewport rectangle
  const vpGraphics = new Graphics();
  const vpLeft = (-stage.position.x / stageScale - bounds.minX) * scale + 5;
  const vpTop = (-stage.position.y / stageScale - bounds.minY) * scale + 5;
  const vpW = (app.screen.width / stageScale) * scale;
  const vpH = (app.screen.height / stageScale) * scale;

  vpGraphics.rect(vpLeft, vpTop, vpW, vpH);
  vpGraphics.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
  minimapContainer.addChild(vpGraphics);

  uiLayer.addChild(minimapContainer);
}
