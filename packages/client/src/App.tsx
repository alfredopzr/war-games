import { useRef, useEffect, useCallback, useState, type ReactElement } from 'react';
import {
  createGame, placeUnit, startBattlePhase,
  getAllHexes, hexToKey,
} from '@hexwar/engine';
import type { GameState, CubeCoord } from '@hexwar/engine';
import { HEX_SIZE, TERRAIN_COLORS, TERRAIN_BORDER_COLORS } from './renderer/constants';
import { hexToPixel, drawHex } from './renderer/hex-render';
import { drawUnit } from './renderer/unit-render';
import { createCamera } from './renderer/camera';

function initGameState(): GameState {
  const state = createGame(42);

  // Place test units for player1 in deployment zone
  const p1 = state.map.player1Deployment;
  placeUnit(state, 'player1', 'infantry', p1[0]!, 'advance');
  placeUnit(state, 'player1', 'tank', p1[2]!, 'advance');
  placeUnit(state, 'player1', 'artillery', p1[4]!, 'support');
  placeUnit(state, 'player1', 'recon', p1[6]!, 'scout');

  // Place test units for player2 in deployment zone
  const p2 = state.map.player2Deployment;
  placeUnit(state, 'player2', 'infantry', p2[1]!, 'advance');
  placeUnit(state, 'player2', 'tank', p2[3]!, 'advance');
  placeUnit(state, 'player2', 'artillery', p2[5]!, 'support');
  placeUnit(state, 'player2', 'recon', p2[7]!, 'scout');

  startBattlePhase(state);
  return state;
}

function computeGridBounds(
  hexes: CubeCoord[],
  hexSize: number,
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const hex of hexes) {
    const { x, y } = hexToPixel(hex, hexSize);
    minX = Math.min(minX, x - hexSize);
    maxX = Math.max(maxX, x + hexSize);
    minY = Math.min(minY, y - hexSize);
    maxY = Math.max(maxY, y + hexSize);
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function App(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState] = useState<GameState>(initGameState);

  const render = useCallback((canvas: HTMLCanvasElement, state: GameState): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const allHexes = getAllHexes(state.map.gridSize);
    const bounds = computeGridBounds(allHexes, HEX_SIZE);
    const camera = createCamera(canvas.width, canvas.height, bounds.width, bounds.height);

    // Offset so grid is centered: translate pixel coords relative to grid min
    const ox = camera.offsetX - bounds.minX;
    const oy = camera.offsetY - bounds.minY;

    // Draw hexes
    for (const hex of allHexes) {
      const { x, y } = hexToPixel(hex, HEX_SIZE);
      const terrain = state.map.terrain.get(hexToKey(hex)) ?? 'plains';
      const fill = TERRAIN_COLORS[terrain] ?? '#4a7c59';
      const stroke = TERRAIN_BORDER_COLORS[terrain] ?? '#3d6b4c';
      drawHex(ctx, x + ox, y + oy, HEX_SIZE, fill, stroke, 1.5);
    }

    // Draw objective marker
    const objPixel = hexToPixel(state.map.centralObjective, HEX_SIZE);
    ctx.beginPath();
    ctx.arc(objPixel.x + ox, objPixel.y + oy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#b8960c';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw units
    const allUnits = [
      ...state.players.player1.units,
      ...state.players.player2.units,
    ];
    for (const unit of allUnits) {
      const { x, y } = hexToPixel(unit.position, HEX_SIZE);
      drawUnit(ctx, unit, x + ox, y + oy);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      render(canvas, gameState);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [gameState, render]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
