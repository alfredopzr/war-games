import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { getThreeContext, markLabelsDirty } from './three-scene';
import { getPalette } from './palette';

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
  const pal = getPalette();
  const el = document.createElement('div');
  el.textContent = damage > 0 ? `-${damage}` : 'CAPTURED';
  el.style.cssText = `font-family:monospace; font-size:16px; font-weight:bold; color:${pal.effect.damageText}; pointer-events:none;`;

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
  fromX: number, fromY: number, fromZ: number,
  toX: number, toY: number, toZ: number,
  color: number = 0xffff88,
): void {
  const points = [
    new THREE.Vector3(fromX, fromY + 0.3, fromZ),
    new THREE.Vector3(toX, toY + 0.3, toZ),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
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
  const pal = getPalette();
  const size = 0.3;
  const group = new THREE.Group();
  group.position.set(x, y + 0.3, z);

  const materials: THREE.LineBasicMaterial[] = [];

  for (const [dx1, dz1, dx2, dz2] of [[-size, -size, size, size], [size, -size, -size, size]]) {
    const points = [
      new THREE.Vector3(dx1, 0, dz1),
      new THREE.Vector3(dx2, 0, dz2),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: pal.effect.death,
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

/** Spawn a floating green heal number at a world position. */
export function spawnHealNumber(x: number, y: number, z: number, amount: number): void {
  const pal = getPalette();
  const el = document.createElement('div');
  el.textContent = `+${amount} HP`;
  el.style.cssText = `font-family:monospace; font-size:16px; font-weight:bold; color:${pal.effect.healText}; pointer-events:none;`;

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

/** Spawn a "REVEALED" text at a world position. */
export function spawnRevealedText(x: number, y: number, z: number): void {
  const pal = getPalette();
  const el = document.createElement('div');
  el.textContent = 'REVEALED';
  el.style.cssText = `font-family:monospace; font-size:16px; font-weight:bold; color:${pal.effect.revealedText}; pointer-events:none;`;

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

/** Spawn an expanding reveal ring at a world position. */
export function spawnRevealRing(x: number, y: number, z: number): void {
  const pal = getPalette();
  const segments = 24;
  const radius = 2.0;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(
      x + Math.cos(angle) * radius,
      y + 0.3,
      z + Math.sin(angle) * radius,
    ));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: pal.effect.revealRing,
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
    lifetime: 0.6,
  });
}

/** Called every frame — update/remove active effects. deltaSec is in seconds. */
export function updateEffects(deltaSec: number): void {
  const group = effectsGroup;
  if (!group) return;

  let hasCss2d = false;
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const effect = activeEffects[i]!;

    switch (effect.kind) {
      case 'damage-number': {
        hasCss2d = true;
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
  if (hasCss2d) markLabelsDirty();
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
