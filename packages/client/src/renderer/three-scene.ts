import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { hexToWorld, createHex } from '@hexwar/engine';
import { perf } from '../perf-monitor';
import { getPalette } from './palette';

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
let labelsDirty = true;
let labelsEnabled = true;

/** Mark CSS2D labels as needing a render pass (camera moved or scene changed). */
export function markLabelsDirty(): void {
  labelsDirty = true;
}

/** Enable/disable CSS2D label rendering (disable during camera animation). */
export function setLabelsEnabled(enabled: boolean): void {
  labelsEnabled = enabled;
  if (enabled) labelsDirty = true;
}

export function getThreeContext(): ThreeContext | null {
  return ctx;
}

/**
 * Camera tilt angle in degrees from vertical.
 * ~35° gives a natural isometric look with true hex geometry.
 */
const CAMERA_TILT_DEG = 60;
const CAMERA_TILT_RAD = (CAMERA_TILT_DEG * Math.PI) / 180;

export function createThreeContext(parentDiv: HTMLDivElement): ThreeContext {
  const w = parentDiv.clientWidth;
  const h = parentDiv.clientHeight;

  // WebGL renderer — opaque background, Three.js owns the canvas now
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(getPalette().scene.clear, 1);
  const canvas = renderer.domElement;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  parentDiv.appendChild(canvas);

  // Handle WebGL context loss — prevent crash, allow recovery
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('[three-scene] WebGL context lost — pausing render loop');
    stopRenderLoop();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.warn('[three-scene] WebGL context restored');
  });

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
  const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -100, 200);
  // Position will be set by fitCameraToMap; start looking at origin
  camera.position.set(0, 10, 0);
  camera.lookAt(0, 0, 0);

  // Scene with lighting for 3D models
  const pal = getPalette();
  const scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(pal.scene.ambient, pal.scene.ambientIntensity);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(pal.scene.directional, pal.scene.directionalIntensity);
  dir.position.set(1, 3, -2);
  scene.add(dir);

  ctx = { renderer, labelRenderer, scene, camera };
  return ctx;
}

/** Update clear color and lighting to match current palette. */
export function syncScenePalette(): void {
  if (!ctx) return;
  const pal = getPalette();
  ctx.renderer.setClearColor(pal.scene.clear, 1);
  ctx.scene.traverse((obj) => {
    if (obj instanceof THREE.AmbientLight) {
      obj.color.setHex(pal.scene.ambient);
      obj.intensity = pal.scene.ambientIntensity;
    } else if (obj instanceof THREE.DirectionalLight) {
      obj.color.setHex(pal.scene.directional);
      obj.intensity = pal.scene.directionalIntensity;
    }
  });
}

// ---------------------------------------------------------------------------
// Camera fitting
// ---------------------------------------------------------------------------

const PADDING = 1.0; // world units of padding around the map
const ZOOM = 1.2; // >1 = zoomed in (frustum shrinks)

// Cached bounding box — recomputed only when elevation map changes
interface MapBounds {
  centerX: number;
  centerZ: number;
  centerY: number;
  worldWidth: number;
  worldDepth: number;
  maxY: number;
}

let cachedBounds: MapBounds | null = null;
let cachedElevationMap: Map<string, number> | null = null;

function computeMapBounds(elevationMap: Map<string, number>): MapBounds {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let maxY = 0;

  for (const [key, elev] of elevationMap) {
    const [qStr, rStr] = key.split(',');
    const hex = createHex(Number(qStr), Number(rStr));
    const w = hexToWorld(hex, elev);
    minX = Math.min(minX, w.x);
    maxX = Math.max(maxX, w.x);
    minZ = Math.min(minZ, w.z);
    maxZ = Math.max(maxZ, w.z);
    maxY = Math.max(maxY, w.y);
  }

  minX -= 1.0 + PADDING;
  maxX += 1.0 + PADDING;
  minZ -= 1.0 + PADDING;
  maxZ += 1.0 + PADDING;

  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    centerY: maxY / 2,
    worldWidth: maxX - minX,
    worldDepth: maxZ - minZ,
    maxY,
  };
}

/**
 * Fit the orthographic camera to show the entire hex grid.
 * Camera is tilted CAMERA_TILT_DEG from vertical (looking down at the XZ plane).
 */
export function fitCameraToMap(
  elevationMap: Map<string, number>,
  rotationRad: number = 0,
  zoomOverride: number = ZOOM,
  stableFrustum: boolean = false,
  tiltOverride: number = CAMERA_TILT_RAD,
  panX: number = 0,
  panZ: number = 0,
): void {
  if (!ctx) return;

  // Recompute bounds only when the map changes
  if (elevationMap !== cachedElevationMap) {
    cachedBounds = computeMapBounds(elevationMap);
    cachedElevationMap = elevationMap;
  }
  const { centerX, centerZ, centerY, worldWidth, worldDepth, maxY } = cachedBounds!;

  // scene.scale.z flips the board for player perspective — camera must follow
  const focusX = centerX + panX;
  const focusZ = (centerZ + panZ) * ctx.scene.scale.z;

  // Camera distance along its look direction (arbitrary, ortho doesn't care)
  const dist = 50;
  const sinTilt = Math.sin(tiltOverride);
  const cosTilt = Math.cos(tiltOverride);
  ctx.camera.position.set(
    focusX + dist * sinTilt * Math.sin(rotationRad),
    centerY + dist * cosTilt,
    focusZ + dist * sinTilt * Math.cos(rotationRad),
  );
  ctx.camera.lookAt(focusX, centerY, focusZ);

  // Compute frustum to fit the rotated view of the bounding box.
  // When stableFrustum is true, use the max extent at any angle (diagonal)
  // to prevent zoom bouncing during continuous rotation.
  let projectedWidth: number, projectedDepth: number;
  if (stableFrustum) {
    const diagonal = Math.sqrt(worldWidth * worldWidth + worldDepth * worldDepth);
    projectedWidth = diagonal;
    projectedDepth = diagonal * cosTilt + maxY * sinTilt;
  } else {
    const cosR = Math.abs(Math.cos(rotationRad));
    const sinR = Math.abs(Math.sin(rotationRad));
    projectedWidth = worldWidth * cosR + worldDepth * sinR;
    const depthAlongLook = worldWidth * sinR + worldDepth * cosR;
    projectedDepth = depthAlongLook * cosTilt + maxY * sinTilt;
  }

  const screenW = ctx.renderer.domElement.clientWidth;
  const screenH = ctx.renderer.domElement.clientHeight;
  const aspect = screenW / screenH;

  let halfW: number, halfH: number;
  if (projectedWidth / projectedDepth > aspect) {
    halfW = projectedWidth / 2;
    halfH = halfW / aspect;
  } else {
    halfH = projectedDepth / 2;
    halfW = halfH * aspect;
  }

  ctx.camera.left = -halfW / zoomOverride;
  ctx.camera.right = halfW / zoomOverride;
  ctx.camera.top = halfH / zoomOverride;
  ctx.camera.bottom = -halfH / zoomOverride;
  ctx.camera.updateProjectionMatrix();
  labelsDirty = true;
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
  const endWebgl = perf.start('webgl');
  ctx.renderer.render(ctx.scene, ctx.camera);
  endWebgl();
  const info = ctx.renderer.info;
  perf.setGpuInfo({
    calls: info.render.calls,
    triangles: info.render.triangles,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
  });
  if (labelsDirty && labelsEnabled) {
    const endLabel = perf.start('labelRender');
    ctx.labelRenderer.render(ctx.scene, ctx.camera);
    endLabel();
    labelsDirty = false;
  }
}

/**
 * Start the render loop. `onTick(deltaSec)` is called each frame before rendering.
 */
export function startRenderLoop(onTick: (deltaSec: number) => void): void {
  if (animFrameId !== null) return;
  let lastTime = performance.now();

  function loop(now: number): void {
    animFrameId = requestAnimationFrame(loop);
    perf.markFrameStart();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    onTick(dt);
    renderThreeScene();
    perf.markFrameEnd();
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
  labelsDirty = true;
}

export function disposeThreeContext(): void {
  stopRenderLoop();
  if (!ctx) return;
  ctx.renderer.domElement.remove();
  ctx.labelRenderer.domElement.remove();
  ctx.renderer.dispose();
  ctx.scene.clear();
  ctx = null;
  cachedBounds = null;
  cachedElevationMap = null;
}
