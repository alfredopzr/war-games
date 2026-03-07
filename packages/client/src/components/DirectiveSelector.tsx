import { useCallback, useState, useEffect, type ReactElement } from 'react';
import { useGameStore } from '../store/game-store';
import { OrderMatrix } from './OrderMatrix';

export function DirectiveSelector(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const setTargetSelectionMode = useGameStore((s) => s.setTargetSelectionMode);
  const targetSelectionMode = useGameStore((s) => s.targetSelectionMode);
  const selectUnit = useGameStore((s) => s.selectUnit);

  const [ordersPicked, setOrdersPicked] = useState(false);

  // Reset when unit changes
  useEffect(() => {
    setOrdersPicked(false);
  }, [selectedUnit?.id]);

  const onBothConfirmed = useCallback((): void => {
    setOrdersPicked(true);
    setTargetSelectionMode(true);
  }, [setTargetSelectionMode]);

  const handleDispatch = useCallback((): void => {
    selectUnit(null);
  }, [selectUnit]);

  if (!gameState || gameState.phase !== 'build') return null;
  if (!selectedUnit) return null;
  if (selectedUnit.owner !== currentPlayerView) return null;

  const ready = ordersPicked && !targetSelectionMode;

  let buttonLabel: string;
  if (!ordersPicked) {
    buttonLabel = 'Select Orders';
  } else if (targetSelectionMode) {
    buttonLabel = 'Select Target';
  } else {
    buttonLabel = 'Dispatch';
  }

  return (
    <div className="directive-selector">
      <h3>ORDERS</h3>
      <OrderMatrix onBothConfirmed={onBothConfirmed} />
      <button
        className={`target-btn ${ready ? 'active' : ''}`}
        onClick={ready ? handleDispatch : undefined}
        disabled={!ready}
        type="button"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
