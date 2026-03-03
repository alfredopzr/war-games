import type { ReactElement } from 'react';
import type { PlayerId } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

function playerLabel(player: PlayerId): string {
  return player === 'player1' ? 'Player 1' : 'Player 2';
}

function playerTextClass(player: PlayerId): string {
  return player === 'player1' ? 'player1-text' : 'player2-text';
}

export function TurnTransition(): ReactElement | null {
  const showTransition = useGameStore((s) => s.showTransition);
  const gameState = useGameStore((s) => s.gameState);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const dismissTransition = useGameStore((s) => s.dismissTransition);

  if (!showTransition) return null;

  const nextPlayer = currentPlayerView === 'player1' ? 'player2' : 'player1';
  const isBuildPhase = gameState?.phase === 'build';
  const heading = isBuildPhase
    ? `${playerLabel(nextPlayer)}: Build Phase`
    : `${playerLabel(nextPlayer)}'s Turn`;

  const hint = isBuildPhase
    ? 'Buy and place units in your highlighted deployment zone. Assign directives to control their battle behavior.'
    : 'Your units will act on their directives. Spend Command Points to give direct orders.';

  return (
    <div className="turn-transition" onClick={dismissTransition} role="button" tabIndex={0}>
      <h1 className={playerTextClass(nextPlayer)}>
        {heading}
      </h1>
      <p className="transition-hint">{hint}</p>
      <p>Click anywhere to continue</p>
    </div>
  );
}
