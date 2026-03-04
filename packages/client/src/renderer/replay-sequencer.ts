import type { CubeCoord, PlayerId } from '@hexwar/engine';
import { hexToPixel } from './hex-render';
import { HEX_SIZE } from './constants';
import {
  spawnAttackTracer,
  spawnDamageNumber,
  spawnDeathMarker,
  clearEffects,
} from './effects-renderer';

// ---------------------------------------------------------------------------
// TurnEvent type
// ---------------------------------------------------------------------------

export type TurnEvent =
  | { type: 'move'; unitId: string; from: CubeCoord; to: CubeCoord }
  | { type: 'attack'; attackerId: string; defenderId: string; damage: number; attackerPos: CubeCoord; defenderPos: CubeCoord }
  | { type: 'kill'; unitId: string; position: CubeCoord; killedBy: string }
  | { type: 'capture'; cityHex: CubeCoord; newOwner: PlayerId };

// ---------------------------------------------------------------------------
// Diff function — generates TurnEvent[] from before/after state snapshots
// ---------------------------------------------------------------------------

interface UnitSnapshot {
  position: CubeCoord;
  hp: number;
  owner: PlayerId;
}

export function diffTurnEvents(
  unitsBefore: Map<string, UnitSnapshot>,
  unitsAfter: Map<string, UnitSnapshot>,
  citiesBefore: Map<string, PlayerId | null>,
  citiesAfter: Map<string, PlayerId | null>,
): TurnEvent[] {
  const events: TurnEvent[] = [];

  for (const [id, before] of unitsBefore) {
    const after = unitsAfter.get(id);

    if (!after) {
      // Unit was killed
      events.push({ type: 'kill', unitId: id, position: before.position, killedBy: 'unknown' });
      continue;
    }

    // Check for movement
    if (before.position.q !== after.position.q || before.position.r !== after.position.r) {
      events.push({ type: 'move', unitId: id, from: before.position, to: after.position });
    }

    // Check for damage taken
    if (after.hp < before.hp) {
      const damage = before.hp - after.hp;
      events.push({
        type: 'attack',
        attackerId: 'unknown',
        defenderId: id,
        damage,
        attackerPos: after.position,
        defenderPos: after.position,
      });
    }
  }

  // Check for city captures
  for (const [key, newOwner] of citiesAfter) {
    const prevOwner = citiesBefore.get(key);
    if (newOwner !== prevOwner && newOwner !== null) {
      // Parse the hex key back to CubeCoord (format: "q,r")
      const parts = key.split(',');
      const q = Number(parts[0]);
      const r = Number(parts[1]);
      const s = -q - r;
      events.push({ type: 'capture', cityHex: { q, r, s }, newOwner });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Replay sequencer state
// ---------------------------------------------------------------------------

let replayActive = false;
let replayTimers: ReturnType<typeof setTimeout>[] = [];
let replayOnComplete: (() => void) | null = null;

export function isReplayActive(): boolean {
  return replayActive;
}

export function startReplay(events: TurnEvent[], onComplete: () => void): void {
  replayActive = true;
  replayOnComplete = onComplete;
  replayTimers = [];

  let delay = 0;

  for (const event of events) {
    const currentDelay = delay;

    switch (event.type) {
      case 'move': {
        const timer = setTimeout(() => {
          // Flash: spawn a tracer from old position to new position to show movement
          const from = hexToPixel(event.from, HEX_SIZE);
          const to = hexToPixel(event.to, HEX_SIZE);
          spawnAttackTracer(from.x, from.y, to.x, to.y);
        }, currentDelay);
        replayTimers.push(timer);
        delay += 300;
        break;
      }
      case 'attack': {
        const timer = setTimeout(() => {
          const attPos = hexToPixel(event.attackerPos, HEX_SIZE);
          const defPos = hexToPixel(event.defenderPos, HEX_SIZE);
          spawnAttackTracer(attPos.x, attPos.y, defPos.x, defPos.y);
          spawnDamageNumber(defPos.x, defPos.y, event.damage);
        }, currentDelay);
        replayTimers.push(timer);
        delay += 400;
        break;
      }
      case 'kill': {
        const timer = setTimeout(() => {
          const pos = hexToPixel(event.position, HEX_SIZE);
          spawnDeathMarker(pos.x, pos.y);
        }, currentDelay);
        replayTimers.push(timer);
        delay += 500;
        break;
      }
      case 'capture': {
        // Simple flash — reuse attack tracer on the city hex
        const timer = setTimeout(() => {
          const pos = hexToPixel(event.cityHex, HEX_SIZE);
          spawnDamageNumber(pos.x, pos.y - 10, 0);
        }, currentDelay);
        replayTimers.push(timer);
        delay += 300;
        break;
      }
    }
  }

  // Schedule completion callback after all events have played
  const finishTimer = setTimeout(() => {
    finishReplay();
  }, delay + 200);
  replayTimers.push(finishTimer);
}

export function skipReplay(): void {
  if (!replayActive) return;
  for (const timer of replayTimers) {
    clearTimeout(timer);
  }
  replayTimers = [];
  clearEffects();
  finishReplay();
}

function finishReplay(): void {
  replayActive = false;
  replayTimers = [];
  const cb = replayOnComplete;
  replayOnComplete = null;
  if (cb) {
    cb();
  }
}
