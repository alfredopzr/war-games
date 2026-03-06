import * as THREE from 'three';
import type { GameState, CubeCoord } from '@hexwar/engine';
import { hexToKey, hexWorldVertices, createHex } from '@hexwar/engine';
import { getThreeContext } from './three-scene';
import { ASH_EMBER_TERRAIN, MODIFIER_COLORS, OBJECTIVE_COLOR, PLAYER_COLORS } from './constants';

// ---------------------------------------------------------------------------
// Terrain renderer — batched Three.js hex geometry
//
// All ~2800 terrain hexes are merged into 3 draw calls:
//   1. Top faces   — single BufferGeometry with vertex colors
//   2. Side faces   — single BufferGeometry with vertex colors (elevated hexes)
//   3. Grid outlines — single LineSegments geometry
// Objective + city borders remain as individual meshes (~6 total).
// ---------------------------------------------------------------------------

let terrainGroup: THREE.Group | null = null;

// Shared materials (module-level singletons)
const batchedTopMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const batchedSideMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const outlineMat = new THREE.LineBasicMaterial({ color: 0x0a0a10 });
const objectiveMat = new THREE.MeshBasicMaterial({
  color: OBJECTIVE_COLOR,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const objectiveOutlineMat = new THREE.LineBasicMaterial({ color: OBJECTIVE_COLOR });

const outlineMaterialCache = new Map<number, THREE.LineBasicMaterial>();
function getOutlineMaterial(color: number): THREE.LineBasicMaterial {
  let mat = outlineMaterialCache.get(color);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({ color });
    outlineMaterialCache.set(color, mat);
  }
  return mat;
}

/** Darken a 0xRRGGBB color by a factor (0–1). */
function darkenColor(color: number, factor: number): number {
  const r = ((color >> 16) & 0xff) * factor;
  const g = ((color >> 8) & 0xff) * factor;
  const b = (color & 0xff) * factor;
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

/** Parse CSS hex color string to numeric value. */
function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Render all terrain hexes, objective glow, and city ownership borders. */
export function renderTerrain(state: GameState): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  // Remove previous terrain
  if (terrainGroup) {
    ctx.scene.remove(terrainGroup);
    terrainGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.LineLoop) {
        obj.geometry.dispose();
      }
    });
  }

  terrainGroup = new THREE.Group();
  terrainGroup.name = 'terrainGroup';
  terrainGroup.renderOrder = 0;

  // Build hex data from terrain map
  const hexEntries: { hex: CubeCoord; key: string }[] = [];
  for (const key of state.map.terrain.keys()) {
    const [qStr, rStr] = key.split(',');
    hexEntries.push({ hex: createHex(Number(qStr), Number(rStr)), key });
  }

  const hexCount = hexEntries.length;

  // Pre-compute per-hex data: vertices, fill color, elevation
  const hexData: {
    verts: { x: number; y: number; z: number }[];
    fill: number;
    elev: number;
  }[] = [];
  let elevatedCount = 0;

  for (let h = 0; h < hexCount; h++) {
    const { hex, key } = hexEntries[h]!;
    const terrain = state.map.terrain.get(key)!;
    const elev = state.map.elevation.get(key) ?? 0;
    const modifier = state.map.modifiers?.get(key);
    const fill = (modifier && MODIFIER_COLORS[modifier]) ?? ASH_EMBER_TERRAIN[terrain] ?? 0x6A6A58;
    const verts = hexWorldVertices(hex, elev);
    if (elev !== 0) elevatedCount++;
    hexData.push({ verts, fill, elev });
  }

  // --- Top faces: 4 triangles per hex (fan from v0) = 12 vertices ---
  const topPositions = new Float32Array(hexCount * 12 * 3);
  const topColors = new Float32Array(hexCount * 12 * 3);
  const tmpColor = new THREE.Color();

  for (let h = 0; h < hexCount; h++) {
    const { verts, fill } = hexData[h]!;
    tmpColor.set(fill);
    const base = h * 36; // 12 verts × 3 floats

    for (let t = 0; t < 4; t++) {
      const off = base + t * 9;
      const v0 = verts[0]!;
      const v1 = verts[t + 1]!;
      const v2 = verts[t + 2]!;

      topPositions[off    ] = v0.x; topPositions[off + 1] = v0.y; topPositions[off + 2] = v0.z;
      topPositions[off + 3] = v1.x; topPositions[off + 4] = v1.y; topPositions[off + 5] = v1.z;
      topPositions[off + 6] = v2.x; topPositions[off + 7] = v2.y; topPositions[off + 8] = v2.z;

      topColors[off    ] = tmpColor.r; topColors[off + 1] = tmpColor.g; topColors[off + 2] = tmpColor.b;
      topColors[off + 3] = tmpColor.r; topColors[off + 4] = tmpColor.g; topColors[off + 5] = tmpColor.b;
      topColors[off + 6] = tmpColor.r; topColors[off + 7] = tmpColor.g; topColors[off + 8] = tmpColor.b;
    }
  }

  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.BufferAttribute(topPositions, 3));
  topGeo.setAttribute('color', new THREE.BufferAttribute(topColors, 3));
  terrainGroup.add(new THREE.Mesh(topGeo, batchedTopMat));

  // --- Grid outlines: 6 line segments per hex = 12 vertices ---
  const outlinePositions = new Float32Array(hexCount * 12 * 3);

  for (let h = 0; h < hexCount; h++) {
    const { verts } = hexData[h]!;
    const base = h * 36;

    for (let i = 0; i < 6; i++) {
      const off = base + i * 6;
      const va = verts[i]!;
      const vb = verts[(i + 1) % 6]!;
      const oy = va.y + 0.001;

      outlinePositions[off    ] = va.x; outlinePositions[off + 1] = oy; outlinePositions[off + 2] = va.z;
      outlinePositions[off + 3] = vb.x; outlinePositions[off + 4] = oy; outlinePositions[off + 5] = vb.z;
    }
  }

  const outlineGeo = new THREE.BufferGeometry();
  outlineGeo.setAttribute('position', new THREE.BufferAttribute(outlinePositions, 3));
  terrainGroup.add(new THREE.LineSegments(outlineGeo, outlineMat));

  // --- Side faces for non-zero elevation hexes: 6 quads = 12 triangles = 36 vertices ---
  if (elevatedCount > 0) {
    const sidePositions = new Float32Array(elevatedCount * 36 * 3);
    const sideColors = new Float32Array(elevatedCount * 36 * 3);
    let si = 0;

    for (let h = 0; h < hexCount; h++) {
      const { hex } = hexEntries[h]!;
      const { verts: topVerts, fill, elev } = hexData[h]!;
      if (elev === 0) continue;

      const botVerts = hexWorldVertices(hex, 0);
      const sideColor = darkenColor(fill, 0.6);
      tmpColor.set(sideColor);

      const baseSide = si * 108; // 36 verts × 3 floats
      for (let e = 0; e < 6; e++) {
        const ta = topVerts[e]!;
        const tb = topVerts[(e + 1) % 6]!;
        const ba = botVerts[e]!;
        const bb = botVerts[(e + 1) % 6]!;

        const off = baseSide + e * 18;
        // Triangle 1: ta, tb, bb
        sidePositions[off     ] = ta.x; sidePositions[off +  1] = ta.y; sidePositions[off +  2] = ta.z;
        sidePositions[off +  3] = tb.x; sidePositions[off +  4] = tb.y; sidePositions[off +  5] = tb.z;
        sidePositions[off +  6] = bb.x; sidePositions[off +  7] = bb.y; sidePositions[off +  8] = bb.z;
        // Triangle 2: ta, bb, ba
        sidePositions[off +  9] = ta.x; sidePositions[off + 10] = ta.y; sidePositions[off + 11] = ta.z;
        sidePositions[off + 12] = bb.x; sidePositions[off + 13] = bb.y; sidePositions[off + 14] = bb.z;
        sidePositions[off + 15] = ba.x; sidePositions[off + 16] = ba.y; sidePositions[off + 17] = ba.z;

        for (let v = 0; v < 6; v++) {
          sideColors[off + v * 3    ] = tmpColor.r;
          sideColors[off + v * 3 + 1] = tmpColor.g;
          sideColors[off + v * 3 + 2] = tmpColor.b;
        }
      }
      si++;
    }

    const sideGeo = new THREE.BufferGeometry();
    sideGeo.setAttribute('position', new THREE.BufferAttribute(sidePositions, 3));
    sideGeo.setAttribute('color', new THREE.BufferAttribute(sideColors, 3));
    terrainGroup.add(new THREE.Mesh(sideGeo, batchedSideMat));
  }

  // --- Objective hex golden glow (single mesh, kept separate) ---
  const objKey = hexToKey(state.map.centralObjective);
  const objElev = state.map.elevation.get(objKey) ?? 0;
  const objVerts = hexWorldVertices(state.map.centralObjective, objElev);
  const objY = objVerts[0]!.y + 0.002;

  // 4 triangles for the hex
  const objPositions = new Float32Array(12 * 3);
  for (let t = 0; t < 4; t++) {
    const off = t * 9;
    const v0 = objVerts[0]!;
    const v1 = objVerts[t + 1]!;
    const v2 = objVerts[t + 2]!;
    objPositions[off    ] = v0.x; objPositions[off + 1] = objY; objPositions[off + 2] = v0.z;
    objPositions[off + 3] = v1.x; objPositions[off + 4] = objY; objPositions[off + 5] = v1.z;
    objPositions[off + 6] = v2.x; objPositions[off + 7] = objY; objPositions[off + 8] = v2.z;
  }
  const objGeo = new THREE.BufferGeometry();
  objGeo.setAttribute('position', new THREE.BufferAttribute(objPositions, 3));
  const objMesh = new THREE.Mesh(objGeo, objectiveMat);
  objMesh.renderOrder = 1;
  terrainGroup.add(objMesh);

  // Golden outline
  const objOutlinePos = new Float32Array(12 * 3);
  const objOutlineY = objVerts[0]!.y + 0.003;
  for (let i = 0; i < 6; i++) {
    const off = i * 6;
    const va = objVerts[i]!;
    const vb = objVerts[(i + 1) % 6]!;
    objOutlinePos[off    ] = va.x; objOutlinePos[off + 1] = objOutlineY; objOutlinePos[off + 2] = va.z;
    objOutlinePos[off + 3] = vb.x; objOutlinePos[off + 4] = objOutlineY; objOutlinePos[off + 5] = vb.z;
  }
  const objOutlineGeo = new THREE.BufferGeometry();
  objOutlineGeo.setAttribute('position', new THREE.BufferAttribute(objOutlinePos, 3));
  terrainGroup.add(new THREE.LineSegments(objOutlineGeo, objectiveOutlineMat));

  // --- City ownership borders (few meshes, kept separate) ---
  if (state.cityOwnership) {
    for (const [key, owner] of state.cityOwnership) {
      if (owner) {
        const [cq, cr] = key.split(',');
        const cityHex = createHex(Number(cq), Number(cr));
        const elev = state.map.elevation.get(key) ?? 0;
        const cityVerts = hexWorldVertices(cityHex, elev);
        const cityY = cityVerts[0]!.y + 0.004;
        const ownerColor = parseColor(PLAYER_COLORS[owner].light);

        const cityOutlinePos = new Float32Array(12 * 3);
        for (let i = 0; i < 6; i++) {
          const off = i * 6;
          const va = cityVerts[i]!;
          const vb = cityVerts[(i + 1) % 6]!;
          cityOutlinePos[off    ] = va.x; cityOutlinePos[off + 1] = cityY; cityOutlinePos[off + 2] = va.z;
          cityOutlinePos[off + 3] = vb.x; cityOutlinePos[off + 4] = cityY; cityOutlinePos[off + 5] = vb.z;
        }
        const cityGeo = new THREE.BufferGeometry();
        cityGeo.setAttribute('position', new THREE.BufferAttribute(cityOutlinePos, 3));
        terrainGroup.add(new THREE.LineSegments(cityGeo, getOutlineMaterial(ownerColor)));
      }
    }
  }

  ctx.scene.add(terrainGroup);
}
