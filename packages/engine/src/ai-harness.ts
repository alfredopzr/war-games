// =============================================================================
// HexWar — AI vs AI Headless Match Runner
// =============================================================================
// Runs N headless matches between two AI instances for balance data.
// All MATH_AUDIT data is extracted directly from state.pendingEvents —
// the typed event log produced by the resolution pipeline.
// =============================================================================

import type {
  GameState,
  PlayerId,
  UnitType,
  ApproachCategory,
  AttackDirective,
} from './types';
import { createGame, placeUnit, startBattlePhase, checkRoundEnd, scoreRound } from './game-state';
import { aiBuildPhase, aiBattlePhase } from './ai';
import { resolveTurn } from './resolution-pipeline';
import { createCommandPool } from './commands';
import { mulberry32 } from './rng';
import { getTypeAdvantage } from './units';
import { resetUnitIdCounter } from './units';
import { cubeDistance } from './hex';

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
  readonly terrain: string;
  readonly approach: ApproachCategory;
  readonly attackerROE: AttackDirective;
  readonly round: number;
  readonly turn: number;
}

export interface RoundResult {
  readonly roundNumber: number;
  readonly winner: PlayerId | null;
  readonly reason: 'king-of-the-hill' | 'elimination' | 'turn-limit' | null;
  readonly turns: number;
  readonly p1Kills: number;
  readonly p2Kills: number;
  readonly p1UnitsAlive: number;
  readonly p2UnitsAlive: number;
  readonly kothTurnsHeld: number;
}

export interface MatchResult {
  readonly seed: number;
  readonly winner: PlayerId;
  readonly rounds: number;
  readonly totalTurns: number;
  readonly kills: KillRecord[];
  readonly roundResults: RoundResult[];
  readonly p1FinalUnits: number;
  readonly p2FinalUnits: number;
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
// Counter (2.0x):       2-3 hits OK
// Neutral (1.0x):       2-5 hits OK
// Disadvantaged (0.6x): 5-8 hits OK

const KILL_TIMING_RANGES: ReadonlyArray<{
  readonly minAdvantage: number;
  readonly okMin: number;
  readonly okMax: number;
}> = [
  { minAdvantage: 1.5, okMin: 2, okMax: 3 },
  { minAdvantage: 0.8, okMin: 2, okMax: 5 },
  { minAdvantage: 0.0, okMin: 5, okMax: 8 },
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

const MAX_TURNS_PER_ROUND = 50;

export function runMatch(seed: number, log = false): MatchResult {
  resetUnitIdCounter();
  const rng = mulberry32(seed);

  const state = createGame(seed);
  const kills: KillRecord[] = [];
  const roundResults: RoundResult[] = [];
  let totalTurns = 0;

  while (state.phase !== 'game-over') {
    // ----- Build Phase -----
    runBuildPhase(state, 'player1', rng);
    runBuildPhase(state, 'player2', rng);
    startBattlePhase(state);

    if (log) {
      const p1Units = state.players.player1.units;
      const p2Units = state.players.player2.units;
      const dep1 = state.map.player1Deployment[0];
      const dep2 = state.map.player2Deployment[0];
      const deployDist = dep1 && dep2 ? cubeDistance(dep1, dep2) : 0;
      console.log(
        `[MATH_AUDIT] MATCH_START  seed:${seed}  mapRadius:${state.map.mapRadius}  deployDist:${deployDist}` +
        `  p1Units:${p1Units.length}  p2Units:${p2Units.length}`,
      );
      logComposition(log, 'player1', p1Units.map((u) => u.type));
      logComposition(log, 'player2', p2Units.map((u) => u.type));
    }

    let roundTurns = 0;
    // hits[defenderId] = { count, attackerType (of most recent hit) }
    let hitsPerUnit = new Map<string, { count: number }>();
    let kothTurnsHeld = 0;

    // ----- Battle Phase -----
    while (state.phase === 'battle') {
      roundTurns++;
      totalTurns++;

      if (roundTurns > MAX_TURNS_PER_ROUND) {
        throw new Error(`Round ${state.round.roundNumber} exceeded ${MAX_TURNS_PER_ROUND} turns`);
      }

      const p1Cmds = aiBattlePhase(state, 'player1');
      const p2Cmds = aiBattlePhase(state, 'player2');

      state.round.commandPools = {
        player1: createCommandPool(),
        player2: createCommandPool(),
      };

      resolveTurn(state, p1Cmds, p2Cmds, rng);

      // ---- Read from the event log ----
      for (const event of state.pendingEvents) {
        // Track hits for kill timing (any hit event increments the counter)
        if (event.type === 'damage' || event.type === 'counter') {
          const existing = hitsPerUnit.get(event.defenderId);
          if (existing) {
            existing.count++;
          } else {
            hitsPerUnit.set(event.defenderId, { count: 1 });
          }
        }

        if (event.type === 'kill') {
          const typeAdv = getTypeAdvantage(event.attackerType, event.defenderType);
          const hits = hitsPerUnit.get(event.defenderId);
          // kill event itself is the final hit; prior hits may be 0 if one-shot
          const hitCount = hits ? hits.count + 1 : 1;
          const verdict = classifyKillTiming(typeAdv, hitCount);

          const record: KillRecord = {
            attackerType: event.attackerType,
            defenderType: event.defenderType,
            typeAdvantage: typeAdv,
            hitCount,
            verdict,
            terrain: event.defenderTerrain,
            approach: event.approachCategory,
            attackerROE: event.attackerAttackDirective,
            round: state.round.roundNumber,
            turn: roundTurns,
          };
          kills.push(record);

          if (log) {
            console.log(
              `[MATH_AUDIT] KILL` +
              `  attacker:${record.attackerType}` +
              `  defender:${record.defenderType}` +
              `  type_adv:${record.typeAdvantage}` +
              `  hits:${record.hitCount}` +
              `  terrain:${record.terrain}` +
              `  approach:${record.approach}` +
              `  roe:${record.attackerROE}` +
              `  verdict:${record.verdict}`,
            );
          }

          hitsPerUnit.delete(event.defenderId);
        }

        if (event.type === 'koth-progress') {
          kothTurnsHeld = event.turnsHeld;
        }
      }

      state.round.turnsPlayed++;
      state.round.turnNumber++;

      const roundEnd = checkRoundEnd(state);
      if (roundEnd.roundOver) {
        const p1Alive = state.players.player1.units.length;
        const p2Alive = state.players.player2.units.length;
        const p1Kills = state.round.unitsKilledThisRound.player1;
        const p2Kills = state.round.unitsKilledThisRound.player2;

        if (log) {
          console.log(
            `[MATH_AUDIT] ROUND_END` +
            `  round:${state.round.roundNumber}` +
            `  winner:${roundEnd.winner}` +
            `  reason:${roundEnd.reason}` +
            `  turns:${roundTurns}` +
            `  kothHeld:${kothTurnsHeld}` +
            `  p1Kills:${p1Kills}  p2Kills:${p2Kills}` +
            `  p1Alive:${p1Alive}  p2Alive:${p2Alive}`,
          );
        }

        roundResults.push({
          roundNumber: state.round.roundNumber,
          winner: roundEnd.winner,
          reason: roundEnd.reason,
          turns: roundTurns,
          p1Kills,
          p2Kills,
          p1UnitsAlive: p1Alive,
          p2UnitsAlive: p2Alive,
          kothTurnsHeld,
        });

        scoreRound(state, roundEnd.winner);
        hitsPerUnit = new Map();
        kothTurnsHeld = 0;
      }
    }
  }

  const winner = state.winner;
  if (!winner) throw new Error('Game ended without a winner');

  const p1Final = state.players.player1.units.length;
  const p2Final = state.players.player2.units.length;

  if (log) {
    console.log(
      `[MATH_AUDIT] MATCH_END` +
      `  seed:${seed}` +
      `  winner:${winner}` +
      `  rounds:${roundResults.length}` +
      `  totalTurns:${totalTurns}` +
      `  kills:${kills.length}` +
      `  p1Alive:${p1Final}  p2Alive:${p2Final}`,
    );
  }

  return { seed, winner, rounds: roundResults.length, totalTurns, kills, roundResults, p1FinalUnits: p1Final, p2FinalUnits: p2Final };
}

// =============================================================================
// Helpers
// =============================================================================

function runBuildPhase(state: GameState, playerId: PlayerId, rng: () => number): void {
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

function logComposition(log: boolean, player: string, types: UnitType[]): void {
  if (!log) return;
  const counts: Partial<Record<UnitType, number>> = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;
  const summary = Object.entries(counts).map(([t, n]) => `${t}:${n}`).join(' ');
  console.log(`[MATH_AUDIT] COMPOSITION  player:${player}  ${summary}`);
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
    const result = runMatch(baseSeed + i, log);
    results.push(result);
    if (result.winner === 'player1') p1Wins++;
    else p2Wins++;
  }

  const allTurns = results.map((r) => r.totalTurns);
  const avgTurns = allTurns.reduce((a, b) => a + b, 0) / matchCount;
  const minTurns = Math.min(...allTurns);
  const maxTurns = Math.max(...allTurns);

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

  return { matchCount, p1Wins, p2Wins, p1WinRate: p1Wins / matchCount, p2WinRate: p2Wins / matchCount, avgTurns, minTurns, maxTurns, results, matchupVerdicts };
}
