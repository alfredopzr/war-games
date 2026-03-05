import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { UnitType } from '@hexwar/engine';
import { MODEL_MANIFEST, type Faction } from './constants';

// ---------------------------------------------------------------------------
// GLB loader with cache and in-flight dedup
// ---------------------------------------------------------------------------

const loader = new GLTFLoader();
const cache = new Map<string, GLTF>();
const pending = new Map<string, Promise<GLTF>>();

export function loadModel(glbPath: string): Promise<GLTF> {
  const cached = cache.get(glbPath);
  if (cached) return Promise.resolve(cached);

  const inflight = pending.get(glbPath);
  if (inflight) return inflight;

  const promise = new Promise<GLTF>((resolve, reject) => {
    loader.load(
      glbPath,
      (gltf) => {
        cache.set(glbPath, gltf);
        pending.delete(glbPath);
        resolve(gltf);
      },
      undefined,
      (err) => {
        pending.delete(glbPath);
        reject(err);
      },
    );
  });

  pending.set(glbPath, promise);
  return promise;
}

export function preloadFactionModels(faction: Faction): Promise<GLTF[]> {
  const manifest = MODEL_MANIFEST[faction];
  const unitTypes: UnitType[] = ['infantry', 'tank', 'artillery', 'recon'];
  const paths = new Set(unitTypes.map((t) => manifest[t].glbPath));
  return Promise.all([...paths].map(loadModel));
}

export function getModelFromCache(glbPath: string): GLTF | undefined {
  return cache.get(glbPath);
}
