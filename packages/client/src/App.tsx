import { useRef, useEffect, useCallback, type ReactElement } from 'react';
import {
  placeUnit,
  getAllHexes, hexToKey, calculateVisibility,
  canAttack, cubeDistance, UNIT_STATS,
} from '@hexwar/engine';
import type { GameState, CubeCoord, Unit, PlayerId, Command } from '@hexwar/engine';
import { Application, Graphics } from 'pixi.js';
import { HEX_SIZE, TERRAIN_COLORS, PLAYER_COLORS } from './renderer/constants';
import { hexToPixel, screenToHex } from './renderer/hex-render';
import { initPixiApp, destroyPixiApp } from './renderer/pixi-app';
import { setupLayers, terrainLayer, deployZoneLayer, fogLayer, unitLayer } from './renderer/layers';
import { setupCameraControls, setMapBounds, centerCameraOnMap } from './renderer/camera-controller';
import { useGameStore } from './store/game-store';
import { UnitInfoPanel } from './components/UnitInfoPanel';
import { UnitShop } from './components/UnitShop';
import { DirectiveSelector } from './components/DirectiveSelector';
import { BattleHUD } from './components/BattleHUD';
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
import { OnlineStatus } from './components/OnlineStatus';

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

/** Draw a single flat-top hexagon into a PIXI.Graphics. */
function drawHexGraphics(g: Graphics, cx: number, cy: number, size: number, fillColor: number, alpha: number, strokeColor?: number, strokeWidth?: number): void {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(cx + size * Math.cos(angle));
    points.push(cy + size * Math.sin(angle));
  }
  g.poly(points, true);
  g.fill({ color: fillColor, alpha });
  if (strokeColor !== undefined && strokeWidth !== undefined) {
    g.stroke({ color: strokeColor, width: strokeWidth });
  }
}

/** Parse CSS hex color string to numeric value. */
function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Render the full scene into PixiJS layers. */
function renderScene(state: GameState): void {
  const allHexes = getAllHexes(state.map.gridSize);
  const store = useGameStore.getState();
  const currentPlayerView = store.currentPlayerView;
  const visibleHexes = store.visibleHexes;
  const lastKnownEnemies = store.lastKnownEnemies;
  const selectedUnit = store.selectedUnit;
  const isBuildPhase = state.phase === 'build';

  // Clear layers
  terrainLayer.removeChildren();
  deployZoneLayer.removeChildren();
  fogLayer.removeChildren();
  unitLayer.removeChildren();

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

  // Draw terrain hexes
  const terrainGraphics = new Graphics();
  const sortedHexes = [...allHexes].sort((a, b) => a.r - b.r);
  for (const hex of sortedHexes) {
    const { x, y } = hexToPixel(hex, HEX_SIZE);
    const hexKey = hexToKey(hex);
    const terrain = state.map.terrain.get(hexKey) ?? 'plains';
    const fill = TERRAIN_COLORS[terrain] ?? '#5a9a50';
    const fillNum = parseColor(fill);

    drawHexGraphics(terrainGraphics, x, y, HEX_SIZE, fillNum, 1, 0x1a1a2e, 1);
  }
  terrainLayer.addChild(terrainGraphics);

  // Objective hex glow
  const objGraphics = new Graphics();
  const objPixel = hexToPixel(state.map.centralObjective, HEX_SIZE);
  drawHexGraphics(objGraphics, objPixel.x, objPixel.y, HEX_SIZE, 0xc88a20, 0.6);
  drawHexGraphics(objGraphics, objPixel.x, objPixel.y, HEX_SIZE + 2, 0x000000, 0, 0xc88a20, 2);
  terrainLayer.addChild(objGraphics);

  // City ownership borders
  if (state.cityOwnership) {
    const cityGraphics = new Graphics();
    for (const hex of allHexes) {
      const key = hexToKey(hex);
      const owner = state.cityOwnership.get(key);
      if (owner) {
        const { x, y } = hexToPixel(hex, HEX_SIZE);
        const ownerColor = parseColor(PLAYER_COLORS[owner].light);
        drawHexGraphics(cityGraphics, x, y, HEX_SIZE, 0x000000, 0, ownerColor, 3);
      }
    }
    terrainLayer.addChild(cityGraphics);
  }

  // Deploy zones
  if (isBuildPhase) {
    const deployGraphics = new Graphics();
    for (const hex of allHexes) {
      const hexKey = hexToKey(hex);
      const { x, y } = hexToPixel(hex, HEX_SIZE);

      if (friendlyDeployKeys.has(hexKey)) {
        const tint = currentPlayerView === 'player1' ? 0x1e5ab4 : 0xb41e1e;
        const stroke = currentPlayerView === 'player1' ? 0x50a0ff : 0xff5050;
        drawHexGraphics(deployGraphics, x, y, HEX_SIZE, tint, 0.45, stroke, 2.5);
      } else if (enemyDeployKeys.has(hexKey)) {
        const tint = currentPlayerView === 'player1' ? 0x8c1e1e : 0x1e46a0;
        const stroke = currentPlayerView === 'player1' ? 0xc83c3c : 0x3c78dc;
        drawHexGraphics(deployGraphics, x, y, HEX_SIZE, tint, 0.35, stroke, 1.5);
      }
    }
    deployZoneLayer.addChild(deployGraphics);
  }

  // Highlights (move/attack range)
  const currentHighlights = store.highlightedHexes;
  const currentHighlightMode = store.highlightMode;
  if (currentHighlights.size > 0 && currentHighlightMode !== 'none') {
    const hlGraphics = new Graphics();
    const hlFill = currentHighlightMode === 'move' ? 0x64c8ff : 0xff5050;
    const hlStroke = currentHighlightMode === 'move' ? 0x64c8ff : 0xff5050;
    const hlAlpha = currentHighlightMode === 'move' ? 0.25 : 0.3;
    for (const hex of allHexes) {
      const key = hexToKey(hex);
      if (currentHighlights.has(key)) {
        const { x, y } = hexToPixel(hex, HEX_SIZE);
        drawHexGraphics(hlGraphics, x, y, HEX_SIZE, hlFill, hlAlpha, hlStroke, 2);
      }
    }
    terrainLayer.addChild(hlGraphics);
  }

  // Hovered hex
  const currentHovered = store.hoveredHex;
  if (currentHovered) {
    const hoverGraphics = new Graphics();
    const { x, y } = hexToPixel(currentHovered, HEX_SIZE);
    drawHexGraphics(hoverGraphics, x, y, HEX_SIZE, 0x000000, 0, 0xffffff, 2);
    terrainLayer.addChild(hoverGraphics);
  }

  // Selected unit highlight
  if (selectedUnit) {
    const selGraphics = new Graphics();
    const { x, y } = hexToPixel(selectedUnit.position, HEX_SIZE);
    drawHexGraphics(selGraphics, x, y, HEX_SIZE, 0x000000, 0, 0xffdd44, 3);
    terrainLayer.addChild(selGraphics);
  }

  // Units
  const drawUnitCircle = (g: Graphics, unit: Unit, cx: number, cy: number): void => {
    const color = parseColor(PLAYER_COLORS[unit.owner].fill);
    const strokeColor = parseColor(PLAYER_COLORS[unit.owner].stroke);
    const radius = HEX_SIZE * 0.5;
    g.circle(cx, cy, radius);
    g.fill({ color, alpha: 1 });
    g.stroke({ color: strokeColor, width: 2 });
  };

  if (isBuildPhase) {
    const unitGraphics = new Graphics();
    const friendly = getPlayerUnits(state, currentPlayerView);
    for (const unit of friendly) {
      const { x, y } = hexToPixel(unit.position, HEX_SIZE);
      drawUnitCircle(unitGraphics, unit, x, y);
    }
    unitLayer.addChild(unitGraphics);
  } else {
    const unitGraphics = new Graphics();

    // Friendly units (always visible)
    const friendly = getPlayerUnits(state, currentPlayerView);
    for (const unit of friendly) {
      const { x, y } = hexToPixel(unit.position, HEX_SIZE);
      drawUnitCircle(unitGraphics, unit, x, y);
    }

    // Enemy units only if in visible hexes
    const enemyPlayer = getEnemyPlayer(currentPlayerView);
    const enemies = getPlayerUnits(state, enemyPlayer);
    for (const unit of enemies) {
      const key = hexToKey(unit.position);
      if (visibleHexes.has(key)) {
        const { x, y } = hexToPixel(unit.position, HEX_SIZE);
        drawUnitCircle(unitGraphics, unit, x, y);
      }
    }

    unitLayer.addChild(unitGraphics);

    // Ghost markers for last-known enemy positions
    const ghostGraphics = new Graphics();
    for (const [, ghost] of lastKnownEnemies) {
      const ghostKey = hexToKey(ghost.position);
      if (!visibleHexes.has(ghostKey)) {
        const { x, y } = hexToPixel(ghost.position, HEX_SIZE);
        ghostGraphics.circle(x, y, HEX_SIZE * 0.35);
        ghostGraphics.fill({ color: 0x888888, alpha: 0.4 });
      }
    }
    unitLayer.addChild(ghostGraphics);

    // Fog overlay on non-visible hexes
    const fogGraphics = new Graphics();
    for (const hex of allHexes) {
      const key = hexToKey(hex);
      if (!visibleHexes.has(key)) {
        const { x, y } = hexToPixel(hex, HEX_SIZE);
        drawHexGraphics(fogGraphics, x, y, HEX_SIZE, 0x000000, 0.6);
      }
    }
    fogLayer.addChild(fogGraphics);
  }
}

export function App(): ReactElement {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cleanupCameraRef = useRef<(() => void) | null>(null);
  const cameraCenteredRef = useRef(false);

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

  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const gameMode = useGameStore((s) => s.gameMode);

  // Recalculate visibility when player view changes
  useEffect(() => {
    if (!gameState) return;
    const viewPlayer = (gameMode === 'online' && myPlayerId) ? myPlayerId : currentPlayerView;
    const friendly = getPlayerUnits(gameState, viewPlayer);
    const vis = calculateVisibility(friendly, gameState.map.terrain);
    setVisibleHexes(vis);

    const enemyPlayer = getEnemyPlayer(viewPlayer);
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
  }, [gameState, currentPlayerView, gameMode, myPlayerId, setVisibleHexes]);

  // Initialize PixiJS app
  useEffect(() => {
    const container = pixiContainerRef.current;
    if (!container) return;

    let cancelled = false;

    initPixiApp(container).then((app) => {
      if (cancelled) {
        destroyPixiApp();
        return;
      }
      appRef.current = app;
      setupLayers(app);
      const cleanup = setupCameraControls(app, app.stage);
      cleanupCameraRef.current = cleanup;
    });

    return () => {
      cancelled = true;
      if (cleanupCameraRef.current) {
        cleanupCameraRef.current();
        cleanupCameraRef.current = null;
      }
      destroyPixiApp();
      appRef.current = null;
      cameraCenteredRef.current = false;
    };
  }, []);

  // Render scene when game state changes
  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState) return;

    const allHexes = getAllHexes(gameState.map.gridSize);
    const bounds = computeGridBounds(allHexes, HEX_SIZE);
    setMapBounds({ minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY });

    // Center camera on first render
    if (!cameraCenteredRef.current) {
      centerCameraOnMap(app.stage, app, bounds);
      cameraCenteredRef.current = true;
    }

    renderScene(gameState);
  }, [gameState, selectedUnit, currentPlayerView, visibleHexes, lastKnownEnemies]);

  // Click handler
  const handleClick = useCallback(
    (e: MouseEvent): void => {
      const app = appRef.current;
      if (!app || !gameState) return;

      const hex = screenToHex(e.clientX, e.clientY, HEX_SIZE, app.stage);
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

        if (store.gameMode === 'online') {
          const unitType = store.placementMode;
          import('./network/network-manager').then(({ networkManager }) => {
            networkManager.placeUnit(unitType, hex, 'advance');
          });
          return;
        }

        placeUnit(gameState, currentPlayerView, store.placementMode, hex);
        store.setGameState({ ...gameState });
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
      if (!gameState || gameState.phase !== 'build') return;
      const app = appRef.current;
      if (!app) return;

      const hex = screenToHex(e.clientX, e.clientY, HEX_SIZE, app.stage);
      const unit = findUnitAtHex(gameState, hex);
      if (unit && unit.owner === currentPlayerView) {
        e.preventDefault();

        if (useGameStore.getState().gameMode === 'online') {
          import('./network/network-manager').then(({ networkManager }) => {
            networkManager.removeUnit(unit.id);
          });
          return;
        }

        useGameStore.getState().removePlacedUnit(unit.id);
      }
    },
    [gameState, currentPlayerView],
  );

  // Mousemove handler — updates hovered hex
  const handleMouseMove = useCallback(
    (e: MouseEvent): void => {
      if (!gameState) return;
      const app = appRef.current;
      if (!app) return;

      const hex = screenToHex(e.clientX, e.clientY, HEX_SIZE, app.stage);
      setHoveredHex(hex);
    },
    [gameState, setHoveredHex],
  );

  // Clear hover when mouse leaves
  const handleMouseLeave = useCallback((): void => {
    setHoveredHex(null);
  }, [setHoveredHex]);

  // Attach click/hover handlers to the PixiJS container
  useEffect(() => {
    const container = pixiContainerRef.current;
    if (!container || !gameState) return;

    container.addEventListener('click', handleClick);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [gameState, handleClick, handleContextMenu, handleMouseMove, handleMouseLeave]);

  return (
    <>
      <StartMenu />
      <div ref={pixiContainerRef} className="game-canvas" />
      {gameState && (
        <>
          <BattleHUD />
          <ResourceBar />
          <UnitShop />
          <DirectiveSelector />
          <UnitInfoPanel />
          <CommandMenu />
          <TerrainLegend />
          <BattleHelp />
          <BattleLog />
          <OnlineStatus />
        </>
      )}
      <Toast />
      {showTransition && <TurnTransition />}
      {showRoundResult && <RoundResult />}
      {showGameOver && <GameOverScreen />}
    </>
  );
}
