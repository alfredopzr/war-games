import * as THREE from 'three';
import type { CubeCoord } from '@hexwar/engine';
import { hexToKey, hexToWorld, hexWorldVertices } from '@hexwar/engine';
import { getThreeContext } from './three-scene';
import { FOG_NEVER_SEEN } from './constants';

// ---------------------------------------------------------------------------
// Fog of war renderer — Three.js translucent overlays
// ---------------------------------------------------------------------------

let fogGroup: THREE.Group | null = null;

export function renderFog(
  allHexes: CubeCoord[],
  visibleHexes: Set<string>,
  elevationMap: Map<string, number>,
  exploredHexes?: Set<string>,
): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  if (fogGroup) {
    ctx.scene.remove(fogGroup);
    fogGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }

  fogGroup = new THREE.Group();
  fogGroup.name = 'fogGroup';
  fogGroup.renderOrder = 3;

  for (const hex of allHexes) {
    const key = hexToKey(hex);
    if (visibleHexes.has(key)) continue;

    const elev = elevationMap.get(key) ?? 0;
    const center = hexToWorld(hex, elev);
    const alpha = exploredHexes && exploredHexes.has(key) ? 0.5 : 0.85;

    const verts = hexWorldVertices(hex, elev);
    const shape = new THREE.Shape();
    shape.moveTo(verts[0]!.x, verts[0]!.z);
    for (let i = 1; i < 6; i++) {
      shape.lineTo(verts[i]!.x, verts[i]!.z);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);

    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: FOG_NEVER_SEEN,
        transparent: true,
        opacity: alpha,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.y = center.y + 0.01;
    mesh.renderOrder = 3;
    fogGroup.add(mesh);
  }

  ctx.scene.add(fogGroup);
}
