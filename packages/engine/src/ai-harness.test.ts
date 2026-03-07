import { describe, it, expect, beforeEach } from 'vitest';
import { resetUnitIdCounter } from './units';
import {
  runMatch,
  runBatch,
  classifyKillTiming,
} from './ai-harness';

beforeEach(() => {
  resetUnitIdCounter();
});

// =============================================================================
// classifyKillTiming
// =============================================================================

describe('classifyKillTiming', () => {
  it('returns TOO_FAST when hits < target range', () => {
    // Counter (2.0x) target: ~2 hits. 1 hit = too fast
    expect(classifyKillTiming(2.0, 1)).toBe('TOO_FAST');
  });

  it('returns OK for counter matchup at 2 hits', () => {
    expect(classifyKillTiming(2.0, 2)).toBe('OK');
  });

  it('returns OK for counter matchup at 3 hits', () => {
    expect(classifyKillTiming(2.0, 3)).toBe('OK');
  });

  it('returns TOO_SLOW for counter matchup at 5 hits', () => {
    expect(classifyKillTiming(2.0, 5)).toBe('TOO_SLOW');
  });

  it('returns OK for neutral matchup at 3 hits', () => {
    expect(classifyKillTiming(1.0, 3)).toBe('OK');
  });

  it('returns OK for neutral matchup at 4 hits', () => {
    expect(classifyKillTiming(1.0, 4)).toBe('OK');
  });

  it('returns TOO_FAST for neutral matchup at 1 hit', () => {
    expect(classifyKillTiming(1.0, 1)).toBe('TOO_FAST');
  });

  it('returns TOO_SLOW for neutral matchup at 7 hits', () => {
    expect(classifyKillTiming(1.0, 7)).toBe('TOO_SLOW');
  });

  it('returns OK for disadvantaged matchup at 6 hits', () => {
    expect(classifyKillTiming(0.6, 6)).toBe('OK');
  });

  it('returns OK for disadvantaged matchup at 7 hits', () => {
    expect(classifyKillTiming(0.6, 7)).toBe('OK');
  });

  it('returns TOO_FAST for disadvantaged matchup at 3 hits', () => {
    expect(classifyKillTiming(0.6, 3)).toBe('TOO_FAST');
  });

  it('returns TOO_SLOW for disadvantaged matchup at 10 hits', () => {
    expect(classifyKillTiming(0.6, 10)).toBe('TOO_SLOW');
  });
});

// =============================================================================
// runMatch
// =============================================================================

// runMatch tests run full AI simulations — allow up to 30s per test
const MATCH_TIMEOUT = 30_000;

describe('runMatch', () => {
  it('returns a valid MatchResult', () => {
    const result = runMatch(42);
    expect(result.winner === null || result.winner === 'player1' || result.winner === 'player2').toBe(true);
    expect(result.seed).toBe(42);
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.totalTurns).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.kills)).toBe(true);
    expect(result.roundResults.length).toBe(result.rounds);
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
    for (let seed = 1; seed <= 5; seed++) {
      resetUnitIdCounter();
      const r = runMatch(seed);
      results.add(`${r.winner}-${r.totalTurns}-${r.kills.length}`);
    }
    expect(results.size).toBeGreaterThan(1);
  }, MATCH_TIMEOUT);

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
  it('runs N matches and returns a summary', () => {
    const summary = runBatch({ matchCount: 3, baseSeed: 42 });
    expect(summary.matchCount).toBe(3);
    expect(summary.p1Wins + summary.p2Wins + summary.draws).toBe(3);
    expect(summary.p1WinRate + summary.p2WinRate + summary.drawRate).toBeCloseTo(1.0);
    expect(summary.results.length).toBe(3);
  }, 60_000);

  it('computes match length distribution', () => {
    const summary = runBatch({ matchCount: 3, baseSeed: 42 });
    expect(summary.avgTurns).toBeGreaterThan(0);
    expect(summary.minTurns).toBeGreaterThan(0);
    expect(summary.maxTurns).toBeGreaterThanOrEqual(summary.minTurns);
  }, 60_000);

  it('computes kill timing verdicts per matchup', () => {
    const summary = runBatch({ matchCount: 3, baseSeed: 42 });
    expect(summary.matchupVerdicts).toBeDefined();
    const totalKills = summary.results.reduce((sum, r) => sum + r.kills.length, 0);
    if (totalKills > 0) {
      expect(Object.keys(summary.matchupVerdicts).length).toBeGreaterThan(0);
    }
  }, 60_000);
});
