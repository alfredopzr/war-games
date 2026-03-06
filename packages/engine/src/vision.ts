// =============================================================================
// HexWar — Vision System (Fog of War)
// =============================================================================

import type { Unit, TerrainType } from './types';
import { cubeDistance, hexToKey, hexLineDraw } from './hex';
import { TERRAIN } from './terrain';
import { getVisionBonus } from './terrain';
import { UNIT_STATS } from './units';

// -----------------------------------------------------------------------------
// calculateVisibility
// -----------------------------------------------------------------------------

/**
 * Compute the set of visible hex keys for a group of friendly units.
 *
 * For each unit:
 *  - Effective vision = base vision range + floor(sqrt(elevation))
 *  - For each hex in terrainMap within effective range, perform LoS check:
 *    - Draw hex line from unit to target
 *    - If any INTERMEDIATE hex blocks the sight line (its elevation
 *      exceeds the interpolated sight-line height AND its terrain
 *      blocks LoS), the target is NOT visible
 *    - The blocking hex itself IS visible
 */
export function calculateVisibility(
  friendlyUnits: Unit[],
  terrainMap: Map<string, TerrainType>,
  elevationMap: Map<string, number>,
): Set<string> {
  const visible = new Set<string>();

  // Pre-build coord array once — avoids re-parsing "q,r" strings per unit
  const hexCoords: { key: string; q: number; r: number }[] = [];
  for (const key of terrainMap.keys()) {
    const [qStr, rStr] = key.split(',');
    hexCoords.push({ key, q: Number(qStr), r: Number(rStr) });
  }

  for (const unit of friendlyUnits) {
    const unitKey = hexToKey(unit.position);
    const unitElev = elevationMap.get(unitKey) ?? 0;
    const visionBonus = getVisionBonus(unitElev);
    const effectiveVision = UNIT_STATS[unit.type].visionRange + visionBonus;

    // The unit always sees its own hex
    visible.add(unitKey);

    for (const hc of hexCoords) {
      const targetCoord = { q: hc.q, r: hc.r, s: -hc.q - hc.r };

      const dist = cubeDistance(unit.position, targetCoord);
      if (dist > effectiveVision || dist === 0) continue;

      // LoS check: draw line and check intermediate hexes
      const line = hexLineDraw(unit.position, targetCoord);
      let blocked = false;

      const elevA = unitElev;
      const elevB = elevationMap.get(hc.key) ?? 0;
      const totalSteps = line.length - 1;

      // Intermediate hexes = everything except first (start) and last (end)
      for (let i = 1; i < line.length - 1; i++) {
        const intermediateKey = hexToKey(line[i]!);
        const intermediateTerrain = terrainMap.get(intermediateKey);
        const intermediateElev = elevationMap.get(intermediateKey) ?? 0;

        // Interpolated sight-line height at this step
        const sightHeight = elevA + (elevB - elevA) * (i / totalSteps);

        if (intermediateElev >= sightHeight && intermediateTerrain && TERRAIN[intermediateTerrain].blocksLoS) {
          // The blocking hex itself is visible, but target is not
          visible.add(intermediateKey);
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        visible.add(hc.key);
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
  elevationMap: Map<string, number>,
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
  const visibleSet = calculateVisibility(observingUnits, terrainMap, elevationMap);
  return visibleSet.has(targetKey);
}
