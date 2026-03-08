import type { Unit, UnitType, TerrainType, HexModifier } from './types';
import { cubeDistance, hexToKey } from './hex';
import { getDefenseModifier } from './terrain';
import { UNIT_STATS, getTypeAdvantage } from './units';

// =============================================================================
// HexWar — Combat Resolution
// =============================================================================

/** RNG floor for combat variance (±15% → [0.85, 1.15]) */
export const COMBAT_RNG_MIN = 0.85;
/** RNG range for combat variance: result = COMBAT_RNG_MIN + rng() * COMBAT_RNG_RANGE */
export const COMBAT_RNG_RANGE = 0.3;

/**
 * Calculate damage dealt by attacker to defender.
 *
 * Formula (GAME_MATH_ENGINE.md §Damage Formula):
 *   baseDamage = ATK * typeMultiplier * randomFactor
 *   finalDamage = max(1, floor(baseDamage * (1 - terrainDefense) - DEF))
 *
 * Terrain reduces gross damage as a percentage first, then DEF subtracts flat.
 * DEF is meaningful on all terrain including plains (terrainDef=0).
 *
 * OPEN: Counter-fire mechanics deferred. Currently all combat is
 * single-strike (no return fire). Counter-fire gating rules will be
 * defined with the combat timeline (S3 Phase 5/6).
 *
 * @param randomFn - Injectable RNG returning a value in [0.85, 1.15].
 *                   Defaults to uniform random in that range.
 */
export function calculateDamage(
  attacker: Unit,
  defender: Unit,
  defenderTerrain: TerrainType,
  randomFn: () => number = (): number => COMBAT_RNG_MIN + Math.random() * COMBAT_RNG_RANGE,
  defenderModifier?: HexModifier,
): number {
  const attackerStats = UNIT_STATS[attacker.type];
  const defenderStats = UNIT_STATS[defender.type];
  const typeMultiplier = getTypeAdvantage(attacker.type, defender.type);
  const terrainDef = getDefenseModifier(defenderTerrain, defenderModifier);

  // Hold directive grants +1 DEF
  const effectiveDef = defenderStats.def + (defender.movementDirective === 'hold' ? 1 : 0);

  const randomFactor = randomFn();
  const baseDamage = attackerStats.atk * typeMultiplier * randomFactor;
  const finalDamage = Math.max(1, Math.floor(baseDamage * (1 - terrainDef) - effectiveDef));

  return finalDamage;
}

/**
 * Check whether an attacker can attack a defender.
 *
 * Returns false if:
 * - Same owner (friendly fire)
 * - Distance is outside [minAttackRange, attackRange]
 * - visibleHexes provided and defender's hex is not in the set (LoS gate)
 */
export function canAttack(attacker: Unit, defender: Unit, visibleHexes?: Set<string>): boolean {
  if (attacker.owner === defender.owner) {
    return false;
  }

  if (visibleHexes && !visibleHexes.has(hexToKey(defender.position))) {
    return false;
  }

  const distance = cubeDistance(attacker.position, defender.position);
  const stats = UNIT_STATS[attacker.type];

  return distance >= stats.minAttackRange && distance <= stats.attackRange;
}

// =============================================================================
// Kill Band — expected hits-to-kill for balance validation
// =============================================================================

export interface KillBand {
  readonly expectedHitsMin: number;
  readonly expectedHitsMax: number;
}

export function computeExpectedKillBand(
  attackerType: UnitType,
  defenderType: UnitType,
  defenderTerrain: TerrainType,
  defenderModifier?: HexModifier,
): KillBand {
  const atk = UNIT_STATS[attackerType].atk;
  const def = UNIT_STATS[defenderType].def;
  const hp = UNIT_STATS[defenderType].maxHp;
  const typeMult = getTypeAdvantage(attackerType, defenderType);
  const terrainDef = getDefenseModifier(defenderTerrain, defenderModifier);

  const minDmg = Math.max(1, Math.floor((atk * typeMult * 0.85) * (1 - terrainDef) - def));
  const maxDmg = Math.max(1, Math.floor((atk * typeMult * 1.15) * (1 - terrainDef) - def));

  return {
    expectedHitsMin: Math.ceil(hp / maxDmg),
    expectedHitsMax: Math.ceil(hp / minDmg),
  };
}
