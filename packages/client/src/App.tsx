import { useRef, useEffect, useCallback, type ReactElement } from 'react';
import {
  placeUnit,
  getAllHexes, hexToKey, calculateVisibility,
  canAttack, cubeDistance, UNIT_STATS,
} from '@hexwar/engine';
import type { GameState, CubeCoord, Unit, PlayerId, Command } from '@hexwar/engine';
import { Application } from 'pixi.js';
import { HEX_SIZE } from './renderer/constants';
import { hexToPixel, screenToHex, setMapFlip } from './renderer/hex-render';
import { renderTerrain } from './renderer/terrain-renderer';
import { renderFog } from './renderer/fog-renderer';
import { renderDeployZones } from './renderer/deploy-renderer';
import { renderSelectionHighlights } from './renderer/selection-renderer';
import { renderUnits } from './renderer/unit-renderer';
import { updateEffects } from './renderer/effects-renderer';
import { renderMinimap } from './renderer/minimap';
import { initPixiApp, destroyPixiApp } from './renderer/pixi-app';
import { setupLayers, deployZoneLayer } from './renderer/layers';
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

/** Render the full scene into PixiJS layers. */
function renderScene(state: GameState): void {
  const allHexes = getAllHexes(state.map.gridSize);
  const store = useGameStore.getState();
  const currentPlayerView = store.currentPlayerView;
  const visibleHexes = store.visibleHexes;
  const lastKnownEnemies = store.lastKnownEnemies;
  const selectedUnit = store.selectedUnit;
  const isBuildPhase = state.phase === 'build';

  // Terrain + objective + city borders
  renderTerrain(state);

  // Deploy zones (build phase only)
  if (isBuildPhase) {
    renderDeployZones(state, currentPlayerView);
  } else {
    deployZoneLayer.removeChildren();
  }

  // Selection highlights, hovered hex, move/attack range (rendered on uiLayer)
  renderSelectionHighlights(
    selectedUnit,
    store.hoveredHex,
    store.highlightedHexes,
    store.highlightMode,
    allHexes,
    state.map.elevation,
  );

  // Units (rendered on unitLayer with HP bars, directive indicators, damage flash)
  renderUnits(state, currentPlayerView, visibleHexes, lastKnownEnemies);

  // Fog overlay on non-visible hexes (battle phase only)
  if (!isBuildPhase) {
    renderFog(allHexes, visibleHexes, state.map.elevation);
  }
}

export function App(): ReactElement {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cleanupCameraRef = useRef<(() => void) | null>(null);
  const cameraCenteredRef = useRef(false);
  const lastPlayerViewRef = useRef<PlayerId | null>(null);

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
      app.ticker.add((ticker) => updateEffects(ticker.deltaTime));
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

    // Set map flip before computing bounds (affects hexToPixel output)
    setMapFlip(currentPlayerView === 'player1');

    const allHexes = getAllHexes(gameState.map.gridSize);
    const bounds = computeGridBounds(allHexes, HEX_SIZE);
    setMapBounds({ minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY });

    // Center camera on first render or when player view changes
    if (!cameraCenteredRef.current || lastPlayerViewRef.current !== currentPlayerView) {
      centerCameraOnMap(app.stage, app, bounds);
      cameraCenteredRef.current = true;
      lastPlayerViewRef.current = currentPlayerView;
    }

    renderScene(gameState);

    // Minimap
    renderMinimap(gameState, useGameStore.getState().visibleHexes, app.stage, app);
  }, [gameState, selectedUnit, currentPlayerView, visibleHexes, lastKnownEnemies]);

  // Click handler
  const handleClick = useCallback(
    (e: MouseEvent): void => {
      const app = appRef.current;
      if (!app || !gameState) return;

      // Block input during turn replay
      if (useGameStore.getState().isReplayPlaying) return;

      const hex = screenToHex(e.clientX, e.clientY, HEX_SIZE, app.stage);
      const store = useGameStore.getState();

      // Build phase: target selection for hunt/capture directives
      if (gameState.phase === 'build' && store.targetSelectionMode && store.selectedUnit) {
        const hexKey = hexToKey(hex);
        const directive = store.targetSelectionDirective;

        if (directive === 'hunt') {
          const enemyPlayer = currentPlayerView === 'player1' ? 'player2' : 'player1';
          const enemy = gameState.players[enemyPlayer].units.find(
            (u) => hexToKey(u.position) === hexKey,
          );
          if (enemy) {
            store.setUnitDirectiveTarget(store.selectedUnit.id, directive, {
              type: 'enemy-unit',
              unitId: enemy.id,
            });
          } else {
            store.showToast('Select a hex with an enemy unit');
          }
        } else if (directive === 'capture') {
          const terrain = gameState.map.terrain.get(hexKey);
          if (terrain === 'city') {
            store.setUnitDirectiveTarget(store.selectedUnit.id, directive, {
              type: 'city',
              hex,
            });
          } else {
            store.showToast('Select a city hex');
          }
        }
        return;
      }

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
          store.exitPlacementMode();
          import('./network/network-manager').then(({ networkManager }) => {
            networkManager.placeUnit(unitType, hex, 'advance');
          });
          return;
        }

        placeUnit(gameState, currentPlayerView, store.placementMode, hex);
        store.exitPlacementMode();
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
      if (useGameStore.getState().isReplayPlaying) return;
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
