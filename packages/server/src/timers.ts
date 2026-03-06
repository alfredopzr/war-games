// =============================================================================
// HexWar Server — Timer Management
// =============================================================================

import type { Room } from './types';

export const BUILD_DURATION = 600; // DEV: 10 min for testing (prod: 120)
export const TURN_DURATION = 60; // seconds

export function startBuildTimer(room: Room, onExpire: () => void): void {
  if (room.timers.build !== null) {
    clearTimeout(room.timers.build);
  }
  room.timers.build = setTimeout(onExpire, BUILD_DURATION * 1000);
}

export function startTurnTimer(room: Room, onExpire: () => void): void {
  if (room.timers.turn !== null) {
    clearTimeout(room.timers.turn);
  }
  room.timers.turn = setTimeout(onExpire, TURN_DURATION * 1000);
}

export function clearBuildTimer(room: Room): void {
  if (room.timers.build !== null) {
    clearTimeout(room.timers.build);
    room.timers.build = null;
  }
}

export function clearTurnTimer(room: Room): void {
  if (room.timers.turn !== null) {
    clearTimeout(room.timers.turn);
    room.timers.turn = null;
  }
}

export function clearAllTimers(room: Room): void {
  clearBuildTimer(room);
  clearTurnTimer(room);
}
