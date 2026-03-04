import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Room } from './types';
import {
  BUILD_DURATION,
  TURN_DURATION,
  startBuildTimer,
  startTurnTimer,
  clearBuildTimer,
  clearTurnTimer,
  clearAllTimers,
} from './timers';

function createMockRoom(): Room {
  return {
    id: 'test',
    players: new Map(),
    gameState: null,
    phase: 'waiting',
    buildConfirmed: new Set(),
    disconnectedPlayers: new Map(),
    timers: { build: null, turn: null },
  };
}

describe('timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startBuildTimer', () => {
    it('fires callback after BUILD_DURATION seconds', () => {
      const room = createMockRoom();
      const callback = vi.fn();

      startBuildTimer(room, callback);
      vi.advanceTimersByTime(BUILD_DURATION * 1000);

      expect(callback).toHaveBeenCalledOnce();
    });

    it('does NOT fire callback before BUILD_DURATION seconds', () => {
      const room = createMockRoom();
      const callback = vi.fn();

      startBuildTimer(room, callback);
      vi.advanceTimersByTime(BUILD_DURATION * 1000 - 1);

      expect(callback).not.toHaveBeenCalled();
    });

    it('clears previous timer if one exists (no double-fire)', () => {
      const room = createMockRoom();
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      startBuildTimer(room, firstCallback);
      vi.advanceTimersByTime(60_000); // advance partway
      startBuildTimer(room, secondCallback);
      vi.advanceTimersByTime(BUILD_DURATION * 1000);

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledOnce();
    });
  });

  describe('startTurnTimer', () => {
    it('fires callback after TURN_DURATION seconds', () => {
      const room = createMockRoom();
      const callback = vi.fn();

      startTurnTimer(room, callback);
      vi.advanceTimersByTime(TURN_DURATION * 1000);

      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('clearBuildTimer', () => {
    it('prevents callback from firing after clearing', () => {
      const room = createMockRoom();
      const callback = vi.fn();

      startBuildTimer(room, callback);
      clearBuildTimer(room);
      vi.advanceTimersByTime(BUILD_DURATION * 1000);

      expect(callback).not.toHaveBeenCalled();
      expect(room.timers.build).toBeNull();
    });
  });

  describe('clearTurnTimer', () => {
    it('prevents callback from firing after clearing', () => {
      const room = createMockRoom();
      const callback = vi.fn();

      startTurnTimer(room, callback);
      clearTurnTimer(room);
      vi.advanceTimersByTime(TURN_DURATION * 1000);

      expect(callback).not.toHaveBeenCalled();
      expect(room.timers.turn).toBeNull();
    });
  });

  describe('clearAllTimers', () => {
    it('clears both build and turn timers', () => {
      const room = createMockRoom();
      const buildCallback = vi.fn();
      const turnCallback = vi.fn();

      startBuildTimer(room, buildCallback);
      startTurnTimer(room, turnCallback);
      clearAllTimers(room);
      vi.advanceTimersByTime(BUILD_DURATION * 1000);

      expect(buildCallback).not.toHaveBeenCalled();
      expect(turnCallback).not.toHaveBeenCalled();
      expect(room.timers.build).toBeNull();
      expect(room.timers.turn).toBeNull();
    });
  });
});
