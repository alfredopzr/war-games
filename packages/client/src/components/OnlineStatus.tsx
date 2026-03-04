import type { ReactElement } from 'react';
import { useGameStore } from '../store/game-store';

export function OnlineStatus(): ReactElement | null {
  const gameMode = useGameStore((s) => s.gameMode);
  const roomId = useGameStore((s) => s.roomId);
  const opponentConnected = useGameStore((s) => s.opponentConnected);

  if (gameMode !== 'online') return null;

  return (
    <div className="online-status">
      <div className="online-status-row">
        <span
          className={`online-status-dot ${opponentConnected ? 'connected' : 'disconnected'}`}
        />
        <span className="online-status-label">
          {opponentConnected ? 'Opponent connected' : 'Opponent disconnected'}
        </span>
      </div>
      {roomId && (
        <div className="online-status-room">
          Room: <span className="online-status-code">{roomId}</span>
        </div>
      )}
    </div>
  );
}
