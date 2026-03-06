import * as THREE from 'three';
import type { CubeCoord } from '@hexwar/engine';
import { worldToHex, hexToKey, WORLD_ELEV_STEP } from '@hexwar/engine';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Click detection via raycaster → elevation-corrected ground plane → worldToHex
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersection = new THREE.Vector3();
const rayDir = new THREE.Vector3();

let elevationMap: Map<string, number> | null = null;

/** Provide the elevation map so click detection can correct for camera tilt. */
export function setClickElevationMap(elev: Map<string, number>): void {
  elevationMap = elev;
}

/**
 * Convert a screen-space click position to the nearest hex cube coordinate.
 * Uses iterative elevation correction to account for camera tilt offset.
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

  // Get ray direction (constant for ortho camera)
  ctx.camera.getWorldDirection(rayDir);

  const sceneScaleZ = ctx.scene.scale.z;

  // Iterative correction: intersect at estimated Y, look up hex elevation, repeat
  let planeY = 0;
  for (let i = 0; i < 3; i++) {
    groundPlane.constant = -planeY; // Plane: y = planeY → normal·p + d = 0 → d = -planeY
    const hit = raycaster.ray.intersectPlane(groundPlane, intersection);
    if (!hit) return null;

    const worldZ = intersection.z * sceneScaleZ;
    const hex = worldToHex(intersection.x, worldZ);

    if (!elevationMap) return hex;

    const elev = elevationMap.get(hexToKey(hex)) ?? 0;
    const hexY = elev * WORLD_ELEV_STEP;

    // Close enough — return this hex
    if (Math.abs(hexY - planeY) < 0.01) return hex;

    planeY = hexY;
  }

  // Final pass with converged planeY
  groundPlane.constant = -planeY;
  const hit = raycaster.ray.intersectPlane(groundPlane, intersection);
  if (!hit) return null;
  return worldToHex(intersection.x, intersection.z * sceneScaleZ);
}
