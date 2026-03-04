import { useState, type ReactElement } from 'react';
import { useGameStore } from '../store/game-store';

export function BattleLog(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const battleLog = useGameStore((s) => s.battleLog);
  const [expanded, setExpanded] = useState(false);

  if (!gameState || gameState.phase !== 'battle') return null;
  if (battleLog.length === 0 && !expanded) {
    return (
      <button
        className="battle-log-toggle"
        onClick={() => setExpanded(true)}
        type="button"
      >
        Log
      </button>
    );
  }

  if (!expanded) {
    return (
      <button
        className="battle-log-toggle"
        onClick={() => setExpanded(true)}
        type="button"
      >
        Log ({battleLog.length})
      </button>
    );
  }

  return (
    <div className="battle-log">
      <div className="battle-log-header">
        <span>Battle Log</span>
        <button
          className="battle-log-close"
          onClick={() => setExpanded(false)}
          type="button"
        >
          ×
        </button>
      </div>
      <div className="battle-log-entries">
        {battleLog.length === 0 ? (
          <div className="battle-log-empty">No events yet</div>
        ) : (
          battleLog.map((entry, i) => (
            <div key={i} className={`battle-log-entry log-${entry.type}`}>
              <span className="log-turn">T{entry.turn}</span>
              <span className="log-msg">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
