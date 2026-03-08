import { describe, it, expect, beforeEach } from 'vitest';
import { resetUnitIdCounter } from './units';
import {
  runMatch,
  runBatch,
} from './ai-harness';

beforeEach(() => {
  resetUnitIdCounter();
});

// =============================================================================
// runMatch
// =============================================================================

// runMatch tests run full AI simulations — matches take ~15s each at 12 turns/round
const MATCH_TIMEOUT = 60_000;

describe('runMatch', () => {
  it('returns a valid MatchResult with mapValidity', () => {
    const result = runMatch(42);
    expect(result.seed).toBe(42);
    expect(result.mapValidity).toBeDefined();
    expect(['VALID', 'DEGRADED', 'BROKEN']).toContain(result.mapValidity.classification);
    expect(result.mapValidity.totalCities).toBeGreaterThan(0);
    expect(result.mapValidity.p1ReachableCities).toBeGreaterThanOrEqual(0);
    expect(result.mapValidity.p2ReachableCities).toBeGreaterThanOrEqual(0);
    if (result.mapValidity.classification !== 'BROKEN') {
      expect(result.winner === null || result.winner === 'player1' || result.winner === 'player2').toBe(true);
      expect(result.rounds).toBeGreaterThanOrEqual(1);
      expect(result.totalTurns).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(result.kills)).toBe(true);
      expect(result.roundResults.length).toBe(result.rounds);
    }
  }, MATCH_TIMEOUT);

  it('is deterministic for the same seed', () => {
    resetUnitIdCounter();
    const r1 = runMatch(123);
    resetUnitIdCounter();
    const r2 = runMatch(123);

    expect(r1.winner).toBe(r2.winner);
    expect(r1.rounds).toBe(r2.rounds);
    expect(r1.totalTurns).toBe(r2.totalTurns);
    expect(r1.kills.length).toBe(r2.kills.length);
  }, MATCH_TIMEOUT);

  it('produces different results for different seeds', () => {
    const results = new Set<string>();
    for (let seed = 1; seed <= 3; seed++) {
      resetUnitIdCounter();
      const r = runMatch(seed);
      results.add(`${r.winner}-${r.totalTurns}-${r.kills.length}`);
    }
    expect(results.size).toBeGreaterThan(1);
  }, 90_000);

  it('kills carry attacker/defender type and hit count', () => {
    const result = runMatch(42);
    if (result.kills.length > 0) {
      const kill = result.kills[0]!;
      expect(kill.attackerType).toBeDefined();
      expect(kill.defenderType).toBeDefined();
      expect(kill.hitCount).toBeGreaterThanOrEqual(1);
      expect(kill.typeAdvantage).toBeGreaterThan(0);
      expect(kill.verdict).toMatch(/^(TOO_FAST|OK|TOO_SLOW)$/);
    }
  }, MATCH_TIMEOUT);

  it('non-BROKEN map has gameplay data', () => {
    const result = runMatch(42);
    if (result.mapValidity.classification !== 'BROKEN') {
      expect(result.rounds).toBeGreaterThanOrEqual(1);
      expect(result.totalTurns).toBeGreaterThanOrEqual(1);
    }
  }, MATCH_TIMEOUT);

  it('terminates within maxRounds * maxTurns turns', () => {
    const result = runMatch(42);
    // 3 rounds * 12 turns/round = 36 max
    expect(result.totalTurns).toBeLessThanOrEqual(36);
  }, MATCH_TIMEOUT);
});

// =============================================================================
// runBatch
// =============================================================================

describe('runBatch', () => {
  it('runs N matches and returns a summary with validity data', () => {
    const summary = runBatch({ matchCount: 3, baseSeed: 42 });
    expect(summary.matchCount).toBe(3);
    expect(summary.validMaps + summary.degradedMaps + summary.brokenMaps).toBe(3);
    expect(summary.results.length).toBe(3);
    expect(summary.p1Wins + summary.p2Wins + summary.draws).toBe(summary.playedMatches);
  }, 60_000);

  it('computes match length distribution from played matches', () => {
    const summary = runBatch({ matchCount: 3, baseSeed: 42 });
    if (summary.playedMatches > 0) {
      expect(summary.avgTurns).toBeGreaterThan(0);
      expect(summary.minTurns).toBeGreaterThan(0);
      expect(summary.maxTurns).toBeGreaterThanOrEqual(summary.minTurns);
    }
  }, 120_000);

  it('computes kill timing verdicts per matchup', () => {
    const summary = runBatch({ matchCount: 3, baseSeed: 42 });
    expect(summary.matchupVerdicts).toBeDefined();
    const totalKills = summary.results.reduce((sum, r) => sum + r.kills.length, 0);
    if (totalKills > 0) {
      expect(Object.keys(summary.matchupVerdicts).length).toBeGreaterThan(0);
    }
  }, 120_000);
});
