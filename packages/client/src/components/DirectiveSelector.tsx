import type { ReactElement } from 'react';
import { useGameStore } from '../store/game-store';
import { OrderMatrix } from './OrderMatrix';

export function DirectiveSelector(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const setTargetSelectionMode = useGameStore((s) => s.setTargetSelectionMode);

  if (!gameState || gameState.phase !== 'build') return null;
  if (!selectedUnit) return null;
  if (selectedUnit.owner !== currentPlayerView) return null;

  return (
    <div className="directive-selector">
      <h3>ORDERS</h3>
      <OrderMatrix />
      <button
        className="target-btn"
        onClick={() => setTargetSelectionMode(true)}
        type="button"
      >
        Set Target
      </button>
    </div>
  );
}
