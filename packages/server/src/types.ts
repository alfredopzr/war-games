// =============================================================================
// HexWar Server — Internal Types
// =============================================================================

import type { PlayerId, GameState } from '@hexwar/engine';

export interface ConnectedPlayer {
  socketId: string;
  playerId: PlayerId;
  reconnectToken: string;
}

export interface DisconnectedPlayer {
  token: string;
  disconnectedAt: number;
  forfeitTimer: ReturnType<typeof setTimeout> | null;
}

export interface Room {
  id: string;
  players: Map<PlayerId, ConnectedPlayer>;
  gameState: GameState | null;
  phase: 'waiting' | 'playing' | 'finished';
  buildConfirmed: Set<PlayerId>;
  disconnectedPlayers: Map<PlayerId, DisconnectedPlayer>;
  timers: {
    build: ReturnType<typeof setTimeout> | null;
    turn: ReturnType<typeof setTimeout> | null;
  };
}
