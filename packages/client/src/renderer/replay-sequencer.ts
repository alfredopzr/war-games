import type { CubeCoord, PlayerId } from '@hexwar/engine';
import { hexToKey, hexToWorld } from '@hexwar/engine';
import {
  spawnAttackTracer,
  spawnDamageNumber,
  spawnDeathMarker,
  clearEffects,
} from './effects-renderer';
import { playUnitAnimation, tweenUnitTo, clearAllTweens } from './unit-model';

// ---------------------------------------------------------------------------
// TurnEvent type
// ---------------------------------------------------------------------------

export type TurnEvent =
  | { type: 'move'; unitId: string; from: CubeCoord; to: CubeCoord }
  | { type: 'attack'; attackerId: string; defenderId: string; damage: number; attackerPos: CubeCoord; defenderPos: CubeCoord }
  | { type: 'kill'; unitId: string; position: CubeCoord; killedBy: string }
  | { type: 'capture'; cityHex: CubeCoord; newOwner: PlayerId }
  // TODO: melee events need meleeRating values (OD-1) before diffTurnEvents can detect them.
  // For now the type is wired up so the sequencer is ready when the 10-phase pipeline lands.
  | { type: 'melee'; unitA: string; unitB: string; position: CubeCoord }
  | { type: 'climb'; unitId: string; from: CubeCoord; to: CubeCoord };

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
      events.push({ type: 'kill', unitId: id, position: before.position, killedBy: 'unknown' });
      continue;
    }

    if (before.position.q !== after.position.q || before.position.r !== after.position.r) {
      events.push({ type: 'move', unitId: id, from: before.position, to: after.position });
    }

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

  for (const [key, newOwner] of citiesAfter) {
    const prevOwner = citiesBefore.get(key);
    if (newOwner !== prevOwner && newOwner !== null) {
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

export interface ReplayCallbacks {
  onComplete: () => void;
  onUnitArrived?: (unitId: string, to: CubeCoord) => void;
}

export function startReplay(events: TurnEvent[], elevationMap: Map<string, number>, callbacks: ReplayCallbacks): void {
  replayActive = true;
  replayOnComplete = callbacks.onComplete;
  replayTimers = [];

  const elev = (coord: CubeCoord): number => elevationMap.get(hexToKey(coord)) ?? 0;

  let delay = 0;

  for (const event of events) {
    const currentDelay = delay;

    switch (event.type) {
      case 'move': {
        const moveDuration = 0.8;
        const timer = setTimeout(() => {
          playUnitAnimation(event.unitId, 'move');
          const to = hexToWorld(event.to, elev(event.to));
          tweenUnitTo(event.unitId, to.x, to.y, to.z, moveDuration);
        }, currentDelay);
        replayTimers.push(timer);
        // Notify fog update partway through the tween
        const arriveTimer = setTimeout(() => {
          callbacks.onUnitArrived?.(event.unitId, event.to);
        }, currentDelay + moveDuration * 500);
        replayTimers.push(arriveTimer);
        delay += 900;
        break;
      }
      case 'attack': {
        const timer = setTimeout(() => {
          playUnitAnimation(event.defenderId, 'hit');
          const attPos = hexToWorld(event.attackerPos, elev(event.attackerPos));
          const defPos = hexToWorld(event.defenderPos, elev(event.defenderPos));
          spawnAttackTracer(attPos.x, attPos.y, attPos.z, defPos.x, defPos.y, defPos.z);
          spawnDamageNumber(defPos.x, defPos.y, defPos.z, event.damage);
        }, currentDelay);
        replayTimers.push(timer);
        delay += 600;
        break;
      }
      case 'kill': {
        const timer = setTimeout(() => {
          playUnitAnimation(event.unitId, 'death');
          const pos = hexToWorld(event.position, elev(event.position));
          spawnDeathMarker(pos.x, pos.y, pos.z);
        }, currentDelay);
        replayTimers.push(timer);
        delay += 800;
        break;
      }
      case 'capture': {
        const timer = setTimeout(() => {
          const pos = hexToWorld(event.cityHex, elev(event.cityHex));
          spawnDamageNumber(pos.x, pos.y + 0.3, pos.z, 0);
        }, currentDelay);
        replayTimers.push(timer);
        delay += 500;
        break;
      }
      // TODO: melee animation needs meleeRating values (OD-1) and adjacent-contact
      // detection from the 10-phase pipeline. Placeholder plays the melee clip.
      case 'melee': {
        const timer = setTimeout(() => {
          playUnitAnimation(event.unitA, 'melee');
          playUnitAnimation(event.unitB, 'melee');
        }, currentDelay);
        replayTimers.push(timer);
        delay += 1000;
        break;
      }
      case 'climb': {
        const climbDuration = 1.0;
        const timer = setTimeout(() => {
          playUnitAnimation(event.unitId, 'climb');
          const to = hexToWorld(event.to, elev(event.to));
          tweenUnitTo(event.unitId, to.x, to.y, to.z, climbDuration);
        }, currentDelay);
        replayTimers.push(timer);
        const climbArriveTimer = setTimeout(() => {
          callbacks.onUnitArrived?.(event.unitId, event.to);
        }, currentDelay + climbDuration * 500);
        replayTimers.push(climbArriveTimer);
        delay += 1100;
        break;
      }
    }
  }

  const finishTimer = setTimeout(() => {
    finishReplay();
  }, delay + 300);
  replayTimers.push(finishTimer);
}

export function skipReplay(): void {
  if (!replayActive) return;
  for (const timer of replayTimers) {
    clearTimeout(timer);
  }
  replayTimers = [];
  clearEffects();
  clearAllTweens();
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
