// =============================================================================
// HexWar — Reveal Sequencer
// =============================================================================
// Consumes BattleEvent[] from the resolution pipeline and plays them back as
// a phase-grouped cinematic animation. Replaces the old diffTurnEvents-based
// replay-sequencer.
//
// Each pipeline phase plays as a group: all events within a phase animate
// concurrently (with small stagger), then a pause before the next phase.
//
// TODO [DIEGO]: Phase 4 engagement flash — white hex flash + "ENGAGED" label
//   before Phase 5 fires. Data is derivable from Phase 5 events (peek ahead at
//   attacker/defender positions). No engine event type needed.
//   Spec: REVEAL_ANIMATION_SPEC.md §Phase 4 (0.3s per clash).
//
// TODO [DIEGO]: Per-unit-type attack/explosion/melee animations. Currently all
//   unit types play the same generic 'attack'/'hit'/'death' clips. Needs
//   distinct VFX per unit type (artillery shell arc, tank cannon flash, recon
//   burst, infantry rifle). Melee animations blocked on OD-1 (meleeRating values).
//
// TODO: "From fog" tracer rendering (GAP-F3/R12). When a friendly unit takes
//   damage from an enemy outside LOS, the tracer currently draws from the
//   enemy's true position — leaking their location through fog. The spec says
//   the tracer should originate from the LOS boundary, attacker identity unknown.
//   Blocked on: real combat VFX from Diego. Once VFX land, animateEvent needs
//   the player's LOS set passed in to check attackerPosition visibility and
//   compute fog-edge intersection for the tracer origin.
//   Spec: REVEAL_ANIMATION_SPEC.md §Visibility Rule, EVENT_LOG_SPEC.md §Fog Filtering.
// =============================================================================

import type { BattleEvent, CubeCoord, PlayerId } from '@hexwar/engine';
import { hexToKey, hexToWorld } from '@hexwar/engine';
import {
  spawnAttackTracer,
  spawnDamageNumber,
  spawnDeathMarker,
  spawnHealNumber,
  spawnRevealedText,
  spawnRevealRing,
  clearEffects,
} from './effects-renderer';
import { playUnitAnimation, tweenUnitTo, clearAllTweens } from './unit-model';
import { getPlayerColor } from './constants';
import { getPalette } from './palette';

// ---------------------------------------------------------------------------
// Phase timing constants (ms)
// ---------------------------------------------------------------------------

interface PhaseTiming {
  perEventMs: number;
  staggerMs: number;
  pauseAfterMs: number;
}

const PHASE_TIMING: Record<number, PhaseTiming> = {
  3:  { perEventMs: 900,  staggerMs: 50,  pauseAfterMs: 400 },
  5:  { perEventMs: 1000, staggerMs: 200, pauseAfterMs: 300 },
  6:  { perEventMs: 1000, staggerMs: 200, pauseAfterMs: 300 },
  7:  { perEventMs: 1200, staggerMs: 0,   pauseAfterMs: 300 },
  8:  { perEventMs: 600,  staggerMs: 100, pauseAfterMs: 200 },
  9:  { perEventMs: 1000, staggerMs: 0,   pauseAfterMs: 500 },
  10: { perEventMs: 2000, staggerMs: 0,   pauseAfterMs: 0 },
};

const DEFAULT_TIMING: PhaseTiming = { perEventMs: 800, staggerMs: 100, pauseAfterMs: 200 };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RevealCallbacks {
  onComplete: () => void;
  onUnitArrived?: (unitId: string, to: CubeCoord) => void;
  onPhaseStart?: (pipelinePhase: number) => void;
  onSound?: (soundId: string) => void;
}

let revealActive = false;
let revealTimers: ReturnType<typeof setTimeout>[] = [];
let revealOnComplete: (() => void) | null = null;
let revealSpeed = 1.0;

export function isRevealActive(): boolean {
  return revealActive;
}

export function setRevealSpeed(speed: number): void {
  revealSpeed = speed;
}

export function startReveal(
  events: BattleEvent[],
  elevationMap: Map<string, number>,
  observingPlayer: PlayerId,
  callbacks: RevealCallbacks,
): void {
  revealActive = true;
  revealOnComplete = callbacks.onComplete;
  revealTimers = [];

  const elev = (coord: CubeCoord): number => elevationMap.get(hexToKey(coord)) ?? 0;
  const groups = groupByPhase(events);
  console.log(`[REVEAL:START] ${events.length} events, ${groups.length} phase groups: ${groups.map(g => `P${g.pipelinePhase}(${g.events.length})`).join(', ')}, speed=${revealSpeed}`);

  let globalDelay = 0;

  for (const group of groups) {
    const timing = PHASE_TIMING[group.pipelinePhase] ?? DEFAULT_TIMING;
    const phaseStartDelay = globalDelay;

    // Notify phase start
    const phaseTimer = setTimeout(() => {
      callbacks.onPhaseStart?.(group.pipelinePhase);
    }, phaseStartDelay / revealSpeed);
    revealTimers.push(phaseTimer);

    // Schedule each event with stagger
    let maxEventEnd = 0;
    for (let i = 0; i < group.events.length; i++) {
      const event = group.events[i]!;
      const eventDelay = phaseStartDelay + i * timing.staggerMs;
      const duration = animateEvent(event, eventDelay, elev, observingPlayer, callbacks);
      maxEventEnd = Math.max(maxEventEnd, eventDelay + duration - phaseStartDelay);
    }

    // Advance global delay past this phase + pause
    globalDelay += Math.max(maxEventEnd, timing.perEventMs) + timing.pauseAfterMs;
  }

  // Finish
  const finishTimer = setTimeout(() => {
    finishReveal();
  }, globalDelay / revealSpeed + 300);
  revealTimers.push(finishTimer);
}

export function skipReveal(): void {
  if (!revealActive) return;
  for (const timer of revealTimers) clearTimeout(timer);
  revealTimers = [];
  clearEffects();
  clearAllTweens();
  finishReveal();
}

// ---------------------------------------------------------------------------
// Phase grouping
// ---------------------------------------------------------------------------

interface PhaseGroup {
  pipelinePhase: number;
  events: BattleEvent[];
}

function groupByPhase(events: BattleEvent[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  let currentPhase = -1;
  let currentGroup: BattleEvent[] = [];

  for (const event of events) {
    if (event.pipelinePhase !== currentPhase) {
      if (currentGroup.length > 0) {
        groups.push({ pipelinePhase: currentPhase, events: currentGroup });
      }
      currentPhase = event.pipelinePhase;
      currentGroup = [event];
    } else {
      currentGroup.push(event);
    }
  }

  if (currentGroup.length > 0) {
    groups.push({ pipelinePhase: currentPhase, events: currentGroup });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Event animator — switch on event.type
// ---------------------------------------------------------------------------
// Returns the duration in ms. Schedules setTimeout internally.
// Each case is an extensibility point: new event type = new case.

function animateEvent(
  event: BattleEvent,
  delay: number,
  elev: (coord: CubeCoord) => number,
  observingPlayer: PlayerId,
  callbacks: RevealCallbacks,
): number {
  const scaledDelay = delay / revealSpeed;

  switch (event.type) {
    case 'move': {
      const duration = 800;
      const timer = setTimeout(() => {
        playUnitAnimation(event.unitId, 'move');
        const to = hexToWorld(event.to, elev(event.to));
        tweenUnitTo(event.unitId, to.x, to.y, to.z, duration / 1000);
        callbacks.onSound?.('move');
      }, scaledDelay);
      revealTimers.push(timer);

      // Fog callback halfway through move
      const arriveTimer = setTimeout(() => {
        callbacks.onUnitArrived?.(event.unitId, event.to);
      }, scaledDelay + (duration * 0.5) / revealSpeed);
      revealTimers.push(arriveTimer);

      return duration;
    }

    case 'intercept': {
      const duration = 600;
      const timer = setTimeout(() => {
        const colors = getPlayerColor(event.actingPlayer, observingPlayer);
        const attPos = hexToWorld(event.attackerPosition, elev(event.attackerPosition));
        const defPos = hexToWorld(event.hex, elev(event.hex));
        playUnitAnimation(event.attackerId, 'attack');
        playUnitAnimation(event.defenderId, 'hit');
        spawnAttackTracer(attPos.x, attPos.y, attPos.z, defPos.x, defPos.y, defPos.z, colors.tracer);
        spawnDamageNumber(defPos.x, defPos.y + 0.3, defPos.z, event.damage);
        callbacks.onSound?.('intercept');
      }, scaledDelay);
      revealTimers.push(timer);
      return duration;
    }

    case 'damage': {
      const duration = 800;
      const timer = setTimeout(() => {
        const colors = getPlayerColor(event.actingPlayer, observingPlayer);
        const attPos = hexToWorld(event.attackerPosition, elev(event.attackerPosition));
        const defPos = hexToWorld(event.defenderPosition, elev(event.defenderPosition));
        playUnitAnimation(event.attackerId, 'attack');
        playUnitAnimation(event.defenderId, 'hit');
        spawnAttackTracer(attPos.x, attPos.y, attPos.z, defPos.x, defPos.y, defPos.z, colors.tracer);
        spawnDamageNumber(defPos.x, defPos.y, defPos.z, event.damage);
        callbacks.onSound?.('damage');
      }, scaledDelay);
      revealTimers.push(timer);
      return duration;
    }

    case 'kill': {
      const duration = 1000;
      const timer = setTimeout(() => {
        const colors = getPlayerColor(event.actingPlayer, observingPlayer);
        const attPos = hexToWorld(event.attackerPosition, elev(event.attackerPosition));
        const defPos = hexToWorld(event.defenderPosition, elev(event.defenderPosition));
        playUnitAnimation(event.attackerId, 'attack');
        playUnitAnimation(event.defenderId, 'death');
        spawnAttackTracer(attPos.x, attPos.y, attPos.z, defPos.x, defPos.y, defPos.z, colors.tracer);
        spawnDamageNumber(defPos.x, defPos.y, defPos.z, event.damage);
        spawnDeathMarker(defPos.x, defPos.y, defPos.z);
        callbacks.onSound?.('kill');
      }, scaledDelay);
      revealTimers.push(timer);
      return duration;
    }

    case 'counter': {
      const duration = 800;
      const timer = setTimeout(() => {
        const attPos = hexToWorld(event.attackerPosition, elev(event.attackerPosition));
        const defPos = hexToWorld(event.defenderPosition, elev(event.defenderPosition));
        playUnitAnimation(event.attackerId, 'attack');
        playUnitAnimation(event.defenderId, 'hit');
        // Orange tracer for counter-fire
        spawnAttackTracer(attPos.x, attPos.y, attPos.z, defPos.x, defPos.y, defPos.z, getPalette().effect.tracerCounter);
        spawnDamageNumber(defPos.x, defPos.y, defPos.z, event.damage);
        callbacks.onSound?.('counter');
      }, scaledDelay);
      revealTimers.push(timer);
      return duration;
    }

    case 'heal': {
      const timer = setTimeout(() => {
        const pos = hexToWorld(event.targetPosition, elev(event.targetPosition));
        spawnHealNumber(pos.x, pos.y, pos.z, event.healAmount);
        callbacks.onSound?.('heal');
      }, scaledDelay);
      revealTimers.push(timer);
      return 600;
    }

    case 'reveal': {
      const timer = setTimeout(() => {
        const pos = hexToWorld(event.unitPosition, elev(event.unitPosition));
        spawnRevealRing(pos.x, pos.y, pos.z);
        spawnRevealedText(pos.x, pos.y, pos.z);
        callbacks.onSound?.('reveal');
      }, scaledDelay);
      revealTimers.push(timer);
      return 600;
    }

    case 'capture':
    case 'recapture': {
      const timer = setTimeout(() => {
        const [q, r] = event.cityKey.split(',').map(Number);
        const pos = hexToWorld({ q: q!, r: r!, s: -q! - r! }, elev({ q: q!, r: r!, s: -q! - r! }));
        spawnDamageNumber(pos.x, pos.y + 0.3, pos.z, 0);
        callbacks.onSound?.('capture');
      }, scaledDelay);
      revealTimers.push(timer);
      return 1000;
    }

    case 'capture-damage': {
      const timer = setTimeout(() => {
        const [q, r] = event.cityKey.split(',').map(Number);
        const pos = hexToWorld({ q: q!, r: r!, s: -q! - r! }, elev({ q: q!, r: r!, s: -q! - r! }));
        playUnitAnimation(event.unitId, 'hit');
        spawnDamageNumber(pos.x, pos.y + 0.3, pos.z, event.captureCost);
        callbacks.onSound?.('capture-damage');
      }, scaledDelay);
      revealTimers.push(timer);
      return 500;
    }

    case 'capture-death': {
      const timer = setTimeout(() => {
        playUnitAnimation(event.unitId, 'death');
        callbacks.onSound?.('capture-death');
      }, scaledDelay);
      revealTimers.push(timer);
      return 800;
    }

    case 'objective-change':
    case 'koth-progress': {
      return 300;
    }

    case 'round-end':
    case 'game-end': {
      return 2000;
    }

    case 'melee': {
      const timer = setTimeout(() => {
        playUnitAnimation(event.unitAId, 'melee');
        playUnitAnimation(event.unitBId, 'melee');
        callbacks.onSound?.('melee');
      }, scaledDelay);
      revealTimers.push(timer);
      return 1200;
    }

    case 'building-built': {
      return 500;
    }

    case 'mine-triggered': {
      const timer = setTimeout(() => {
        callbacks.onSound?.('explosion');
      }, scaledDelay);
      revealTimers.push(timer);
      return 1000;
    }

    case 'mortar-fire': {
      const timer = setTimeout(() => {
        callbacks.onSound?.('attack');
      }, scaledDelay);
      revealTimers.push(timer);
      return 1000;
    }
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function finishReveal(): void {
  revealActive = false;
  revealTimers = [];
  const cb = revealOnComplete;
  revealOnComplete = null;
  if (cb) cb();
}
