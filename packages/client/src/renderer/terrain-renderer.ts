import * as THREE from 'three';
import type { GameState, CubeCoord } from '@hexwar/engine';
import { getAllHexes, hexToKey, hexWorldVertices } from '@hexwar/engine';
import { getThreeContext } from './three-scene';
import { ASH_EMBER_TERRAIN, OBJECTIVE_COLOR, PLAYER_COLORS } from './constants';

// ---------------------------------------------------------------------------
// Terrain renderer — Three.js hex meshes (flat, no elevation)
// ---------------------------------------------------------------------------

let terrainGroup: THREE.Group | null = null;

/** Parse CSS hex color string to numeric value. */
function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Build a flat-top hex ShapeGeometry from world vertices (XZ -> XY for shape). */
function createHexShape(hex: CubeCoord): THREE.Shape {
  const verts = hexWorldVertices(hex);
  const shape = new THREE.Shape();
  shape.moveTo(verts[0]!.x, verts[0]!.z);
  for (let i = 1; i < 6; i++) {
    shape.lineTo(verts[i]!.x, verts[i]!.z);
  }
  shape.closePath();
  return shape;
}

/** Create a LineLoop for a hex outline in XZ plane. */
function createHexOutline(
  hex: CubeCoord,
  color: number,
  yOffset: number,
): THREE.LineLoop {
  const verts = hexWorldVertices(hex);
  const points = verts.map((v) => new THREE.Vector3(v.x, v.y + yOffset, v.z));
  points.push(points[0]!.clone());
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color });
  return new THREE.LineLoop(geometry, material);
}

/** Render all terrain hexes, objective glow, and city ownership borders. */
export function renderTerrain(state: GameState): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  // Remove previous terrain
  if (terrainGroup) {
    ctx.scene.remove(terrainGroup);
    terrainGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineLoop) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }

  terrainGroup = new THREE.Group();
  terrainGroup.name = 'terrainGroup';
  terrainGroup.renderOrder = 0;

  const allHexes = getAllHexes(state.map.gridSize);

  for (const hex of allHexes) {
    const hexKey = hexToKey(hex);
    const terrain = state.map.terrain.get(hexKey) ?? 'plains';
    const fill = ASH_EMBER_TERRAIN[terrain] ?? 0x6A6A58;

    // Top face
    const shape = createHexShape(hex);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    const topMesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: fill, side: THREE.DoubleSide }),
    );
    topMesh.position.y = 0;
    topMesh.position.x = 0;
    topMesh.position.z = 0;
    terrainGroup.add(topMesh);

    // Grid outline
    const outline = createHexOutline(hex, 0x0a0a10, 0.001);
    terrainGroup.add(outline);
  }

  // Objective hex golden glow
  const objShape = createHexShape(state.map.centralObjective);
  const objGeo = new THREE.ShapeGeometry(objShape);
  objGeo.rotateX(Math.PI / 2);
  const objMesh = new THREE.Mesh(
    objGeo,
    new THREE.MeshBasicMaterial({
      color: OBJECTIVE_COLOR,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  objMesh.position.y = 0.002;
  objMesh.renderOrder = 1;
  terrainGroup.add(objMesh);

  // Golden outline
  const objOutline = createHexOutline(state.map.centralObjective, OBJECTIVE_COLOR, 0.003);
  terrainGroup.add(objOutline);

  // City ownership borders
  if (state.cityOwnership) {
    for (const hex of allHexes) {
      const key = hexToKey(hex);
      const owner = state.cityOwnership.get(key);
      if (owner) {
        const ownerColor = parseColor(PLAYER_COLORS[owner].light);
        const cityOutline = createHexOutline(hex, ownerColor, 0.004);
        terrainGroup.add(cityOutline);
      }
    }
  }

  ctx.scene.add(terrainGroup);
}
