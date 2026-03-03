// =============================================================================
// HexWar — Vision System (Fog of War)
// =============================================================================

import type { Unit, TerrainType } from './types';
import { cubeDistance, hexToKey, hexLineDraw } from './hex';
import { TERRAIN } from './terrain';
import { UNIT_STATS } from './units';

// -----------------------------------------------------------------------------
// calculateVisibility
// -----------------------------------------------------------------------------

/**
 * Compute the set of visible hex keys for a group of friendly units.
 *
 * For each unit:
 *  - Effective vision = base vision range + terrain vision modifier at unit position
 *  - For each hex in terrainMap within effective range, perform LoS check:
 *    - Draw hex line from unit to target
 *    - If any INTERMEDIATE hex (not start, not end) has blocksLoS terrain,
 *      the target is NOT visible
 *    - The blocking hex itself IS visible
 */
export function calculateVisibility(
  friendlyUnits: Unit[],
  terrainMap: Map<string, TerrainType>,
): Set<string> {
  const visible = new Set<string>();

  for (const unit of friendlyUnits) {
    const unitKey = hexToKey(unit.position);
    const unitTerrain = terrainMap.get(unitKey);
    const visionMod = unitTerrain ? TERRAIN[unitTerrain].visionModifier : 0;
    const effectiveVision = UNIT_STATS[unit.type].visionRange + visionMod;

    // The unit always sees its own hex
    visible.add(unitKey);

    for (const key of terrainMap.keys()) {
      // Parse the key back to a coord for distance check
      const [qStr, rStr] = key.split(',');
      const tq = Number(qStr);
      const tr = Number(rStr);
      const targetCoord = { q: tq, r: tr, s: -tq - tr };

      const dist = cubeDistance(unit.position, targetCoord);
      if (dist > effectiveVision || dist === 0) continue;

      // LoS check: draw line and check intermediate hexes
      const line = hexLineDraw(unit.position, targetCoord);
      let blocked = false;

      // Intermediate hexes = everything except first (start) and last (end)
      for (let i = 1; i < line.length - 1; i++) {
        const intermediateKey = hexToKey(line[i]!);
        const intermediateTerrain = terrainMap.get(intermediateKey);
        if (intermediateTerrain && TERRAIN[intermediateTerrain].blocksLoS) {
          // The blocking hex itself is visible, but target is not
          visible.add(intermediateKey);
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        visible.add(key);
      }
    }
  }

  return visible;
}

// -----------------------------------------------------------------------------
// isUnitVisible
// -----------------------------------------------------------------------------

/**
 * Check if a target unit is visible to any of the observing units.
 *
 * Special rule: if the target is on a forest hex, it is only visible
 * if at least one observer is adjacent (cube distance <= 1).
 */
export function isUnitVisible(
  target: Unit,
  observingUnits: Unit[],
  terrainMap: Map<string, TerrainType>,
): boolean {
  const targetKey = hexToKey(target.position);
  const targetTerrain = terrainMap.get(targetKey);

  // Forest concealment: only adjacent observers can see units in forest
  if (targetTerrain === 'forest') {
    return observingUnits.some(
      (obs) => cubeDistance(obs.position, target.position) <= 1,
    );
  }

  // Otherwise check if target hex is in the combined visibility set
  const visibleSet = calculateVisibility(observingUnits, terrainMap);
  return visibleSet.has(targetKey);
}
