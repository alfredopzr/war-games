import { useCallback, type ReactElement } from 'react';
import type { DirectiveType } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

interface DirectiveInfo {
  type: DirectiveType;
  name: string;
  desc: string;
}

const DIRECTIVES: readonly DirectiveInfo[] = [
  { type: 'advance', name: 'Advance', desc: 'Move toward the objective aggressively' },
  { type: 'hold', name: 'Hold', desc: 'Stay in position and defend' },
  { type: 'flank-left', name: 'Flank Left', desc: 'Circle around the left side' },
  { type: 'flank-right', name: 'Flank Right', desc: 'Circle around the right side' },
  { type: 'scout', name: 'Scout', desc: 'Explore and reveal enemy positions' },
  { type: 'support', name: 'Support', desc: 'Stay back and provide fire support' },
] as const;

export function DirectiveSelector(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const setUnitDirective = useGameStore((s) => s.setUnitDirective);

  const handleSelect = useCallback(
    (directive: DirectiveType): void => {
      if (!selectedUnit) return;
      setUnitDirective(selectedUnit.id, directive);
    },
    [selectedUnit, setUnitDirective],
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
