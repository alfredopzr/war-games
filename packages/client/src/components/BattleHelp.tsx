import { useState, type ReactElement } from 'react';
import { useGameStore } from '../store/game-store';

export function BattleHelp(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const [open, setOpen] = useState(false);

  if (!gameState || gameState.phase !== 'battle') return null;

  return (
    <>
      <button
        className="battle-help-toggle"
        onClick={() => setOpen(!open)}
        type="button"
        title="Battle help"
      >
        ?
      </button>
      {open && (
        <div className="battle-help">
          <button
            className="battle-help-close"
            onClick={() => setOpen(false)}
            type="button"
          >
            x
          </button>
          <div className="battle-help-content">
            <strong>Battle Phase</strong>
            <p>Your units move automatically based on their directives. Use <strong>Command Points (CP)</strong> to give direct orders:</p>
            <ul>
              <li>Click a unit to select it, then use the command bar at the bottom</li>
              <li>You have <strong>4 CP per turn</strong> — Move, Attack, Redirect, or Retreat</li>
              <li>The golden hex is the <strong>objective</strong> — hold it for 2 turns <em>and</em> control 2 cities to win the round</li>
              <li>Dark hexes are hidden by <strong>fog of war</strong></li>
            </ul>
            <p>Click <strong>End Turn</strong> when ready.</p>
          </div>
        </div>
      )}
    </>
  );
}
