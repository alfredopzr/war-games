// =============================================================================
// HexWar — AI vs AI Headless Match Runner
// =============================================================================
// Runs N headless matches between two AI instances for balance data.
// Produces [MATH_AUDIT] log lines for kill timing analysis.
// =============================================================================

import type {
  GameState,
  PlayerId,
  UnitType,
  BattleEvent,
  BattleEventKill,
  BattleEventDamage,
} from './types';
import { createGame, placeUnit, startBattlePhase, checkRoundEnd, scoreRound } from './game-state';
import { aiBuildPhase, aiBattlePhase } from './ai';
import { resolveTurn } from './resolution-pipeline';
import { createCommandPool } from './commands';
import { mulberry32 } from './rng';
import { getTypeAdvantage } from './units';
import { resetUnitIdCounter } from './units';

// =============================================================================
// Types
// =============================================================================

export type KillVerdict = 'TOO_FAST' | 'OK' | 'TOO_SLOW';

export interface KillRecord {
  readonly attackerType: UnitType;
  readonly defenderType: UnitType;
  readonly typeAdvantage: number;
  readonly hitCount: number;
  readonly verdict: KillVerdict;
  readonly round: number;
  readonly turn: number;
}

export interface RoundResult {
  readonly roundNumber: number;
  readonly winner: PlayerId | null;
  readonly reason: 'king-of-the-hill' | 'elimination' | 'turn-limit' | null;
  readonly turns: number;
}

export interface MatchResult {
  readonly seed: number;
  readonly winner: PlayerId;
  readonly rounds: number;
  readonly totalTurns: number;
  readonly kills: KillRecord[];
  readonly roundResults: RoundResult[];
}

export interface BatchOptions {
  readonly matchCount: number;
  readonly baseSeed: number;
}

export interface MatchupVerdictCounts {
  readonly TOO_FAST: number;
  readonly OK: number;
  readonly TOO_SLOW: number;
  readonly total: number;
}

export interface BatchSummary {
  readonly matchCount: number;
  readonly p1Wins: number;
  readonly p2Wins: number;
  readonly p1WinRate: number;
  readonly p2WinRate: number;
  readonly avgTurns: number;
  readonly minTurns: number;
  readonly maxTurns: number;
  readonly results: MatchResult[];
  readonly matchupVerdicts: Record<string, MatchupVerdictCounts>;
}

// =============================================================================
// Kill Timing Classification
// =============================================================================
// Counter (2.0x):       2-3 hits to kill
// Neutral (1.0x):       3-4 hits to kill (accepting 2 and 5 as borderline OK)
// Disadvantaged (0.6x): 6-7 hits to kill (accepting 5 and 8 as borderline OK)

const KILL_TIMING_RANGES: ReadonlyArray<{
  readonly minAdvantage: number;
  readonly okMin: number;
  readonly okMax: number;
}> = [
  { minAdvantage: 1.5, okMin: 2, okMax: 3 },   // counter (2.0x)
  { minAdvantage: 0.8, okMin: 2, okMax: 5 },    // neutral (1.0x)
  { minAdvantage: 0.0, okMin: 5, okMax: 8 },    // disadvantaged (0.6x)
];

export function classifyKillTiming(typeAdvantage: number, hitCount: number): KillVerdict {
  const range = KILL_TIMING_RANGES.find((r) => typeAdvantage >= r.minAdvantage);
  if (!range) throw new Error(`No timing range for advantage ${typeAdvantage}`);
  if (hitCount < range.okMin) return 'TOO_FAST';
  if (hitCount > range.okMax) return 'TOO_SLOW';
  return 'OK';
}

// =============================================================================
// Match Runner
// =============================================================================

const MAX_TURNS_PER_ROUND = 50; // safety cap to prevent infinite loops

export function runMatch(seed: number, log = false): MatchResult {
  resetUnitIdCounter();
  const rng = mulberry32(seed);

  const state = createGame(seed);
  const kills: KillRecord[] = [];
  const roundResults: RoundResult[] = [];
  let totalTurns = 0;

  // Track cumulative damage per defender for hit counting
  let damageHits = new Map<string, { attackerType: UnitType; count: number }>();

  while (state.phase !== 'game-over') {
    // ----- Build Phase -----
    runBuildPhase(state, 'player1', rng);
    runBuildPhase(state, 'player2', rng);
    startBattlePhase(state);

    let roundTurns = 0;

    // ----- Battle Phase -----
    while (state.phase === 'battle') {
      roundTurns++;
      totalTurns++;

      if (roundTurns > MAX_TURNS_PER_ROUND) {
        throw new Error(`Round ${state.round.roundNumber} exceeded ${MAX_TURNS_PER_ROUND} turns — infinite loop`);
      }

      // Generate commands from both AIs
      const p1Cmds = aiBattlePhase(state, 'player1');
      const p2Cmds = aiBattlePhase(state, 'player2');

      // Reset command pools for this turn
      state.round.commandPools = {
        player1: createCommandPool(),
        player2: createCommandPool(),
      };

      // Resolve turn
      resolveTurn(state, p1Cmds, p2Cmds, rng);

      // Process events for kill tracking
      const turnKills = processEvents(
        state.pendingEvents,
        damageHits,
        state.round.roundNumber,
        roundTurns,
        log,
      );
      kills.push(...turnKills);

      // Advance turn counter
      state.round.turnsPlayed++;
      state.round.turnNumber++;

      // Check round end
      const roundEnd = checkRoundEnd(state);

      if (roundEnd.roundOver) {
        if (log) {
          console.log(
            `[MATH_AUDIT] ROUND_END  round:${state.round.roundNumber}  winner:${roundEnd.winner}  reason:${roundEnd.reason}  turns:${roundTurns}`,
          );
        }

        roundResults.push({
          roundNumber: state.round.roundNumber,
          winner: roundEnd.winner,
          reason: roundEnd.reason,
          turns: roundTurns,
        });

        scoreRound(state, roundEnd.winner);
        damageHits = new Map();
      }
    }
  }

  const winner = state.winner;
  if (!winner) throw new Error('Game ended without a winner');

  if (log) {
    console.log(
      `[MATH_AUDIT] MATCH_END  seed:${seed}  winner:${winner}  rounds:${roundResults.length}  totalTurns:${totalTurns}  kills:${kills.length}`,
    );
  }

  return {
    seed,
    winner,
    rounds: roundResults.length,
    totalTurns,
    kills,
    roundResults,
  };
}

// =============================================================================
// Build Phase Helper
// =============================================================================

function runBuildPhase(state: GameState, playerId: PlayerId, rng: () => number): void {
  // Override Math.random with seeded RNG during build to make preset selection deterministic
  const origRandom = Math.random;
  Math.random = rng;
  const actions = aiBuildPhase(state, playerId);
  Math.random = origRandom;

  for (const action of actions) {
    placeUnit(
      state,
      playerId,
      action.unitType,
      action.position,
      action.movementDirective,
      action.attackDirective,
      action.specialtyModifier,
      action.directiveTarget,
    );
  }
}

// =============================================================================
// Event Processing
// =============================================================================

function processEvents(
  events: BattleEvent[],
  damageHits: Map<string, { attackerType: UnitType; count: number }>,
  round: number,
  turn: number,
  log: boolean,
): KillRecord[] {
  const kills: KillRecord[] = [];

  for (const event of events) {
    if (event.type === 'damage' || event.type === 'counter' || event.type === 'intercept') {
      const defenderId = event.defenderId;
      const existing = damageHits.get(defenderId);
      if (existing) {
        existing.count++;
      } else {
        damageHits.set(defenderId, {
          attackerType: (event as BattleEventDamage).attackerType,
          count: 1,
        });
      }
    }

    if (event.type === 'kill') {
      const killEvent = event as BattleEventKill;
      const typeAdv = getTypeAdvantage(killEvent.attackerType, killEvent.defenderType);
      const hitTracking = damageHits.get(killEvent.defenderId);
      // The kill event itself is the final hit
      const hitCount = hitTracking ? hitTracking.count : 1;
      const verdict = classifyKillTiming(typeAdv, hitCount);

      const record: KillRecord = {
        attackerType: killEvent.attackerType,
        defenderType: killEvent.defenderType,
        typeAdvantage: typeAdv,
        hitCount,
        verdict,
        round,
        turn,
      };
      kills.push(record);

      if (log) {
        console.log(
          `[MATH_AUDIT] KILL       attacker:${record.attackerType}  defender:${record.defenderType}  ` +
          `type_adv:${record.typeAdvantage}  total_hits:${record.hitCount}  verdict:${record.verdict}`,
        );
      }

      // Clear tracking for this defender
      damageHits.delete(killEvent.defenderId);
    }
  }

  return kills;
}

// =============================================================================
// Batch Runner
// =============================================================================

export function runBatch(options: BatchOptions, log = false): BatchSummary {
  const { matchCount, baseSeed } = options;
  const results: MatchResult[] = [];
  let p1Wins = 0;
  let p2Wins = 0;

  for (let i = 0; i < matchCount; i++) {
    const matchSeed = baseSeed + i;
    const result = runMatch(matchSeed, log);
    results.push(result);
    if (result.winner === 'player1') p1Wins++;
    else p2Wins++;
  }

  const totalTurns = results.map((r) => r.totalTurns);
  const avgTurns = totalTurns.reduce((a, b) => a + b, 0) / matchCount;
  const minTurns = Math.min(...totalTurns);
  const maxTurns = Math.max(...totalTurns);

  // Compute matchup verdict distribution
  const matchupVerdicts: Record<string, MatchupVerdictCounts> = {};
  for (const result of results) {
    for (const kill of result.kills) {
      const key = `${kill.attackerType} vs ${kill.defenderType}`;
      if (!matchupVerdicts[key]) {
        matchupVerdicts[key] = { TOO_FAST: 0, OK: 0, TOO_SLOW: 0, total: 0 };
      }
      const entry = matchupVerdicts[key] as { TOO_FAST: number; OK: number; TOO_SLOW: number; total: number };
      entry[kill.verdict]++;
      entry.total++;
    }
  }

  if (log) {
    console.log(`\n========== BATCH SUMMARY ==========`);
    console.log(`Matches: ${matchCount}`);
    console.log(`P1 wins: ${p1Wins} (${(p1Wins / matchCount * 100).toFixed(1)}%)`);
    console.log(`P2 wins: ${p2Wins} (${(p2Wins / matchCount * 100).toFixed(1)}%)`);
    console.log(`Turns: avg=${avgTurns.toFixed(1)} min=${minTurns} max=${maxTurns}`);
    console.log(`\nKill Timing Verdicts:`);
    for (const [matchup, counts] of Object.entries(matchupVerdicts)) {
      const pctOk = counts.total > 0 ? ((counts.OK / counts.total) * 100).toFixed(0) : '0';
      const pctFast = counts.total > 0 ? ((counts.TOO_FAST / counts.total) * 100).toFixed(0) : '0';
      const pctSlow = counts.total > 0 ? ((counts.TOO_SLOW / counts.total) * 100).toFixed(0) : '0';
      console.log(
        `  ${matchup.padEnd(28)} OK:${pctOk}%  TOO_FAST:${pctFast}%  TOO_SLOW:${pctSlow}%  (n=${counts.total})`,
      );
    }
    console.log(`===================================\n`);
  }

  return {
    matchCount,
    p1Wins,
    p2Wins,
    p1WinRate: p1Wins / matchCount,
    p2WinRate: p2Wins / matchCount,
    avgTurns,
    minTurns,
    maxTurns,
    results,
    matchupVerdicts,
  };
}
