import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import type { PlayerId } from '@hexwar/engine';
import type { ConnectedPlayer, Room } from './types';

export const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

function createEmptyRoom(id: string): Room {
  return {
    id,
    players: new Map<PlayerId, ConnectedPlayer>(),
    gameState: null,
    gameSeed: null,
    phase: 'waiting',
    buildConfirmed: new Set<PlayerId>(),
    disconnectedPlayers: new Map(),
    timers: {
      build: null,
      turn: null,
    },
  };
}

export function createRoom(): Room {
  const id = generateRoomCode();
  const room = createEmptyRoom(id);
  rooms.set(id, room);
  return room;
}

export function joinRoom(
  roomId: string,
  socketId: string,
): { room: Room; playerId: PlayerId; reconnectToken: string } {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error(`Room ${roomId} does not exist`);
  }

  if (room.players.size >= 2) {
    throw new Error(`Room ${roomId} is full`);
  }

  const playerId: PlayerId = room.players.has('player1') ? 'player2' : 'player1';
  const reconnectToken = uuidv4();

  const player: ConnectedPlayer = {
    socketId,
    playerId,
    reconnectToken,
  };

  room.players.set(playerId, player);

  return { room, playerId, reconnectToken };
}

export function leaveRoom(roomId: string, playerId: PlayerId): void {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  room.players.delete(playerId);

  if (room.players.size === 0) {
    rooms.delete(roomId);
  }
}

export function handleDisconnect(roomId: string, playerId: PlayerId): void {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  const player = room.players.get(playerId);
  if (!player) {
    return;
  }

  room.disconnectedPlayers.set(playerId, {
    token: player.reconnectToken,
    disconnectedAt: Date.now(),
    forfeitTimer: null,
  });

  room.players.delete(playerId);
}

export function handleReconnect(
  roomId: string,
  reconnectToken: string,
  newSocketId: string,
): { room: Room; playerId: PlayerId } {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error(`Room ${roomId} does not exist`);
  }

  let matchedPlayerId: PlayerId | null = null;

  for (const [playerId, disconnected] of room.disconnectedPlayers) {
    if (disconnected.token === reconnectToken) {
      matchedPlayerId = playerId;
      break;
    }
  }

  if (!matchedPlayerId) {
    throw new Error('No matching disconnected player for the provided reconnect token');
  }

  const disconnected = room.disconnectedPlayers.get(matchedPlayerId);
  if (disconnected?.forfeitTimer) {
    clearTimeout(disconnected.forfeitTimer);
  }

  room.disconnectedPlayers.delete(matchedPlayerId);

  const player: ConnectedPlayer = {
    socketId: newSocketId,
    playerId: matchedPlayerId,
    reconnectToken,
  };

  room.players.set(matchedPlayerId, player);

  return { room, playerId: matchedPlayerId };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getRoomBySocket(
  socketId: string,
): { room: Room; playerId: PlayerId } | undefined {
  for (const room of rooms.values()) {
    for (const [playerId, player] of room.players) {
      if (player.socketId === socketId) {
        return { room, playerId };
      }
    }
  }
  return undefined;
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
}
