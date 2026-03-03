import { type ReactElement } from 'react';
import { createGame } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

export function StartMenu(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const vsAI = useGameStore((s) => s.vsAI);
  const setVsAI = useGameStore((s) => s.setVsAI);
  const setGameState = useGameStore((s) => s.setGameState);
  const startBuildTimer = useGameStore((s) => s.startBuildTimer);

  if (gameState) return null;

  const startGame = (): void => {
    const state = createGame(42);
    setGameState(state);
    startBuildTimer();
  };

  return (
    <div className="start-menu-overlay">
      <div className="start-menu">
        <h1 className="start-menu-title">HexWar</h1>
        <label className="start-menu-toggle">
          <input
            type="checkbox"
            checked={vsAI}
            onChange={(e) => setVsAI(e.target.checked)}
          />
          Play vs AI
        </label>
        <button className="start-menu-button" onClick={startGame} type="button">
          Start Game
        </button>
      </div>
    </div>
  );
}
