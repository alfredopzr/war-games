import * as THREE from 'three';
import type { Command, GameState } from '@hexwar/engine';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Command visuals
// ---------------------------------------------------------------------------
// With the redirect-only command model, pending commands are directive changes
// rather than spatial commands. No path/attack visuals to render — just clear
// any stale group. This renderer is kept as a stub for future visual feedback
// (e.g. showing which units have been redirected this turn).
// ---------------------------------------------------------------------------

let commandGroup: THREE.Group | null = null;
let cachedCommandsRef: Command[] | null = null;

export function renderCommandVisuals(
  pendingCommands: Command[],
  _state: GameState,
): void {
  if (pendingCommands === cachedCommandsRef) return;
  cachedCommandsRef = pendingCommands;

  const ctx = getThreeContext();
  if (!ctx) return;

  if (commandGroup) {
    ctx.scene.remove(commandGroup);
    commandGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }

  commandGroup = new THREE.Group();
  commandGroup.name = 'commandGroup';
  ctx.scene.add(commandGroup);
}

export function clearCommandVisuals(): void {
  cachedCommandsRef = null;
  const ctx = getThreeContext();
  if (!ctx || !commandGroup) return;
  ctx.scene.remove(commandGroup);
  commandGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
      obj.geometry.dispose();
      if (obj.material instanceof THREE.Material) {
        obj.material.dispose();
      }
    }
  });
  commandGroup = null;
}
