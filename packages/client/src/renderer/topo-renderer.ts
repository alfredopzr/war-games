import * as THREE from 'three';
import type { CubeCoord } from '@hexwar/engine';
import { hexToKey, hexWorldVertices, hexAdd, CUBE_DIRECTIONS, WORLD_ELEV_STEP } from '@hexwar/engine';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Topographic contour renderer
//
// Draws contour lines at each integer elevation level. A contour segment
// appears on a hex edge when one neighbor is below the level and the other
// is at or above it — standard topo map convention.
// ---------------------------------------------------------------------------

let topoGroup: THREE.Group | null = null;

const topoMaterial = new THREE.LineBasicMaterial({
  color: 0xc8b898,
  depthTest: false,
  depthWrite: false,
});

/** Maps CUBE_DIRECTIONS index to hex vertex edge index (edge i = vertex i to i+1). */
const DIR_TO_EDGE = [0, 5, 4, 3, 2, 1] as const;

export function renderTopoLines(
  allHexes: CubeCoord[],
  elevationMap: Map<string, number>,
  visibleHexes?: Set<string>,
  exploredHexes?: Set<string>,
): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  clearTopoLines();

  topoGroup = new THREE.Group();
  topoGroup.name = 'topoGroup';
  topoGroup.renderOrder = 4;

  // Find elevation range
  let maxElev = 0;
  for (const elev of elevationMap.values()) {
    if (elev > maxElev) maxElev = elev;
  }

  const maxLevel = Math.floor(maxElev);
  if (maxLevel < 1) {
    ctx.scene.add(topoGroup);
    return;
  }

  const segments: number[] = [];
  const visited = new Set<string>();

  for (const hex of allHexes) {
    const key = hexToKey(hex);
    const elev = elevationMap.get(key) ?? 0;

    for (let d = 0; d < 6; d++) {
      const neighbor = hexAdd(hex, CUBE_DIRECTIONS[d]!);
      const neighborKey = hexToKey(neighbor);
      const neighborElev = elevationMap.get(neighborKey);

      if (neighborElev === undefined) continue;

      // Only draw topo on unexplored terrain — skip if both hexes are known
      const hexKnown = visibleHexes?.has(key) || exploredHexes?.has(key);
      const neighborKnown = visibleHexes?.has(neighborKey) || exploredHexes?.has(neighborKey);
      if (hexKnown && neighborKnown) continue;

      // Deduplicate edges
      const edgeId = key < neighborKey ? `${key}|${neighborKey}` : `${neighborKey}|${key}`;
      if (visited.has(edgeId)) continue;
      visited.add(edgeId);

      const lo = Math.min(elev, neighborElev);
      const hi = Math.max(elev, neighborElev);

      // Contour every 1 elevation unit
      const INTERVAL = 1;
      const firstLevel = Math.ceil((lo + 0.001) / INTERVAL) * INTERVAL;

      for (let level = firstLevel; level <= hi; level += INTERVAL) {
        if (level < INTERVAL) continue;
        if (lo >= level) continue;

        const contourY = level * WORLD_ELEV_STEP + 0.012;
        const edge = DIR_TO_EDGE[d]!;
        // Use elev=0 for XZ so adjacent hexes share vertex positions at the boundary
        const verts = hexWorldVertices(hex, 0);
        const va = verts[edge]!;
        const vb = verts[(edge + 1) % 6]!;

        segments.push(va.x, contourY, va.z, vb.x, contourY, vb.z);
      }
    }
  }

  if (segments.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
    const lines = new THREE.LineSegments(geo, topoMaterial);
    lines.renderOrder = 4;
    topoGroup.add(lines);
  }

  ctx.scene.add(topoGroup);
}

export function clearTopoLines(): void {
  if (!topoGroup) return;
  const ctx = getThreeContext();
  if (ctx) ctx.scene.remove(topoGroup);
  topoGroup.traverse((obj) => {
    if (obj instanceof THREE.LineSegments) {
      obj.geometry.dispose();
    }
  });
  topoGroup = null;
}
