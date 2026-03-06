import * as THREE from 'three';
import type { CubeCoord } from '@hexwar/engine';
import { hexToKey, hexWorldVertices } from '@hexwar/engine';
import { getThreeContext } from './three-scene';
import { FOG_NEVER_SEEN } from './constants';

// ---------------------------------------------------------------------------
// Fog of war renderer — single batched translucent overlay
//
// All non-visible hexes are merged into 1 draw call.
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

export function renderFog(
  allHexes: CubeCoord[],
  visibleHexes: Set<string>,
  elevationMap: Map<string, number>,
): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  if (fogGroup) {
    ctx.scene.remove(fogGroup);
    fogGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
  }

  fogGroup = new THREE.Group();
  fogGroup.name = 'fogGroup';
  fogGroup.renderOrder = 3;

  const foggedHexes: CubeCoord[] = [];
  for (const hex of allHexes) {
    if (!visibleHexes.has(hexToKey(hex))) {
      foggedHexes.push(hex);
    }
  }

  buildFogBatch(foggedHexes, elevationMap);

  ctx.scene.add(fogGroup);
}

function buildFogBatch(
  hexes: CubeCoord[],
  elevationMap: Map<string, number>,
): void {
  if (hexes.length === 0) return;

  // Count elevated hexes for side geometry sizing
  let elevatedCount = 0;
  for (const hex of hexes) {
    if ((elevationMap.get(hexToKey(hex)) ?? 0) !== 0) elevatedCount++;
  }

  // Top faces: 4 triangles per hex = 12 vertices
  const topPositions = new Float32Array(hexes.length * 12 * 3);
  // Side faces: 6 quads per elevated hex = 12 triangles = 36 vertices
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

    // Side walls for non-zero elevation hexes
    if (elev !== 0 && sidePositions) {
      const botVerts = hexWorldVertices(hex, 0);
      const baseSide = si * 108; // 36 verts × 3 floats

      for (let e = 0; e < 6; e++) {
        const ta = verts[e]!;
        const tb = verts[(e + 1) % 6]!;
        const ba = botVerts[e]!;
        const bb = botVerts[(e + 1) % 6]!;

        const off = baseSide + e * 18;
        // Triangle 1: ta, tb, bb
        sidePositions[off     ] = ta.x; sidePositions[off +  1] = ta.y; sidePositions[off +  2] = ta.z;
        sidePositions[off +  3] = tb.x; sidePositions[off +  4] = tb.y; sidePositions[off +  5] = tb.z;
        sidePositions[off +  6] = bb.x; sidePositions[off +  7] = bb.y; sidePositions[off +  8] = bb.z;
        // Triangle 2: ta, bb, ba
        sidePositions[off +  9] = ta.x; sidePositions[off + 10] = ta.y; sidePositions[off + 11] = ta.z;
        sidePositions[off + 12] = bb.x; sidePositions[off + 13] = bb.y; sidePositions[off + 14] = bb.z;
        sidePositions[off + 15] = ba.x; sidePositions[off + 16] = ba.y; sidePositions[off + 17] = ba.z;
      }
      si++;
    }
  }

  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.BufferAttribute(topPositions, 3));
  const topMesh = new THREE.Mesh(topGeo, fogTopMaterial);
  topMesh.renderOrder = 3;
  fogGroup!.add(topMesh);

  if (sidePositions && elevatedCount > 0) {
    const sideGeo = new THREE.BufferGeometry();
    sideGeo.setAttribute('position', new THREE.BufferAttribute(sidePositions, 3));
    const sideMesh = new THREE.Mesh(sideGeo, fogSideMaterial);
    sideMesh.renderOrder = 3;
    fogGroup!.add(sideMesh);
  }
}

export function clearFog(): void {
  if (!fogGroup) return;
  const ctx = getThreeContext();
  if (ctx) ctx.scene.remove(fogGroup);
  fogGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
    }
  });
  fogGroup = null;
}
