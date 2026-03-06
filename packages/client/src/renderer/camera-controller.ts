import type { CubeCoord } from '@hexwar/engine';
import { hexToWorld } from '@hexwar/engine';
import { getThreeContext, fitCameraToMap, resizeThreeRenderers, setLabelsEnabled } from './three-scene';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let elevationMap: Map<string, number> | null = null;

/** Current camera rotation in radians around the Y axis. */
let rotationRad = 0;

/** Base rotation so the current player's deploy zone faces the camera (screen bottom). */
let baseRotationRad = 0;

/** Deploy zone center in world coords (for pan target). */
let deployWorldX = 0;
let deployWorldZ = 0;

/** Rotation speed in radians per second (continuous). */
const ROTATION_SPEED = Math.PI * 0.35;

/** Pan speed in world units per second (continuous). */
const PAN_SPEED = 25;

/** Zoom step per keypress. */
const ZOOM_STEP = 0.3;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 8.0;

/** Manual pan offset (world space, before rotation). */
let panOffsetX = 0;
let panOffsetZ = 0;

// ---------------------------------------------------------------------------
// Intro animation
// ---------------------------------------------------------------------------

/** Phase 1: wide sweep. Phase 2: dramatic zoom-in + tilt increase. */
const SWEEP_DURATION = 7.0;
const ZOOMIN_DURATION = 2.0;
const INTRO_EXTRA_ROTATION = Math.PI * 2;

const INTRO_START_ZOOM = 0.8;
const SWEEP_END_ZOOM = 1.0;

/** Final resting camera state — close-in with steep angle. */
const FINAL_ZOOM = 1.4;
const FINAL_TILT_DEG = 71;
const FINAL_TILT_RAD = (FINAL_TILT_DEG * Math.PI) / 180;

/** Extra downward pan to compensate for UI panels covering the bottom of the viewport. */
const FINAL_PAN_BIAS_Z = -4;

/** Default tilt from three-scene (60°). */
const DEFAULT_TILT_RAD = (60 * Math.PI) / 180;

/** Manual zoom level (overrides FINAL_ZOOM). */
let zoomLevel = FINAL_ZOOM;

/** Manual tilt in radians. */
let tiltRad = FINAL_TILT_RAD;
const TILT_SPEED = Math.PI * 0.35; // rad/s — matches rotation speed
const MIN_TILT = (20 * Math.PI) / 180;
const MAX_TILT = (89 * Math.PI) / 180;


let introActive = false;
let introElapsed = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Always returns false — no drag interaction with a static camera. */
export function wasDrag(): boolean {
  return false;
}

/** True while the intro animation is playing. */
export function isIntroActive(): boolean {
  return introActive;
}

/** Dump current camera state to console. Call from browser devtools: dumpCamera() */
function dumpCamera(): void {
  const angle = baseRotationRad + rotationRad;
  const angleDeg = (angle * 180) / Math.PI;
  const ctx = getThreeContext();
  const pos = ctx?.camera.position;
  console.table({
    rotationRad: +rotationRad.toFixed(4),
    baseRotationRad: +baseRotationRad.toFixed(4),
    totalAngleRad: +angle.toFixed(4),
    totalAngleDeg: +angleDeg.toFixed(1),
    zoomLevel: +zoomLevel.toFixed(2),
    panOffsetX: +panOffsetX.toFixed(2),
    panOffsetZ: +panOffsetZ.toFixed(2),
    deployWorldX: +deployWorldX.toFixed(2),
    deployWorldZ: +deployWorldZ.toFixed(2),
    cameraX: pos ? +pos.x.toFixed(2) : null,
    cameraY: pos ? +pos.y.toFixed(2) : null,
    cameraZ: pos ? +pos.z.toFixed(2) : null,
    tiltRad: +tiltRad.toFixed(4),
    tiltDeg: +((tiltRad * 180) / Math.PI).toFixed(1),
  });
}
(globalThis as Record<string, unknown>).dumpCamera = dumpCamera;

/** Store map parameters so resize can refit the camera. */
export function setMapParams(elev: Map<string, number>): void {
  elevationMap = elev;
}

/**
 * Set the base camera rotation so the given deploy zone faces the camera
 * (appears at screen bottom). Call when player view changes.
 * sceneFlipZ should be the current scene.scale.z value (−1 for P1, 1 for P2).
 */
export function setDeployFacing(deployZone: CubeCoord[], sceneFlipZ: number): void {
  if (deployZone.length === 0) return;
  // Average world position of deploy zone
  let ax = 0, az = 0;
  for (const hex of deployZone) {
    const w = hexToWorld(hex, 0);
    ax += w.x;
    az += w.z;
  }
  ax /= deployZone.length;
  az /= deployZone.length;
  deployWorldX = ax;
  deployWorldZ = az;
  // The scene flips Z for player perspective — the camera sees flipped coords.
  // Camera sits at +angle from center; we want the deploy zone toward the camera.
  baseRotationRad = Math.atan2(ax, az * sceneFlipZ);
}

/** Refit camera to current map. No-op while intro is playing. */
export function refitCamera(): void {
  if (introActive) return;
  if (elevationMap) {
    // Orbit around map center (0,0). Pan offset is screen-relative, rotated into world space.
    const angle = baseRotationRad + rotationRad;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const worldPanX = panOffsetX * cosA - panOffsetZ * sinA;
    const worldPanZ = panOffsetX * sinA + panOffsetZ * cosA;
    fitCameraToMap(elevationMap, angle, zoomLevel, true, tiltRad, worldPanX, worldPanZ);
  }
}

/** Start the intro camera sweep. Call once when the map first loads. */
export function startIntro(): void {
  introActive = true;
  introElapsed = 0;
  setLabelsEnabled(false);
}

/** Cancel the intro and snap to final position. */
function skipIntro(): void {
  introActive = false;
  setLabelsEnabled(true);
  refitCamera();
}

/**
 * Advance the intro animation. Call every frame from the render loop.
 * Phase 1 (0–SWEEP_DURATION): wide orbital sweep at stable zoom.
 * Phase 2 (SWEEP–end): dramatic zoom-in + tilt increase to final game view.
 */
export function tickIntro(dt: number): void {
  if (!introActive || !elevationMap) return;

  introElapsed += dt;

  if (introElapsed < SWEEP_DURATION) {
    // Phase 1: orbital sweep — constant speed
    const t = introElapsed / SWEEP_DURATION;
    const rotation = baseRotationRad + INTRO_EXTRA_ROTATION * (1 - t);
    const zoom = INTRO_START_ZOOM + (SWEEP_END_ZOOM - INTRO_START_ZOOM) * t;
    fitCameraToMap(elevationMap, rotation, zoom, true, DEFAULT_TILT_RAD);
  } else {
    // Phase 2: zoom in + tilt steeper + pan to deploy zone
    const t2 = Math.min((introElapsed - SWEEP_DURATION) / ZOOMIN_DURATION, 1);
    const eased2 = t2 * t2 * (3 - 2 * t2);
    zoomLevel = SWEEP_END_ZOOM + (FINAL_ZOOM - SWEEP_END_ZOOM) * eased2;
    tiltRad = DEFAULT_TILT_RAD + (FINAL_TILT_RAD - DEFAULT_TILT_RAD) * eased2;

    // Compute pan offset in screen-relative space (same as refitCamera uses)
    const angle = baseRotationRad + rotationRad;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const targetPanX = deployWorldX * cosA + deployWorldZ * sinA;
    const targetPanZ = -deployWorldX * sinA + deployWorldZ * cosA;
    panOffsetX = targetPanX * eased2;
    panOffsetZ = (targetPanZ + FINAL_PAN_BIAS_Z) * eased2;

    // Use the same path as refitCamera — stableFrustum: true
    const worldPanX = panOffsetX * cosA - panOffsetZ * sinA;
    const worldPanZ = panOffsetX * sinA + panOffsetZ * cosA;
    fitCameraToMap(elevationMap, angle, zoomLevel, true, tiltRad, worldPanX, worldPanZ);

    if (t2 >= 1) {
      introActive = false;
      setLabelsEnabled(true);
    }
  }
}

// ---------------------------------------------------------------------------
// Held-key tracking for smooth continuous movement
// ---------------------------------------------------------------------------

const heldKeys = new Set<string>();

/**
 * Tick camera pan/rotation from held keys. Call every frame with delta time.
 */
export function tickCamera(dt: number): void {
  if (introActive) return;

  let dirty = false;
  const panDelta = PAN_SPEED * dt;

  // Q/E: smooth rotation
  if (heldKeys.has('q')) { rotationRad -= ROTATION_SPEED * dt; dirty = true; }
  if (heldKeys.has('e')) { rotationRad += ROTATION_SPEED * dt; dirty = true; }

  // T/G: tilt (isometric angle)
  if (heldKeys.has('t')) { tiltRad = Math.min(tiltRad + TILT_SPEED * dt, MAX_TILT); dirty = true; }
  if (heldKeys.has('g')) { tiltRad = Math.max(tiltRad - TILT_SPEED * dt, MIN_TILT); dirty = true; }

  // W/S: forward/back (Z axis, W = forward)
  if (heldKeys.has('w')) { panOffsetZ += panDelta; dirty = true; }
  if (heldKeys.has('s')) { panOffsetZ -= panDelta; dirty = true; }

  // A/D: left/right (X axis)
  if (heldKeys.has('a')) { panOffsetX -= panDelta; dirty = true; }
  if (heldKeys.has('d')) { panOffsetX += panDelta; dirty = true; }

  if (dirty) refitCamera();
}

/**
 * Attach a ResizeObserver so the camera re-fits on viewport resize.
 * Also listens for Q/E keys to rotate the view, WASD for smooth pan.
 * Returns a cleanup function.
 */
export function setupStaticCamera(container: HTMLElement): () => void {
  let rafId = 0;

  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const ctx = getThreeContext();
      if (!ctx) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      resizeThreeRenderers(w, h);
      refitCamera();
    });
  });

  observer.observe(container);

  const onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();

    if (introActive) {
      skipIntro();
      return;
    }

    // Track held state for smooth pan + rotation
    if (['w', 'a', 's', 'd', 'q', 'e', 't', 'g'].includes(key)) {
      heldKeys.add(key);
      return;
    }

    switch (key) {
      case 'r': zoomLevel = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM); break;
      case 'f': zoomLevel = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM); break;
      default: return;
    }
    refitCamera();
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    heldKeys.delete(e.key.toLowerCase());
  };

  const onBlur = (): void => {
    heldKeys.clear();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return () => {
    cancelAnimationFrame(rafId);
    observer.disconnect();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    heldKeys.clear();
  };
}
