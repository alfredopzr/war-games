import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { getThreeContext } from './three-scene';

// ---------------------------------------------------------------------------
// Effects renderer — CSS2D damage numbers, Three.js lines
// ---------------------------------------------------------------------------

interface DamageNumberEffect {
  kind: 'damage-number';
  object: CSS2DObject;
  element: HTMLDivElement;
  speed: number;
  fadeRate: number;
}

interface AttackTracerEffect {
  kind: 'attack-tracer';
  object: THREE.Line;
  age: number;
  lifetime: number;
}

interface DeathMarkerEffect {
  kind: 'death-marker';
  group: THREE.Group;
  fadeRate: number;
  materials: THREE.LineBasicMaterial[];
}

type ActiveEffect = DamageNumberEffect | AttackTracerEffect | DeathMarkerEffect;

const activeEffects: ActiveEffect[] = [];
let effectsGroup: THREE.Group | null = null;

function getEffectsGroup(): THREE.Group {
  if (!effectsGroup) {
    effectsGroup = new THREE.Group();
    effectsGroup.name = 'effectsGroup';
    effectsGroup.renderOrder = 4;
    const ctx = getThreeContext();
    if (ctx) ctx.scene.add(effectsGroup);
  }
  return effectsGroup;
}

/** Spawn a floating damage number that rises and fades. */
export function spawnDamageNumber(x: number, y: number, z: number, damage: number): void {
  const el = document.createElement('div');
  el.textContent = damage > 0 ? `-${damage}` : 'CAPTURED';
  el.style.cssText =
    'font-family:monospace; font-size:16px; font-weight:bold; color:#9a4a3a; pointer-events:none;';

  const cssObj = new CSS2DObject(el);
  cssObj.position.set(x, y + 0.5, z);
  getEffectsGroup().add(cssObj);

  activeEffects.push({
    kind: 'damage-number',
    object: cssObj,
    element: el,
    speed: 0.8,
    fadeRate: 1.5,
  });
}

/** Spawn an attack tracer line between two world positions. */
export function spawnAttackTracer(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
): void {
  const points = [
    new THREE.Vector3(fromX, fromY + 0.3, fromZ),
    new THREE.Vector3(toX, toY + 0.3, toZ),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xffff88,
    transparent: true,
    opacity: 1,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 4;
  getEffectsGroup().add(line);

  activeEffects.push({
    kind: 'attack-tracer',
    object: line,
    age: 0,
    lifetime: 0.4,
  });
}

/** Spawn a death marker (X shape) at a world position. */
export function spawnDeathMarker(x: number, y: number, z: number): void {
  const size = 0.3;
  const group = new THREE.Group();
  group.position.set(x, y + 0.3, z);

  const materials: THREE.LineBasicMaterial[] = [];

  for (const [dx1, dz1, dx2, dz2] of [
    [-size, -size, size, size],
    [size, -size, -size, size],
  ]) {
    const points = [new THREE.Vector3(dx1, 0, dz1), new THREE.Vector3(dx2, 0, dz2)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 1,
    });
    materials.push(mat);
    const line = new THREE.Line(geo, mat);
    group.add(line);
  }

  group.renderOrder = 4;
  getEffectsGroup().add(group);

  activeEffects.push({
    kind: 'death-marker',
    group,
    fadeRate: 0.33,
    materials,
  });
}

/** Called every frame — update/remove active effects. deltaSec is in seconds. */
export function updateEffects(deltaSec: number): void {
  const group = effectsGroup;
  if (!group) return;

  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const effect = activeEffects[i]!;

    switch (effect.kind) {
      case 'damage-number': {
        effect.object.position.y += effect.speed * deltaSec;
        const currentOpacity = parseFloat(effect.element.style.opacity || '1');
        const newOpacity = currentOpacity - effect.fadeRate * deltaSec;
        effect.element.style.opacity = String(Math.max(0, newOpacity));
        if (newOpacity <= 0) {
          group.remove(effect.object);
          activeEffects.splice(i, 1);
        }
        break;
      }
      case 'attack-tracer': {
        effect.age += deltaSec;
        const mat = effect.object.material as THREE.LineBasicMaterial;
        mat.opacity = 1 - effect.age / effect.lifetime;
        if (effect.age >= effect.lifetime) {
          group.remove(effect.object);
          effect.object.geometry.dispose();
          mat.dispose();
          activeEffects.splice(i, 1);
        }
        break;
      }
      case 'death-marker': {
        const newOpacity = (effect.materials[0]?.opacity ?? 1) - effect.fadeRate * deltaSec;
        for (const mat of effect.materials) {
          mat.opacity = Math.max(0, newOpacity);
        }
        if (newOpacity <= 0) {
          group.remove(effect.group);
          effect.group.traverse((obj) => {
            if (obj instanceof THREE.Line) {
              obj.geometry.dispose();
            }
          });
          for (const mat of effect.materials) mat.dispose();
          activeEffects.splice(i, 1);
        }
        break;
      }
    }
  }
}

/** Clear all active effects immediately. */
export function clearEffects(): void {
  const group = effectsGroup;
  if (!group) return;

  for (const effect of activeEffects) {
    switch (effect.kind) {
      case 'damage-number':
        group.remove(effect.object);
        break;
      case 'attack-tracer':
        group.remove(effect.object);
        effect.object.geometry.dispose();
        (effect.object.material as THREE.Material).dispose();
        break;
      case 'death-marker':
        group.remove(effect.group);
        effect.group.traverse((obj) => {
          if (obj instanceof THREE.Line) obj.geometry.dispose();
        });
        for (const mat of effect.materials) mat.dispose();
        break;
    }
  }
  activeEffects.length = 0;
}
