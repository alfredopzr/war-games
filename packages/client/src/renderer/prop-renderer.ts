import * as THREE from 'three';
import type { GameState, TerrainType } from '@hexwar/engine';
import { hexToWorld, createHex, mulberry32, WORLD_HEX_SIZE } from '@hexwar/engine';
import { getThreeContext } from './three-scene';
import { loadModel, getModelFromCache } from './model-loader';
import { PROP_MANIFEST, ALL_PROP_PATHS, isTreeProp, type PropDefinition } from './prop-manifest';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let propGroup: THREE.Group | null = null;
const failedPaths = new Set<string>();

// ---------------------------------------------------------------------------
// Preloading
// ---------------------------------------------------------------------------

export function preloadAllProps(): Promise<void> {
  const promises = ALL_PROP_PATHS.map((path) =>
    loadModel(path).catch(() => {
      failedPaths.add(path);
    }),
  );
  return Promise.all(promises).then(() => {});
}

// ---------------------------------------------------------------------------
// Per-hex deterministic placement
// ---------------------------------------------------------------------------

interface PlacedProp {
  readonly glbPath: string;
  readonly scale: number;
  readonly yRotation: number;
  readonly offsetX: number;
  readonly offsetZ: number;
}

function hashHexKey(q: number, r: number): number {
  return ((q * 73856093) ^ (r * 19349663)) >>> 0;
}

function computePropsForHex(
  terrain: TerrainType,
  rng: () => number,
): PlacedProp[] {
  const defs = PROP_MANIFEST[terrain];
  const placed: PlacedProp[] = [];
  let hasTree = false;

  for (const def of defs) {
    for (let i = 0; i < def.maxPerHex; i++) {
      const roll = rng();
      if (roll < def.probability) {
        const prop = rollPropPlacement(def, rng);
        placed.push(prop);
        if (isTreeProp(def.id)) hasTree = true;
      }
    }
  }

  // Forest: guarantee at least 1 tree
  if (terrain === 'forest' && !hasTree) {
    const treeDef = defs[0]!; // tree_a is first in FOREST_PROPS
    placed.push(rollPropPlacement(treeDef, rng));
  }

  return placed;
}

function rollPropPlacement(def: PropDefinition, rng: () => number): PlacedProp {
  const scale = def.scaleRange[0] + rng() * (def.scaleRange[1] - def.scaleRange[0]);
  const yRotation = rng() * Math.PI * 2;
  const offsetX = (rng() - 0.5) * WORLD_HEX_SIZE * 0.6;
  const offsetZ = (rng() - 0.5) * WORLD_HEX_SIZE * 0.6;
  return { glbPath: def.glbPath, scale, yRotation, offsetX, offsetZ };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderProps(state: GameState): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  clearProps();

  propGroup = new THREE.Group();
  propGroup.name = 'propGroup';

  const mapSeed = state.map.seed;

  for (const [key, terrain] of state.map.terrain) {
    const [qStr, rStr] = key.split(',');
    const q = Number(qStr);
    const r = Number(rStr);
    const hex = createHex(q, r);
    const elev = state.map.elevation.get(key) ?? 0;
    const world = hexToWorld(hex, elev);

    const hexSeed = (mapSeed ^ hashHexKey(q, r)) >>> 0;
    const rng = mulberry32(hexSeed);

    const props = computePropsForHex(terrain, rng);

    for (const prop of props) {
      if (failedPaths.has(prop.glbPath)) continue;

      const gltf = getModelFromCache(prop.glbPath);
      if (!gltf) continue;

      const clone = gltf.scene.clone();
      clone.scale.setScalar(prop.scale);
      clone.rotation.y = prop.yRotation;
      clone.position.set(
        world.x + prop.offsetX,
        world.y + 0.01,
        world.z + prop.offsetZ,
      );
      propGroup.add(clone);
    }
  }

  ctx.scene.add(propGroup);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function clearProps(): void {
  if (!propGroup) return;

  const ctx = getThreeContext();
  if (ctx) {
    ctx.scene.remove(propGroup);
  }

  propGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else if (obj.material instanceof THREE.Material) {
        obj.material.dispose();
      }
    }
  });

  propGroup = null;
}
