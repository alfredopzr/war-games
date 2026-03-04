import { useRef, useEffect, useCallback, useState, type ReactElement } from 'react';
import {
  placeUnit,
  getAllHexes, hexToKey, calculateVisibility,
  canAttack, cubeDistance, UNIT_STATS,
} from '@hexwar/engine';
import type { GameState, CubeCoord, Unit, PlayerId, Command } from '@hexwar/engine';
import { HEX_SIZE, TERRAIN_COLORS, TERRAIN_BORDER_COLORS, PLAYER_COLORS } from './renderer/constants';
import { hexToPixel, pixelToHex, drawHex, drawHexTile } from './renderer/hex-render';
import { loadAllTiles, getTileImage, getObjectiveTileImage, tilesReady } from './renderer/asset-loader';
import { drawUnit } from './renderer/unit-render';
import { drawObjective } from './renderer/objective-render';
import { drawFog, drawGhostMarker } from './renderer/fog-render';
import { createCamera } from './renderer/camera';
import { useGameStore } from './store/game-store';
import { UnitInfoPanel } from './components/UnitInfoPanel';
import { UnitShop } from './components/UnitShop';
import { DirectiveSelector } from './components/DirectiveSelector';
import { BattleHUD } from './components/BattleHUD';
import { BuildTimer } from './components/BuildTimer';
import { ResourceBar } from './components/ResourceBar';
import { CommandMenu } from './components/CommandMenu';
import { TurnTransition } from './components/TurnTransition';
import { RoundResult } from './components/RoundResult';
import { GameOverScreen } from './components/GameOverScreen';
import { StartMenu } from './components/StartMenu';
import { TerrainLegend } from './components/TerrainLegend';
import { BattleHelp } from './components/BattleHelp';
import { BattleLog } from './components/BattleLog';
import { Toast } from './components/Toast';

const DAMAGE_FLASH_DURATION = 500; // ms

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

function drawDirectiveArrow(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  state: GameState,
  ox: number,
  oy: number,
): void {
  const unitPixel = hexToPixel(unit.position, HEX_SIZE);
  const startX = unitPixel.x + ox;
  const startY = unitPixel.y + oy;

  let targetX: number;
  let targetY: number;

  const objPixel = hexToPixel(state.map.centralObjective, HEX_SIZE);
  const objX = objPixel.x + ox;
  const objY = objPixel.y + oy;

  switch (unit.directive) {
    case 'hold':
      return; // No arrow for hold
    case 'advance':
      targetX = objX;
      targetY = objY;
      break;
    case 'flank-left': {
      const dx = objX - startX;
      const dy = objY - startY;
      // Rotate 40 degrees left
      const cos = Math.cos(-0.7);
      const sin = Math.sin(-0.7);
      targetX = startX + dx * cos - dy * sin;
      targetY = startY + dx * sin + dy * cos;
      break;
    }
    case 'flank-right': {
      const dx = objX - startX;
      const dy = objY - startY;
      // Rotate 40 degrees right
      const cos = Math.cos(0.7);
      const sin = Math.sin(0.7);
      targetX = startX + dx * cos - dy * sin;
      targetY = startY + dx * sin + dy * cos;
      break;
    }
    case 'scout': {
      // Arrow away from friendlies (opposite of average friendly direction)
      const friendlies = getPlayerUnits(state, unit.owner);
      if (friendlies.length <= 1) {
        targetX = startX;
        targetY = startY - 60;
      } else {
        let avgX = 0;
        let avgY = 0;
        let count = 0;
        for (const f of friendlies) {
          if (f.id === unit.id) continue;
          const fp = hexToPixel(f.position, HEX_SIZE);
          avgX += fp.x + ox;
          avgY += fp.y + oy;
          count++;
        }
        avgX /= count;
        avgY /= count;
        // Point away from average
        targetX = startX + (startX - avgX);
        targetY = startY + (startY - avgY);
      }
      break;
    }
    case 'support': {
      // Arrow toward nearest friendly
      const friendlies = getPlayerUnits(state, unit.owner);
      let nearest = { x: startX, y: startY - 60 };
      let bestDist = Infinity;
      for (const f of friendlies) {
        if (f.id === unit.id) continue;
        const fp = hexToPixel(f.position, HEX_SIZE);
        const dx = (fp.x + ox) - startX;
        const dy = (fp.y + oy) - startY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) {
          bestDist = d;
          nearest = { x: fp.x + ox, y: fp.y + oy };
        }
      }
      targetX = nearest.x;
      targetY = nearest.y;
      break;
    }
  }

  // Normalize and cap arrow length at 60px
  const dx = targetX - startX;
  const dy = targetY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  const maxLen = 60;
  const len = Math.min(dist, maxLen);
  const nx = dx / dist;
  const ny = dy / dist;
  const endX = startX + nx * len;
  const endY = startY + ny * len;

  // Draw dashed line
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 200, 0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw arrowhead
  const headLen = 8;
  const angle = Math.atan2(ny, nx);
  ctx.fillStyle = 'rgba(255, 255, 200, 0.4)';
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
  ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function App(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boundsRef = useRef<{ minX: number; minY: number; width: number; height: number } | null>(null);
  const animFrameRef = useRef<number>(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    loadAllTiles().then(() => setAssetsLoaded(true)).catch(() => setAssetsLoaded(true));
  }, []);

  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const visibleHexes = useGameStore((s) => s.visibleHexes);
  const lastKnownEnemies = useGameStore((s) => s.lastKnownEnemies);
  const showTransition = useGameStore((s) => s.showTransition);
  const showRoundResult = useGameStore((s) => s.showRoundResult);
  const showGameOver = useGameStore((s) => s.showGameOver);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const setVisibleHexes = useGameStore((s) => s.setVisibleHexes);
  const setHoveredHex = useGameStore((s) => s.setHoveredHex);

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
        updated.delete(enemy.id);
      }
    }

    useGameStore.setState({ lastKnownEnemies: updated });
  }, [gameState, currentPlayerView, setVisibleHexes]);

  const render = useCallback(
    (canvas: HTMLCanvasElement, state: GameState, time: number): void => {
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

      const isBuildPhase = state.phase === 'build';

      // Build deployment zone lookups for build phase
      const friendlyDeployKeys = new Set<string>();
      const enemyDeployKeys = new Set<string>();
      if (isBuildPhase) {
        const friendlyZone = currentPlayerView === 'player1'
          ? state.map.player1Deployment
          : state.map.player2Deployment;
        const enemyZone = currentPlayerView === 'player1'
          ? state.map.player2Deployment
          : state.map.player1Deployment;
        for (const h of friendlyZone) {
          friendlyDeployKeys.add(hexToKey(h));
        }
        for (const h of enemyZone) {
          enemyDeployKeys.add(hexToKey(h));
        }
      }

      // Draw terrain hexes — sorted by r (top to bottom) for correct isometric overlap
      const sortedHexes = [...allHexes].sort((a, b) => a.r - b.r);
      for (const hex of sortedHexes) {
        const { x, y } = hexToPixel(hex, HEX_SIZE);
        const hexKey = hexToKey(hex);
        const terrain = state.map.terrain.get(hexKey) ?? 'plains';
        const cx = x + ox;
        const cy = y + oy;

        if (isBuildPhase) {
          if (friendlyDeployKeys.has(hexKey)) {
            // Own deployment zone: solid player color, no terrain tile
            const fill = currentPlayerView === 'player1'
              ? 'rgba(30, 90, 180, 0.9)'
              : 'rgba(180, 30, 30, 0.9)';
            const stroke = currentPlayerView === 'player1'
              ? 'rgba(80, 160, 255, 1.0)'
              : 'rgba(255, 80, 80, 1.0)';
            drawHex(ctx, cx, cy, HEX_SIZE, fill, stroke, 2.5);
          } else if (enemyDeployKeys.has(hexKey)) {
            // Enemy deployment zone: dimmer opposite color, no terrain tile
            const fill = currentPlayerView === 'player1'
              ? 'rgba(140, 30, 30, 0.7)'
              : 'rgba(30, 70, 160, 0.7)';
            const stroke = currentPlayerView === 'player1'
              ? 'rgba(200, 60, 60, 0.8)'
              : 'rgba(60, 120, 220, 0.8)';
            drawHex(ctx, cx, cy, HEX_SIZE, fill, stroke, 1.5);
          } else {
            // Non-deployment hex: terrain tile + dark overlay to de-emphasise
            const fill = TERRAIN_COLORS[terrain] ?? '#5a9a50';
            drawHex(ctx, cx, cy, HEX_SIZE, fill, 'transparent', 0);
            if (tilesReady) {
              const img = getTileImage(terrain);
              if (img) drawHexTile(ctx, img, cx, cy, HEX_SIZE);
            }
            drawHex(ctx, cx, cy, HEX_SIZE, 'rgba(0, 0, 0, 0.4)', 'transparent', 0);
          }
        } else {
          // Normal phase: solid base then tile (base fills transparent tile corners)
          const fill = TERRAIN_COLORS[terrain] ?? '#5a9a50';
          drawHex(ctx, cx, cy, HEX_SIZE, fill, 'transparent', 0);
          if (tilesReady) {
            const img = getTileImage(terrain);
            if (img) {
              drawHexTile(ctx, img, cx, cy, HEX_SIZE);
            } else {
              const stroke = TERRAIN_BORDER_COLORS[terrain] ?? '#4a8840';
              drawHex(ctx, cx, cy, HEX_SIZE, 'transparent', stroke, 1.5);
            }
          }
        }
      }

      // Draw city ownership borders
      if (state.cityOwnership) {
        for (const hex of allHexes) {
          const key = hexToKey(hex);
          const owner = state.cityOwnership.get(key);
          if (owner) {
            const { x, y } = hexToPixel(hex, HEX_SIZE);
            const ownerColor = PLAYER_COLORS[owner].light;
            drawHex(ctx, x + ox, y + oy, HEX_SIZE, 'transparent', ownerColor, 3);
          }
        }
      }

      // Draw range highlights (move/attack)
      const currentHighlights = useGameStore.getState().highlightedHexes;
      const currentHighlightMode = useGameStore.getState().highlightMode;
      if (currentHighlights.size > 0 && currentHighlightMode !== 'none') {
        const hlFill = currentHighlightMode === 'move'
          ? 'rgba(100, 200, 255, 0.25)'
          : 'rgba(255, 80, 80, 0.3)';
        const hlStroke = currentHighlightMode === 'move'
          ? 'rgba(100, 200, 255, 0.6)'
          : 'rgba(255, 80, 80, 0.7)';
        for (const hex of allHexes) {
          const key = hexToKey(hex);
          if (currentHighlights.has(key)) {
            const { x, y } = hexToPixel(hex, HEX_SIZE);
            drawHex(ctx, x + ox, y + oy, HEX_SIZE, hlFill, hlStroke, 2);
          }
        }
      }

      // Draw hovered hex highlight
      const currentHovered = useGameStore.getState().hoveredHex;
      if (currentHovered) {
        const { x, y } = hexToPixel(currentHovered, HEX_SIZE);
        drawHex(ctx, x + ox, y + oy, HEX_SIZE, 'transparent', 'rgba(255, 255, 255, 0.35)', 2);
      }

      // Draw selected unit highlight
      if (selectedUnit) {
        const { x, y } = hexToPixel(selectedUnit.position, HEX_SIZE);
        drawHex(ctx, x + ox, y + oy, HEX_SIZE, 'transparent', '#ffdd44', 3);
      }

      // Draw objective — skyscraper tile as base, then pulsing glow on top
      const objPixel = hexToPixel(state.map.centralObjective, HEX_SIZE);
      const objCx = objPixel.x + ox;
      const objCy = objPixel.y + oy;
      if (tilesReady) {
        const skyImg = getObjectiveTileImage();
        if (skyImg) {
          drawHex(ctx, objCx, objCy, HEX_SIZE, TERRAIN_COLORS['city'] ?? '#a09070', 'transparent', 0);
          drawHexTile(ctx, skyImg, objCx, objCy, HEX_SIZE);
        }
      }
      drawObjective(
        ctx,
        objCx,
        objCy,
        HEX_SIZE,
        state.round.objective,
        time,
      );

      const now = Date.now();
      const currentDamagedUnits = useGameStore.getState().damagedUnits;

      // During build phase, show all own units (no fog)
      if (isBuildPhase) {
        const friendly = getPlayerUnits(state, currentPlayerView);
        for (const unit of friendly) {
          const { x, y } = hexToPixel(unit.position, HEX_SIZE);
          drawUnit(ctx, unit, x + ox, y + oy, false);
        }
      } else {
        const currentPendingCommands = useGameStore.getState().pendingCommands;
        const commandedIds = new Set(currentPendingCommands.map((c) => c.unitId));

        // Draw friendly units (always visible)
        const friendly = getPlayerUnits(state, currentPlayerView);
        for (const unit of friendly) {
          const { x, y } = hexToPixel(unit.position, HEX_SIZE);
          const damageTime = currentDamagedUnits.get(unit.id);
          const isDamaged = damageTime !== undefined && now - damageTime < DAMAGE_FLASH_DURATION;
          drawUnit(ctx, unit, x + ox, y + oy, isDamaged, commandedIds.has(unit.id));
        }

        // Draw enemy units only if in visible hexes
        const enemyPlayer = getEnemyPlayer(currentPlayerView);
        const enemies = getPlayerUnits(state, enemyPlayer);
        for (const unit of enemies) {
          const key = hexToKey(unit.position);
          if (visibleHexes.has(key)) {
            const { x, y } = hexToPixel(unit.position, HEX_SIZE);
            const damageTime = currentDamagedUnits.get(unit.id);
            const isDamaged = damageTime !== undefined && now - damageTime < DAMAGE_FLASH_DURATION;
            drawUnit(ctx, unit, x + ox, y + oy, isDamaged);
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

        // Draw directive intention arrow for selected friendly unit
        if (selectedUnit && selectedUnit.owner === currentPlayerView) {
          drawDirectiveArrow(ctx, selectedUnit, state, ox, oy);
        }
      }
    },
    [selectedUnit, currentPlayerView, visibleHexes, lastKnownEnemies],
  );

  // Canvas click handler — handles unit selection, command mode, AND build-phase placement
  const handleClick = useCallback(
    (e: MouseEvent): void => {
      const canvas = canvasRef.current;
      if (!canvas || !gameState || !boundsRef.current) return;

      const bounds = boundsRef.current;
      const camera = createCamera(canvas.width, canvas.height, bounds.width, bounds.height);
      const ox = camera.offsetX - bounds.minX;
      const oy = camera.offsetY - bounds.minY;

      const pixelX = e.clientX - ox;
      const pixelY = e.clientY - oy;
      const hex = pixelToHex(pixelX, pixelY, HEX_SIZE);

      const store = useGameStore.getState();

      // Build phase: placement mode
      if (gameState.phase === 'build' && store.placementMode) {
        const hexKey = hexToKey(hex);
        const zone = currentPlayerView === 'player1'
          ? gameState.map.player1Deployment
          : gameState.map.player2Deployment;
        const inZone = zone.some((h) => hexToKey(h) === hexKey);
        if (!inZone) return;

        const allUnits = [...gameState.players.player1.units, ...gameState.players.player2.units];
        const isOccupied = allUnits.some((u) => hexToKey(u.position) === hexKey);
        if (isOccupied) return;

        const cost = UNIT_STATS[store.placementMode].cost;
        if (gameState.players[currentPlayerView].resources < cost) return;

        try {
          placeUnit(gameState, currentPlayerView, store.placementMode, hex);
          store.setGameState({ ...gameState });
        } catch {
          // placement failed — ignore
        }
        return;
      }

      // Build phase: select own unit (for directive assignment)
      if (gameState.phase === 'build') {
        const unit = findUnitAtHex(gameState, hex);
        if (unit && unit.owner === currentPlayerView) {
          selectUnit(unit);
        } else {
          selectUnit(null);
        }
        return;
      }

      const mode = store.commandMode;
      const selected = store.selectedUnit;

      // Command mode: move
      if (mode === 'move' && selected && selected.owner === currentPlayerView) {
        const stats = UNIT_STATS[selected.type];
        const dist = cubeDistance(selected.position, hex);
        const targetKey = hexToKey(hex);
        if (dist <= stats.moveRange && dist > 0) {
          const allUnits = [...gameState.players.player1.units, ...gameState.players.player2.units];
          const isOccupied = allUnits.some((u) => hexToKey(u.position) === targetKey);
          if (isOccupied) {
            useGameStore.getState().showToast('Hex occupied');
            return;
          }
          if (!gameState.map.terrain.has(targetKey)) {
            useGameStore.getState().showToast('Invalid hex');
            return;
          }
          const command: Command = { type: 'direct-move', unitId: selected.id, targetHex: hex };
          useGameStore.getState().addPendingCommand(command);
          useGameStore.getState().selectUnit(null);
          return;
        }
        useGameStore.getState().showToast('Out of range');
        useGameStore.getState().setCommandMode('none');
        useGameStore.getState().clearHighlightedHexes();
        return;
      }

      // Command mode: attack
      if (mode === 'attack' && selected && selected.owner === currentPlayerView) {
        const targetUnit = findUnitAtHex(gameState, hex);
        if (targetUnit && targetUnit.owner !== currentPlayerView) {
          if (canAttack(selected, targetUnit)) {
            const command: Command = {
              type: 'direct-attack',
              unitId: selected.id,
              targetUnitId: targetUnit.id,
            };
            useGameStore.getState().addPendingCommand(command);
            useGameStore.getState().selectUnit(null);
            return;
          }
          useGameStore.getState().showToast('Out of attack range');
          return;
        }
        useGameStore.getState().showToast('No enemy target');
        useGameStore.getState().setCommandMode('none');
        useGameStore.getState().clearHighlightedHexes();
        return;
      }

      // Normal click: select/deselect unit
      const unit = findUnitAtHex(gameState, hex);
      if (unit) {
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

  // Right-click handler — remove placed unit during build phase
  const handleContextMenu = useCallback(
    (e: MouseEvent): void => {
      if (!gameState || gameState.phase !== 'build' || !boundsRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const bounds = boundsRef.current;
      const camera = createCamera(canvas.width, canvas.height, bounds.width, bounds.height);
      const ox = camera.offsetX - bounds.minX;
      const oy = camera.offsetY - bounds.minY;

      const pixelX = e.clientX - ox;
      const pixelY = e.clientY - oy;
      const hex = pixelToHex(pixelX, pixelY, HEX_SIZE);

      const unit = findUnitAtHex(gameState, hex);
      if (unit && unit.owner === currentPlayerView) {
        e.preventDefault();
        useGameStore.getState().removePlacedUnit(unit.id);
      }
    },
    [gameState, currentPlayerView],
  );

  // Mousemove handler — updates hovered hex
  const handleMouseMove = useCallback(
    (e: MouseEvent): void => {
      if (!gameState || !boundsRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const bounds = boundsRef.current;
      const camera = createCamera(canvas.width, canvas.height, bounds.width, bounds.height);
      const ox = camera.offsetX - bounds.minX;
      const oy = camera.offsetY - bounds.minY;

      const pixelX = e.clientX - ox;
      const pixelY = e.clientY - oy;
      const hex = pixelToHex(pixelX, pixelY, HEX_SIZE);
      setHoveredHex(hex);
    },
    [gameState, setHoveredHex],
  );

  // Clear hover when mouse leaves canvas
  const handleMouseLeave = useCallback((): void => {
    setHoveredHex(null);
  }, [setHoveredHex]);

  // Animation loop + resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const resize = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();

    const loop = (time: number): void => {
      const currentState = useGameStore.getState().gameState;
      if (canvas && currentState) {
        render(canvas, currentState, time);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    window.addEventListener('resize', resize);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [gameState, render, handleClick, handleContextMenu, handleMouseMove, handleMouseLeave]);

  return (
    <>
      {!assetsLoaded && (
        <div className="loading-screen">Loading assets...</div>
      )}
      <StartMenu />
      <canvas ref={canvasRef} className="game-canvas" />
      {gameState && (
        <>
          <BattleHUD />
          <BuildTimer />
          <ResourceBar />
          <UnitShop />
          <DirectiveSelector />
          <UnitInfoPanel />
          <CommandMenu />
          <TerrainLegend />
          <BattleHelp />
          <BattleLog />
        </>
      )}
      <Toast />
      {showTransition && <TurnTransition />}
      {showRoundResult && <RoundResult />}
      {showGameOver && <GameOverScreen />}
    </>
  );
}
