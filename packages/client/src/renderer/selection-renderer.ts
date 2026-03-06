import * as THREE from 'three';
import type { CubeCoord, Unit, Command } from '@hexwar/engine';
import { hexToKey, hexWorldVertices } from '@hexwar/engine';
import { cachedHexToWorld } from './render-cache';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Selection highlights — Three.js outlines + fills
// ---------------------------------------------------------------------------

let selectionGroup: THREE.Group | null = null;

function createHexOutline(
  hex: CubeCoord,
  elevation: number,
  color: number,
  alpha: number,
  yOffset: number,
): THREE.LineLoop {
  const verts = hexWorldVertices(hex, elevation);
  const points = verts.map((v) => new THREE.Vector3(v.x, v.y + yOffset, v.z));
  points.push(points[0]!.clone());
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false });
  const line = new THREE.LineLoop(geometry, material);
  line.renderOrder = 2;
  return line;
}

function createHexFill(
  hex: CubeCoord,
  elevation: number,
  color: number,
  alpha: number,
  yOffset: number,
): THREE.Mesh {
  const verts = hexWorldVertices(hex, elevation);
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
      color,
      transparent: true,
      opacity: alpha,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.y = cachedHexToWorld(hex, elevation).y + yOffset;
  mesh.renderOrder = 2;
  return mesh;
}

export function renderSelectionHighlights(
  selectedUnit: Unit | null,
  hoveredHex: CubeCoord | null,
  highlightedHexes: Set<string>,
  highlightMode: 'move' | 'attack' | 'none',
  allHexes: CubeCoord[],
  elevationMap: Map<string, number>,
  commandMode: 'none' | 'move' | 'attack',
  pendingCommands: Command[],
): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  if (selectionGroup) {
    ctx.scene.remove(selectionGroup);
    selectionGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineLoop) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }

  selectionGroup = new THREE.Group();
  selectionGroup.name = 'selectionGroup';
  selectionGroup.renderOrder = 2;

  // Move/attack range
  if (highlightedHexes.size > 0 && highlightMode !== 'none') {
    const color = highlightMode === 'move' ? 0x00ccff : 0x9a4a3a;
    const fillAlpha = highlightMode === 'move' ? 0.08 : 0.1;

    for (const hex of allHexes) {
      const key = hexToKey(hex);
      if (!highlightedHexes.has(key)) continue;
      const elev = elevationMap.get(key) ?? 0;

      selectionGroup.add(createHexFill(hex, elev, color, fillAlpha, 0.005));
      selectionGroup.add(createHexOutline(hex, elev, color, 0.7, 0.006));
    }
  }

  // Pending move command destination highlights (electric blue)
  for (const cmd of pendingCommands) {
    if (cmd.type === 'direct-move') {
      const key = hexToKey(cmd.targetHex);
      const elev = elevationMap.get(key) ?? 0;
      selectionGroup.add(createHexFill(cmd.targetHex, elev, 0x00ccff, 0.15, 0.005));
      selectionGroup.add(createHexOutline(cmd.targetHex, elev, 0x00ccff, 0.9, 0.006));
    }
  }

  // Hovered hex: electric blue in move/attack mode, white otherwise
  if (hoveredHex) {
    const key = hexToKey(hoveredHex);
    const elev = elevationMap.get(key) ?? 0;
    const hoverColor = commandMode === 'move' ? 0x00ccff : commandMode === 'attack' ? 0x9a4a3a : 0xffffff;
    const hoverAlpha = commandMode !== 'none' ? 0.8 : 0.6;
    selectionGroup.add(createHexOutline(hoveredHex, elev, hoverColor, hoverAlpha, 0.007));
    if (commandMode === 'move') {
      selectionGroup.add(createHexFill(hoveredHex, elev, 0x00ccff, 0.1, 0.005));
    }
  }

  // Selected unit: beige outline
  if (selectedUnit) {
    const key = hexToKey(selectedUnit.position);
    const elev = elevationMap.get(key) ?? 0;
    selectionGroup.add(createHexOutline(selectedUnit.position, elev, 0xe8e4d8, 0.9, 0.008));
  }

  ctx.scene.add(selectionGroup);
}
