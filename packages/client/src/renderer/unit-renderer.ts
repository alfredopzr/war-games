import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { GameState, PlayerId, UnitType, CubeCoord } from '@hexwar/engine';
import { hexToKey, hexToWorld } from '@hexwar/engine';
import { getThreeContext } from './three-scene';
import { UNIT_LABELS } from './constants';

// ---------------------------------------------------------------------------
// Ghost markers — last-known enemy positions as Three.js objects
// Live units are 3D models handled by unit-model.ts.
// ---------------------------------------------------------------------------

let ghostGroup: THREE.Group | null = null;

/** Render ghost markers. Live units handled by Three.js unit-model.ts. */
export function renderUnits(
  state: GameState,
  _currentPlayerView: PlayerId,
  visibleHexes: Set<string>,
  lastKnownEnemies: Map<string, { type: UnitType; position: CubeCoord }>,
): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  // Remove previous ghosts
  if (ghostGroup) {
    ctx.scene.remove(ghostGroup);
    ghostGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }

  ghostGroup = new THREE.Group();
  ghostGroup.name = 'ghostGroup';

  if (state.phase === 'build') {
    ctx.scene.add(ghostGroup);
    return;
  }

  const elevationMap = state.map.elevation;

  for (const [, ghost] of lastKnownEnemies) {
    const ghostKey = hexToKey(ghost.position);
    if (visibleHexes.has(ghostKey)) continue;

    const elev = elevationMap.get(ghostKey) ?? 0;
    const world = hexToWorld(ghost.position, elev);

    // Grey translucent circle
    const circleGeo = new THREE.CircleGeometry(0.35, 16);
    circleGeo.rotateX(-Math.PI / 2);
    const circleMesh = new THREE.Mesh(
      circleGeo,
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    circleMesh.position.set(world.x, world.y + 0.02, world.z);
    ghostGroup.add(circleMesh);

    // Unit type label
    const label = UNIT_LABELS[ghost.type] ?? '?';
    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-family:monospace; font-size:12px; font-weight:bold; color:#aaa; opacity:0.5; pointer-events:none;';
    const cssLabel = new CSS2DObject(labelEl);
    cssLabel.position.set(world.x, world.y + 0.05, world.z);
    ghostGroup.add(cssLabel);
  }

  ctx.scene.add(ghostGroup);
}
