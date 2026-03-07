import { describe, it, expect, beforeEach } from 'vitest';
import { resetUnitIdCounter } from './units';
import {
  runMatch,
  runBatch,
  classifyKillTiming,
  computeKillThresholds,
} from './ai-harness';

beforeEach(() => {
  resetUnitIdCounter();
});

// =============================================================================
// computeKillThresholds — verify formula matches known matchups
// =============================================================================

describe('computeKillThresholds', () => {
  it('tank vs infantry on plains (counter 2.0x): okMin=1, okMax=2', () => {
    // ATK=14, typeMult=2.0, DEF=2, HP=30, terrainDef=0
    // minDmg = max(1, floor(14*2.0*0.85 - 2)) = 21
    // maxDmg = max(1, floor(14*2.0*1.15 - 2)) = 30
    const t = computeKillThresholds('tank', 'infantry', 'plains');
    expect(t.minDmg).toBe(21);
    expect(t.maxDmg).toBe(30);
    expect(t.okMin).toBe(1);
    expect(t.okMax).toBe(2);
  });

  it('infantry vs infantry on plains (neutral 1.0x): okMin=4, okMax=5', () => {
    // ATK=10, typeMult=1.0, DEF=2, HP=30, terrainDef=0
    // minDmg = max(1, floor(10*1.0*0.85 - 2)) = 6
    // maxDmg = max(1, floor(10*1.0*1.15 - 2)) = 9
    const t = computeKillThresholds('infantry', 'infantry', 'plains');
    expect(t.minDmg).toBe(6);
    expect(t.maxDmg).toBe(9);
    expect(t.okMin).toBe(4);
    expect(t.okMax).toBe(5);
  });

  it('infantry vs tank on plains (disadvantaged 0.6x): okMin=10, okMax=14', () => {
    // ATK=10, typeMult=0.6, DEF=2, HP=40, terrainDef=0
    // minDmg = max(1, floor(10*0.6*0.85 - 2)) = 3
    // maxDmg = max(1, floor(10*0.6*1.15 - 2)) = 4
    const t = computeKillThresholds('infantry', 'tank', 'plains');
    expect(t.minDmg).toBe(3);
    expect(t.maxDmg).toBe(4);
    expect(t.okMin).toBe(10);
    expect(t.okMax).toBe(14);
  });

  it('forest defense reduces damage and extends kill time', () => {
    // Tank vs infantry on forest: terrainDef=0.25
    // minDmg = max(1, floor(14*2.0*0.85*0.75 - 2)) = 15
    // maxDmg = max(1, floor(14*2.0*1.15*0.75 - 2)) = 22
    const plains = computeKillThresholds('tank', 'infantry', 'plains');
    const forest = computeKillThresholds('tank', 'infantry', 'forest');
    expect(forest.minDmg).toBe(15);
    expect(forest.maxDmg).toBe(22);
    expect(forest.okMin).toBe(2);
    expect(forest.okMax).toBe(2);
    // Forest always produces lower damage than plains
    expect(forest.minDmg).toBeLessThan(plains.minDmg);
    expect(forest.maxDmg).toBeLessThan(plains.maxDmg);
  });

  it('mountain and city have same thresholds as plains (0% defense)', () => {
    const plains = computeKillThresholds('tank', 'infantry', 'plains');
    const mountain = computeKillThresholds('tank', 'infantry', 'mountain');
    const city = computeKillThresholds('tank', 'infantry', 'city');
    expect(mountain).toEqual(plains);
    expect(city).toEqual(plains);
  });
});

// =============================================================================
// classifyKillTiming — new signature: (attackerType, defenderType, terrain, hits)
// =============================================================================

describe('classifyKillTiming', () => {
  it('returns TOO_FAST when hits below ok band', () => {
    // Tank vs infantry on plains: okMin=1, so 0 would be TOO_FAST but minimum is 1 hit
    // Use infantry vs infantry: okMin=4, so 3 hits = TOO_FAST
    expect(classifyKillTiming('infantry', 'infantry', 'plains', 3)).toBe('TOO_FAST');
  });

  it('returns OK for tank vs infantry on plains at 1 hit', () => {
    // okMin=1, okMax=2
    expect(classifyKillTiming('tank', 'infantry', 'plains', 1)).toBe('OK');
  });

  it('returns OK for tank vs infantry on plains at 2 hits', () => {
    expect(classifyKillTiming('tank', 'infantry', 'plains', 2)).toBe('OK');
  });

  it('returns TOO_SLOW for tank vs infantry on plains at 4 hits', () => {
    // okMax=2
    expect(classifyKillTiming('tank', 'infantry', 'plains', 4)).toBe('TOO_SLOW');
  });

  it('returns OK for neutral matchup within band', () => {
    // infantry vs infantry on plains: okMin=4, okMax=5
    expect(classifyKillTiming('infantry', 'infantry', 'plains', 4)).toBe('OK');
    expect(classifyKillTiming('infantry', 'infantry', 'plains', 5)).toBe('OK');
  });

  it('returns TOO_SLOW for neutral matchup above band', () => {
    expect(classifyKillTiming('infantry', 'infantry', 'plains', 6)).toBe('TOO_SLOW');
  });

  it('returns OK for disadvantaged matchup within band', () => {
    // infantry vs tank on plains: okMin=10, okMax=14
    expect(classifyKillTiming('infantry', 'tank', 'plains', 10)).toBe('OK');
    expect(classifyKillTiming('infantry', 'tank', 'plains', 14)).toBe('OK');
  });

  it('returns TOO_FAST for disadvantaged matchup below band', () => {
    expect(classifyKillTiming('infantry', 'tank', 'plains', 9)).toBe('TOO_FAST');
  });

  it('returns TOO_SLOW for disadvantaged matchup above band', () => {
    expect(classifyKillTiming('infantry', 'tank', 'plains', 15)).toBe('TOO_SLOW');
  });

  it('terrain affects verdict — forest extends ok band', () => {
    // Tank vs infantry: plains okMax=2, forest okMin=2, okMax=2
    // So 2 hits is OK on both, but 3 hits is TOO_SLOW on plains AND forest
    expect(classifyKillTiming('tank', 'infantry', 'plains', 2)).toBe('OK');
    expect(classifyKillTiming('tank', 'infantry', 'forest', 2)).toBe('OK');
  });
});

// =============================================================================
// runMatch
// =============================================================================

// runMatch tests run full AI simulations — allow up to 30s per test
const MATCH_TIMEOUT = 30_000;

describe('runMatch', () => {
  it('returns a valid MatchResult with mapFairness', () => {
    const result = runMatch(42);
    expect(result.winner === null || result.winner === 'player1' || result.winner === 'player2').toBe(true);
    expect(result.seed).toBe(42);
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.totalTurns).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.kills)).toBe(true);
    expect(result.roundResults.length).toBe(result.rounds);
    expect(result.mapFairness).toBeDefined();
    expect(result.mapFairness.cityDistP1).toBeGreaterThan(0);
    expect(result.mapFairness.cityDistP2).toBeGreaterThan(0);
    expect(result.mapFairness.cityDistDelta).toBeGreaterThanOrEqual(0);
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
  it('runs N matches and returns a summary with fairness data', () => {
    const summary = runBatch({ matchCount: 3, baseSeed: 42 });
    expect(summary.matchCount).toBe(3);
    expect(summary.p1Wins + summary.p2Wins + summary.draws).toBe(3);
    expect(summary.p1WinRate + summary.p2WinRate + summary.drawRate).toBeCloseTo(1.0);
    expect(summary.results.length).toBe(3);
    expect(summary.avgCityDistDelta).toBeGreaterThanOrEqual(0);
    expect(summary.avgPathCostDelta).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it('computes match length distribution', () => {
    const summary = runBatch({ matchCount: 3, baseSeed: 42 });
    expect(summary.avgTurns).toBeGreaterThan(0);
    expect(summary.minTurns).toBeGreaterThan(0);
    expect(summary.maxTurns).toBeGreaterThanOrEqual(summary.minTurns);
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
