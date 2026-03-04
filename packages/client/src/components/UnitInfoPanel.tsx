import type { ReactElement } from 'react';
import { UNIT_STATS } from '@hexwar/engine';
import type { DirectiveType } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

function ownerLabel(owner: string): string {
  return owner === 'player1' ? 'Player 1' : 'Player 2';
}

const DIRECTIVE_INFO: Record<DirectiveType, { name: string; desc: string }> = {
  'advance': { name: 'Advance', desc: 'Move toward the objective aggressively' },
  'hold': { name: 'Hold', desc: 'Stay in position and defend' },
  'flank-left': { name: 'Flank Left', desc: 'Circle around the left side' },
  'flank-right': { name: 'Flank Right', desc: 'Circle around the right side' },
  'scout': { name: 'Scout', desc: 'Explore and reveal enemy positions' },
  'support': { name: 'Support', desc: 'Stay back and provide fire support' },
};

export function UnitInfoPanel(): ReactElement | null {
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const selectUnit = useGameStore((s) => s.selectUnit);

  if (!selectedUnit) return null;

  const stats = UNIT_STATS[selectedUnit.type];
  const directiveInfo = DIRECTIVE_INFO[selectedUnit.directive];

  return (
    <div className="unit-info-panel">
      <button className="close-btn" onClick={() => selectUnit(null)} type="button">
        x
      </button>
      <h3>{selectedUnit.type.toUpperCase()}</h3>
      <StatRow label="Owner" value={ownerLabel(selectedUnit.owner)} />
      <HpBar current={selectedUnit.hp} max={stats.maxHp} />
      <StatRow label="ATK" value={String(stats.atk)} />
      <StatRow label="DEF" value={String(stats.def)} />
      <StatRow label="Move" value={String(stats.moveRange)} />
      <StatRow label="Range" value={`${stats.minAttackRange}-${stats.attackRange}`} />
      <StatRow label="Vision" value={String(stats.visionRange)} />
      <div className="directive-section">
        <span className="directive-section-name">{directiveInfo.name}</span>
        <span className="directive-section-desc">{directiveInfo.desc}</span>
      </div>
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

function hpColor(pct: number): string {
  if (pct > 0.6) return '#6a8a48';
  if (pct > 0.3) return '#a08a40';
  return '#9a4a3a';
}

function HpBar({ current, max }: { current: number; max: number }): ReactElement {
  const pct = max > 0 ? current / max : 0;
  const color = hpColor(pct);

  return (
    <div className="hp-bar-container">
      <span className="stat-label">HP</span>
      <div className="hp-bar-track">
        <div
          className="hp-bar-fill"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="hp-bar-text">{current}/{max}</span>
    </div>
  );
}
