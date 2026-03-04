// =============================================================================
// HexWar Server — Internal Types
// =============================================================================

import type { PlayerId, GameState, BattleEvent } from '@hexwar/engine';

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

export interface TurnRecord {
  turnNumber: number;
  player: PlayerId;
  commandsSubmitted: number;
  rngSeed: number;
  events: BattleEvent[];
}

export interface Room {
  id: string;
  players: Map<PlayerId, ConnectedPlayer>;
  gameState: GameState | null;
  gameSeed: number | null;
  phase: 'waiting' | 'playing' | 'finished';
  buildConfirmed: Set<PlayerId>;
  disconnectedPlayers: Map<PlayerId, DisconnectedPlayer>;
  turnLog: TurnRecord[];
  timers: {
    build: ReturnType<typeof setTimeout> | null;
    turn: ReturnType<typeof setTimeout> | null;
  };
}
