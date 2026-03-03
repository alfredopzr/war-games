import { describe, it, expect } from 'vitest';
import type { IncomeParams } from './types';
import {
  calculateIncome,
  applyCarryover,
  applyMaintenance,
  canAfford,
  BASE_INCOME,
  CITY_INCOME,
  KILL_BONUS,
  ROUND_WIN_BONUS,
  CATCH_UP_BONUS,
  CARRYOVER_RATE,
  MAINTENANCE_RATE,
} from './economy';

describe('calculateIncome', () => {
  it('returns base income of 500 with no modifiers', () => {
    const params: IncomeParams = {
      citiesHeld: 0,
      unitsKilled: 0,
      wonRound: false,
      lostRound: false,
    };
    expect(calculateIncome(params)).toBe(500);
  });

  it('adds 100 per city held', () => {
    const params: IncomeParams = {
      citiesHeld: 3,
      unitsKilled: 0,
      wonRound: false,
      lostRound: false,
    };
    expect(calculateIncome(params)).toBe(500 + 3 * 100);
  });

  it('adds 25 per kill', () => {
    const params: IncomeParams = {
      citiesHeld: 0,
      unitsKilled: 4,
      wonRound: false,
      lostRound: false,
    };
    expect(calculateIncome(params)).toBe(500 + 4 * 25);
  });

  it('adds 150 for winning a round', () => {
    const params: IncomeParams = {
      citiesHeld: 0,
      unitsKilled: 0,
      wonRound: true,
      lostRound: false,
    };
    expect(calculateIncome(params)).toBe(500 + 150);
  });

  it('adds 200 catch-up bonus for losing a round', () => {
    const params: IncomeParams = {
      citiesHeld: 0,
      unitsKilled: 0,
      wonRound: false,
      lostRound: true,
    };
    expect(calculateIncome(params)).toBe(500 + 200);
  });

  it('combines all modifiers correctly', () => {
    const params: IncomeParams = {
      citiesHeld: 2,
      unitsKilled: 3,
      wonRound: true,
      lostRound: false,
    };
    // 500 + 200 + 75 + 150 = 925
    expect(calculateIncome(params)).toBe(925);
  });
});

describe('applyCarryover', () => {
  it('returns 50% of unspent resources (floored)', () => {
    expect(applyCarryover(150)).toBe(75);
    expect(applyCarryover(101)).toBe(50);
    expect(applyCarryover(1)).toBe(0);
  });

  it('returns 0 for 0 unspent', () => {
    expect(applyCarryover(0)).toBe(0);
  });
});

describe('applyMaintenance', () => {
  it('returns 20% of total surviving unit costs (floored)', () => {
    expect(applyMaintenance([100, 200, 300])).toBe(120);
  });

  it('floors the result', () => {
    expect(applyMaintenance([51])).toBe(10);
  });

  it('returns 0 for empty array', () => {
    expect(applyMaintenance([])).toBe(0);
  });
});

describe('canAfford', () => {
  it('returns true when resources equal cost', () => {
    expect(canAfford(100, 100)).toBe(true);
  });

  it('returns true when resources exceed cost', () => {
    expect(canAfford(200, 100)).toBe(true);
  });

  it('returns false when resources are less than cost', () => {
    expect(canAfford(50, 100)).toBe(false);
  });
});

describe('economy constants', () => {
  it('exports the correct constants', () => {
    expect(BASE_INCOME).toBe(500);
    expect(CITY_INCOME).toBe(100);
    expect(KILL_BONUS).toBe(25);
    expect(ROUND_WIN_BONUS).toBe(150);
    expect(CATCH_UP_BONUS).toBe(200);
    expect(CARRYOVER_RATE).toBe(0.5);
    expect(MAINTENANCE_RATE).toBe(0.2);
  });
});
