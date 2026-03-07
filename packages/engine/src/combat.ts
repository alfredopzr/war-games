import type { Unit, TerrainType, Building } from './types';
import { cubeDistance, hexToKey } from './hex';
import { getDefenseModifier } from './terrain';
import { UNIT_STATS, getTypeAdvantage } from './units';
import { BUILDING_STATS } from './buildings';

// =============================================================================
// HexWar — Combat Resolution
// =============================================================================

/**
 * Calculate damage dealt by attacker to defender.
 *
 * Formula:
 *   baseDamage = ATK * typeMultiplier * randomFactor
 *   finalDamage = max(1, floor(baseDamage - DEF * terrainDefense))
 *
 * @param randomFn - Injectable RNG returning a value in [0.85, 1.15].
 *                   Defaults to uniform random in that range.
 */
export function calculateDamage(
  attacker: Unit,
  defender: Unit,
  defenderTerrain: TerrainType,
  randomFn: () => number = (): number => 0.85 + Math.random() * 0.3,
  buildings?: Building[],
): number {
  const attackerStats = UNIT_STATS[attacker.type];
  const defenderStats = UNIT_STATS[defender.type];
  const typeMultiplier = getTypeAdvantage(attacker.type, defender.type);
  let terrainDef = getDefenseModifier(defenderTerrain);

  // Defensive position bonus
  if (buildings) {
    const defenderKey = hexToKey(defender.position);
    const hasDP = buildings.some(
      (b) =>
        b.type === 'defensive-position' &&
        b.owner === defender.owner &&
        hexToKey(b.position) === defenderKey,
    );
    if (hasDP) {
      terrainDef += BUILDING_STATS['defensive-position'].defenseBonus ?? 0.5;
    }
  }

  // Hold directive grants +1 DEF
  const effectiveDef = defenderStats.def + (defender.directive === 'hold' ? 1 : 0);

  const randomFactor = randomFn();
  const baseDamage = attackerStats.atk * typeMultiplier * randomFactor;
  const finalDamage = Math.max(1, Math.floor(baseDamage - effectiveDef * terrainDef));

  return finalDamage;
}

/**
 * Check whether an attacker can attack a defender.
 *
 * Returns false if:
 * - Same owner (friendly fire)
 * - Distance is outside [minAttackRange, attackRange]
 */
export function canAttack(attacker: Unit, defender: Unit): boolean {
  if (attacker.owner === defender.owner) {
    return false;
  }

  const distance = cubeDistance(attacker.position, defender.position);
  const stats = UNIT_STATS[attacker.type];

  return distance >= stats.minAttackRange && distance <= stats.attackRange;
}
