import * as THREE from 'three';
import type { GameState, CubeCoord } from '@hexwar/engine';
import { getAllHexes, hexToKey, hexToWorld, hexWorldVertices } from '@hexwar/engine';
import { getThreeContext } from './three-scene';
import { ASH_EMBER_TERRAIN, OBJECTIVE_COLOR, PLAYER_COLORS } from './constants';

// ---------------------------------------------------------------------------
// Terrain renderer — Three.js hex meshes
// ---------------------------------------------------------------------------

let terrainGroup: THREE.Group | null = null;

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

/** Build a flat-top hex ShapeGeometry from world vertices (XZ → XY for shape). */
function createHexShape(hex: CubeCoord, elevation: number): THREE.Shape {
  const verts = hexWorldVertices(hex, elevation);
  const shape = new THREE.Shape();
  shape.moveTo(verts[0]!.x, verts[0]!.z);
  for (let i = 1; i < 6; i++) {
    shape.lineTo(verts[i]!.x, verts[i]!.z);
  }
  shape.closePath();
  return shape;
}

/** Create a LineLoop for a hex outline in XZ plane at the given elevation. */
function createHexOutline(
  hex: CubeCoord,
  elevation: number,
  color: number,
  yOffset: number,
): THREE.LineLoop {
  const verts = hexWorldVertices(hex, elevation);
  const points = verts.map((v) => new THREE.Vector3(v.x, v.y + yOffset, v.z));
  points.push(points[0]!.clone()); // close the loop
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

  // Sort by world Z (back-to-front) for correct elevation overlap
  const sortedHexes = [...allHexes].sort((a: CubeCoord, b: CubeCoord) => {
    return hexToWorld(a).z - hexToWorld(b).z;
  });

  for (const hex of sortedHexes) {
    const hexKey = hexToKey(hex);
    const terrain = state.map.terrain.get(hexKey) ?? 'plains';
    const elev = state.map.elevation.get(hexKey) ?? 0;
    const fill = ASH_EMBER_TERRAIN[terrain] ?? 0x6A6A58;

    const center = hexToWorld(hex, elev);

    // Top face — ShapeGeometry in XZ, rotated to lie flat
    const shape = createHexShape(hex, elev);
    const geo = new THREE.ShapeGeometry(shape);
    // ShapeGeometry is in XY — rotate to XZ (lie flat)
    geo.rotateX(-Math.PI / 2);
    // ShapeGeometry built with world XZ coords, but after rotateX it maps:
    // shape X → mesh X, shape Y → mesh Z, mesh Y = 0
    // We need to set Y to the elevation height
    const topMesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: fill }),
    );
    topMesh.position.y = center.y;
    // Reset XZ since geometry already has world coords baked in
    topMesh.position.x = 0;
    topMesh.position.z = 0;
    terrainGroup.add(topMesh);

    // Side faces for elevated hexes
    if (elev > 0) {
      const sideColor = darkenColor(fill, 0.6);
      const topVerts = hexWorldVertices(hex, elev);
      const botVerts = hexWorldVertices(hex, 0);

      // All 6 edges
      const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
      for (const [a, b] of edges) {
        const ta = topVerts[a!]!;
        const tb = topVerts[b!]!;
        const ba = botVerts[a!]!;
        const bb = botVerts[b!]!;

        const sideGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          ta.x, ta.y, ta.z,
          tb.x, tb.y, tb.z,
          bb.x, bb.y, bb.z,
          ta.x, ta.y, ta.z,
          bb.x, bb.y, bb.z,
          ba.x, ba.y, ba.z,
        ]);
        sideGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        sideGeo.computeVertexNormals();

        const sideMesh = new THREE.Mesh(
          sideGeo,
          new THREE.MeshBasicMaterial({ color: sideColor }),
        );
        terrainGroup.add(sideMesh);
      }
    }

    // Grid outline
    const outline = createHexOutline(hex, elev, 0x0a0a10, 0.001);
    terrainGroup.add(outline);
  }

  // Objective hex golden glow
  const objKey = hexToKey(state.map.centralObjective);
  const objElev = state.map.elevation.get(objKey) ?? 0;

  // Translucent fill
  const objShape = createHexShape(state.map.centralObjective, objElev);
  const objGeo = new THREE.ShapeGeometry(objShape);
  objGeo.rotateX(-Math.PI / 2);
  const objMesh = new THREE.Mesh(
    objGeo,
    new THREE.MeshBasicMaterial({
      color: OBJECTIVE_COLOR,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  objMesh.position.y = hexToWorld(state.map.centralObjective, objElev).y + 0.002;
  objMesh.renderOrder = 1;
  terrainGroup.add(objMesh);

  // Golden outline
  const objOutline = createHexOutline(state.map.centralObjective, objElev, OBJECTIVE_COLOR, 0.003);
  terrainGroup.add(objOutline);

  // City ownership borders
  if (state.cityOwnership) {
    for (const hex of allHexes) {
      const key = hexToKey(hex);
      const owner = state.cityOwnership.get(key);
      if (owner) {
        const elev = state.map.elevation.get(key) ?? 0;
        const ownerColor = parseColor(PLAYER_COLORS[owner].light);
        const cityOutline = createHexOutline(hex, elev, ownerColor, 0.004);
        terrainGroup.add(cityOutline);
      }
    }
  }

  ctx.scene.add(terrainGroup);
}
