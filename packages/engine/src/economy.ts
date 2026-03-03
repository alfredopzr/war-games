import type { IncomeParams } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BASE_INCOME = 500;
export const CITY_INCOME = 100;
export const KILL_BONUS = 25;
export const ROUND_WIN_BONUS = 150;
export const CATCH_UP_BONUS = 200;
export const CARRYOVER_RATE = 0.5;
export const MAINTENANCE_RATE = 0.2;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Total income for a player at the start of a round.
 * Base + city bonus + kill bonus + round-outcome bonus.
 */
export function calculateIncome(params: IncomeParams): number {
  const { citiesHeld, unitsKilled, wonRound, lostRound } = params;

  return (
    BASE_INCOME +
    citiesHeld * CITY_INCOME +
    unitsKilled * KILL_BONUS +
    (wonRound ? ROUND_WIN_BONUS : 0) +
    (lostRound ? CATCH_UP_BONUS : 0)
  );
}

/**
 * Resources carried over from the previous round (50%, floored).
 */
export function applyCarryover(unspentResources: number): number {
  return Math.floor(unspentResources * CARRYOVER_RATE);
}

/**
 * Maintenance cost for surviving units (20% of total cost, floored).
 */
export function applyMaintenance(survivingUnitCosts: number[]): number {
  const total = survivingUnitCosts.reduce((sum, cost) => sum + cost, 0);
  return Math.floor(total * MAINTENANCE_RATE);
}

/**
 * Whether the player can afford a purchase.
 */
export function canAfford(currentResources: number, cost: number): boolean {
  return currentResources >= cost;
}
