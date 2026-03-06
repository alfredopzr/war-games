import { useCallback, useState, type ReactElement } from 'react';
import { canIssueCommand, CP_PER_ROUND } from '@hexwar/engine';
import type { MovementDirective, AttackDirective, SpecialtyModifier, CommandPool } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';
import { OrderMatrix } from './OrderMatrix';

export function CommandMenu(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const pendingCommands = useGameStore((s) => s.pendingCommands);
  const gameMode = useGameStore((s) => s.gameMode);
  const commandsSubmitted = useGameStore((s) => s.commandsSubmitted);
  const addPendingCommand = useGameStore((s) => s.addPendingCommand);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const setTargetSelectionMode = useGameStore((s) => s.setTargetSelectionMode);

  const [showMatrix, setShowMatrix] = useState(false);

  const handleRedirect = useCallback(
    (movement: MovementDirective, attack: AttackDirective, specialty: SpecialtyModifier | null): void => {
      if (!selectedUnit) return;
      addPendingCommand({
        type: 'redirect',
        unitId: selectedUnit.id,
        newMovementDirective: movement,
        newAttackDirective: attack,
        newSpecialtyModifier: specialty,
      });
      setShowMatrix(false);
      selectUnit(null);
    },
    [selectedUnit, addPendingCommand, selectUnit],
  );

  // TODO: may merge redirect + target into single flow
  const handleSetTarget = useCallback((): void => {
    setTargetSelectionMode(true);
    setShowMatrix(false);
  }, [setTargetSelectionMode]);

  if (!gameState || !selectedUnit) return null;
  if (gameState.phase !== 'battle') return null;
  if (gameMode === 'online' && commandsSubmitted) return null;
  if (selectedUnit.owner !== currentPlayerView) return null;

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
        className={`command-btn ${showMatrix ? 'active' : ''}`}
        onClick={() => setShowMatrix((prev) => !prev)}
        disabled={!canCommand}
        type="button"
      >
        Redirect
      </button>
      <button
        className="command-btn"
        onClick={handleSetTarget}
        type="button"
      >
        Set Target
      </button>
      {showMatrix && canCommand && (
        <div className="directive-dropdown">
          <OrderMatrix onSelect={handleRedirect} />
        </div>
      )}
    </div>
  );
}
