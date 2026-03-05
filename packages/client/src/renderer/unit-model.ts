import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { Unit, PlayerId, GameState } from '@hexwar/engine';
import { hexToKey, hexToWorld, UNIT_STATS, WORLD_HEX_SIZE } from '@hexwar/engine';
import {
  MODEL_MANIFEST,
  PLAYER_FACTION,
  type Faction,
} from './constants';
import { getModelFromCache } from './model-loader';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnimClip = 'idle' | 'move' | 'attack' | 'hit' | 'death';

interface UnitModel3D {
  unitId: string;
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  currentClip: AnimClip | null;
  hpLabel: CSS2DObject;
  hpBar: HTMLDivElement;
  hpFill: HTMLDivElement;
  directiveLabel: CSS2DObject;
  directiveEl: HTMLDivElement;
}

const unitModels = new Map<string, UnitModel3D>();

// ---------------------------------------------------------------------------
// Directive symbols
// ---------------------------------------------------------------------------

const DIRECTIVE_ICONS: Record<string, string> = {
  'advance': '\u25B2',
  'hold': '\u25A0',
  'flank-left': '\u25C4',
  'flank-right': '\u25BA',
  'scout': '\u25CF',
  'support': '\u25C6',
  'hunt': '\u2666',
  'capture': '\u2691',
};

// ---------------------------------------------------------------------------
// Auto-scale: fit model bounding box to target world-unit size
// ---------------------------------------------------------------------------

const UNIT_SCALE: Record<string, number> = {
  infantry:  1.20,
  tank:      1.80,
  artillery: 1.50,
  recon:     1.30,
};

// ---------------------------------------------------------------------------
// Create / remove unit model
// ---------------------------------------------------------------------------

function createUnitModel(
  unit: Unit,
  faction: Faction,
  elevationMap: Map<string, number>,
): UnitModel3D | null {
  const ctx = getThreeContext();
  if (!ctx) return null;

  const manifest = MODEL_MANIFEST[faction][unit.type];
  const gltf = getModelFromCache(manifest.glbPath);
  if (!gltf) return null;

  const clone = SkeletonUtils.clone(gltf.scene);

  // Scale to fit hex
  const origBox = new THREE.Box3().setFromObject(gltf.scene);
  const origSize = new THREE.Vector3();
  origBox.getSize(origSize);
  const maxDim = Math.max(origSize.x, origSize.y, origSize.z);
  const typeMul = UNIT_SCALE[unit.type] ?? 0.6;
  if (maxDim > 0) {
    clone.scale.setScalar((WORLD_HEX_SIZE * typeMul) / maxDim);
  }

  // Face units inward: P1 deploys bottom, faces up; P2 deploys top, faces down
  clone.rotation.y = unit.owner === 'player1' ? Math.PI : 0;

  // Position using engine world coordinates
  const elev = elevationMap.get(hexToKey(unit.position)) ?? 0;
  const world = hexToWorld(unit.position, elev);
  clone.position.set(world.x, world.y, world.z);

  // Animation mixer + clips
  const mixer = new THREE.AnimationMixer(clone);
  const clips = new Map<string, THREE.AnimationClip>();
  for (const clip of gltf.animations) {
    clips.set(clip.name, clip);
  }

  // --- HP bar (CSS2D) ---
  const modelHeight = origSize.y;

  const hpWrapper = document.createElement('div');
  hpWrapper.style.cssText = 'pointer-events:none; width:28px; height:4px; background:#333; border-radius:1px; overflow:hidden;';

  const hpFill = document.createElement('div');
  const maxHp = UNIT_STATS[unit.type].maxHp;
  const ratio = unit.hp / maxHp;
  hpFill.style.cssText = `width:${ratio * 100}%; height:100%; background:${hpColor(ratio)}; transition:width 0.2s;`;
  hpWrapper.appendChild(hpFill);

  const hpLabel = new CSS2DObject(hpWrapper);
  hpLabel.position.set(0, modelHeight * 1.1, 0);
  clone.add(hpLabel);

  const directiveEl = document.createElement('div');
  const directiveLabel = new CSS2DObject(directiveEl);

  ctx.scene.add(clone);

  const model: UnitModel3D = {
    unitId: unit.id,
    object: clone,
    mixer,
    clips,
    currentClip: null,
    hpLabel,
    hpBar: hpWrapper,
    hpFill,
    directiveLabel,
    directiveEl,
  };

  playAnimation(model, 'idle');

  unitModels.set(unit.id, model);
  return model;
}

function removeUnitModel(unitId: string): void {
  const model = unitModels.get(unitId);
  if (!model) return;
  const ctx = getThreeContext();
  if (ctx) {
    ctx.scene.remove(model.object);
  }
  model.mixer.stopAllAction();
  model.hpLabel.removeFromParent();
  model.directiveLabel.removeFromParent();
  unitModels.delete(unitId);
}

// ---------------------------------------------------------------------------
// HP bar color helper
// ---------------------------------------------------------------------------

function hpColor(ratio: number): string {
  if (ratio > 0.6) return '#6a8a48';
  if (ratio > 0.3) return '#a08a40';
  return '#9a4a3a';
}

// ---------------------------------------------------------------------------
// Animation playback
// ---------------------------------------------------------------------------

function playAnimation(model: UnitModel3D, clipName: AnimClip): void {
  const clip = model.clips.get(clipName);
  if (!clip) return;
  if (model.currentClip === clipName) return;

  model.mixer.stopAllAction();
  const action = model.mixer.clipAction(clip);
  action.reset();

  if (clipName === 'idle') {
    action.setLoop(THREE.LoopRepeat, Infinity);
  } else {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
  }

  action.play();
  model.currentClip = clipName;

  if (clipName !== 'idle' && clipName !== 'death') {
    const onFinished = (): void => {
      model.mixer.removeEventListener('finished', onFinished);
      playAnimation(model, 'idle');
    };
    model.mixer.addEventListener('finished', onFinished);
  }
}

/** Trigger an animation on a unit by ID. */
export function playUnitAnimation(unitId: string, clipName: AnimClip): void {
  const model = unitModels.get(unitId);
  if (!model) return;
  playAnimation(model, clipName);
}

// ---------------------------------------------------------------------------
// Sync all unit models to game state
// ---------------------------------------------------------------------------

export function syncUnitModels(
  state: GameState,
  currentPlayerView: PlayerId,
  visibleHexes: Set<string>,
): void {
  const elevationMap = state.map.elevation;
  const isBuildPhase = state.phase === 'build';

  const activeUnitIds = new Set<string>();

  for (const pid of ['player1', 'player2'] as PlayerId[]) {
    const units = state.players[pid].units;
    for (const unit of units) {
      const key = hexToKey(unit.position);
      const isOwn = pid === currentPlayerView;
      const isVisible = isBuildPhase ? isOwn : (isOwn || visibleHexes.has(key));

      if (!isVisible) continue;

      activeUnitIds.add(unit.id);
      const existing = unitModels.get(unit.id);

      if (existing) {
        // Update position using engine world coordinates
        const elev = elevationMap.get(key) ?? 0;
        const world = hexToWorld(unit.position, elev);
        existing.object.position.set(world.x, world.y, world.z);

        // Update HP bar
        const maxHp = UNIT_STATS[unit.type].maxHp;
        const ratio = unit.hp / maxHp;
        existing.hpFill.style.width = `${ratio * 100}%`;
        existing.hpFill.style.background = hpColor(ratio);

        // Update directive icon
        existing.directiveEl.textContent = DIRECTIVE_ICONS[unit.directive] ?? '';
      } else {
        const faction = PLAYER_FACTION[unit.owner];
        createUnitModel(unit, faction, elevationMap);
      }
    }
  }

  for (const [unitId] of unitModels) {
    if (!activeUnitIds.has(unitId)) {
      removeUnitModel(unitId);
    }
  }
}

// ---------------------------------------------------------------------------
// Advance all animation mixers
// ---------------------------------------------------------------------------

export function advanceAnimations(deltaSec: number): void {
  for (const [, model] of unitModels) {
    model.mixer.update(deltaSec);
  }
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

export function clearAllUnitModels(): void {
  for (const [unitId] of unitModels) {
    removeUnitModel(unitId);
  }
}
