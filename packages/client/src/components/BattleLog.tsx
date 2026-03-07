import { useEffect, useRef, type ReactElement } from 'react';
import { formatBattleEvent } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

export function BattleLog(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const battleLog = useGameStore((s) => s.battleLog);
  const entriesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    const el = entriesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [battleLog.length]);

  if (!gameState || gameState.phase !== 'battle') return null;

  return (
    <div className="battle-log">
      <div className="battle-log-header">
        <span>Battle Log</span>
      </div>
      <div className="battle-log-entries" ref={entriesRef}>
        {battleLog.length === 0 ? (
          <div className="battle-log-empty">No events yet</div>
        ) : (
          battleLog.map((entry, i) => (
            <div key={i} className={`battle-log-entry log-${entry.event.type}`}>
              <span className="log-turn">T{entry.turn}</span>
              <span className="log-msg">{formatBattleEvent(entry.event)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
