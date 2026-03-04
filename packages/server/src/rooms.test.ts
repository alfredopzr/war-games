import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  handleDisconnect,
  handleReconnect,
  getRoom,
  getRoomBySocket,
  deleteRoom,
  rooms,
} from './rooms';
import { getRoomPhase } from './types';

beforeEach(() => {
  rooms.clear();
});

describe('createRoom', () => {
  it('creates a room with a 6-char uppercase alphanumeric ID', () => {
    const room = createRoom();
    expect(room.id).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('creates a room with waiting phase', () => {
    const room = createRoom();
    expect(getRoomPhase(room)).toBe('waiting');
  });

  it('stores the room in the rooms map', () => {
    const room = createRoom();
    expect(rooms.get(room.id)).toBe(room);
  });
});

describe('joinRoom', () => {
  it('assigns player1 to the first player', () => {
    const room = createRoom();
    const result = joinRoom(room.id, 'socket-1');

    expect(result.playerId).toBe('player1');
    expect(result.reconnectToken).toBeTruthy();
    expect(result.room).toBe(room);
  });

  it('assigns player2 to the second player', () => {
    const room = createRoom();
    joinRoom(room.id, 'socket-1');
    const result = joinRoom(room.id, 'socket-2');

    expect(result.playerId).toBe('player2');
    expect(result.reconnectToken).toBeTruthy();
  });

  it('gives each player a unique reconnect token', () => {
    const room = createRoom();
    const p1 = joinRoom(room.id, 'socket-1');
    const p2 = joinRoom(room.id, 'socket-2');

    expect(p1.reconnectToken).not.toBe(p2.reconnectToken);
  });

  it('throws when joining a full room', () => {
    const room = createRoom();
    joinRoom(room.id, 'socket-1');
    joinRoom(room.id, 'socket-2');

    expect(() => joinRoom(room.id, 'socket-3')).toThrow('full');
  });

  it('throws when joining a nonexistent room', () => {
    expect(() => joinRoom('NOPE00', 'socket-1')).toThrow('does not exist');
  });
});

describe('leaveRoom', () => {
  it('removes the player from the room', () => {
    const room = createRoom();
    joinRoom(room.id, 'socket-1');

    leaveRoom(room.id, 'player1');
    expect(room.players.has('player1')).toBe(false);
  });

  it('deletes the room when the last player leaves', () => {
    const room = createRoom();
    joinRoom(room.id, 'socket-1');

    leaveRoom(room.id, 'player1');
    expect(rooms.has(room.id)).toBe(false);
  });

  it('keeps the room when one player remains', () => {
    const room = createRoom();
    joinRoom(room.id, 'socket-1');
    joinRoom(room.id, 'socket-2');

    leaveRoom(room.id, 'player1');
    expect(rooms.has(room.id)).toBe(true);
    expect(room.players.size).toBe(1);
  });
});

describe('getRoomBySocket', () => {
  it('finds the correct room and player by socket ID', () => {
    const room = createRoom();
    joinRoom(room.id, 'socket-1');
    joinRoom(room.id, 'socket-2');

    const result = getRoomBySocket('socket-2');
    expect(result).toBeDefined();
    expect(result!.room).toBe(room);
    expect(result!.playerId).toBe('player2');
  });

  it('returns undefined for unknown socket ID', () => {
    const result = getRoomBySocket('unknown');
    expect(result).toBeUndefined();
  });
});

describe('handleDisconnect', () => {
  it('moves the player to disconnectedPlayers', () => {
    const room = createRoom();
    const { reconnectToken } = joinRoom(room.id, 'socket-1');

    handleDisconnect(room.id, 'player1');

    expect(room.players.has('player1')).toBe(false);
    expect(room.disconnectedPlayers.has('player1')).toBe(true);

    const disconnected = room.disconnectedPlayers.get('player1')!;
    expect(disconnected.token).toBe(reconnectToken);
    expect(disconnected.disconnectedAt).toBeGreaterThan(0);
    expect(disconnected.forfeitTimer).toBeNull();
  });
});

describe('handleReconnect', () => {
  it('restores a disconnected player with a valid token', () => {
    const room = createRoom();
    const { reconnectToken } = joinRoom(room.id, 'socket-1');

    handleDisconnect(room.id, 'player1');

    const result = handleReconnect(room.id, reconnectToken, 'socket-new');

    expect(result.playerId).toBe('player1');
    expect(result.room).toBe(room);
    expect(room.players.has('player1')).toBe(true);
    expect(room.players.get('player1')!.socketId).toBe('socket-new');
    expect(room.disconnectedPlayers.has('player1')).toBe(false);
  });

  it('throws with an invalid reconnect token', () => {
    const room = createRoom();
    joinRoom(room.id, 'socket-1');
    handleDisconnect(room.id, 'player1');

    expect(() => handleReconnect(room.id, 'wrong-token', 'socket-new')).toThrow(
      'No matching disconnected player',
    );
  });

  it('throws when there are no disconnected players', () => {
    const room = createRoom();
    joinRoom(room.id, 'socket-1');

    expect(() => handleReconnect(room.id, 'any-token', 'socket-new')).toThrow(
      'No matching disconnected player',
    );
  });

  it('throws when room does not exist', () => {
    expect(() => handleReconnect('NOPE00', 'token', 'socket')).toThrow('does not exist');
  });
});

describe('getRoom', () => {
  it('returns the room when it exists', () => {
    const room = createRoom();
    expect(getRoom(room.id)).toBe(room);
  });

  it('returns undefined for nonexistent room', () => {
    expect(getRoom('NOPE00')).toBeUndefined();
  });
});

describe('deleteRoom', () => {
  it('removes the room from the map', () => {
    const room = createRoom();
    deleteRoom(room.id);
    expect(rooms.has(room.id)).toBe(false);
  });
});
