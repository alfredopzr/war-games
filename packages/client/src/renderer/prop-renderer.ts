import * as THREE from 'three';
import type { GameState, TerrainType, HexModifier, CubeCoord } from '@hexwar/engine';
import { createHex, hexToKey, hexNeighbors, mulberry32, WORLD_HEX_SIZE } from '@hexwar/engine';
import { cachedHexToWorld } from './render-cache';
import { getThreeContext } from './three-scene';
import { loadModel, getModelFromCache } from './model-loader';
import { PROP_MANIFEST, MODIFIER_PROPS, SURFACE_PROPS, ALL_PROP_PATHS, isTreeProp, type PropDefinition } from './prop-manifest';

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
  readonly yOffset: number;
}

function hashHexKey(q: number, r: number): number {
  return ((q * 73856093) ^ (r * 19349663)) >>> 0;
}

function computePropsForHex(
  terrain: TerrainType,
  rng: () => number,
  modifier?: HexModifier,
): PlacedProp[] {
  // If hex has a modifier, use modifier props instead of terrain props
  const modDefs = modifier ? MODIFIER_PROPS[modifier] : undefined;
  if (modDefs) {
    const placed: PlacedProp[] = [];
    for (const def of modDefs) {
      for (let i = 0; i < def.maxPerHex; i++) {
        if (rng() < def.probability) {
          placed.push(rollPropPlacement(def, rng, placed));
        }
      }
    }
    return placed;
  }

  const defs = PROP_MANIFEST[terrain];
  const placed: PlacedProp[] = [];
  let hasTree = false;

  for (const def of defs) {
    for (let i = 0; i < def.maxPerHex; i++) {
      const roll = rng();
      if (roll < def.probability) {
        const prop = rollPropPlacement(def, rng, placed);
        placed.push(prop);
        if (isTreeProp(def.id)) hasTree = true;
      }
    }
  }

  // Forest: guarantee at least 1 tree
  if (terrain === 'forest' && !hasTree) {
    const treeDef = defs[0]!; // tree_a is first in FOREST_PROPS
    placed.push(rollPropPlacement(treeDef, rng, placed));
  }

  return placed;
}

/** Hex-aware placement: polar coords clamped to inscribed radius, with rejection sampling for spacing. */
const MIN_SPACING_SQ = (WORLD_HEX_SIZE * 0.25) ** 2;

function rollPropPlacement(
  def: PropDefinition,
  rng: () => number,
  existing?: PlacedProp[],
): PlacedProp {
  const maxR = WORLD_HEX_SIZE * 0.42; // stay inside hex boundary
  const scale = def.scaleRange[0] + rng() * (def.scaleRange[1] - def.scaleRange[0]);
  const yRotation = rng() * Math.PI * 2;

  let offsetX = 0;
  let offsetZ = 0;

  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * maxR; // sqrt for uniform area distribution
    offsetX = Math.cos(angle) * dist;
    offsetZ = Math.sin(angle) * dist;

    if (!existing || existing.length === 0) break;

    let tooClose = false;
    for (const p of existing) {
      const dx = offsetX - p.offsetX;
      const dz = offsetZ - p.offsetZ;
      if (dx * dx + dz * dz < MIN_SPACING_SQ) { tooClose = true; break; }
    }
    if (!tooClose) break;
  }

  const yOffset = Math.abs(def.yMin) * scale;
  return { glbPath: def.glbPath, scale, yRotation, offsetX, offsetZ, yOffset };
}

// ---------------------------------------------------------------------------
// Surface prop direction
// ---------------------------------------------------------------------------

const COMPATIBLE_MODIFIERS: Record<string, readonly HexModifier[]> = {
  highway: ['highway', 'bridge'],
  bridge: ['highway', 'bridge'],
  river: ['river', 'lake'],
  lake: ['river', 'lake'],
};

function computeSurfaceAngle(
  hex: CubeCoord,
  modifier: HexModifier,
  modifiers: Map<string, HexModifier>,
): number {
  const compatible = COMPATIBLE_MODIFIERS[modifier] ?? [modifier];
  const neighbors = hexNeighbors(hex);
  const center = cachedHexToWorld(hex);

  let dx = 0;
  let dz = 0;
  let count = 0;

  for (const n of neighbors) {
    const nMod = modifiers.get(hexToKey(n));
    if (nMod && compatible.includes(nMod)) {
      const nWorld = cachedHexToWorld(n);
      dx += nWorld.x - center.x;
      dz += nWorld.z - center.z;
      count++;
    }
  }

  if (count === 0) return 0;
  return Math.atan2(dx, dz) + Math.PI / 2;
}

// ---------------------------------------------------------------------------
// Instancing helpers
// ---------------------------------------------------------------------------

/** Scratch objects reused across all matrix compositions to avoid GC. */
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _instanceMat = new THREE.Matrix4();
const _euler = new THREE.Euler();
const _childMat = new THREE.Matrix4();
const _composedMat = new THREE.Matrix4();
const _identityMat = new THREE.Matrix4();

interface PropTransform {
  x: number; y: number; z: number;
  xRot?: number;
  yRot: number;
  s: number;
}

const _xRotMat = new THREE.Matrix4();

/**
 * Compose a world-space matrix from a PropTransform into the scratch _instanceMat.
 * Returns _instanceMat — caller must use it before the next call.
 */
function composeMatrix(t: PropTransform): THREE.Matrix4 {
  _pos.set(t.x, t.y, t.z);
  _euler.set(0, t.yRot, 0);
  _quat.setFromEuler(_euler);
  _scale.set(t.s, t.s, t.s);
  _instanceMat.compose(_pos, _quat, _scale);
  if (t.xRot) _instanceMat.multiply(_xRotMat.makeRotationX(t.xRot));
  return _instanceMat;
}

/**
 * Pre-compose all transforms into a Float32Array of 4x4 matrices.
 * Returns buffer of length transforms.length * 16.
 */
function bakeTransforms(transforms: PropTransform[]): Float32Array {
  const buf = new Float32Array(transforms.length * 16);
  for (let i = 0; i < transforms.length; i++) {
    composeMatrix(transforms[i]!);
    _instanceMat.toArray(buf, i * 16);
  }
  return buf;
}

/**
 * For each child Mesh in a GLTF scene, create an InstancedMesh.
 * Instance matrices are written directly into a Float32Array — minimal GC.
 */
function createInstancedMeshes(
  glbPath: string,
  transforms: PropTransform[],
  group: THREE.Group,
  boundingSphere?: THREE.Sphere,
): void {
  const gltf = getModelFromCache(glbPath);
  if (!gltf) return;

  const bakedMatrices = bakeTransforms(transforms);

  gltf.scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.updateWorldMatrix(true, false);
    _childMat.copy(child.matrixWorld);

    const count = transforms.length;
    const im = new THREE.InstancedMesh(child.geometry, child.material, count);
    const arr = im.instanceMatrix.array as Float32Array;

    const isIdentityChild = _childMat.equals(_identityMat);
    if (isIdentityChild) {
      // Fast path: copy baked buffer directly — no per-instance multiply
      arr.set(bakedMatrices);
    } else {
      for (let i = 0; i < count; i++) {
        _instanceMat.fromArray(bakedMatrices, i * 16);
        _composedMat.multiplyMatrices(_instanceMat, _childMat);
        _composedMat.toArray(arr, i * 16);
      }
    }
    im.instanceMatrix.needsUpdate = true;

    if (boundingSphere) {
      im.boundingSphere = boundingSphere.clone();
      im.frustumCulled = true;
    } else {
      im.computeBoundingSphere();
      im.frustumCulled = false;
    }

    group.add(im);
  });
}

// ---------------------------------------------------------------------------
// Chunk key: combines glbPath + megaHex chunk ID
// ---------------------------------------------------------------------------

function chunkKey(glbPath: string, chunkId: string): string {
  return `${chunkId}|${glbPath}`;
}

// ---------------------------------------------------------------------------
// Chunk bounding sphere computation
// ---------------------------------------------------------------------------

interface ChunkData {
  transforms: PropTransform[];
  positions: { x: number; y: number; z: number }[];
}

function computeChunkSphere(positions: { x: number; y: number; z: number }[]): THREE.Sphere {
  let cx = 0, cy = 0, cz = 0;
  for (const p of positions) {
    cx += p.x; cy += p.y; cz += p.z;
  }
  const n = positions.length;
  cx /= n; cy /= n; cz /= n;

  let maxR2 = 0;
  for (const p of positions) {
    const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 > maxR2) maxR2 = r2;
  }

  // Pad radius to cover prop extents beyond hex centers
  return new THREE.Sphere(new THREE.Vector3(cx, cy, cz), Math.sqrt(maxR2) + WORLD_HEX_SIZE * 2);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderProps(state: GameState, visibleHexes?: Set<string>): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  clearProps();

  propGroup = new THREE.Group();
  propGroup.name = 'propGroup';

  const mapSeed = state.map.seed;

  // Pass 1: collect transforms per (glbPath, chunkId)
  const chunks = new Map<string, ChunkData>();
  const FALLBACK_CHUNK = '_deploy';

  function collect(glbPath: string, megaId: string, t: PropTransform): void {
    const ck = chunkKey(glbPath, megaId);
    let data = chunks.get(ck);
    if (!data) {
      data = { transforms: [], positions: [] };
      chunks.set(ck, data);
    }
    data.transforms.push(t);
    data.positions.push({ x: t.x, y: t.y, z: t.z });
  }

  for (const [key, terrain] of state.map.terrain) {
    // Skip fogged hexes — props hidden by fog of war
    if (visibleHexes && !visibleHexes.has(key)) continue;

    const [qStr, rStr] = key.split(',');
    const q = Number(qStr);
    const r = Number(rStr);
    const hex = createHex(q, r);
    const elev = state.map.elevation.get(key) ?? 0;
    const world = cachedHexToWorld(hex, elev);
    const megaId = state.map.megaHexes.get(key) ?? FALLBACK_CHUNK;

    const modifier = state.map.modifiers?.get(key);
    const hexSeed = (mapSeed ^ hashHexKey(q, r)) >>> 0;
    const rng = mulberry32(hexSeed);

    // Surface prop for modifier hexes (full-hex coverage)
    if (modifier) {
      const surfaceDef = SURFACE_PROPS[modifier];
      if (surfaceDef && !failedPaths.has(surfaceDef.glbPath)) {
        let yRot = 0;
        if (surfaceDef.directional && state.map.modifiers) {
          yRot = computeSurfaceAngle(hex, modifier, state.map.modifiers);
        }
        collect(surfaceDef.glbPath, megaId, { x: world.x, y: world.y + 0.005, z: world.z, xRot: surfaceDef.xRot, yRot, s: surfaceDef.scale });
      }
    }

    // Scatter props (terrain-based or modifier accent props)
    const props = computePropsForHex(terrain, rng, modifier);

    for (const prop of props) {
      if (failedPaths.has(prop.glbPath)) continue;
      collect(prop.glbPath, megaId, {
        x: world.x + prop.offsetX,
        y: world.y + 0.01 + prop.yOffset,
        z: world.z + prop.offsetZ,
        yRot: prop.yRotation,
        s: prop.scale,
      });
    }
  }

  // Pass 2: create InstancedMesh per (glbPath, chunkId) with bounding sphere
  let meshCount = 0;
  let totalInstances = 0;
  for (const [ck, data] of chunks) {
    const glb = ck.substring(ck.indexOf('|') + 1);
    const sphere = computeChunkSphere(data.positions);
    const before = propGroup.children.length;
    createInstancedMeshes(glb, data.transforms, propGroup, sphere);
    const added = propGroup.children.length - before;
    meshCount += added;
    totalInstances += data.transforms.length * added;
  }

  // Per-model triangle census
  const modelTris = new Map<string, { tris: number; instances: number }>();
  for (const [ck, data] of chunks) {
    const glb = ck.substring(ck.indexOf('|') + 1);
    const gltf = getModelFromCache(glb);
    if (!gltf) continue;
    let meshTris = 0;
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry.index) {
        meshTris += child.geometry.index.count / 3;
      } else if (child instanceof THREE.Mesh) {
        const pos = child.geometry.getAttribute('position');
        if (pos) meshTris += pos.count / 3;
      }
    });
    const entry = modelTris.get(glb) ?? { tris: 0, instances: 0 };
    entry.tris = meshTris;
    entry.instances += data.transforms.length;
    modelTris.set(glb, entry);
  }
  const sorted = [...modelTris.entries()].sort((a, b) => (b[1].tris * b[1].instances) - (a[1].tris * a[1].instances));
  console.log(`[prop-renderer] ${chunks.size} chunks → ${meshCount} InstancedMeshes, ${totalInstances} total instances`);
  console.table(sorted.map(([path, { tris, instances }]) => ({
    model: path.replace('/models/props/', ''),
    trisPerModel: tris,
    instances,
    totalTris: tris * instances,
  })));
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

  // Only dispose instance matrix buffers — geometry/materials belong to cached GLTFs
  propGroup.traverse((obj) => {
    if (obj instanceof THREE.InstancedMesh) {
      obj.dispose();
    }
  });

  propGroup = null;
}
