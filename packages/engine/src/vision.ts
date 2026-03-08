// =============================================================================
// HexWar — Vision System (Fog of War)
// =============================================================================

import type { Unit, TerrainType } from './types';
import { cubeDistance, hexToKey, keyToHex, hexLineDraw } from './hex';
import { getVisionBonus } from './terrain';
import { UNIT_STATS } from './units';
import { FOREST_VISION_PENALTY, LOS_EYE_HEIGHT } from './map-gen-params';

// -----------------------------------------------------------------------------
// calculateVisibility
// -----------------------------------------------------------------------------

/**
 * Compute the set of visible hex keys for a group of friendly units.
 *
 * For each unit:
 *  - Effective vision = base vision range + floor(base * elevation / MTN_PEAK_MAX)
 *  - Forest penalty: units on forest hexes lose FOREST_VISION_PENALTY range
 *  - For each hex within effective range, perform LoS check:
 *    - Draw hex line from unit to target
 *    - Sight line is raised by LOS_EYE_HEIGHT at both endpoints
 *    - If any INTERMEDIATE hex has elevation strictly above the interpolated
 *      sight-line height, the target is NOT visible (elevation occlusion)
 *    - The blocking hex itself IS visible
 */
export function calculateVisibility(
  friendlyUnits: Unit[],
  terrainMap: Map<string, TerrainType>,
  elevationMap: Map<string, number>,
  unitStats?: Record<string, { visionRange: number }>,
): Set<string> {
  const visible = new Set<string>();

  // Pre-build coord array once — avoids re-parsing "q,r" strings per unit
  const hexCoords: { key: string; q: number; r: number }[] = [];
  for (const key of terrainMap.keys()) {
    const coord = keyToHex(key);
    hexCoords.push({ key, q: coord.q, r: coord.r });
  }

  for (const unit of friendlyUnits) {
    const unitKey = hexToKey(unit.position);
    const unitElev = elevationMap.get(unitKey) ?? 0;
    const unitTerrain = terrainMap.get(unitKey);
    const stats = unitStats ?? UNIT_STATS;
    const baseVision = stats[unit.type].visionRange;
    const visionBonus = getVisionBonus(unitElev, baseVision);
    let effectiveVision = baseVision + visionBonus;

    // Forest vision penalty: units in forest see less in all directions
    if (unitTerrain === 'forest') {
      effectiveVision -= FOREST_VISION_PENALTY;
    }

    // The unit always sees its own hex
    visible.add(unitKey);

    if (effectiveVision <= 0) continue;

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
        const intermediateElev = elevationMap.get(intermediateKey) ?? 0;

        // Interpolated sight-line height at this step (raised by eye height)
        const sightHeight = elevA + LOS_EYE_HEIGHT + (elevB - elevA) * (i / totalSteps);

        // Pure elevation occlusion: any hex strictly above the sight line blocks
        if (intermediateElev > sightHeight) {
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
// canSeeHex — fast point-to-point LoS check (no full-map scan)
// -----------------------------------------------------------------------------

/**
 * Check if a specific observer unit can see a specific target hex.
 * Same LoS rules as calculateVisibility but O(vision_range) instead of O(all_hexes).
 */
export function canSeeHex(
  observer: Unit,
  targetHex: { q: number; r: number; s: number },
  terrainMap: Map<string, TerrainType>,
  elevationMap: Map<string, number>,
  unitStats?: Record<string, { visionRange: number }>,
): boolean {
  const observerKey = hexToKey(observer.position);
  const targetKey = hexToKey(targetHex);
  if (observerKey === targetKey) return true;

  const stats = unitStats ?? UNIT_STATS;
  const baseVision = stats[observer.type].visionRange;
  const observerElev = elevationMap.get(observerKey) ?? 0;
  const visionBonus = getVisionBonus(observerElev, baseVision);
  let effectiveVision = baseVision + visionBonus;

  const observerTerrain = terrainMap.get(observerKey);
  if (observerTerrain === 'forest') effectiveVision -= FOREST_VISION_PENALTY;

  const dist = cubeDistance(observer.position, targetHex);
  if (dist > effectiveVision) return false;

  const line = hexLineDraw(observer.position, targetHex);
  const elevA = observerElev;
  const elevB = elevationMap.get(targetKey) ?? 0;
  const totalSteps = line.length - 1;

  for (let i = 1; i < line.length - 1; i++) {
    const intermediateKey = hexToKey(line[i]!);
    const intermediateElev = elevationMap.get(intermediateKey) ?? 0;
    const sightHeight = elevA + LOS_EYE_HEIGHT + (elevB - elevA) * (i / totalSteps);
    if (intermediateElev > sightHeight) return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// isUnitVisible
// -----------------------------------------------------------------------------

/**
 * Check if a target unit is visible to any of the observing units.
 *
 * Forest concealment: units in forest are invisible to ALL observers outside
 * the forest. Only observers who are also on forest hexes can detect them
 * (subject to the forest vision penalty).
 */
export function isUnitVisible(
  target: Unit,
  observingUnits: Unit[],
  terrainMap: Map<string, TerrainType>,
  elevationMap: Map<string, number>,
  unitStats?: Record<string, { visionRange: number }>,
): boolean {
  const targetKey = hexToKey(target.position);
  const targetTerrain = terrainMap.get(targetKey);

  // Forest concealment: only observers on forest hexes can see units in forest
  if (targetTerrain === 'forest') {
    const forestObservers = observingUnits.filter((obs) => {
      const obsTerrain = terrainMap.get(hexToKey(obs.position));
      return obsTerrain === 'forest';
    });
    if (forestObservers.length === 0) return false;
    const visibleSet = calculateVisibility(forestObservers, terrainMap, elevationMap, unitStats);
    return visibleSet.has(targetKey);
  }

  // Non-forest target: check if any observer can see the hex
  const visibleSet = calculateVisibility(observingUnits, terrainMap, elevationMap, unitStats);
  return visibleSet.has(targetKey);
}
