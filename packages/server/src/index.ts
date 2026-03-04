// =============================================================================
// HexWar Server — Entry Point
// =============================================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomBySocket,
  handleDisconnect,
  handleReconnect,
  deleteRoom,
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

import type { PlayerId, DirectiveTarget } from '@hexwar/engine';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(express.static(clientDist));

app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

io.on('connection', (socket) => {
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
        startGame(room, io);
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

    if (room.phase === 'playing') {
      const enemyId: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
      socket.to(room.id).emit('forfeit', {
        type: 'forfeit',
        winner: enemyId,
        reason: 'leave',
      });
      clearAllTimers(room);
      room.phase = 'finished';
    }

    leaveRoom(room.id, playerId);
  });

  socket.on(
    'place-unit',
    (data: { unitType: string; position: { q: number; r: number; s: number }; directive: string; target?: unknown }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      try {
        handlePlaceUnit(
          found.room,
          found.playerId,
          data.unitType as Parameters<typeof handlePlaceUnit>[2],
          data.position,
          data.directive as Parameters<typeof handlePlaceUnit>[4],
          io,
          data.target as DirectiveTarget | undefined,
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
      handleRemoveUnit(found.room, found.playerId, data.unitId, io);
    } catch (err) {
      socket.emit('room-error', {
        type: 'room-error',
        message: (err as Error).message,
      });
    }
  });

  socket.on('set-directive', (data: { unitId: string; directive: string; target?: unknown }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    try {
      handleSetDirective(
        found.room,
        found.playerId,
        data.unitId,
        data.directive as Parameters<typeof handleSetDirective>[3],
        io,
        data.target as DirectiveTarget | undefined,
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
    try {
      handleConfirmBuild(found.room, found.playerId, io);
    } catch (err) {
      socket.emit('room-error', {
        type: 'room-error',
        message: (err as Error).message,
      });
    }
  });

  socket.on('submit-commands', (data: { commands: Parameters<typeof handleSubmitCommands>[2] }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    try {
      handleSubmitCommands(found.room, found.playerId, data.commands, io);
    } catch (err) {
      socket.emit('room-error', {
        type: 'room-error',
        message: (err as Error).message,
      });
    }
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

    if (room.phase === 'playing') {
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
          if (room.phase !== 'playing') return;
          socket.to(room.id).emit('forfeit', {
            type: 'forfeit',
            winner: enemyId,
            reason: 'disconnect',
          });
          clearAllTimers(room);
          room.phase = 'finished';
        }, 30000);
      }
    } else if (room.phase === 'waiting') {
      leaveRoom(room.id, playerId);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io, httpServer };
