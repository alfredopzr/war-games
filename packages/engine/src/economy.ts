import type { IncomeParams } from './types';
import balanceData from './balance.json';

// ---------------------------------------------------------------------------
// Constants — derived from balance.json (single source of truth)
// ---------------------------------------------------------------------------

export const BASE_INCOME = balanceData.economy.baseIncome;
export const CITY_INCOME = balanceData.economy.cityIncome;
export const KILL_BONUS = balanceData.economy.killBonus;
export const ROUND_WIN_BONUS = balanceData.economy.roundWinBonus;
export const CATCH_UP_BONUS = balanceData.economy.catchUpBonus;
export const CARRYOVER_RATE = balanceData.economy.carryoverRate;
export const MAINTENANCE_RATE = balanceData.economy.maintenanceRate;

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
