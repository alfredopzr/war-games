import * as THREE from 'three';
import type { GameState, PlayerId } from '@hexwar/engine';
import { getAllHexes, hexToKey, hexToWorld, hexWorldVertices } from '@hexwar/engine';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Deploy zone renderer — Three.js overlays
// ---------------------------------------------------------------------------

let deployGroup: THREE.Group | null = null;

export function renderDeployZones(state: GameState, currentPlayerView: PlayerId): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  if (deployGroup) {
    ctx.scene.remove(deployGroup);
    deployGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineLoop) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }

  deployGroup = new THREE.Group();
  deployGroup.name = 'deployGroup';
  deployGroup.renderOrder = 1;

  if (state.phase !== 'build') {
    ctx.scene.add(deployGroup);
    return;
  }

  const friendlyZone = currentPlayerView === 'player1'
    ? state.map.player1Deployment
    : state.map.player2Deployment;
  const enemyZone = currentPlayerView === 'player1'
    ? state.map.player2Deployment
    : state.map.player1Deployment;

  const friendlyKeys = new Set<string>();
  for (const h of friendlyZone) friendlyKeys.add(hexToKey(h));

  const enemyKeys = new Set<string>();
  for (const h of enemyZone) enemyKeys.add(hexToKey(h));

  const allHexes = getAllHexes(state.map.gridSize);

  for (const hex of allHexes) {
    const hexKey = hexToKey(hex);
    let fillColor: number | null = null;
    let fillAlpha = 0;
    let strokeColor = 0;
    let strokeAlpha = 0;

    if (friendlyKeys.has(hexKey)) {
      fillColor = currentPlayerView === 'player1' ? 0x4a5a3a : 0x6a3a2a;
      fillAlpha = 0.45;
      strokeColor = currentPlayerView === 'player1' ? 0x8a9a7a : 0xaa7a6a;
      strokeAlpha = 1;
    } else if (enemyKeys.has(hexKey)) {
      fillColor = currentPlayerView === 'player1' ? 0x5a2a1a : 0x2a3a1a;
      fillAlpha = 0.35;
      strokeColor = currentPlayerView === 'player1' ? 0x8a5a4a : 0x6a7a5a;
      strokeAlpha = 1;
    }

    if (fillColor === null) continue;

    const elev = state.map.elevation.get(hexKey) ?? 0;
    const center = hexToWorld(hex, elev);
    const verts = hexWorldVertices(hex, elev);

    // Fill
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
        color: fillColor,
        transparent: true,
        opacity: fillAlpha,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.y = center.y + 0.003;
    mesh.renderOrder = 1;
    deployGroup.add(mesh);

    // Outline
    const points = verts.map((v) => new THREE.Vector3(v.x, v.y + 0.004, v.z));
    points.push(points[0]!.clone());
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: strokeColor,
      transparent: true,
      opacity: strokeAlpha,
    });
    const line = new THREE.LineLoop(lineGeo, lineMat);
    line.renderOrder = 1;
    deployGroup.add(line);
  }

  ctx.scene.add(deployGroup);
}
