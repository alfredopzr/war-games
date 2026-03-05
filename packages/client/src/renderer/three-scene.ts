import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { GridSize } from '@hexwar/engine';
import { hexToWorld, getAllHexes } from '@hexwar/engine';

// ---------------------------------------------------------------------------
// Three.js context — scene, camera, renderers
// ---------------------------------------------------------------------------

export interface ThreeContext {
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
}

let ctx: ThreeContext | null = null;
let animFrameId: number | null = null;

export function getThreeContext(): ThreeContext | null {
  return ctx;
}

/**
 * Camera tilt angle in degrees from vertical.
 * ~35° gives a natural isometric look with true hex geometry.
 */
const CAMERA_TILT_DEG = 35;
const CAMERA_TILT_RAD = (CAMERA_TILT_DEG * Math.PI) / 180;

export function createThreeContext(parentDiv: HTMLDivElement): ThreeContext {
  const w = parentDiv.clientWidth;
  const h = parentDiv.clientHeight;

  // WebGL renderer — opaque background, Three.js owns the canvas now
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x0a0a10, 1);
  const canvas = renderer.domElement;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  parentDiv.appendChild(canvas);

  // CSS2D renderer — HP bars, labels as HTML divs
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(w, h);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.zIndex = '1';
  labelRenderer.domElement.style.pointerEvents = 'none';
  parentDiv.appendChild(labelRenderer.domElement);

  // Orthographic camera — tilted for isometric perspective
  const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -2000, 2000);
  // Position will be set by fitCameraToMap; start looking at origin
  camera.position.set(0, 10, 0);
  camera.lookAt(0, 0, 0);

  // Scene with lighting for 3D models
  const scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(0xffffff, 1.8);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xfff5e0, 0.6);
  dir.position.set(1, 3, -2);
  scene.add(dir);

  ctx = { renderer, labelRenderer, scene, camera };
  return ctx;
}

// ---------------------------------------------------------------------------
// Camera fitting
// ---------------------------------------------------------------------------

const PADDING = 1.0; // world units of padding around the map

/**
 * Fit the orthographic camera to show the entire hex grid.
 * Camera is tilted CAMERA_TILT_DEG from vertical (looking down at the XZ plane).
 */
export function fitCameraToMap(
  gridSize: GridSize,
  elevationMap: Map<string, number>,
): void {
  if (!ctx) return;

  // Compute world-space bounding box of all hexes
  const hexes = getAllHexes(gridSize);
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let maxY = 0;

  for (const hex of hexes) {
    const key = `${hex.q},${hex.r}`;
    const elev = elevationMap.get(key) ?? 0;
    const w = hexToWorld(hex, elev);
    minX = Math.min(minX, w.x);
    maxX = Math.max(maxX, w.x);
    minZ = Math.min(minZ, w.z);
    maxZ = Math.max(maxZ, w.z);
    maxY = Math.max(maxY, w.y);
  }

  // Expand by hex radius + padding
  minX -= 1.0 + PADDING;
  maxX += 1.0 + PADDING;
  minZ -= 1.0 + PADDING;
  maxZ += 1.0 + PADDING;

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const centerY = maxY / 2;

  // scene.scale.z flips the board for player perspective — camera must follow
  const vizCenterZ = centerZ * ctx.scene.scale.z;

  // Camera distance along its look direction (arbitrary, ortho doesn't care)
  const dist = 50;
  // Camera offset: tilted from vertical by CAMERA_TILT_RAD
  // Camera looks toward -Y tilted toward +Z
  ctx.camera.position.set(
    centerX,
    centerY + dist * Math.cos(CAMERA_TILT_RAD),
    vizCenterZ + dist * Math.sin(CAMERA_TILT_RAD),
  );
  ctx.camera.lookAt(centerX, centerY, vizCenterZ);

  // Compute frustum to fit the map
  // Project map corners onto the camera's view plane
  const worldWidth = maxX - minX;
  // The Z extent gets foreshortened by the tilt angle
  const worldDepth = maxZ - minZ;
  const projectedDepth = worldDepth * Math.cos(CAMERA_TILT_RAD) + maxY * Math.sin(CAMERA_TILT_RAD);

  const screenW = ctx.renderer.domElement.clientWidth;
  const screenH = ctx.renderer.domElement.clientHeight;
  const aspect = screenW / screenH;

  // Fit the larger dimension
  let halfW: number, halfH: number;
  if (worldWidth / projectedDepth > aspect) {
    // Width-constrained
    halfW = worldWidth / 2;
    halfH = halfW / aspect;
  } else {
    // Height-constrained
    halfH = projectedDepth / 2;
    halfW = halfH * aspect;
  }

  ctx.camera.left = -halfW;
  ctx.camera.right = halfW;
  ctx.camera.top = halfH;
  ctx.camera.bottom = -halfH;
  ctx.camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Map flip
// ---------------------------------------------------------------------------

/**
 * Flip the board so the current player's deployment zone is at screen bottom.
 * Since hexes are in the XZ plane, flipping Z mirrors the board.
 */
export function setMapFlip(player1View: boolean): void {
  if (!ctx) return;
  ctx.scene.scale.z = player1View ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

export function renderThreeScene(): void {
  if (!ctx) return;
  ctx.renderer.render(ctx.scene, ctx.camera);
  ctx.labelRenderer.render(ctx.scene, ctx.camera);
}

/**
 * Start the render loop. `onTick(deltaSec)` is called each frame before rendering.
 */
export function startRenderLoop(onTick: (deltaSec: number) => void): void {
  if (animFrameId !== null) return;
  let lastTime = performance.now();

  function loop(now: number): void {
    animFrameId = requestAnimationFrame(loop);
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    onTick(dt);
    renderThreeScene();
  }
  animFrameId = requestAnimationFrame(loop);
}

export function stopRenderLoop(): void {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

// ---------------------------------------------------------------------------
// Resize & cleanup
// ---------------------------------------------------------------------------

export function resizeThreeRenderers(w: number, h: number): void {
  if (!ctx) return;
  ctx.renderer.setSize(w, h);
  ctx.labelRenderer.setSize(w, h);
}

export function disposeThreeContext(): void {
  stopRenderLoop();
  if (!ctx) return;
  ctx.renderer.domElement.remove();
  ctx.labelRenderer.domElement.remove();
  ctx.renderer.dispose();
  ctx.scene.clear();
  ctx = null;
}
