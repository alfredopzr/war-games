import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlayerId } from '@hexwar/engine';
import { UNIT_STATS } from '@hexwar/engine';
import type { Room, ConnectedPlayer } from './types';
import { BUILD_DURATION } from './timers';
import { getRoomPhase } from './types';
import {
  startGame,
  handlePlaceUnit,
  handleRemoveUnit,
  handleSetDirective,
  handleConfirmBuild,
  handleSubmitCommands,
} from './game-loop';

// -----------------------------------------------------------------------------
// Mock IO
// -----------------------------------------------------------------------------

interface EmittedEvent {
  to: string;
  event: string;
  data: unknown;
}

interface MockIo {
  emitted: EmittedEvent[];
  to(id: string): { emit(event: string, data: unknown): void };
}

function createMockIo(): MockIo {
  const emitted: EmittedEvent[] = [];
  return {
    emitted,
    to(id: string) {
      return {
        emit(event: string, data: unknown) {
          emitted.push({ to: id, event, data });
        },
      };
    },
  };
}

// -----------------------------------------------------------------------------
// Room Factory
// -----------------------------------------------------------------------------

function createTestRoom(): Room {
  const players = new Map<PlayerId, ConnectedPlayer>();
  players.set('player1', {
    socketId: 'socket-p1',
    playerId: 'player1',
    reconnectToken: 'token-p1',
  });
  players.set('player2', {
    socketId: 'socket-p2',
    playerId: 'player2',
    reconnectToken: 'token-p2',
  });

  return {
    id: 'ROOM01',
    players,
    gameState: null,
    gameSeed: null,
    forfeited: false,
    buildConfirmed: new Set<PlayerId>(),
    bufferedCommands: new Map(),
    disconnectedPlayers: new Map(),
    turnLog: [],
    timers: {
      build: null,
      turn: null,
    },
  };
}

// Suppress timer side effects
beforeEach(() => {
  vi.useFakeTimers();
});

// -----------------------------------------------------------------------------
// startGame
// -----------------------------------------------------------------------------

describe('startGame', () => {
  it('creates gameState and sets room phase to playing', () => {
    const room = createTestRoom();
    const io = createMockIo();

    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    expect(room.gameState).not.toBeNull();
    expect(getRoomPhase(room)).toBe('playing');
    expect(room.gameState!.phase).toBe('build');
  });

  it('emits game-start to each player with their playerId', () => {
    const room = createTestRoom();
    const io = createMockIo();

    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    const p1Events = io.emitted.filter(
      (e) => e.to === 'socket-p1' && e.event === 'game-start',
    );
    const p2Events = io.emitted.filter(
      (e) => e.to === 'socket-p2' && e.event === 'game-start',
    );

    expect(p1Events).toHaveLength(1);
    expect(p2Events).toHaveLength(1);
    expect((p1Events[0]!.data as Record<string, unknown>).playerId).toBe('player1');
    expect((p2Events[0]!.data as Record<string, unknown>).playerId).toBe('player2');
  });

  it('starts a build timer', () => {
    const room = createTestRoom();
    const io = createMockIo();

    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    expect(room.timers.build).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// handlePlaceUnit
// -----------------------------------------------------------------------------

describe('handlePlaceUnit', () => {
  it('adds a unit to the player state', () => {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    const deployZone = room.gameState!.map.player1Deployment;
    const pos = deployZone[0]!;

    handlePlaceUnit(
      room,
      'player1',
      'infantry',
      pos,
      'advance',
      'ignore',
      null,
      io as unknown as Parameters<typeof handlePlaceUnit>[7],
    );

    expect(room.gameState!.players.player1.units).toHaveLength(1);
    expect(room.gameState!.players.player1.units[0]!.type).toBe('infantry');
  });

  it('emits state-update to both players', () => {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);
    io.emitted.length = 0; // clear game-start events

    const pos = room.gameState!.map.player1Deployment[0]!;
    handlePlaceUnit(
      room,
      'player1',
      'infantry',
      pos,
      'advance',
      'ignore',
      null,
      io as unknown as Parameters<typeof handlePlaceUnit>[7],
    );

    const updates = io.emitted.filter((e) => e.event === 'state-update');
    expect(updates).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// handleRemoveUnit
// -----------------------------------------------------------------------------

describe('handleRemoveUnit', () => {
  it('removes unit and refunds cost', () => {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    const pos = room.gameState!.map.player1Deployment[0]!;
    handlePlaceUnit(
      room,
      'player1',
      'infantry',
      pos,
      'advance',
      'ignore',
      null,
      io as unknown as Parameters<typeof handlePlaceUnit>[7],
    );

    const resourcesAfterPlace = room.gameState!.players.player1.resources;
    const unitId = room.gameState!.players.player1.units[0]!.id;

    handleRemoveUnit(
      room,
      'player1',
      unitId,
      io as unknown as Parameters<typeof handleRemoveUnit>[3],
    );

    expect(room.gameState!.players.player1.units).toHaveLength(0);
    expect(room.gameState!.players.player1.resources).toBe(
      resourcesAfterPlace + UNIT_STATS.infantry.cost,
    );
  });
});

// -----------------------------------------------------------------------------
// handleSetDirective
// -----------------------------------------------------------------------------

describe('handleSetDirective', () => {
  it('changes the directive on a unit', () => {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    const pos = room.gameState!.map.player1Deployment[0]!;
    handlePlaceUnit(
      room,
      'player1',
      'infantry',
      pos,
      'advance',
      'ignore',
      null,
      io as unknown as Parameters<typeof handlePlaceUnit>[7],
    );

    const unitId = room.gameState!.players.player1.units[0]!.id;

    handleSetDirective(
      room,
      'player1',
      unitId,
      'hold',
      'shoot-on-sight',
      null,
      io as unknown as Parameters<typeof handleSetDirective>[6],
    );

    expect(room.gameState!.players.player1.units[0]!.movementDirective).toBe('hold');
  });
});

// -----------------------------------------------------------------------------
// handleConfirmBuild
// -----------------------------------------------------------------------------

describe('handleConfirmBuild', () => {
  it('when both players confirm, transitions to battle phase', () => {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    handleConfirmBuild(
      room,
      'player1',
      io as unknown as Parameters<typeof handleConfirmBuild>[2],
    );

    expect(room.gameState!.phase).toBe('build'); // still build — only one confirmed

    handleConfirmBuild(
      room,
      'player2',
      io as unknown as Parameters<typeof handleConfirmBuild>[2],
    );

    expect(room.gameState!.phase).toBe('battle');
  });

  it('emits build-confirmed to the other player', () => {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);
    io.emitted.length = 0;

    handleConfirmBuild(
      room,
      'player1',
      io as unknown as Parameters<typeof handleConfirmBuild>[2],
    );

    const confirmEvents = io.emitted.filter((e) => e.event === 'build-confirmed');
    expect(confirmEvents).toHaveLength(1);
    expect(confirmEvents[0]!.to).toBe('socket-p2'); // sent to the OTHER player
  });

  it('emits battle-start to both players when both confirm', () => {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);
    io.emitted.length = 0;

    handleConfirmBuild(
      room,
      'player1',
      io as unknown as Parameters<typeof handleConfirmBuild>[2],
    );
    handleConfirmBuild(
      room,
      'player2',
      io as unknown as Parameters<typeof handleConfirmBuild>[2],
    );

    const battleStartEvents = io.emitted.filter((e) => e.event === 'battle-start');
    expect(battleStartEvents).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// handleSubmitCommands
// -----------------------------------------------------------------------------

describe('handleSubmitCommands', () => {
  function setupBattle(): { room: Room; io: MockIo } {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    // Place at least one unit per player so elimination doesn't trigger immediately
    const p1Zone = room.gameState!.map.player1Deployment;
    const p2Zone = room.gameState!.map.player2Deployment;
    handlePlaceUnit(room, 'player1', 'infantry', p1Zone[0]!, 'hold', 'ignore', null, io as unknown as Parameters<typeof handlePlaceUnit>[7]);
    handlePlaceUnit(room, 'player2', 'infantry', p2Zone[0]!, 'hold', 'ignore', null, io as unknown as Parameters<typeof handlePlaceUnit>[7]);

    handleConfirmBuild(room, 'player1', io as unknown as Parameters<typeof handleConfirmBuild>[2]);
    handleConfirmBuild(room, 'player2', io as unknown as Parameters<typeof handleConfirmBuild>[2]);
    io.emitted.length = 0;
    return { room, io };
  }

  it('buffers first player without executing', () => {
    const { room, io } = setupBattle();

    const turnBefore = room.gameState!.round.turnNumber;

    handleSubmitCommands(
      room,
      'player1',
      [],
      io as unknown as Parameters<typeof handleSubmitCommands>[3],
    );

    // Turn should NOT have advanced yet — waiting for player2
    expect(room.gameState!.round.turnNumber).toBe(turnBefore);

    // Should emit commands-received to player1
    const acks = io.emitted.filter((e) => e.event === 'commands-received' && e.to === 'socket-p1');
    expect(acks).toHaveLength(1);

    // Should emit opponent-commands-received to player2
    const oppAcks = io.emitted.filter((e) => e.event === 'opponent-commands-received' && e.to === 'socket-p2');
    expect(oppAcks).toHaveLength(1);
  });

  it('resolves when both players submit', () => {
    const { room, io } = setupBattle();

    const turnBefore = room.gameState!.round.turnNumber;

    handleSubmitCommands(room, 'player1', [], io as unknown as Parameters<typeof handleSubmitCommands>[3]);
    handleSubmitCommands(room, 'player2', [], io as unknown as Parameters<typeof handleSubmitCommands>[3]);

    // Turn advances by 1 (one simultaneous resolution)
    expect(room.gameState!.round.turnNumber).toBe(turnBefore + 1);

    // Should emit turn-result to both players
    const turnResults = io.emitted.filter((e) => e.event === 'turn-result');
    expect(turnResults).toHaveLength(2);
  });

  it('rejects double-submit from same player', () => {
    const { room, io } = setupBattle();

    handleSubmitCommands(room, 'player1', [], io as unknown as Parameters<typeof handleSubmitCommands>[3]);
    io.emitted.length = 0;

    // player1 tries to submit again
    handleSubmitCommands(room, 'player1', [], io as unknown as Parameters<typeof handleSubmitCommands>[3]);

    const errors = io.emitted.filter(
      (e) => e.event === 'room-error' && e.to === 'socket-p1',
    );
    expect(errors).toHaveLength(1);

    // Turn should NOT have advanced (still waiting for player2)
    expect(room.gameState!.round.turnNumber).toBe(1);
  });

  it('clears buffered commands after resolution', () => {
    const { room, io } = setupBattle();

    handleSubmitCommands(room, 'player1', [], io as unknown as Parameters<typeof handleSubmitCommands>[3]);
    handleSubmitCommands(room, 'player2', [], io as unknown as Parameters<typeof handleSubmitCommands>[3]);

    expect(room.bufferedCommands.size).toBe(0);
  });

  it('timeout fills empty commands for missing players', () => {
    const { room, io } = setupBattle();

    const turnBefore = room.gameState!.round.turnNumber;

    // Only player1 submits
    handleSubmitCommands(room, 'player1', [], io as unknown as Parameters<typeof handleSubmitCommands>[3]);

    // Simulate turn timeout (60s)
    vi.advanceTimersByTime(60_000);

    // Both players resolved — turn advanced by 1
    expect(room.gameState!.round.turnNumber).toBe(turnBefore + 1);
  });
});

// -----------------------------------------------------------------------------
// Build timeout
// -----------------------------------------------------------------------------

describe('build timeout', () => {
  it('auto-confirms and transitions to battle when timer expires', () => {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    expect(room.gameState!.phase).toBe('build');

    // Fast-forward the build timer
    vi.advanceTimersByTime(BUILD_DURATION * 1000);

    expect(room.gameState!.phase).toBe('battle');
  });

  it('auto-confirms remaining player if one already confirmed', () => {
    const room = createTestRoom();
    const io = createMockIo();
    startGame(room, io as unknown as Parameters<typeof startGame>[1]);

    handleConfirmBuild(
      room,
      'player1',
      io as unknown as Parameters<typeof handleConfirmBuild>[2],
    );

    expect(room.gameState!.phase).toBe('build');

    vi.advanceTimersByTime(BUILD_DURATION * 1000);

    expect(room.gameState!.phase).toBe('battle');
  });
});
