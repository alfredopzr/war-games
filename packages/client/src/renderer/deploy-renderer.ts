import * as THREE from 'three';
import type { GameState, PlayerId, CubeCoord } from '@hexwar/engine';
import { hexToKey, hexWorldVertices } from '@hexwar/engine';
import { cachedHexToWorld } from './render-cache';
import { getThreeContext } from './three-scene';
import { getPalette } from './palette';

// ---------------------------------------------------------------------------
// Deploy zone renderer — batched into 4 draw calls
// ---------------------------------------------------------------------------

function darkenColor(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.max(0, (color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

let deployGroup: THREE.Group | null = null;

function buildZoneFillGeometry(
  hexes: CubeCoord[],
  elevation: Map<string, number>,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (const hex of hexes) {
    const key = hexToKey(hex);
    const elev = elevation.get(key) ?? 0;
    const center = cachedHexToWorld(hex, elev);
    const verts = hexWorldVertices(hex, elev);
    const y = center.y + 0.003;
    const base = positions.length / 3;

    // Center vertex + 6 corner vertices
    positions.push(center.x, y, center.z);
    for (let i = 0; i < 6; i++) {
      positions.push(verts[i]!.x, y, verts[i]!.z);
    }

    // 6 triangles (fan from center)
    for (let i = 0; i < 6; i++) {
      indices.push(base, base + 1 + i, base + 1 + ((i + 1) % 6));
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function buildZoneStrokeGeometry(
  hexes: CubeCoord[],
  elevation: Map<string, number>,
): THREE.BufferGeometry {
  const positions: number[] = [];

  for (const hex of hexes) {
    const key = hexToKey(hex);
    const elev = elevation.get(key) ?? 0;
    const verts = hexWorldVertices(hex, elev);

    // 6 line segments forming the hex outline
    for (let i = 0; i < 6; i++) {
      const a = verts[i]!;
      const b = verts[(i + 1) % 6]!;
      positions.push(a.x, a.y + 0.004, a.z);
      positions.push(b.x, b.y + 0.004, b.z);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

export function renderDeployZones(state: GameState, currentPlayerView: PlayerId): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  if (deployGroup) {
    ctx.scene.remove(deployGroup);
    deployGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
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

  const pal = getPalette();
  const friendly = pal.player[currentPlayerView === 'player1' ? 'p1' : 'p2'];
  const enemy = pal.player[currentPlayerView === 'player1' ? 'p2' : 'p1'];

  // Friendly fill (1 draw call)
  const friendlyFillGeo = buildZoneFillGeometry(friendlyZone, state.map.elevation);
  const friendlyFill = new THREE.Mesh(friendlyFillGeo, new THREE.MeshBasicMaterial({
    color: darkenColor(friendly.primary, 0.7),
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  friendlyFill.renderOrder = 1;
  deployGroup.add(friendlyFill);

  // Enemy fill (1 draw call)
  const enemyFillGeo = buildZoneFillGeometry(enemyZone, state.map.elevation);
  const enemyFill = new THREE.Mesh(enemyFillGeo, new THREE.MeshBasicMaterial({
    color: darkenColor(enemy.primary, 0.7),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  enemyFill.renderOrder = 1;
  deployGroup.add(enemyFill);

  // Friendly stroke (1 draw call)
  const friendlyStrokeGeo = buildZoneStrokeGeometry(friendlyZone, state.map.elevation);
  const friendlyStroke = new THREE.LineSegments(friendlyStrokeGeo, new THREE.LineBasicMaterial({
    color: friendly.light,
  }));
  friendlyStroke.renderOrder = 1;
  deployGroup.add(friendlyStroke);

  // Enemy stroke (1 draw call)
  const enemyStrokeGeo = buildZoneStrokeGeometry(enemyZone, state.map.elevation);
  const enemyStroke = new THREE.LineSegments(enemyStrokeGeo, new THREE.LineBasicMaterial({
    color: darkenColor(enemy.primary, 0.8),
  }));
  enemyStroke.renderOrder = 1;
  deployGroup.add(enemyStroke);

  ctx.scene.add(deployGroup);
}
