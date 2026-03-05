// =============================================================================
// HexWar Server — Integration Tests
// =============================================================================
// Tests the full multiplayer flow using real socket.io connections.
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';

import {
  createRoom,
  joinRoom,
  getRoomBySocket,
  leaveRoom,
  handleDisconnect,
  handleReconnect,
  rooms,
} from './rooms';
import { filterStateForPlayer } from './state-filter';
import { clearAllTimers } from './timers';
import {
  startGame,
  handlePlaceUnit,
  handleRemoveUnit,
  handleSetDirective,
  handleConfirmBuild,
  handleSubmitCommands,
} from './game-loop';

import type { PlayerId } from '@hexwar/engine';
import { getRoomPhase } from './types';

// -----------------------------------------------------------------------------
// Test Server Setup
// -----------------------------------------------------------------------------

let httpServer: HttpServer;
let ioServer: Server;
let port: number;

function createClient(): ClientSocket {
  return ioc(`http://localhost:${port}`, {
    autoConnect: true,
    reconnection: false,
    transports: ['websocket'],
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForAnyEvent(
  socket: ClientSocket,
  events: string[],
  timeoutMs = 3000,
): Promise<{ event: string; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for any of: ${events.join(', ')}`)),
      timeoutMs,
    );
    let resolved = false;
    for (const event of events) {
      socket.once(event, (data: Record<string, unknown>) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({ event, data });
        }
      });
    }
  });
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      httpServer = createServer();
      ioServer = new Server(httpServer, {
        cors: { origin: '*' },
      });

      // Wire socket events (mirrors index.ts)
      ioServer.on('connection', (socket) => {
        socket.on('create-room', () => {
          const room = createRoom();
          const { playerId, reconnectToken } = joinRoom(room.id, socket.id);
          socket.join(room.id);
          socket.emit('room-created', {
            type: 'room-created',
            roomId: room.id,
            playerId,
            reconnectToken,
          });
        });

        socket.on('join-room', ({ roomId }: { roomId: string }) => {
          try {
            const { room, playerId, reconnectToken } = joinRoom(roomId, socket.id);
            socket.join(roomId);
            socket.emit('room-joined', {
              type: 'room-joined',
              roomId,
              playerId,
              reconnectToken,
            });
            socket.to(roomId).emit('opponent-joined', { type: 'opponent-joined' });

            if (room.players.size === 2) {
              startGame(room, ioServer);
            }
          } catch (err) {
            socket.emit('room-error', {
              type: 'room-error',
              message: (err as Error).message,
            });
          }
        });

        socket.on('leave-room', () => {
          const found = getRoomBySocket(socket.id);
          if (!found) return;
          const { room, playerId } = found;
          socket.leave(room.id);

          if (getRoomPhase(room) === 'playing') {
            const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
            socket.to(room.id).emit('forfeit', {
              type: 'forfeit',
              winner: enemyId,
              reason: 'leave',
            });
            clearAllTimers(room);
            room.forfeited = true;
          }

          leaveRoom(room.id, playerId);
        });

        socket.on(
          'place-unit',
          (data: { unitType: string; position: { q: number; r: number; s: number }; directive: string }) => {
            const found = getRoomBySocket(socket.id);
            if (!found) return;
            try {
              handlePlaceUnit(
                found.room,
                found.playerId,
                data.unitType as Parameters<typeof handlePlaceUnit>[2],
                data.position,
                data.directive as Parameters<typeof handlePlaceUnit>[4],
                ioServer,
              );
            } catch (err) {
              socket.emit('room-error', {
                type: 'room-error',
                message: (err as Error).message,
              });
            }
          },
        );

        socket.on('remove-unit', (data: { unitId: string }) => {
          const found = getRoomBySocket(socket.id);
          if (!found) return;
          try {
            handleRemoveUnit(found.room, found.playerId, data.unitId, ioServer);
          } catch (err) {
            socket.emit('room-error', {
              type: 'room-error',
              message: (err as Error).message,
            });
          }
        });

        socket.on('set-directive', (data: { unitId: string; directive: string }) => {
          const found = getRoomBySocket(socket.id);
          if (!found) return;
          try {
            handleSetDirective(
              found.room,
              found.playerId,
              data.unitId,
              data.directive as Parameters<typeof handleSetDirective>[3],
              ioServer,
            );
          } catch (err) {
            socket.emit('room-error', {
              type: 'room-error',
              message: (err as Error).message,
            });
          }
        });

        socket.on('confirm-build', () => {
          const found = getRoomBySocket(socket.id);
          if (!found) return;
          handleConfirmBuild(found.room, found.playerId, ioServer);
        });

        socket.on('submit-commands', (data: { commands: Parameters<typeof handleSubmitCommands>[2] }) => {
          const found = getRoomBySocket(socket.id);
          if (!found) return;
          handleSubmitCommands(found.room, found.playerId, data.commands, ioServer);
        });

        socket.on(
          'reconnect-attempt',
          (data: { roomId: string; reconnectToken: string }) => {
            try {
              const { room, playerId } = handleReconnect(
                data.roomId,
                data.reconnectToken,
                socket.id,
              );
              socket.join(room.id);

              if (room.gameState) {
                const filtered = filterStateForPlayer(room.gameState, playerId);
                socket.emit('game-start', {
                  type: 'game-start',
                  state: filtered,
                  playerId,
                });
              }

              socket.to(room.id).emit('opponent-reconnected', {
                type: 'opponent-reconnected',
              });
            } catch (err) {
              socket.emit('room-error', {
                type: 'room-error',
                message: (err as Error).message,
              });
            }
          },
        );

        socket.on('disconnect', () => {
          const found = getRoomBySocket(socket.id);
          if (!found) return;
          const { room, playerId } = found;

          if (getRoomPhase(room) === 'playing') {
            handleDisconnect(room.id, playerId);
            const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
            const deadline = Date.now() + 30000;
            socket.to(room.id).emit('opponent-disconnected', {
              type: 'opponent-disconnected',
              reconnectDeadline: deadline,
            });

            const disconnected = room.disconnectedPlayers.get(playerId);
            if (disconnected) {
              disconnected.forfeitTimer = setTimeout(() => {
                socket.to(room.id).emit('forfeit', {
                  type: 'forfeit',
                  winner: enemyId,
                  reason: 'disconnect',
                });
                clearAllTimers(room);
                room.forfeited = true;
              }, 30000);
            }
          } else if (getRoomPhase(room) === 'waiting') {
            leaveRoom(room.id, playerId);
          }
        });
      });

      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    }),
);

afterEach(() => {
  // Clean up all rooms between tests
  for (const [id, room] of rooms) {
    clearAllTimers(room);
    // Clear forfeit timers
    for (const [, disc] of room.disconnectedPlayers) {
      if (disc.forfeitTimer) clearTimeout(disc.forfeitTimer);
    }
    rooms.delete(id);
  }
});

afterAll(
  () =>
    new Promise<void>((resolve) => {
      ioServer.close();
      httpServer.close(() => resolve());
    }),
);

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('Room Creation and Joining', () => {
  it('should create a room and receive room-created', async () => {
    const client = createClient();
    try {
      const created = waitForEvent<{ roomId: string; playerId: string; reconnectToken: string }>(
        client,
        'room-created',
      );
      client.emit('create-room');
      const data = await created;

      expect(data.roomId).toHaveLength(6);
      expect(data.playerId).toBe('player1');
      expect(data.reconnectToken).toBeTruthy();
    } finally {
      client.disconnect();
    }
  });

  it('should join a room and both receive game-start', async () => {
    const client1 = createClient();
    const client2 = createClient();
    try {
      const created = waitForEvent<{ roomId: string }>(client1, 'room-created');
      client1.emit('create-room');
      const { roomId } = await created;

      const [p1Start, p2Joined] = await Promise.all([
        waitForEvent<{ playerId: string; state: Record<string, unknown> }>(client1, 'game-start'),
        (async () => {
          const joined = waitForEvent<{ playerId: string }>(client2, 'room-joined');
          const gameStart = waitForEvent<{ playerId: string; state: Record<string, unknown> }>(
            client2,
            'game-start',
          );
          client2.emit('join-room', { roomId });
          await joined;
          return gameStart;
        })(),
      ]);

      expect(p1Start.playerId).toBe('player1');
      expect(p1Start.state).toBeTruthy();
      expect(p2Joined.playerId).toBe('player2');
      expect(p2Joined.state).toBeTruthy();
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });

  it('should reject joining a nonexistent room', async () => {
    const client = createClient();
    try {
      const error = waitForEvent<{ message: string }>(client, 'room-error');
      client.emit('join-room', { roomId: 'ZZZZZZ' });
      const data = await error;
      expect(data.message).toContain('does not exist');
    } finally {
      client.disconnect();
    }
  });

  it('should reject joining a full room', async () => {
    const client1 = createClient();
    const client2 = createClient();
    const client3 = createClient();
    try {
      const created = waitForEvent<{ roomId: string }>(client1, 'room-created');
      client1.emit('create-room');
      const { roomId } = await created;

      // Client2 joins and both get game-start (room is now full)
      const p1Start = waitForEvent(client1, 'game-start');
      const p2Start = waitForEvent(client2, 'game-start');
      client2.emit('join-room', { roomId });
      await Promise.all([p1Start, p2Start]);

      // Client3 tries to join the full room
      const error = waitForEvent<{ message: string }>(client3, 'room-error');
      client3.emit('join-room', { roomId });
      const data = await error;
      expect(data.message).toContain('full');
    } finally {
      client1.disconnect();
      client2.disconnect();
      client3.disconnect();
    }
  });
});

describe('Build Phase', () => {
  it('should place a unit and receive state-update', async () => {
    const client1 = createClient();
    const client2 = createClient();
    try {
      const created = waitForEvent<{ roomId: string }>(client1, 'room-created');
      client1.emit('create-room');
      const { roomId } = await created;

      // Wait for game to start
      const p1Start = waitForEvent<{ state: { map: { player1Deployment: Array<{ q: number; r: number; s: number }> } } }>(
        client1,
        'game-start',
      );
      client2.emit('join-room', { roomId });
      const startData = await p1Start;

      // Place a unit in P1's deployment zone
      const deployHex = startData.state.map.player1Deployment[0]!;
      const stateUpdate = waitForEvent<{ state: Record<string, unknown> }>(client1, 'state-update');
      client1.emit('place-unit', {
        unitType: 'infantry',
        position: deployHex,
        directive: 'advance',
      });
      const update = await stateUpdate;
      expect(update.state).toBeTruthy();
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });

  it('should transition to battle when both players confirm build', async () => {
    const client1 = createClient();
    const client2 = createClient();
    try {
      const created = waitForEvent<{ roomId: string }>(client1, 'room-created');
      client1.emit('create-room');
      const { roomId } = await created;

      await Promise.all([
        waitForEvent(client1, 'game-start'),
        (async () => {
          client2.emit('join-room', { roomId });
          await waitForEvent(client2, 'game-start');
        })(),
      ]);

      // Both confirm build
      const p1Battle = waitForEvent<{ state: Record<string, unknown> }>(client1, 'battle-start');
      const p2Battle = waitForEvent<{ state: Record<string, unknown> }>(client2, 'battle-start');

      client1.emit('confirm-build');
      client2.emit('confirm-build');

      const [b1, b2] = await Promise.all([p1Battle, p2Battle]);
      expect(b1.state).toBeTruthy();
      expect(b2.state).toBeTruthy();
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });
});

describe('Battle Phase', () => {
  async function setupBattle(): Promise<{
    client1: ClientSocket;
    client2: ClientSocket;
    roomId: string;
  }> {
    const client1 = createClient();
    const client2 = createClient();

    const created = waitForEvent<{ roomId: string }>(client1, 'room-created');
    client1.emit('create-room');
    const { roomId } = await created;

    await Promise.all([
      waitForEvent(client1, 'game-start'),
      (async () => {
        client2.emit('join-room', { roomId });
        await waitForEvent(client2, 'game-start');
      })(),
    ]);

    // Both confirm to enter battle
    const p1Battle = waitForEvent(client1, 'battle-start');
    const p2Battle = waitForEvent(client2, 'battle-start');
    client1.emit('confirm-build');
    client2.emit('confirm-build');
    await Promise.all([p1Battle, p2Battle]);

    return { client1, client2, roomId };
  }

  it('should resolve when both players submit commands', async () => {
    const { client1, client2 } = await setupBattle();
    try {
      // Both players submit — resolution fires when both are received
      const p1Result = waitForAnyEvent(client1, ['turn-result', 'round-end', 'game-over']);
      const p2Result = waitForAnyEvent(client2, ['turn-result', 'round-end', 'game-over']);

      client1.emit('submit-commands', { commands: [] });
      client2.emit('submit-commands', { commands: [] });
      const [r1, r2] = await Promise.all([p1Result, p2Result]);

      expect(r1.data).toBeTruthy();
      expect(r2.data).toBeTruthy();
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });

  it('should reject double-submit from same player', async () => {
    const { client1, client2 } = await setupBattle();
    try {
      // Player 1 submits
      const ack = waitForEvent(client1, 'commands-received');
      client1.emit('submit-commands', { commands: [] });
      await ack;

      // Player 1 tries to submit again
      const error = waitForEvent<{ message: string }>(client1, 'room-error');
      client1.emit('submit-commands', { commands: [] });
      const data = await error;
      expect(data.message).toContain('already submitted');
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });

  it('should resolve simultaneous turns until round or game ends', async () => {
    const { client1, client2 } = await setupBattle();
    try {
      // Play up to 3 simultaneous turns or until round/game ends
      for (let i = 0; i < 3; i++) {
        const p1Result = waitForAnyEvent(client1, ['turn-result', 'round-end', 'game-over']);
        const p2Result = waitForAnyEvent(client2, ['turn-result', 'round-end', 'game-over']);

        client1.emit('submit-commands', { commands: [] });
        client2.emit('submit-commands', { commands: [] });

        const [r1] = await Promise.all([p1Result, p2Result]);

        if (r1.event === 'round-end' || r1.event === 'game-over') {
          break;
        }
      }

      expect(true).toBe(true);
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });
});

describe('Leave and Forfeit', () => {
  it('should forfeit when a player leaves mid-game', async () => {
    const client1 = createClient();
    const client2 = createClient();
    try {
      const created = waitForEvent<{ roomId: string }>(client1, 'room-created');
      client1.emit('create-room');
      const { roomId } = await created;

      await Promise.all([
        waitForEvent(client1, 'game-start'),
        (async () => {
          client2.emit('join-room', { roomId });
          await waitForEvent(client2, 'game-start');
        })(),
      ]);

      // Both confirm build to get into playing state
      const p1Battle = waitForEvent(client1, 'battle-start');
      const p2Battle = waitForEvent(client2, 'battle-start');
      client1.emit('confirm-build');
      client2.emit('confirm-build');
      await Promise.all([p1Battle, p2Battle]);

      // P2 leaves — P1 should get forfeit
      const forfeit = waitForEvent<{ winner: string; reason: string }>(client1, 'forfeit');
      client2.emit('leave-room');
      const data = await forfeit;

      expect(data.winner).toBe('player1');
      expect(data.reason).toBe('leave');
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });
});

describe('Disconnect and Reconnect', () => {
  it('should notify opponent on disconnect and allow reconnect', async () => {
    const client1 = createClient();
    const client2 = createClient();
    try {
      const created = waitForEvent<{ roomId: string }>(client1, 'room-created');
      client1.emit('create-room');
      const { roomId } = await created;

      const p2Joined = waitForEvent<{ reconnectToken: string }>(client2, 'room-joined');
      const p1Start = waitForEvent(client1, 'game-start');
      const p2Start = waitForEvent(client2, 'game-start');
      client2.emit('join-room', { roomId });
      const joinData = await p2Joined;
      await Promise.all([p1Start, p2Start]);

      // Confirm build to enter playing phase
      const p1Battle = waitForEvent(client1, 'battle-start');
      const p2Battle = waitForEvent(client2, 'battle-start');
      client1.emit('confirm-build');
      client2.emit('confirm-build');
      await Promise.all([p1Battle, p2Battle]);

      // Set up disconnect listener BEFORE disconnecting
      const disconnectNotice = waitForEvent<{ reconnectDeadline: number }>(
        client1,
        'opponent-disconnected',
      );
      client2.disconnect();
      const discData = await disconnectNotice;
      expect(discData.reconnectDeadline).toBeGreaterThan(Date.now());

      // P2 reconnects with a new socket
      const client2b = createClient();
      try {
        const reconnectStart = waitForEvent<{ playerId: string; state: Record<string, unknown> }>(
          client2b,
          'game-start',
        );
        const reconnectNotice = waitForEvent(client1, 'opponent-reconnected');

        client2b.emit('reconnect-attempt', {
          roomId,
          reconnectToken: joinData.reconnectToken,
        });

        const [reconData] = await Promise.all([reconnectStart, reconnectNotice]);
        expect(reconData.playerId).toBe('player2');
        expect(reconData.state).toBeTruthy();
      } finally {
        client2b.disconnect();
      }
    } finally {
      client1.disconnect();
    }
  });

  it('should reject reconnect with invalid token', async () => {
    const client1 = createClient();
    const client2 = createClient();
    try {
      const created = waitForEvent<{ roomId: string }>(client1, 'room-created');
      client1.emit('create-room');
      const { roomId } = await created;

      const p1Start = waitForEvent(client1, 'game-start');
      const p2Start = waitForEvent(client2, 'game-start');
      client2.emit('join-room', { roomId });
      await Promise.all([p1Start, p2Start]);

      // Confirm build to get into playing phase
      const p1Battle = waitForEvent(client1, 'battle-start');
      const p2Battle = waitForEvent(client2, 'battle-start');
      client1.emit('confirm-build');
      client2.emit('confirm-build');
      await Promise.all([p1Battle, p2Battle]);

      // Set up listener BEFORE disconnect
      const disconnectNotice = waitForEvent(client1, 'opponent-disconnected');
      client2.disconnect();
      await disconnectNotice;

      // Try reconnect with bad token
      const client3 = createClient();
      try {
        const error = waitForEvent<{ message: string }>(client3, 'room-error');
        client3.emit('reconnect-attempt', {
          roomId,
          reconnectToken: 'bad-token-12345',
        });
        const data = await error;
        expect(data.message).toContain('No matching');
      } finally {
        client3.disconnect();
      }
    } finally {
      client1.disconnect();
    }
  });
});

describe('Full Game Flow', () => {
  it('should play through multiple turns without errors', async () => {
    const client1 = createClient();
    const client2 = createClient();
    try {
      // Create and join
      const created = waitForEvent<{ roomId: string }>(client1, 'room-created');
      client1.emit('create-room');
      const { roomId } = await created;

      client2.emit('join-room', { roomId });
      await Promise.all([
        waitForEvent(client1, 'game-start'),
        waitForEvent(client2, 'game-start'),
      ]);

      // Confirm build
      const p1Battle = waitForEvent(client1, 'battle-start');
      const p2Battle = waitForEvent(client2, 'battle-start');
      client1.emit('confirm-build');
      client2.emit('confirm-build');
      await Promise.all([p1Battle, p2Battle]);

      // Play up to 4 simultaneous turns with empty commands
      for (let i = 0; i < 4; i++) {
        const p1Result = waitForAnyEvent(client1, ['turn-result', 'round-end', 'game-over']);
        const p2Result = waitForAnyEvent(client2, ['turn-result', 'round-end', 'game-over']);

        client1.emit('submit-commands', { commands: [] });
        client2.emit('submit-commands', { commands: [] });

        const [r1] = await Promise.all([p1Result, p2Result]);

        if (r1.event === 'round-end' || r1.event === 'game-over') {
          break;
        }
      }

      // If we got here without errors, the flow works
      expect(true).toBe(true);
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });
});
