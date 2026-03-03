import { useRef, useEffect, useCallback, type ReactElement } from 'react';
import {
  createGame, placeUnit, startBattlePhase,
  getAllHexes, hexToKey, calculateVisibility,
} from '@hexwar/engine';
import type { GameState, CubeCoord, Unit, PlayerId } from '@hexwar/engine';
import { HEX_SIZE, TERRAIN_COLORS, TERRAIN_BORDER_COLORS } from './renderer/constants';
import { hexToPixel, pixelToHex, drawHex } from './renderer/hex-render';
import { drawUnit } from './renderer/unit-render';
import { drawFog, drawGhostMarker } from './renderer/fog-render';
import { createCamera } from './renderer/camera';
import { useGameStore } from './store/game-store';
import { UnitInfoPanel } from './components/UnitInfoPanel';

function initGameState(): GameState {
  const state = createGame(42);

  const p1 = state.map.player1Deployment;
  placeUnit(state, 'player1', 'infantry', p1[0]!, 'advance');
  placeUnit(state, 'player1', 'tank', p1[2]!, 'advance');
  placeUnit(state, 'player1', 'artillery', p1[4]!, 'support');
  placeUnit(state, 'player1', 'recon', p1[6]!, 'scout');

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

function findUnitAtHex(state: GameState, hex: CubeCoord): Unit | null {
  const key = hexToKey(hex);
  const allUnits = [...state.players.player1.units, ...state.players.player2.units];
  return allUnits.find((u) => hexToKey(u.position) === key) ?? null;
}

function getPlayerUnits(state: GameState, player: PlayerId): Unit[] {
  return state.players[player].units;
}

function getEnemyPlayer(player: PlayerId): PlayerId {
  return player === 'player1' ? 'player2' : 'player1';
}

export function App(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boundsRef = useRef<{ minX: number; minY: number; width: number; height: number } | null>(null);

  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const visibleHexes = useGameStore((s) => s.visibleHexes);
  const lastKnownEnemies = useGameStore((s) => s.lastKnownEnemies);
  const setGameState = useGameStore((s) => s.setGameState);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const setVisibleHexes = useGameStore((s) => s.setVisibleHexes);
  const switchPlayerView = useGameStore((s) => s.switchPlayerView);

  // Initialize game state on mount
  useEffect(() => {
    const state = initGameState();
    setGameState(state);

    const friendly = getPlayerUnits(state, 'player1');
    const vis = calculateVisibility(friendly, state.map.terrain);
    setVisibleHexes(vis);
  }, [setGameState, setVisibleHexes]);

  // Recalculate visibility when player view changes
  useEffect(() => {
    if (!gameState) return;
    const friendly = getPlayerUnits(gameState, currentPlayerView);
    const vis = calculateVisibility(friendly, gameState.map.terrain);
    setVisibleHexes(vis);

    // Update last-known enemies: track enemies that leave visibility
    const enemyPlayer = getEnemyPlayer(currentPlayerView);
    const enemies = getPlayerUnits(gameState, enemyPlayer);
    const store = useGameStore.getState();
    const updated = new Map(store.lastKnownEnemies);

    for (const enemy of enemies) {
      const key = hexToKey(enemy.position);
      if (vis.has(key)) {
        // Enemy is visible now — update last-known position and remove ghost
        updated.delete(enemy.id);
      } else {
        // Enemy not visible — if we saw them before, keep a ghost
        // (We only set ghosts for enemies we previously saw)
      }
    }

    useGameStore.setState({ lastKnownEnemies: updated });
  }, [gameState, currentPlayerView, setVisibleHexes]);

  const render = useCallback(
    (canvas: HTMLCanvasElement, state: GameState): void => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const allHexes = getAllHexes(state.map.gridSize);
      const bounds = computeGridBounds(allHexes, HEX_SIZE);
      boundsRef.current = bounds;
      const camera = createCamera(canvas.width, canvas.height, bounds.width, bounds.height);

      const ox = camera.offsetX - bounds.minX;
      const oy = camera.offsetY - bounds.minY;

      // Draw terrain hexes
      for (const hex of allHexes) {
        const { x, y } = hexToPixel(hex, HEX_SIZE);
        const terrain = state.map.terrain.get(hexToKey(hex)) ?? 'plains';
        const fill = TERRAIN_COLORS[terrain] ?? '#4a7c59';
        const stroke = TERRAIN_BORDER_COLORS[terrain] ?? '#3d6b4c';
        drawHex(ctx, x + ox, y + oy, HEX_SIZE, fill, stroke, 1.5);
      }

      // Draw selected unit highlight
      if (selectedUnit) {
        const { x, y } = hexToPixel(selectedUnit.position, HEX_SIZE);
        drawHex(ctx, x + ox, y + oy, HEX_SIZE, 'transparent', '#ffdd44', 3);
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

      // Draw friendly units (always visible)
      const friendly = getPlayerUnits(state, currentPlayerView);
      for (const unit of friendly) {
        const { x, y } = hexToPixel(unit.position, HEX_SIZE);
        drawUnit(ctx, unit, x + ox, y + oy);
      }

      // Draw enemy units only if in visible hexes
      const enemyPlayer = getEnemyPlayer(currentPlayerView);
      const enemies = getPlayerUnits(state, enemyPlayer);
      for (const unit of enemies) {
        const key = hexToKey(unit.position);
        if (visibleHexes.has(key)) {
          const { x, y } = hexToPixel(unit.position, HEX_SIZE);
          drawUnit(ctx, unit, x + ox, y + oy);
        }
      }

      // Draw ghost markers for last-known enemy positions
      for (const [, ghost] of lastKnownEnemies) {
        const ghostKey = hexToKey(ghost.position);
        if (!visibleHexes.has(ghostKey)) {
          const { x, y } = hexToPixel(ghost.position, HEX_SIZE);
          drawGhostMarker(ctx, ghost.type, x + ox, y + oy);
        }
      }

      // Draw fog overlay on non-visible hexes
      drawFog(ctx, allHexes, visibleHexes, ox, oy, HEX_SIZE);
    },
    [selectedUnit, currentPlayerView, visibleHexes, lastKnownEnemies],
  );

  // Canvas click handler
  const handleClick = useCallback(
    (e: MouseEvent): void => {
      const canvas = canvasRef.current;
      if (!canvas || !gameState || !boundsRef.current) return;

      const bounds = boundsRef.current;
      const camera = createCamera(canvas.width, canvas.height, bounds.width, bounds.height);
      const ox = camera.offsetX - bounds.minX;
      const oy = camera.offsetY - bounds.minY;

      // Convert pixel click to hex grid coords
      const pixelX = e.clientX - ox;
      const pixelY = e.clientY - oy;
      const hex = pixelToHex(pixelX, pixelY, HEX_SIZE);

      // Find unit at clicked hex
      const unit = findUnitAtHex(gameState, hex);

      if (unit) {
        // Only select units that are visible
        const key = hexToKey(unit.position);
        const isOwn = unit.owner === currentPlayerView;
        if (isOwn || visibleHexes.has(key)) {
          selectUnit(unit);
        } else {
          selectUnit(null);
        }
      } else {
        selectUnit(null);
      }
    },
    [gameState, currentPlayerView, visibleHexes, selectUnit],
  );

  // Resize + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const resize = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      render(canvas, gameState);
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('click', handleClick);
    };
  }, [gameState, render, handleClick]);

  // Re-render when selection or visibility changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    render(canvas, gameState);
  }, [gameState, render]);

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      <UnitInfoPanel />
      <button
        className="view-switch-btn"
        onClick={switchPlayerView}
        type="button"
      >
        View: {currentPlayerView === 'player1' ? 'P1' : 'P2'}
      </button>
    </>
  );
}
