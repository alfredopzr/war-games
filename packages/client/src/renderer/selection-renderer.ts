import { Graphics } from 'pixi.js';
import type { CubeCoord, Unit } from '@hexwar/engine';
import { hexToKey } from '@hexwar/engine';
import { hexToPixel, hexPoints } from './hex-render';
import { HEX_SIZE } from './constants';
import { uiLayer } from './layers';

let selectionGraphics: Graphics | null = null;

function drawHexOutline(g: Graphics, cx: number, cy: number, size: number, color: number, width: number, alpha: number): void {
  const points = hexPoints(cx, cy, size);
  g.poly(points, true);
  g.stroke({ color, width, alpha });
}

export function renderSelectionHighlights(
  selectedUnit: Unit | null,
  hoveredHex: CubeCoord | null,
  highlightedHexes: Set<string>,
  highlightMode: 'move' | 'attack' | 'none',
  allHexes: CubeCoord[],
  elevationMap: Map<string, number>,
): void {
  // Remove previous selection graphics
  if (selectionGraphics) {
    uiLayer.removeChild(selectionGraphics);
    selectionGraphics.destroy();
    selectionGraphics = null;
  }

  selectionGraphics = new Graphics();

  // Move/attack range hex outlines
  if (highlightedHexes.size > 0 && highlightMode !== 'none') {
    const color = highlightMode === 'move' ? 0xe8e4d8 : 0x9a4a3a;
    const fillAlpha = highlightMode === 'move' ? 0.08 : 0.1;

    for (const hex of allHexes) {
      const key = hexToKey(hex);
      if (highlightedHexes.has(key)) {
        const elev = elevationMap.get(key) ?? 0;
        const { x, y } = hexToPixel(hex, HEX_SIZE, elev);
        const fillPts = hexPoints(x, y, HEX_SIZE);
        selectionGraphics.poly(fillPts, true);
        selectionGraphics.fill({ color, alpha: fillAlpha });
        drawHexOutline(selectionGraphics, x, y, HEX_SIZE, color, 1.5, 0.7);
      }
    }
  }

  // Hovered hex: thin white wireframe outline
  if (hoveredHex) {
    const key = hexToKey(hoveredHex);
    const elev = elevationMap.get(key) ?? 0;
    const { x, y } = hexToPixel(hoveredHex, HEX_SIZE, elev);
    drawHexOutline(selectionGraphics, x, y, HEX_SIZE, 0xffffff, 1.5, 0.6);
  }

  // Selected unit hex: cyan wireframe outline
  if (selectedUnit) {
    const key = hexToKey(selectedUnit.position);
    const elev = elevationMap.get(key) ?? 0;
    const { x, y } = hexToPixel(selectedUnit.position, HEX_SIZE, elev);
    drawHexOutline(selectionGraphics, x, y, HEX_SIZE, 0xe8e4d8, 2.5, 0.9);
  }

  uiLayer.addChild(selectionGraphics);
}
