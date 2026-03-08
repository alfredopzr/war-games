import { useState, useRef, useEffect, useCallback, type ReactElement } from 'react';
import {
  placeUnit,
  hexToKey, calculateVisibility, createHex,
  UNIT_STATS, getReachableHexes,
} from '@hexwar/engine';
import type { GameState, CubeCoord, Unit, PlayerId } from '@hexwar/engine';
import { screenToHex, setClickElevationMap } from './renderer/click-handler';
import { renderTerrain } from './renderer/terrain-renderer';
import { renderFog, clearFog } from './renderer/fog-renderer';
import { renderDeployZones } from './renderer/deploy-renderer';
import { renderSelectionHighlights } from './renderer/selection-renderer';
import { renderCommandVisuals, clearCommandVisuals } from './renderer/command-renderer';
import { renderUnits } from './renderer/unit-renderer';
import { updateEffects } from './renderer/effects-renderer';
import { setupStaticCamera, setMapParams, setDeployFacing, refitCamera, startIntro, tickIntro, tickCamera, wasDrag } from './renderer/camera-controller';
import {
  createThreeContext, setMapFlip, startRenderLoop, stopRenderLoop,
  disposeThreeContext, markLabelsDirty, syncScenePalette,
} from './renderer/three-scene';
import { preloadFactionModels } from './renderer/model-loader';
import { syncUnitModels, advanceAnimations, clearAllUnitModels } from './renderer/unit-model';
import { preloadAllProps, renderProps, clearProps } from './renderer/prop-renderer';
import { clearWorldCache } from './renderer/render-cache';
import { injectCssPalette } from './renderer/css-palette';
import { renderTopoLines, clearTopoLines } from './renderer/topo-renderer';
import { ASH_EMBER, setPalette, getPalette } from './renderer/palette';
import { WINTER } from './renderer/palette-winter';
import { DESERT } from './renderer/palette-desert';
import { NATO } from './renderer/palette-nato';
import { SATELLITE } from './renderer/palette-satellite';
import { NEON } from './renderer/palette-neon';
import { DEBUG } from './renderer/palette-debug';
import { useGameStore } from './store/game-store';
import { perf } from './perf-monitor';
import { UnitInfoPanel } from './components/UnitInfoPanel';
import { DirectiveSelector } from './components/DirectiveSelector';
import { BattleHUD } from './components/BattleHUD';
import { BottomPanel } from './components/BottomPanel';
import { CommandMenu } from './components/CommandMenu';
import { RoundResult } from './components/RoundResult';
import { GameOverScreen } from './components/GameOverScreen';
import { StartMenu } from './components/StartMenu';
import { DeployManifest } from './components/DeployManifest';
import { BattleHelp } from './components/BattleHelp';
import { Toast } from './components/Toast';
import { OnlineStatus } from './components/OnlineStatus';

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

// ---------------------------------------------------------------------------
// Dirty-flag: skip static map rebuild when only units/commands changed
// ---------------------------------------------------------------------------

let lastTerrainSeed = -1;
let lastCityOwnershipHash = '';

function invalidateTerrainCache(): void {
  lastTerrainSeed = -1;
  lastCityOwnershipHash = '';
}

function cityOwnershipHash(state: GameState): string {
  const parts: string[] = [];
  for (const [key, owner] of state.cityOwnership) {
    if (owner) parts.push(`${key}:${owner}`);
  }
  return parts.join('|');
}

/** Lightweight selection/hover highlight update — called from renderScene and its own useEffect. */
function updateSelectionHighlights(state: GameState): void {
  const store = useGameStore.getState();
  const allHexes: CubeCoord[] = [];
  for (const key of state.map.terrain.keys()) {
    const [qStr, rStr] = key.split(',');
    allHexes.push(createHex(Number(qStr), Number(rStr)));
  }
  const endSelection = perf.start('renderSelection');
  renderSelectionHighlights(
    store.selectedUnit,
    store.hoveredHex,
    store.highlightedHexes,
    store.highlightMode,
    allHexes,
    state.map.elevation,
    store.commandMode,
    store.pendingCommands,
    store.targetSelectionMode,
    state,
    store.currentPlayerView,
    store.preRevealUnitPositions,
  );
  endSelection();
}

/** Render the full scene into Three.js. */
function renderScene(state: GameState): void {
  clearWorldCache();
  markLabelsDirty();
  const endTotal = perf.start('renderScene');
  const store = useGameStore.getState();
  const currentPlayerView = store.currentPlayerView;
  const visibleHexes = store.visibleHexes;
  const lastKnownEnemies = store.lastKnownEnemies;
  const isBuildPhase = state.phase === 'build';
  // Build hex list from terrain map keys (hex boundary has negative coords)
  const allHexes: CubeCoord[] = [];
  for (const key of state.map.terrain.keys()) {
    const [qStr, rStr] = key.split(',');
    allHexes.push(createHex(Number(qStr), Number(rStr)));
  }

  const ownerHash = cityOwnershipHash(state);
  const terrainDirty = state.map.seed !== lastTerrainSeed || ownerHash !== lastCityOwnershipHash;

  if (terrainDirty) {
    const endTerrain = perf.start('renderTerrain');
    renderTerrain(state);
    endTerrain();
    lastTerrainSeed = state.map.seed;
    lastCityOwnershipHash = ownerHash;
  }

  if (isBuildPhase) {
    const endDeploy = perf.start('renderDeployZones');
    renderDeployZones(state, currentPlayerView);
    endDeploy();
  }

  updateSelectionHighlights(state);

  const endCommand = perf.start('renderCommandVisuals');
  renderCommandVisuals(store.pendingCommands, state);
  endCommand();

  const endUnits = perf.start('renderUnits');
  renderUnits(state, currentPlayerView, visibleHexes, lastKnownEnemies);
  endUnits();

  const debugFogOff = store.debugFogOff;
  const exploredHexes = store.exploredHexes;

  if (!debugFogOff) {
    const endProps = perf.start('renderProps');
    renderProps(state, visibleHexes, exploredHexes);
    endProps();

    const endFog = perf.start('renderFog');
    renderFog(allHexes, visibleHexes, exploredHexes, state.map.elevation);
    endFog();

    renderTopoLines(allHexes, state.map.elevation, visibleHexes, exploredHexes);
  } else {
    clearFog();
    clearTopoLines();
    renderProps(state);
  }
  endTotal();
}

export function App(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupCameraRef = useRef<(() => void) | null>(null);
  const modelsLoadedRef = useRef(false);
  const propsRenderedRef = useRef(false);
  const introPlayedRef = useRef(false);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const visibleHexes = useGameStore((s) => s.visibleHexes);
  const lastKnownEnemies = useGameStore((s) => s.lastKnownEnemies);
  const showRoundResult = useGameStore((s) => s.showRoundResult);
  const showGameOver = useGameStore((s) => s.showGameOver);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const setVisibleHexes = useGameStore((s) => s.setVisibleHexes);
  const setHoveredHex = useGameStore((s) => s.setHoveredHex);

  const pendingCommands = useGameStore((s) => s.pendingCommands);
  const exploredHexes = useGameStore((s) => s.exploredHexes);
  const debugFogOff = useGameStore((s) => s.debugFogOff);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const gameMode = useGameStore((s) => s.gameMode);
  const targetSelectionMode = useGameStore((s) => s.targetSelectionMode);
  const hoveredHex = useGameStore((s) => s.hoveredHex);
  const highlightedHexes = useGameStore((s) => s.highlightedHexes);
  const highlightMode = useGameStore((s) => s.highlightMode);
  const commandMode = useGameStore((s) => s.commandMode);
  const preRevealUnitPositions = useGameStore((s) => s.preRevealUnitPositions);

  // Update selection highlights on hover/selection/target changes
  useEffect(() => {
    if (!gameState) return;
    updateSelectionHighlights(gameState);
  }, [gameState, selectedUnit, hoveredHex, targetSelectionMode, highlightedHexes, highlightMode, commandMode, pendingCommands, preRevealUnitPositions]);

  // Recalculate visibility when player view changes
  useEffect(() => {
    if (!gameState) return;
    const endVis = perf.start('effect.visibility');
    const viewPlayer = (gameMode === 'online' && myPlayerId) ? myPlayerId : currentPlayerView;
    const friendly = getPlayerUnits(gameState, viewPlayer);
    const endCalc = perf.start('visibility');
    const vis = calculateVisibility(friendly, gameState.map.terrain, gameState.map.elevation);
    endCalc();
    setVisibleHexes(vis);

    // Accumulate explored hexes — persists across rounds, but only during combat
    if (gameState.phase !== 'build') {
      const prevExplored = useGameStore.getState().exploredHexes;
      const merged = new Set(prevExplored);
      for (const k of vis) merged.add(k);
      if (merged.size !== prevExplored.size) {
        useGameStore.setState({ exploredHexes: merged });
      }
    }

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
    endVis();
  }, [gameState, currentPlayerView, gameMode, myPlayerId, setVisibleHexes]);

  // Debug: P key toggles fog
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'p') useGameStore.getState().toggleDebugFog();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Dev: number keys 1-7 switch palette
  useEffect(() => {
    const palettes = [ASH_EMBER, WINTER, DESERT, NATO, SATELLITE, NEON, DEBUG] as const;
    const onPaletteKey = (e: KeyboardEvent): void => {
      const idx = parseInt(e.key, 10);
      if (!(idx >= 1 && idx <= 7)) return;
      setPalette(palettes[idx - 1]!);
      syncScenePalette();
      invalidateTerrainCache();
      const gs = useGameStore.getState().gameState;
      if (gs) renderScene(gs);
    };
    window.addEventListener('keydown', onPaletteKey);
    return () => window.removeEventListener('keydown', onPaletteKey);
  }, []);

  // Initialize Three.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    createThreeContext(container);
    injectCssPalette(getPalette());

    const cleanupCamera = setupStaticCamera(container);
    cleanupCameraRef.current = cleanupCamera;

    startRenderLoop((deltaSec) => {
      tickIntro(deltaSec);
      tickCamera(deltaSec);
      advanceAnimations(deltaSec);
      updateEffects(deltaSec);
    });

    return () => {
      if (cleanupCameraRef.current) {
        cleanupCameraRef.current();
        cleanupCameraRef.current = null;
      }
      stopRenderLoop();
      clearAllUnitModels();
      clearCommandVisuals();
      clearProps();
      disposeThreeContext();
    };
  }, []);

  // Render scene when game state changes
  useEffect(() => {
    if (!gameState) return;

    // Set map flip before rendering
    const isP1 = currentPlayerView === 'player1';
    setMapFlip(isP1);

    // Orient camera so current player's deploy zone is at screen bottom
    const deployZone = isP1 ? gameState.map.player1Deployment : gameState.map.player2Deployment;
    setDeployFacing(deployZone, isP1 ? -1 : 1);

    // Store map params and refit camera with rotation
    setMapParams(gameState.map.elevation);
    setClickElevationMap(gameState.map.elevation);
    refitCamera();

    renderScene(gameState);

    // Preload all assets on first state arrival, then start intro
    if (!modelsLoadedRef.current) {
      modelsLoadedRef.current = true;
      propsRenderedRef.current = true;
      setAssetsLoading(true);

      const modelT0 = performance.now();
      const modelPromise = Promise.all([
        preloadFactionModels('iron-collective'),
        preloadFactionModels('caravaner'),
      ]).then(() => {
        perf.record('preloadModels', performance.now() - modelT0);
      });

      const propT0 = performance.now();
      const propPromise = preloadAllProps().then(() => {
        perf.record('preloadProps', performance.now() - propT0);
      });

      Promise.all([modelPromise, propPromise]).then(() => {
        setAssetsLoading(false);
        const gs = useGameStore.getState().gameState;
        if (gs) {
          syncUnitModels(gs, useGameStore.getState().currentPlayerView, useGameStore.getState().visibleHexes);
          const endRenderProps = perf.start('renderProps');
          renderProps(gs, useGameStore.getState().visibleHexes, useGameStore.getState().exploredHexes);
          endRenderProps();
        }
        if (!introPlayedRef.current) {
          introPlayedRef.current = true;
          startIntro();
        }
      });
    }

    const endSync = perf.start('syncUnitModels');
    syncUnitModels(gameState, currentPlayerView, useGameStore.getState().visibleHexes);
    endSync();
  }, [gameState, selectedUnit, currentPlayerView, visibleHexes, exploredHexes, lastKnownEnemies, pendingCommands, debugFogOff]);

  // Click handler
  const handleClick = useCallback(
    (e: MouseEvent): void => {
      if (wasDrag()) return;
      if (!gameState) return;
      if (useGameStore.getState().isReplayPlaying) return;

      const clickT0 = performance.now();
      const canvas = containerRef.current;
      if (!canvas) return;
      const hex = screenToHex(e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
      if (!hex) return;

      const store = useGameStore.getState();

      // Target selection mode: click map to set directive target
      if (store.targetSelectionMode && store.selectedUnit) {
        const hexKey = hexToKey(hex);

        // Try enemy unit first
        const enemyPlayer = currentPlayerView === 'player1' ? 'player2' : 'player1';
        const enemy = gameState.players[enemyPlayer].units.find(
          (u) => hexToKey(u.position) === hexKey,
        );
        if (enemy) {
          store.setUnitDirectiveTarget(store.selectedUnit.id, { type: 'enemy-unit', unitId: enemy.id });
          perf.logAction('target:enemy', performance.now() - clickT0);
          return;
        }

        // Hex target (including cities — no special city target type)
        store.setUnitDirectiveTarget(store.selectedUnit.id, { type: 'hex', hex });
        perf.logAction('target:hex', performance.now() - clickT0);
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
            networkManager.placeUnit(unitType, hex, 'advance', 'ignore', null);
            perf.logAction('place:online', performance.now() - clickT0);
          });
          return;
        }

        placeUnit(gameState, currentPlayerView, store.placementMode, hex);
        store.exitPlacementMode();
        const placed = gameState.players[currentPlayerView].units.find(
          (u) => hexToKey(u.position) === hexKey,
        );
        if (placed) selectUnit(placed);
        store.setGameState({ ...gameState });
        perf.logAction('place:local', performance.now() - clickT0);
        return;
      }

      // Build phase: select own unit (for directive assignment)
      if (gameState.phase === 'build') {
        const unit = findUnitAtHex(gameState, hex);
        if (unit && unit.owner === currentPlayerView) {
          selectUnit(unit);
          perf.logAction('select:build', performance.now() - clickT0);
        } else {
          selectUnit(null);
        }
        return;
      }

      // Normal click: select/deselect unit
      const unit = findUnitAtHex(gameState, hex);
      if (unit) {
        const key = hexToKey(unit.position);
        const isOwn = unit.owner === currentPlayerView;
        if (isOwn || visibleHexes.has(key)) {
          selectUnit(unit);
          // Show move range on selection for own units
          if (isOwn) {
            const stats = UNIT_STATS[unit.type];
            const allUnits = [...gameState.players.player1.units, ...gameState.players.player2.units];
            const occupiedKeys = new Set(allUnits.map((u) => hexToKey(u.position)));
            const reachable = getReachableHexes(
              unit.position, stats.moveRange, gameState.map.terrain, unit.type,
              occupiedKeys, unit.movementDirective, gameState.map.modifiers, gameState.map.elevation,
            );
            useGameStore.getState().setHighlightedHexes(reachable, 'move');
          }
          perf.logAction('select:unit', performance.now() - clickT0);
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
      if (wasDrag()) {
        e.preventDefault();
        return;
      }
      if (!gameState || gameState.phase !== 'build') return;
      if (useGameStore.getState().isReplayPlaying) return;
      const canvas = containerRef.current;
      if (!canvas) return;

      const hex = screenToHex(e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
      if (!hex) return;

      const unit = findUnitAtHex(gameState, hex);
      if (unit && unit.owner === currentPlayerView) {
        e.preventDefault();
        const t0 = performance.now();

        if (useGameStore.getState().gameMode === 'online') {
          import('./network/network-manager').then(({ networkManager }) => {
            networkManager.removeUnit(unit.id);
            perf.logAction('remove:online', performance.now() - t0);
          });
          return;
        }

        useGameStore.getState().removePlacedUnit(unit.id);
        perf.logAction('remove:local', performance.now() - t0);
      }
    },
    [gameState, currentPlayerView],
  );

  // Mousemove handler — updates hovered hex
  const handleMouseMove = useCallback(
    (e: MouseEvent): void => {
      if (!gameState) return;
      const canvas = containerRef.current;
      if (!canvas) return;

      const hex = screenToHex(e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
      setHoveredHex(hex);
    },
    [gameState, setHoveredHex],
  );

  // Clear hover when mouse leaves
  const handleMouseLeave = useCallback((): void => {
    setHoveredHex(null);
  }, [setHoveredHex]);

  // Attach click/hover handlers to the container
  useEffect(() => {
    const container = containerRef.current;
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
      {assetsLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}
      <div className="game-layout">
        {gameState && <BattleHUD />}
        <div ref={containerRef} className={`game-canvas ${targetSelectionMode ? 'target-mode' : ''}`} />
        {gameState && (
          <>
            <BottomPanel />
            <DirectiveSelector />
            <UnitInfoPanel />
            <CommandMenu />
            <DeployManifest />
            <BattleHelp />
            <OnlineStatus />
          </>
        )}
      </div>
      <Toast />
      {showRoundResult && <RoundResult />}
      {showGameOver && <GameOverScreen />}
    </>
  );
}
