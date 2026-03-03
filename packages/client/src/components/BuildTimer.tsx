import { useEffect, type ReactElement } from 'react';
import { useGameStore } from '../store/game-store';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timerClass(seconds: number): string {
  if (seconds <= 10) return 'timer-value timer-critical';
  if (seconds <= 30) return 'timer-value timer-warning';
  return 'timer-value timer-normal';
}

export function BuildTimer(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const buildTimeRemaining = useGameStore((s) => s.buildTimeRemaining);
  const startBuildTimer = useGameStore((s) => s.startBuildTimer);
  const confirmBuild = useGameStore((s) => s.confirmBuild);
  const buildTimerInterval = useGameStore((s) => s.buildTimerInterval);

  // Start timer when build phase begins and no interval is running
  useEffect(() => {
    if (gameState?.phase === 'build' && !buildTimerInterval) {
      startBuildTimer();
    }
  }, [gameState?.phase, buildTimerInterval, startBuildTimer]);

  if (!gameState || gameState.phase !== 'build') return null;

  return (
    <div className="build-timer">
      <div className={timerClass(buildTimeRemaining)}>
        {formatTime(buildTimeRemaining)}
      </div>
      <button className="ready-btn" onClick={confirmBuild} type="button">
        Ready
      </button>
    </div>
  );
}
