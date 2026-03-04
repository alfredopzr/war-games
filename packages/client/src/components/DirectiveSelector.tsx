import { useCallback, type ReactElement } from 'react';
import type { DirectiveType } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

interface DirectiveInfo {
  type: DirectiveType;
  name: string;
  desc: string;
}

const DIRECTIVES: readonly DirectiveInfo[] = [
  { type: 'advance', name: 'Advance', desc: 'Push toward objective or target' },
  { type: 'hold', name: 'Hold', desc: '+1 DEF — move to target, then dig in' },
  { type: 'flank-left', name: 'Flank Left', desc: 'Arc left around target' },
  { type: 'flank-right', name: 'Flank Right', desc: 'Arc right around target' },
  { type: 'scout', name: 'Scout', desc: 'Acts first — reconnoiter target area' },
  { type: 'support', name: 'Support', desc: 'Follow and heal target friendly' },
  { type: 'hunt', name: 'Hunt', desc: 'Pursue and destroy target enemy' },
  { type: 'capture', name: 'Capture', desc: 'Move to city, occupy, then hold' },
] as const;

export function DirectiveSelector(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const setUnitDirective = useGameStore((s) => s.setUnitDirective);
  const setTargetSelectionMode = useGameStore((s) => s.setTargetSelectionMode);

  const handleSelect = useCallback(
    (directive: DirectiveType): void => {
      if (!selectedUnit) return;
      if (directive === 'hunt' || directive === 'capture') {
        setTargetSelectionMode(true, directive);
        return;
      }
      setUnitDirective(selectedUnit.id, directive);
    },
    [selectedUnit, setUnitDirective, setTargetSelectionMode],
  );

  if (!gameState || gameState.phase !== 'build') return null;
  if (!selectedUnit) return null;
  if (selectedUnit.owner !== currentPlayerView) return null;

  return (
    <div className="directive-selector">
      <h3>DIRECTIVE</h3>
      {DIRECTIVES.map((d) => {
        const isActive = selectedUnit.directive === d.type;
        const className = ['directive-option', isActive ? 'active' : '']
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={d.type}
            className={className}
            onClick={() => handleSelect(d.type)}
          >
            <div className="directive-name">{d.name}</div>
            <div className="directive-desc">{d.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
