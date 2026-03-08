#!/usr/bin/env tsx
// =============================================================================
// P1 Win Bias Diagnostic
// =============================================================================
// Tests three hypotheses for P1's 9/10 win rate:
//   H1: Map geometry — P1 deployment zone is closer to the objective
//   H2: Preset bias — P1 consistently draws stronger compositions
//   H3: Initiative bias — check round win reasons (fast KotH = map bias)
//
// Usage: npx tsx packages/engine/scripts/diagnose-bias.ts
// =============================================================================

import { createGame } from '../src/game-state';
import { mulberry32 } from '../src/rng';
import { runMatch } from '../src/ai-harness';
import { cubeDistance } from '../src/hex';
import type { CubeCoord } from '../src/types';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function centroid(hexes: CubeCoord[]): CubeCoord {
  const n = hexes.length;
  const q = Math.round(hexes.reduce((s, h) => s + h.q, 0) / n);
  const r = Math.round(hexes.reduce((s, h) => s + h.r, 0) / n);
  return { q, r, s: -q - r };
}

const PRESET_NAMES = ['balanced', 'infantry-rush', 'armor-push', 'artillery-fortress', 'flanker', 'tank-infantry'];

function predictPresets(seed: number): { p1: string; p2: string } {
  // aiBuildPhase calls Math.random() exactly once per player for preset selection.
  // The harness seeds Math.random with mulberry32(seed) before each build phase.
  // P1 builds first → uses call #1. P2 builds second → uses call #2.
  const rng = mulberry32(seed);
  const p1Idx = Math.floor(rng() * PRESET_NAMES.length);
  const p2Idx = Math.floor(rng() * PRESET_NAMES.length);
  return {
    p1: PRESET_NAMES[p1Idx] ?? 'unknown',
    p2: PRESET_NAMES[p2Idx] ?? 'unknown',
  };
}

// Preset strength heuristic: armor > balanced/tank-infantry > flanker > infantry-rush > artillery-fortress
const PRESET_STRENGTH: Record<string, number> = {
  'armor-push': 5,
  'balanced': 4,
  'tank-infantry': 4,
  'flanker': 3,
  'infantry-rush': 2,
  'artillery-fortress': 1,
};

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

console.log('=== P1 WIN BIAS DIAGNOSTIC ===\n');
console.log('Testing 20 seeds for map geometry, preset, and KotH bias.\n');

// ---- H1: Map Geometry ----
console.log('--- H1: MAP GEOMETRY (deployment centroid distance to objective) ---');
const geoRows: string[] = [];
let p1CloserCount = 0;
let p2CloserCount = 0;
let equalCount = 0;

for (const seed of SEEDS) {
  const state = createGame(seed);
  const obj = state.map.centralObjective;
  const p1Center = centroid(state.map.player1Deployment);
  const p2Center = centroid(state.map.player2Deployment);
  const p1Dist = cubeDistance(p1Center, obj);
  const p2Dist = cubeDistance(p2Center, obj);
  const bias = p1Dist < p2Dist ? 'P1 CLOSER' : p1Dist > p2Dist ? 'P2 CLOSER' : 'EQUAL';
  if (p1Dist < p2Dist) p1CloserCount++;
  else if (p2Dist < p1Dist) p2CloserCount++;
  else equalCount++;
  geoRows.push(`  seed ${String(seed).padStart(2)}: P1→obj=${p1Dist}  P2→obj=${p2Dist}  ${bias}`);
}

for (const row of geoRows) console.log(row);
console.log(`\n  Summary: P1 closer=${p1CloserCount}  P2 closer=${p2CloserCount}  Equal=${equalCount}`);
if (p1CloserCount > 14) console.log('  ⚠️  STRONG MAP BIAS TOWARD P1');
else if (p1CloserCount > p2CloserCount + 4) console.log('  ⚠️  MODERATE MAP BIAS TOWARD P1');
else console.log('  ✓  Map geometry looks symmetric');

// ---- H2: Preset Bias ----
console.log('\n--- H2: PRESET BIAS (which composition each player draws) ---');
let p1StrengthTotal = 0;
let p2StrengthTotal = 0;
let p1StrongerCount = 0;
let p2StrongerCount = 0;
const presetMatchupCounts: Record<string, number> = {};

for (const seed of SEEDS) {
  const { p1, p2 } = predictPresets(seed);
  const p1Str = PRESET_STRENGTH[p1] ?? 3;
  const p2Str = PRESET_STRENGTH[p2] ?? 3;
  p1StrengthTotal += p1Str;
  p2StrengthTotal += p2Str;
  if (p1Str > p2Str) p1StrongerCount++;
  else if (p2Str > p1Str) p2StrongerCount++;
  const key = `${p1} vs ${p2}`;
  presetMatchupCounts[key] = (presetMatchupCounts[key] ?? 0) + 1;
  console.log(`  seed ${String(seed).padStart(2)}: P1=${p1.padEnd(18)} P2=${p2.padEnd(18)} ${p1Str > p2Str ? 'P1 STRONGER' : p2Str > p1Str ? 'P2 STRONGER' : 'EQUAL'}`);
}

console.log(`\n  P1 avg strength: ${(p1StrengthTotal / SEEDS.length).toFixed(2)}`);
console.log(`  P2 avg strength: ${(p2StrengthTotal / SEEDS.length).toFixed(2)}`);
console.log(`  P1 draws stronger preset: ${p1StrongerCount}/20`);
console.log(`  P2 draws stronger preset: ${p2StrongerCount}/20`);
console.log('\n  Matchup distribution:');
for (const [matchup, count] of Object.entries(presetMatchupCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${matchup.padEnd(40)} ×${count}`);
}
if (p1StrengthTotal > p2StrengthTotal + 10) console.log('\n  ⚠️  STRONG PRESET BIAS TOWARD P1');
else if (p1StrongerCount > 13) console.log('\n  ⚠️  MODERATE PRESET BIAS TOWARD P1');
else console.log('\n  ✓  Preset distribution looks balanced');

// ---- H3: Round Win Reason (KotH fast = map bias signal) ----
console.log('\n--- H3: ROUND WIN REASONS (KotH fast = map geometry bias) ---');
let kothWins = 0;
let elimWins = 0;
let turnLimitWins = 0;
let p1WinTotal = 0;
let p2WinTotal = 0;
const roundRows: string[] = [];

for (const seed of SEEDS) {
  const result = runMatch(seed);
  if (result.winner === 'player1') p1WinTotal++;
  else if (result.winner === 'player2') p2WinTotal++;

  for (const round of result.roundResults) {
    if (round.reason === 'king-of-the-hill') kothWins++;
    else if (round.reason === 'elimination') elimWins++;
    else if (round.reason === 'turn-limit') turnLimitWins++;
  }

  const reasons = result.roundResults.map((r) => `${r.reason}(${r.turns}t)`).join(', ');
  roundRows.push(`  seed ${String(seed).padStart(2)}: winner=${(result.winner ?? 'DRAW').padEnd(8)} rounds=${result.rounds}  ${reasons}`);
}

for (const row of roundRows) console.log(row);

const totalRounds = kothWins + elimWins + turnLimitWins;
const drawTotal = SEEDS.length - p1WinTotal - p2WinTotal;
console.log(`\n  P1 wins: ${p1WinTotal}/20   P2 wins: ${p2WinTotal}/20   Draws: ${drawTotal}/20`);
console.log(`  Round endings: KotH=${kothWins} (${Math.round(kothWins/totalRounds*100)}%)  Elim=${elimWins} (${Math.round(elimWins/totalRounds*100)}%)  TurnLimit=${turnLimitWins} (${Math.round(turnLimitWins/totalRounds*100)}%)`);
if (kothWins / totalRounds > 0.7) console.log('  ⚠️  >70% of rounds end via KotH — map geometry dominates outcomes');
else console.log('  ✓  Round endings are mixed — KotH not dominant');

// ---- Final Verdict ----
console.log('\n=== VERDICT ===');
const mapBias = p1CloserCount > p2CloserCount + 4;
const presetBias = p1StrengthTotal > p2StrengthTotal + 10 || p1StrongerCount > 13;
const kothBias = kothWins / (kothWins + elimWins + turnLimitWins) > 0.7;

if (!mapBias && !presetBias) {
  console.log('Neither map geometry nor preset selection explains P1 dominance.');
  console.log('Root cause is likely in initiative fire ordering (response time) or type matchup asymmetry.');
  console.log('Recommended: log which player fires first in P5 initiative per engagement.');
} else {
  if (mapBias) console.log('MAP GEOMETRY is contributing to P1 bias.');
  if (presetBias) console.log('PRESET SELECTION is contributing to P1 bias.');
  if (kothBias) console.log('Most rounds end via KotH — map geometry is the primary driver.');
}
