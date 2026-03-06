import type { ReactElement } from 'react';
import { UNIT_STATS } from '@hexwar/engine';
import type { UnitType } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

const UNIT_TYPES: UnitType[] = ['infantry', 'tank', 'artillery', 'recon'];
const LABELS: Record<UnitType, string> = {
  infantry: 'INFANTRY',
  tank: 'TANK',
  artillery: 'ARTILLERY',
  recon: 'RECON',
};

export function DeployManifest(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const selectedUnit = useGameStore((s) => s.selectedUnit);

  if (!gameState || gameState.phase !== 'build') return null;
  if (selectedUnit) return null;

  const units = gameState.players[currentPlayerView].units;
  const counts: Record<UnitType, number> = { infantry: 0, tank: 0, artillery: 0, recon: 0 };
  let totalCost = 0;

  for (const unit of units) {
    counts[unit.type]++;
    totalCost += UNIT_STATS[unit.type].cost;
  }

  return (
    <div className="deploy-manifest">
      <div className="deploy-manifest-header">DEPLOYED</div>
      {UNIT_TYPES.map((type) => (
        <div key={type} className="deploy-manifest-row">
          <span>{LABELS[type]}</span>
          <span>{counts[type]}</span>
        </div>
      ))}
      <div className="deploy-manifest-divider" />
      <div className="deploy-manifest-row deploy-manifest-total">
        <span>Total cost</span>
        <span>{totalCost}g</span>
      </div>
    </div>
  );
}
