import { useCallback, useState, type ReactElement } from 'react';
import { canIssueCommand, CP_PER_ROUND, cubeDistance, canAttack, getAllHexes, hexToKey, UNIT_STATS } from '@hexwar/engine';
import type { DirectiveType, CommandPool } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

const DIRECTIVES: readonly DirectiveType[] = [
  'advance', 'hold', 'flank-left', 'flank-right', 'scout', 'support',
] as const;

function directiveLabel(d: DirectiveType): string {
  switch (d) {
    case 'advance': return 'Advance';
    case 'hold': return 'Hold';
    case 'flank-left': return 'Flank L';
    case 'flank-right': return 'Flank R';
    case 'scout': return 'Scout';
    case 'support': return 'Support';
  }
}

export function CommandMenu(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const pendingCommands = useGameStore((s) => s.pendingCommands);
  const commandMode = useGameStore((s) => s.commandMode);
  const setCommandMode = useGameStore((s) => s.setCommandMode);
  const addPendingCommand = useGameStore((s) => s.addPendingCommand);
  const selectUnit = useGameStore((s) => s.selectUnit);

  const [showDirectives, setShowDirectives] = useState(false);

  const handleRetreat = useCallback((): void => {
    if (!selectedUnit) return;
    addPendingCommand({ type: 'retreat', unitId: selectedUnit.id });
    selectUnit(null);
  }, [selectedUnit, addPendingCommand, selectUnit]);

  const handleRedirect = useCallback((directive: DirectiveType): void => {
    if (!selectedUnit) return;
    addPendingCommand({ type: 'redirect', unitId: selectedUnit.id, newDirective: directive });
    setShowDirectives(false);
    selectUnit(null);
  }, [selectedUnit, addPendingCommand, selectUnit]);

  const handleMoveMode = useCallback((): void => {
    if (commandMode === 'move') {
      setCommandMode('none');
      useGameStore.getState().clearHighlightedHexes();
    } else {
      setCommandMode('move');
      setShowDirectives(false);
      // Compute move range highlights
      const store = useGameStore.getState();
      if (store.selectedUnit && store.gameState) {
        const unit = store.selectedUnit;
        const stats = UNIT_STATS[unit.type];
        const allHexes = getAllHexes(store.gameState.map.gridSize);
        const allUnits = [...store.gameState.players.player1.units, ...store.gameState.players.player2.units];
        const occupiedKeys = new Set(allUnits.map((u) => hexToKey(u.position)));
        const reachable = new Set<string>();
        for (const hex of allHexes) {
          const key = hexToKey(hex);
          const dist = cubeDistance(unit.position, hex);
          if (dist > 0 && dist <= stats.moveRange && !occupiedKeys.has(key) && store.gameState.map.terrain.has(key)) {
            reachable.add(key);
          }
        }
        store.setHighlightedHexes(reachable, 'move');
      }
    }
  }, [commandMode, setCommandMode]);

  const handleAttackMode = useCallback((): void => {
    if (commandMode === 'attack') {
      setCommandMode('none');
      useGameStore.getState().clearHighlightedHexes();
    } else {
      setCommandMode('attack');
      setShowDirectives(false);
      // Compute attack range highlights
      const store = useGameStore.getState();
      if (store.selectedUnit && store.gameState) {
        const unit = store.selectedUnit;
        const enemyPlayer = unit.owner === 'player1' ? 'player2' : 'player1';
        const enemies = store.gameState.players[enemyPlayer].units;
        const targetKeys = new Set<string>();
        for (const enemy of enemies) {
          if (canAttack(unit, enemy)) {
            targetKeys.add(hexToKey(enemy.position));
          }
        }
        store.setHighlightedHexes(targetKeys, 'attack');
      }
    }
  }, [commandMode, setCommandMode]);

  const handleRedirectToggle = useCallback((): void => {
    setShowDirectives((prev) => !prev);
    setCommandMode('none');
  }, [setCommandMode]);

  if (!gameState || !selectedUnit) return null;
  if (gameState.phase !== 'battle') return null;
  if (gameState.round.currentPlayer !== currentPlayerView) return null;
  if (selectedUnit.owner !== currentPlayerView) return null;

  // Build a virtual command pool that accounts for pending commands
  const cpRemaining = CP_PER_ROUND - pendingCommands.length;
  const commandedIds = new Set(pendingCommands.map((c) => c.unitId));
  const virtualPool: CommandPool = {
    remaining: cpRemaining,
    commandedUnitIds: commandedIds,
  };

  const canCommand = canIssueCommand(virtualPool, selectedUnit.id);

  return (
    <div className="command-menu">
      <button
        className={`command-btn ${commandMode === 'move' ? 'active' : ''}`}
        onClick={handleMoveMode}
        disabled={!canCommand}
        type="button"
      >
        Move
      </button>
      <button
        className={`command-btn ${commandMode === 'attack' ? 'active' : ''}`}
        onClick={handleAttackMode}
        disabled={!canCommand}
        type="button"
      >
        Attack
      </button>
      <div className="command-redirect-wrap">
        <button
          className={`command-btn ${showDirectives ? 'active' : ''}`}
          onClick={handleRedirectToggle}
          disabled={!canCommand}
          type="button"
        >
          Redirect
        </button>
        {showDirectives && canCommand && (
          <div className="directive-dropdown">
            {DIRECTIVES.map((d) => (
              <button
                key={d}
                className="directive-option"
                onClick={() => handleRedirect(d)}
                type="button"
              >
                {directiveLabel(d)}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        className="command-btn"
        onClick={handleRetreat}
        disabled={!canCommand}
        type="button"
      >
        Retreat
      </button>
    </div>
  );
}
