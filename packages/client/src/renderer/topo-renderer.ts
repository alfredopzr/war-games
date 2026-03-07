import * as THREE from 'three';
import type { CubeCoord } from '@hexwar/engine';
import { hexToKey, hexWorldVertices, hexAdd, CUBE_DIRECTIONS, WORLD_ELEV_STEP } from '@hexwar/engine';
import { getThreeContext } from './three-scene';
import { getPalette } from './palette';

// ---------------------------------------------------------------------------
// Topographic contour renderer
//
// Two layers of contour lines like a real topo map:
//   Major contours — every 3 elevation units, bright
//   Minor contours — every 1 elevation unit, darker/subtler
//
// Contours are rendered as thin quad strips (two triangles per edge) instead
// of LineSegments so that polygonOffset works for depth bias against terrain.
// ---------------------------------------------------------------------------

let topoGroup: THREE.Group | null = null;

const QUAD_HALF_WIDTH = 0.10;
const MAJOR_INTERVAL = 3;
const MINOR_INTERVAL = 1;

let majorMaterial: THREE.MeshBasicMaterial;
let minorMaterial: THREE.MeshBasicMaterial;

function ensureTopoMaterials(): void {
  const p = getPalette();
  if (!majorMaterial) {
    majorMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    minorMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }
  majorMaterial.color.setHex(p.topo.major);
  minorMaterial.color.setHex(p.topo.minor);
}

/** Maps CUBE_DIRECTIONS index to hex vertex edge index (edge i = vertex i to i+1). */
const DIR_TO_EDGE = [0, 5, 4, 3, 2, 1] as const;

interface QuadAccumulator {
  positions: number[];
  indices: number[];
  vertexCount: number;
}

function pushQuad(
  acc: QuadAccumulator,
  va: { x: number; z: number },
  vb: { x: number; z: number },
  contourY: number,
): void {
  const dx = vb.x - va.x;
  const dz = vb.z - va.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  const nx = (-dz / len) * QUAD_HALF_WIDTH;
  const nz = (dx / len) * QUAD_HALF_WIDTH;

  const base = acc.vertexCount;
  acc.positions.push(
    va.x - nx, contourY, va.z - nz,
    va.x + nx, contourY, va.z + nz,
    vb.x + nx, contourY, vb.z + nz,
    vb.x - nx, contourY, vb.z - nz,
  );
  acc.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  acc.vertexCount += 4;
}

export function renderTopoLines(
  allHexes: CubeCoord[],
  elevationMap: Map<string, number>,
  visibleHexes?: Set<string>,
  exploredHexes?: Set<string>,
): void {
  const ctx = getThreeContext();
  if (!ctx) return;
  ensureTopoMaterials();

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

  const major: QuadAccumulator = { positions: [], indices: [], vertexCount: 0 };
  const minor: QuadAccumulator = { positions: [], indices: [], vertexCount: 0 };
  const visited = new Set<string>();

  for (const hex of allHexes) {
    const key = hexToKey(hex);
    const elev = elevationMap.get(key) ?? 0;

    for (let d = 0; d < 6; d++) {
      const neighbor = hexAdd(hex, CUBE_DIRECTIONS[d]!);
      const neighborKey = hexToKey(neighbor);
      const neighborElev = elevationMap.get(neighborKey) ?? 0;

      if (!elevationMap.has(neighborKey) && elev === 0) continue;

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

      const firstLevel = Math.ceil((lo + 0.001) / MINOR_INTERVAL) * MINOR_INTERVAL;

      for (let level = firstLevel; level <= hi; level += MINOR_INTERVAL) {
        if (level < MINOR_INTERVAL) continue;
        if (lo >= level) continue;

        const contourY = level * WORLD_ELEV_STEP + 0.012;
        const edge = DIR_TO_EDGE[d]!;
        const verts = hexWorldVertices(hex, 0);
        const va = verts[edge]!;
        const vb = verts[(edge + 1) % 6]!;

        const isMajor = level % MAJOR_INTERVAL === 0;
        pushQuad(isMajor ? major : minor, va, vb, contourY);
      }
    }
  }

  if (minor.positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(minor.positions, 3));
    geo.setIndex(minor.indices);
    const mesh = new THREE.Mesh(geo, minorMaterial);
    mesh.renderOrder = 4;
    topoGroup.add(mesh);
  }

  if (major.positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(major.positions, 3));
    geo.setIndex(major.indices);
    const mesh = new THREE.Mesh(geo, majorMaterial);
    mesh.renderOrder = 4;
    topoGroup.add(mesh);
  }

  ctx.scene.add(topoGroup);
}

export function clearTopoLines(): void {
  if (!topoGroup) return;
  const ctx = getThreeContext();
  if (ctx) ctx.scene.remove(topoGroup);
  topoGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
    }
  });
  topoGroup = null;
}
