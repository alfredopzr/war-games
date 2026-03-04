import type { ReactElement } from 'react';
import { useGameStore } from '../store/game-store';

export function Toast(): ReactElement | null {
  const toastMessage = useGameStore((s) => s.toastMessage);

  if (!toastMessage) return null;

  return (
    <div className="toast">{toastMessage}</div>
  );
}
