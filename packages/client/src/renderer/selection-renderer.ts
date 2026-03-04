import { Graphics } from 'pixi.js';
import type { CubeCoord, Unit } from '@hexwar/engine';
import { hexToKey } from '@hexwar/engine';
import { hexToPixel } from './hex-render';
import { HEX_SIZE } from './constants';
import { uiLayer } from './layers';

let selectionGraphics: Graphics | null = null;

function drawHexOutline(g: Graphics, cx: number, cy: number, size: number, color: number, width: number, alpha: number): void {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(cx + size * Math.cos(angle));
    points.push(cy + size * Math.sin(angle));
  }
  g.poly(points, true);
  g.stroke({ color, width, alpha });
}

export function renderSelectionHighlights(
  selectedUnit: Unit | null,
  hoveredHex: CubeCoord | null,
  highlightedHexes: Set<string>,
  highlightMode: 'move' | 'attack' | 'none',
  allHexes: CubeCoord[],
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
    const color = highlightMode === 'move' ? 0x00d4ff : 0xff4444;
    const fillAlpha = highlightMode === 'move' ? 0.08 : 0.1;

    for (const hex of allHexes) {
      const key = hexToKey(hex);
      if (highlightedHexes.has(key)) {
        const { x, y } = hexToPixel(hex, HEX_SIZE);
        // Subtle fill
        const fillPoints: number[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 180) * (60 * i);
          fillPoints.push(x + HEX_SIZE * Math.cos(angle));
          fillPoints.push(y + HEX_SIZE * Math.sin(angle));
        }
        selectionGraphics.poly(fillPoints, true);
        selectionGraphics.fill({ color, alpha: fillAlpha });
        // Wireframe outline
        drawHexOutline(selectionGraphics, x, y, HEX_SIZE, color, 1.5, 0.7);
      }
    }
  }

  // Hovered hex: thin white wireframe outline
  if (hoveredHex) {
    const { x, y } = hexToPixel(hoveredHex, HEX_SIZE);
    drawHexOutline(selectionGraphics, x, y, HEX_SIZE, 0xffffff, 1.5, 0.6);
  }

  // Selected unit hex: cyan wireframe outline
  if (selectedUnit) {
    const { x, y } = hexToPixel(selectedUnit.position, HEX_SIZE);
    drawHexOutline(selectionGraphics, x, y, HEX_SIZE, 0x00d4ff, 2.5, 0.9);
  }

  uiLayer.addChild(selectionGraphics);
}
