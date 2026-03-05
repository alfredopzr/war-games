import { type ReactElement } from 'react';
import { useGameStore } from '../store/game-store';
import { UnitShop } from './UnitShop';
import { BattleLog } from './BattleLog';
import { WinConditionPanel } from './WinConditionPanel';

export function BottomPanel(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) return null;

  const phase = gameState.phase;

  if (phase === 'build') {
    return (
      <div className="bottom-panel">
        <UnitShop />
      </div>
    );
  }

  if (phase === 'battle') {
    return (
      <div className="bottom-panel">
        <WinConditionPanel />
        <BattleLog />
      </div>
    );
  }

  return null;
}
