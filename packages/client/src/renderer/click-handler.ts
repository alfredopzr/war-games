import * as THREE from 'three';
import type { CubeCoord } from '@hexwar/engine';
import { worldToHex } from '@hexwar/engine';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Click detection via raycaster → XZ ground plane → worldToHex
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // XZ plane at Y=0
const intersection = new THREE.Vector3();

/**
 * Convert a screen-space click position to the nearest hex cube coordinate.
 * Returns null if the ray doesn't hit the ground plane (shouldn't happen with ortho camera).
 */
export function screenToHex(
  screenX: number,
  screenY: number,
  canvasW: number,
  canvasH: number,
): CubeCoord | null {
  const ctx = getThreeContext();
  if (!ctx) return null;

  // Convert screen coords to NDC [-1, 1]
  ndc.x = (screenX / canvasW) * 2 - 1;
  ndc.y = -(screenY / canvasH) * 2 + 1;

  raycaster.setFromCamera(ndc, ctx.camera);
  const hit = raycaster.ray.intersectPlane(groundPlane, intersection);
  if (!hit) return null;

  // Scene may be flipped on Z for player perspective — account for that
  const sceneScaleZ = ctx.scene.scale.z;
  const worldZ = intersection.z * sceneScaleZ;

  return worldToHex(intersection.x, worldZ);
}
