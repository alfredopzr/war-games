import * as THREE from 'three';
import type { CubeCoord } from '@hexwar/engine';
import { worldToHex, hexToKey, WORLD_ELEV_STEP } from '@hexwar/engine';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Click detection via raycaster against terrain mesh, fallback to ground plane
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersection = new THREE.Vector3();

let elevationMap: Map<string, number> | null = null;
let terrainMesh: THREE.Mesh | null = null;

/** Provide the elevation map so click detection can correct for camera tilt. */
export function setClickElevationMap(elev: Map<string, number>): void {
  elevationMap = elev;
}

/** Provide the terrain top-face mesh for direct raycasting. */
export function setClickTerrainMesh(mesh: THREE.Mesh): void {
  terrainMesh = mesh;
}

/**
 * Convert a screen-space click position to the nearest hex cube coordinate.
 * Raycasts against the terrain mesh first for accurate elevation hits,
 * falls back to iterative ground plane correction.
 */
export function screenToHex(
  screenX: number,
  screenY: number,
  canvasW: number,
  canvasH: number,
): CubeCoord | null {
  const ctx = getThreeContext();
  if (!ctx) return null;

  ndc.x = (screenX / canvasW) * 2 - 1;
  ndc.y = -(screenY / canvasH) * 2 + 1;

  raycaster.setFromCamera(ndc, ctx.camera);

  const sceneScaleZ = ctx.scene.scale.z;

  // Primary: raycast against actual terrain geometry
  if (terrainMesh) {
    const hits = raycaster.intersectObject(terrainMesh);
    if (hits.length > 0) {
      const p = hits[0]!.point;
      return worldToHex(p.x, p.z * sceneScaleZ);
    }
  }

  // Fallback: iterative ground plane correction
  let planeY = 0;
  for (let i = 0; i < 3; i++) {
    groundPlane.constant = -planeY;
    const hit = raycaster.ray.intersectPlane(groundPlane, intersection);
    if (!hit) return null;

    const worldZ = intersection.z * sceneScaleZ;
    const hex = worldToHex(intersection.x, worldZ);

    if (!elevationMap) return hex;

    const elev = elevationMap.get(hexToKey(hex)) ?? 0;
    const hexY = elev * WORLD_ELEV_STEP;

    if (Math.abs(hexY - planeY) < 0.01) return hex;

    planeY = hexY;
  }

  groundPlane.constant = -planeY;
  const hit = raycaster.ray.intersectPlane(groundPlane, intersection);
  if (!hit) return null;
  return worldToHex(intersection.x, intersection.z * sceneScaleZ);
}
