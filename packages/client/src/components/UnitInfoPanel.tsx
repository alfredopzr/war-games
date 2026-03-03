import type { ReactElement } from 'react';
import { UNIT_STATS } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

function ownerLabel(owner: string): string {
  return owner === 'player1' ? 'Player 1' : 'Player 2';
}

export function UnitInfoPanel(): ReactElement | null {
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const selectUnit = useGameStore((s) => s.selectUnit);

  if (!selectedUnit) return null;

  const stats = UNIT_STATS[selectedUnit.type];

  return (
    <div className="unit-info-panel">
      <button className="close-btn" onClick={() => selectUnit(null)} type="button">
        x
      </button>
      <h3>{selectedUnit.type.toUpperCase()}</h3>
      <StatRow label="Owner" value={ownerLabel(selectedUnit.owner)} />
      <StatRow label="HP" value={`${selectedUnit.hp}/${stats.maxHp}`} />
      <StatRow label="ATK" value={String(stats.atk)} />
      <StatRow label="DEF" value={String(stats.def)} />
      <StatRow label="Move" value={String(stats.moveRange)} />
      <StatRow label="Range" value={`${stats.minAttackRange}-${stats.attackRange}`} />
      <StatRow label="Vision" value={String(stats.visionRange)} />
      <span className="directive-badge">{selectedUnit.directive}</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}
