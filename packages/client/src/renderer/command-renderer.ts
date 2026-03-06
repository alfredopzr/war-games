import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import type { Command, GameState } from '@hexwar/engine';
import { findPath, hexToKey } from '@hexwar/engine';
import { cachedHexToWorld } from './render-cache';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Command visuals — path lines for moves, crosshairs for attacks
// ---------------------------------------------------------------------------

let commandGroup: THREE.Group | null = null;
let cachedCommandsRef: Command[] | null = null;

export function renderCommandVisuals(
  pendingCommands: Command[],
  state: GameState,
): void {
  if (pendingCommands === cachedCommandsRef) return;
  cachedCommandsRef = pendingCommands;
  console.log('[command-renderer] rebuilding, commands:', pendingCommands.length);

  const ctx = getThreeContext();
  if (!ctx) return;

  if (commandGroup) {
    ctx.scene.remove(commandGroup);
    commandGroup.traverse((obj) => {
      if (obj instanceof THREE.Line || obj instanceof Line2) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }

  commandGroup = new THREE.Group();
  commandGroup.name = 'commandGroup';
  commandGroup.renderOrder = 2;

  const allUnits = [...state.players.player1.units, ...state.players.player2.units];
  const occupiedHexes = new Set(allUnits.map((u) => hexToKey(u.position)));

  for (const cmd of pendingCommands) {
    if (cmd.type === 'direct-move') {
      const unit = allUnits.find((u) => u.id === cmd.unitId);
      if (!unit) continue;

      const path = findPath(
        unit.position,
        cmd.targetHex,
        state.map.terrain,
        unit.type,
        occupiedHexes,
        unit.directive,
        state.map.modifiers,
        state.map.elevation,
      );
      if (!path || path.length < 2) continue;

      const positions: number[] = [];
      for (const hex of path) {
        const elev = state.map.elevation.get(hexToKey(hex)) ?? 0;
        const w = cachedHexToWorld(hex, elev);
        positions.push(w.x, w.y + 0.15, w.z);
      }

      const geo = new LineGeometry();
      geo.setPositions(positions);
      const mat = new LineMaterial({
        color: 0x00ccff,
        linewidth: 4,
        transparent: true,
        opacity: 0.9,
        resolution: new THREE.Vector2(
          ctx.renderer.domElement.clientWidth,
          ctx.renderer.domElement.clientHeight,
        ),
      });
      const line = new Line2(geo, mat);
      line.computeLineDistances();
      line.renderOrder = 2;
      commandGroup.add(line);
    }

    if (cmd.type === 'direct-attack') {
      const target = allUnits.find((u) => u.id === cmd.targetUnitId);
      if (!target) continue;

      const elev = state.map.elevation.get(hexToKey(target.position)) ?? 0;
      const w = cachedHexToWorld(target.position, elev);
      const y = w.y + 0.3;
      const s = 0.35;

      // Horizontal bar
      const hGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(w.x - s, y, w.z),
        new THREE.Vector3(w.x + s, y, w.z),
      ]);
      const hMat = new THREE.LineBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.9,
      });
      const hLine = new THREE.Line(hGeo, hMat);
      hLine.renderOrder = 2;
      commandGroup.add(hLine);

      // Vertical bar
      const vGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(w.x, y, w.z - s),
        new THREE.Vector3(w.x, y, w.z + s),
      ]);
      const vMat = new THREE.LineBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.9,
      });
      const vLine = new THREE.Line(vGeo, vMat);
      vLine.renderOrder = 2;
      commandGroup.add(vLine);
    }
  }

  ctx.scene.add(commandGroup);
}

export function clearCommandVisuals(): void {
  const ctx = getThreeContext();
  if (!ctx || !commandGroup) return;

  ctx.scene.remove(commandGroup);
  commandGroup.traverse((obj) => {
    if (obj instanceof THREE.Line || obj instanceof Line2) {
      obj.geometry.dispose();
      if (obj.material instanceof THREE.Material) {
        obj.material.dispose();
      }
    }
  });
  commandGroup = null;
  cachedCommandsRef = null;
}
