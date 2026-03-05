import { useRef, useEffect, useCallback, type ReactElement } from 'react';
import {
  placeUnit,
  getAllHexes, hexToKey, calculateVisibility,
  canAttack, cubeDistance, UNIT_STATS,
} from '@hexwar/engine';
import type { GameState, CubeCoord, Unit, PlayerId, Command } from '@hexwar/engine';
import { screenToHex } from './renderer/click-handler';
import { renderTerrain } from './renderer/terrain-renderer';
import { renderFog } from './renderer/fog-renderer';
import { renderDeployZones } from './renderer/deploy-renderer';
import { renderSelectionHighlights } from './renderer/selection-renderer';
import { renderUnits } from './renderer/unit-renderer';
import { updateEffects } from './renderer/effects-renderer';
import { setupStaticCamera, setMapParams, wasDrag } from './renderer/camera-controller';
import {
  createThreeContext, setMapFlip, startRenderLoop, stopRenderLoop,
  disposeThreeContext, fitCameraToMap,
} from './renderer/three-scene';
import { preloadFactionModels } from './renderer/model-loader';
import { syncUnitModels, advanceAnimations, clearAllUnitModels } from './renderer/unit-model';
import { useGameStore } from './store/game-store';
import { UnitInfoPanel } from './components/UnitInfoPanel';
import { DirectiveSelector } from './components/DirectiveSelector';
import { BattleHUD } from './components/BattleHUD';
import { BottomPanel } from './components/BottomPanel';
import { CommandMenu } from './components/CommandMenu';
import { TurnTransition } from './components/TurnTransition';
import { RoundResult } from './components/RoundResult';
import { GameOverScreen } from './components/GameOverScreen';
import { StartMenu } from './components/StartMenu';
import { TerrainLegend } from './components/TerrainLegend';
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

/** Render the full scene into Three.js. */
function renderScene(state: GameState): void {
  const store = useGameStore.getState();
  const currentPlayerView = store.currentPlayerView;
  const visibleHexes = store.visibleHexes;
  const lastKnownEnemies = store.lastKnownEnemies;
  const selectedUnit = store.selectedUnit;
  const isBuildPhase = state.phase === 'build';
  const allHexes = getAllHexes(state.map.gridSize);

  renderTerrain(state);

  if (isBuildPhase) {
    renderDeployZones(state, currentPlayerView);
  }

  renderSelectionHighlights(
    selectedUnit,
    store.hoveredHex,
    store.highlightedHexes,
    store.highlightMode,
    allHexes,
    state.map.elevation,
  );

  renderUnits(state, currentPlayerView, visibleHexes, lastKnownEnemies);

  if (!isBuildPhase) {
    renderFog(allHexes, visibleHexes, state.map.elevation);
  }
}

export function App(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupCameraRef = useRef<(() => void) | null>(null);
  const modelsLoadedRef = useRef(false);

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

  // Initialize Three.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    createThreeContext(container);

    const cleanupCamera = setupStaticCamera(container);
    cleanupCameraRef.current = cleanupCamera;

    startRenderLoop((deltaSec) => {
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
      disposeThreeContext();
    };
  }, []);

  // Render scene when game state changes
  useEffect(() => {
    if (!gameState) return;

    // Set map flip before rendering
    setMapFlip(currentPlayerView === 'player1');

    // Store map params for camera fitting
    setMapParams(gameState.map.gridSize, gameState.map.elevation);
    fitCameraToMap(gameState.map.gridSize, gameState.map.elevation);

    renderScene(gameState);

    // Preload 3D models on first state arrival
    if (!modelsLoadedRef.current) {
      modelsLoadedRef.current = true;
      Promise.all([
        preloadFactionModels('engineer'),
        preloadFactionModels('caravaner'),
      ]).then(() => {
        syncUnitModels(gameState, currentPlayerView, useGameStore.getState().visibleHexes);
      });
    }

    syncUnitModels(gameState, currentPlayerView, useGameStore.getState().visibleHexes);
  }, [gameState, selectedUnit, currentPlayerView, visibleHexes, lastKnownEnemies]);

  // Click handler
  const handleClick = useCallback(
    (e: MouseEvent): void => {
      if (wasDrag()) return;
      if (!gameState) return;
      if (useGameStore.getState().isReplayPlaying) return;

      const canvas = containerRef.current;
      if (!canvas) return;
      const hex = screenToHex(e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
      if (!hex) return;

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
      <div className="game-layout">
        {gameState && <BattleHUD />}
        <div ref={containerRef} className="game-canvas" />
        {gameState && (
          <>
            <BottomPanel />
            <DirectiveSelector />
            <UnitInfoPanel />
            <CommandMenu />
            <TerrainLegend />
            <BattleHelp />
            <OnlineStatus />
          </>
        )}
      </div>
      <Toast />
      {showTransition && <TurnTransition />}
      {showRoundResult && <RoundResult />}
      {showGameOver && <GameOverScreen />}
    </>
  );
}
