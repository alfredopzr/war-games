import * as THREE from 'three';
import type { CubeCoord } from '@hexwar/engine';
import { hexToKey, hexWorldVertices, hexAdd, CUBE_DIRECTIONS } from '@hexwar/engine';
import { getThreeContext } from './three-scene';
import { FOG_NEVER_SEEN } from './constants';

// ---------------------------------------------------------------------------
// Fog of war renderer
//
// Three visual states:
//   Unexplored — full opaque fog (top + side walls)
//   Explored   — semi-transparent dark wash (top only)
//   Visible    — no fog
//
// Plus a LoS border ring around the visible area boundary.
// ---------------------------------------------------------------------------

let fogGroup: THREE.Group | null = null;

const fogTopMaterial = new THREE.MeshBasicMaterial({
  color: FOG_NEVER_SEEN,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const fogSideMaterial = new THREE.MeshBasicMaterial({
  color: FOG_NEVER_SEEN,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});

const exploredWashMaterial = new THREE.MeshBasicMaterial({
  color: FOG_NEVER_SEEN,
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const losBorderMaterial = new THREE.LineBasicMaterial({
  color: 0xe8e4d8,
  depthTest: false,
  depthWrite: false,
});

/** Maps CUBE_DIRECTIONS index to hex vertex edge index. */
const DIR_TO_EDGE = [0, 5, 4, 3, 2, 1] as const;

export function renderFog(
  allHexes: CubeCoord[],
  visibleHexes: Set<string>,
  exploredHexes: Set<string>,
  elevationMap: Map<string, number>,
): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  if (fogGroup) {
    ctx.scene.remove(fogGroup);
    fogGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry.dispose();
      }
    });
  }

  fogGroup = new THREE.Group();
  fogGroup.name = 'fogGroup';
  fogGroup.renderOrder = 3;

  const unexploredHexes: CubeCoord[] = [];
  const exploredNotVisible: CubeCoord[] = [];
  for (const hex of allHexes) {
    const key = hexToKey(hex);
    if (visibleHexes.has(key)) continue;
    if (exploredHexes.has(key)) {
      exploredNotVisible.push(hex);
    } else {
      unexploredHexes.push(hex);
    }
  }

  // Full opaque fog on unexplored
  buildFogBatch(unexploredHexes, elevationMap, fogTopMaterial, fogSideMaterial);

  // Semi-transparent wash on explored (top only, no side walls)
  buildFogTopOnly(exploredNotVisible, elevationMap, exploredWashMaterial);

  // LoS border ring
  buildLosBorder(allHexes, visibleHexes, elevationMap);

  ctx.scene.add(fogGroup);
}

function buildFogBatch(
  hexes: CubeCoord[],
  elevationMap: Map<string, number>,
  topMat: THREE.MeshBasicMaterial,
  sideMat: THREE.MeshBasicMaterial,
): void {
  if (hexes.length === 0) return;

  let elevatedCount = 0;
  for (const hex of hexes) {
    if ((elevationMap.get(hexToKey(hex)) ?? 0) !== 0) elevatedCount++;
  }

  const topPositions = new Float32Array(hexes.length * 12 * 3);
  const sidePositions = elevatedCount > 0 ? new Float32Array(elevatedCount * 36 * 3) : null;
  let si = 0;

  for (let h = 0; h < hexes.length; h++) {
    const hex = hexes[h]!;
    const elev = elevationMap.get(hexToKey(hex)) ?? 0;
    const verts = hexWorldVertices(hex, elev);
    const fogY = verts[0]!.y + 0.01;
    const base = h * 36;

    for (let t = 0; t < 4; t++) {
      const off = base + t * 9;
      const v0 = verts[0]!;
      const v1 = verts[t + 1]!;
      const v2 = verts[t + 2]!;

      topPositions[off    ] = v0.x; topPositions[off + 1] = fogY; topPositions[off + 2] = v0.z;
      topPositions[off + 3] = v1.x; topPositions[off + 4] = fogY; topPositions[off + 5] = v1.z;
      topPositions[off + 6] = v2.x; topPositions[off + 7] = fogY; topPositions[off + 8] = v2.z;
    }

    if (elev !== 0 && sidePositions) {
      const botVerts = hexWorldVertices(hex, 0);
      const baseSide = si * 108;

      for (let e = 0; e < 6; e++) {
        const ta = verts[e]!;
        const tb = verts[(e + 1) % 6]!;
        const ba = botVerts[e]!;
        const bb = botVerts[(e + 1) % 6]!;

        const off = baseSide + e * 18;
        sidePositions[off     ] = ta.x; sidePositions[off +  1] = ta.y; sidePositions[off +  2] = ta.z;
        sidePositions[off +  3] = tb.x; sidePositions[off +  4] = tb.y; sidePositions[off +  5] = tb.z;
        sidePositions[off +  6] = bb.x; sidePositions[off +  7] = bb.y; sidePositions[off +  8] = bb.z;
        sidePositions[off +  9] = ta.x; sidePositions[off + 10] = ta.y; sidePositions[off + 11] = ta.z;
        sidePositions[off + 12] = bb.x; sidePositions[off + 13] = bb.y; sidePositions[off + 14] = bb.z;
        sidePositions[off + 15] = ba.x; sidePositions[off + 16] = ba.y; sidePositions[off + 17] = ba.z;
      }
      si++;
    }
  }

  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.BufferAttribute(topPositions, 3));
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.renderOrder = 3;
  fogGroup!.add(topMesh);

  if (sidePositions && elevatedCount > 0) {
    const sideGeo = new THREE.BufferGeometry();
    sideGeo.setAttribute('position', new THREE.BufferAttribute(sidePositions, 3));
    const sideMesh = new THREE.Mesh(sideGeo, sideMat);
    sideMesh.renderOrder = 3;
    fogGroup!.add(sideMesh);
  }
}

function buildFogTopOnly(
  hexes: CubeCoord[],
  elevationMap: Map<string, number>,
  mat: THREE.MeshBasicMaterial,
): void {
  if (hexes.length === 0) return;

  const topPositions = new Float32Array(hexes.length * 12 * 3);

  for (let h = 0; h < hexes.length; h++) {
    const hex = hexes[h]!;
    const elev = elevationMap.get(hexToKey(hex)) ?? 0;
    const verts = hexWorldVertices(hex, elev);
    const fogY = verts[0]!.y + 0.01;
    const base = h * 36;

    for (let t = 0; t < 4; t++) {
      const off = base + t * 9;
      const v0 = verts[0]!;
      const v1 = verts[t + 1]!;
      const v2 = verts[t + 2]!;

      topPositions[off    ] = v0.x; topPositions[off + 1] = fogY; topPositions[off + 2] = v0.z;
      topPositions[off + 3] = v1.x; topPositions[off + 4] = fogY; topPositions[off + 5] = v1.z;
      topPositions[off + 6] = v2.x; topPositions[off + 7] = fogY; topPositions[off + 8] = v2.z;
    }
  }

  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.BufferAttribute(topPositions, 3));
  const topMesh = new THREE.Mesh(topGeo, mat);
  topMesh.renderOrder = 3;
  fogGroup!.add(topMesh);
}

function buildLosBorder(
  allHexes: CubeCoord[],
  visibleHexes: Set<string>,
  elevationMap: Map<string, number>,
): void {
  const segments: number[] = [];

  for (const hex of allHexes) {
    const key = hexToKey(hex);
    if (!visibleHexes.has(key)) continue;

    const elev = elevationMap.get(key) ?? 0;

    for (let d = 0; d < 6; d++) {
      const neighbor = hexAdd(hex, CUBE_DIRECTIONS[d]!);
      const neighborKey = hexToKey(neighbor);

      // Border edge: visible hex adjacent to non-visible hex
      if (visibleHexes.has(neighborKey)) continue;

      const edge = DIR_TO_EDGE[d]!;
      const verts = hexWorldVertices(hex, elev);
      const va = verts[edge]!;
      const vb = verts[(edge + 1) % 6]!;
      const borderY = verts[0]!.y + 0.009;

      segments.push(va.x, borderY, va.z, vb.x, borderY, vb.z);
    }
  }

  if (segments.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
    const lines = new THREE.LineSegments(geo, losBorderMaterial);
    lines.renderOrder = 4;
    fogGroup!.add(lines);
  }
}

export function clearFog(): void {
  if (!fogGroup) return;
  const ctx = getThreeContext();
  if (ctx) ctx.scene.remove(fogGroup);
  fogGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      obj.geometry.dispose();
    }
  });
  fogGroup = null;
}
