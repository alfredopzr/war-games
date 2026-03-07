import { useCallback, useState, useEffect, useRef, type ReactElement } from 'react';
import { canIssueCommand, CP_PER_ROUND } from '@hexwar/engine';
import type { CommandPool } from '@hexwar/engine';
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
  const targetSelectionMode = useGameStore((s) => s.targetSelectionMode);

  const [showMatrix, setShowMatrix] = useState(false);
  const [redirectActive, setRedirectActive] = useState(false);
  const redirectUnitId = useRef<string | null>(null);

  // Reset redirect state when unit changes
  useEffect(() => {
    setRedirectActive(false);
    setShowMatrix(false);
    redirectUnitId.current = null;
  }, [selectedUnit?.id]);

  // When both orders are picked, enter target selection mode
  const onBothConfirmed = useCallback((): void => {
    if (!selectedUnit) return;
    redirectUnitId.current = selectedUnit.id;
    setRedirectActive(true);
    setTargetSelectionMode(true);
    setShowMatrix(false);
  }, [selectedUnit, setTargetSelectionMode]);

  // When target selection completes (targetSelectionMode goes false while redirect is active),
  // create the pending command from the unit's current directives + target
  useEffect(() => {
    if (!redirectActive) return;
    if (targetSelectionMode) return;
    // targetSelectionMode just went false while we're mid-redirect — target was set
    const unitId = redirectUnitId.current;
    if (!unitId) return;

    const store = useGameStore.getState();
    const player = store.gameState?.players[store.currentPlayerView];
    const unit = player?.units.find((u) => u.id === unitId);
    if (!unit) return;

    addPendingCommand({
      type: 'redirect',
      unitId: unit.id,
      newMovementDirective: unit.movementDirective,
      newAttackDirective: unit.attackDirective,
      newSpecialtyModifier: unit.specialtyModifier,
      target: unit.directiveTarget,
      patrolRadius: unit.patrolRadius,
      huntPriorityType: unit.huntPriorityType,
    });

    setRedirectActive(false);
    redirectUnitId.current = null;
    selectUnit(null);
  }, [targetSelectionMode, redirectActive, addPendingCommand, selectUnit]);

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

  if (redirectActive) {
    return (
      <div className="command-menu">
        <div className="command-btn active">Select Target</div>
      </div>
    );
  }

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
      {showMatrix && canCommand && (
        <div className="directive-dropdown">
          <OrderMatrix onBothConfirmed={onBothConfirmed} />
        </div>
      )}
    </div>
  );
}
