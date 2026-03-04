import type { Application, Container } from 'pixi.js';

/* ── Tuning constants ─────────────────────────────────────────────── */

const PAN_SPEED = 8;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.05;
const INITIAL_ZOOM = 1.5;

/** How fast the camera lerps toward its target (0–1, higher = faster). */
const ZOOM_LERP = 0.12;
const PAN_LERP = 0.18;

/** World-space padding around the map before hitting the hard clamp. */
const BOUNDARY_PADDING = 40;

/** Pixels the mouse must move before a click becomes a drag. */
const DRAG_THRESHOLD = 5;

/* ── Types ────────────────────────────────────────────────────────── */

interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface CameraState {
  keysDown: Set<string>;
  /** Whether a mouse button is held (pending or active drag). */
  mouseDown: boolean;
  /** True once the mouse has moved past DRAG_THRESHOLD. */
  isDragging: boolean;
  /** Start position of the current mouse-down for threshold check. */
  dragStartX: number;
  dragStartY: number;
  lastMouseX: number;
  lastMouseY: number;
  mouseX: number;
  mouseY: number;
  mapBounds: MapBounds | null;
  /** Set to true after a drag; cleared on next mousedown. */
  didDrag: boolean;

  /** Smoothed zoom — the scale we're lerping toward. */
  targetZoom: number;
  /** World-space point we're zooming toward (keeps cursor stable). */
  zoomFocusWorldX: number;
  zoomFocusWorldY: number;
  /** Screen-space position of the zoom focus point. */
  zoomFocusScreenX: number;
  zoomFocusScreenY: number;

  /** Smoothed pan targets. */
  targetPosX: number;
  targetPosY: number;
}

const state: CameraState = {
  keysDown: new Set(),
  mouseDown: false,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  lastMouseX: 0,
  lastMouseY: 0,
  mouseX: 0,
  mouseY: 0,
  mapBounds: null,
  didDrag: false,

  targetZoom: INITIAL_ZOOM,
  zoomFocusWorldX: 0,
  zoomFocusWorldY: 0,
  zoomFocusScreenX: 0,
  zoomFocusScreenY: 0,

  targetPosX: 0,
  targetPosY: 0,
};

/* ── Public helpers ───────────────────────────────────────────────── */

export function setMapBounds(bounds: MapBounds): void {
  state.mapBounds = bounds;
}

/** Returns true if the last mouse interaction was a drag (not a click). */
export function wasDrag(): boolean {
  return state.didDrag;
}

export function centerCameraOnMap(stage: Container, app: Application, bounds: MapBounds): void {
  const mapW = bounds.maxX - bounds.minX + BOUNDARY_PADDING * 2;
  const mapH = bounds.maxY - bounds.minY + BOUNDARY_PADDING * 2;

  const screenW = app.screen.width;
  const screenH = app.screen.height;

  // Fit the entire map in the viewport, capped at MAX_ZOOM
  const zoom = Math.min(screenW / mapW, screenH / mapH, MAX_ZOOM);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  const posX = screenW / 2 - centerX * zoom;
  const posY = screenH / 2 - centerY * zoom;

  stage.scale.set(zoom);
  stage.position.x = posX;
  stage.position.y = posY;

  state.targetZoom = zoom;
  state.targetPosX = posX;
  state.targetPosY = posY;
}

/* ── Clamping ─────────────────────────────────────────────────────── */

function clampValue(posX: number, posY: number, scale: number, screenW: number, screenH: number): { x: number; y: number } {
  if (!state.mapBounds) return { x: posX, y: posY };

  const b = state.mapBounds;
  const worldLeft = b.minX - BOUNDARY_PADDING;
  const worldRight = b.maxX + BOUNDARY_PADDING;
  const worldTop = b.minY - BOUNDARY_PADDING;
  const worldBottom = b.maxY + BOUNDARY_PADDING;

  const mapPixelW = (worldRight - worldLeft) * scale;
  const mapPixelH = (worldBottom - worldTop) * scale;

  let x = posX;
  let y = posY;

  if (mapPixelW <= screenW) {
    // Map fits on screen — center it
    x = (screenW - mapPixelW) / 2 - worldLeft * scale;
  } else {
    // Map wider than screen — don't show past edges
    const maxX = -worldLeft * scale;
    const minX = screenW - worldRight * scale;
    x = Math.max(minX, Math.min(maxX, x));
  }

  if (mapPixelH <= screenH) {
    y = (screenH - mapPixelH) / 2 - worldTop * scale;
  } else {
    const maxY = -worldTop * scale;
    const minY = screenH - worldBottom * scale;
    y = Math.max(minY, Math.min(maxY, y));
  }

  return { x, y };
}

function clampTargets(screenW: number, screenH: number): void {
  const clamped = clampValue(state.targetPosX, state.targetPosY, state.targetZoom, screenW, screenH);
  state.targetPosX = clamped.x;
  state.targetPosY = clamped.y;
}

/* ── Lerp utility ─────────────────────────────────────────────────── */

function lerp(current: number, target: number, t: number): number {
  const diff = target - current;
  if (Math.abs(diff) < 0.5) return target; // snap when close enough
  return current + diff * t;
}

/* ── Setup ────────────────────────────────────────────────────────── */

export function setupCameraControls(app: Application, stage: Container): () => void {
  const canvas = app.canvas as HTMLCanvasElement;

  // Sync targets to current stage position
  state.targetPosX = stage.position.x;
  state.targetPosY = stage.position.y;
  state.targetZoom = stage.scale.x;

  /* ── Keyboard ────────────────────────────────────────────────── */

  const onKeyDown = (e: KeyboardEvent): void => {
    state.keysDown.add(e.key);
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    state.keysDown.delete(e.key);
  };

  /* ── Mouse drag pan ──────────────────────────────────────────── */

  const onMouseDown = (e: MouseEvent): void => {
    state.mouseDown = true;
    state.isDragging = false;
    state.didDrag = false;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;

    // Prevent default for middle-click (avoids auto-scroll icon)
    if (e.button === 1) e.preventDefault();
  };

  const onMouseUp = (): void => {
    if (state.isDragging) {
      state.didDrag = true;
    }
    state.mouseDown = false;
    state.isDragging = false;
  };

  const onMouseMove = (e: MouseEvent): void => {
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;

    if (state.mouseDown) {
      // Check if we've passed the drag threshold
      if (!state.isDragging) {
        const distX = Math.abs(e.clientX - state.dragStartX);
        const distY = Math.abs(e.clientY - state.dragStartY);
        if (distX > DRAG_THRESHOLD || distY > DRAG_THRESHOLD) {
          state.isDragging = true;
        } else {
          return;
        }
      }

      const dx = e.clientX - state.lastMouseX;
      const dy = e.clientY - state.lastMouseY;

      state.targetPosX += dx;
      state.targetPosY += dy;

      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;

      clampTargets(app.screen.width, app.screen.height);
    }
  };

  /* ── Scroll wheel zoom ──────────────────────────────────────── */

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();

    const direction = e.deltaY < 0 ? 1 : -1;
    const oldTarget = state.targetZoom;
    const newTarget = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldTarget + direction * ZOOM_STEP));

    // Compute world point under cursor (using current *target* values so
    // consecutive scroll ticks accumulate correctly)
    const worldX = (e.clientX - state.targetPosX) / oldTarget;
    const worldY = (e.clientY - state.targetPosY) / oldTarget;

    state.targetZoom = newTarget;

    // Adjust target position so the world point stays under the cursor
    state.targetPosX = e.clientX - worldX * newTarget;
    state.targetPosY = e.clientY - worldY * newTarget;

    clampTargets(app.screen.width, app.screen.height);
  };

  /* ── Context menu ────────────────────────────────────────────── */

  const onContextMenu = (e: MouseEvent): void => {
    if (state.isDragging) {
      e.preventDefault();
    }
  };

  /* ── Per-frame tick ──────────────────────────────────────────── */

  const tickerCallback = (): void => {
    const screenW = app.screen.width;
    const screenH = app.screen.height;

    // Keyboard pan — adjust targets
    let dx = 0;
    let dy = 0;
    if (state.keysDown.has('w') || state.keysDown.has('ArrowUp')) dy += PAN_SPEED;
    if (state.keysDown.has('s') || state.keysDown.has('ArrowDown')) dy -= PAN_SPEED;
    if (state.keysDown.has('a') || state.keysDown.has('ArrowLeft')) dx += PAN_SPEED;
    if (state.keysDown.has('d') || state.keysDown.has('ArrowRight')) dx -= PAN_SPEED;

    if (dx !== 0 || dy !== 0) {
      state.targetPosX += dx;
      state.targetPosY += dy;
      clampTargets(screenW, screenH);
    }

    // Lerp actual stage values toward targets
    const currentZoom = stage.scale.x;
    const newZoom = lerp(currentZoom, state.targetZoom, ZOOM_LERP);

    if (newZoom !== currentZoom) {
      // Keep the screen center stable while zooming smoothly
      const cx = screenW / 2;
      const cy = screenH / 2;
      const worldCX = (cx - stage.position.x) / currentZoom;
      const worldCY = (cy - stage.position.y) / currentZoom;

      stage.scale.set(newZoom);

      // Re-derive position so the center stays fixed, then lerp that too
      const idealX = cx - worldCX * newZoom;
      const idealY = cy - worldCY * newZoom;
      stage.position.x = idealX;
      stage.position.y = idealY;

      // Also lerp toward the *target* position to honor cursor-anchored zoom
      stage.position.x = lerp(stage.position.x, state.targetPosX, ZOOM_LERP);
      stage.position.y = lerp(stage.position.y, state.targetPosY, ZOOM_LERP);
    } else {
      stage.position.x = lerp(stage.position.x, state.targetPosX, PAN_LERP);
      stage.position.y = lerp(stage.position.y, state.targetPosY, PAN_LERP);
    }

    // Hard-clamp the actual position every frame
    const clamped = clampValue(stage.position.x, stage.position.y, stage.scale.x, screenW, screenH);
    stage.position.x = clamped.x;
    stage.position.y = clamped.y;
  };

  /* ── Event binding ───────────────────────────────────────────── */

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  app.ticker.add(tickerCallback);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
    app.ticker.remove(tickerCallback);
  };
}
