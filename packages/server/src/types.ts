// =============================================================================
// HexWar Server — Internal Types
// =============================================================================

import type { PlayerId, GameState, BattleEvent, Command } from '@hexwar/engine';

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
  resolutionOrder: [PlayerId, PlayerId];
  players: {
    player: PlayerId;
    commandsSubmitted: number;
    rngSeed: number;
  }[];
  events: BattleEvent[];
}

export interface Room {
  id: string;
  players: Map<PlayerId, ConnectedPlayer>;
  gameState: GameState | null;
  gameSeed: number | null;
  forfeited: boolean;
  buildConfirmed: Set<PlayerId>;
  bufferedCommands: Map<PlayerId, Command[]>;
  disconnectedPlayers: Map<PlayerId, DisconnectedPlayer>;
  turnLog: TurnRecord[];
  timers: {
    build: ReturnType<typeof setTimeout> | null;
    turn: ReturnType<typeof setTimeout> | null;
  };
}

export type RoomPhase = 'waiting' | 'playing' | 'finished';

export function getRoomPhase(room: Room): RoomPhase {
  if (!room.gameState) return 'waiting';
  if (room.forfeited) return 'finished';
  if (room.gameState.phase === 'game-over') return 'finished';
  return 'playing';
}
