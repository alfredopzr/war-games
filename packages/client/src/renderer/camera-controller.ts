import type { Application, Container } from 'pixi.js';

const PAN_SPEED = 8;
const EDGE_SCROLL_MARGIN = 30;
const EDGE_SCROLL_SPEED = 6;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface CameraState {
  keysDown: Set<string>;
  isDragging: boolean;
  lastMouseX: number;
  lastMouseY: number;
  mouseX: number;
  mouseY: number;
  mapBounds: MapBounds | null;
}

const state: CameraState = {
  keysDown: new Set(),
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  mouseX: 0,
  mouseY: 0,
  mapBounds: null,
};

export function setMapBounds(bounds: MapBounds): void {
  state.mapBounds = bounds;
}

export function centerCameraOnMap(stage: Container, app: Application, bounds: MapBounds): void {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  stage.position.x = app.screen.width / 2 - centerX * stage.scale.x;
  stage.position.y = app.screen.height / 2 - centerY * stage.scale.y;
}

function clampCamera(stage: Container, screenWidth: number, screenHeight: number): void {
  if (!state.mapBounds) return;
  const scale = stage.scale.x;
  const b = state.mapBounds;
  const padding = 100;

  const worldLeft = b.minX - padding;
  const worldRight = b.maxX + padding;
  const worldTop = b.minY - padding;
  const worldBottom = b.maxY + padding;

  // Don't let the viewport show empty space beyond the map
  const maxPosX = -worldLeft * scale + screenWidth * 0.1;
  const minPosX = -worldRight * scale + screenWidth * 0.9;
  const maxPosY = -worldTop * scale + screenHeight * 0.1;
  const minPosY = -worldBottom * scale + screenHeight * 0.9;

  if (maxPosX > minPosX) {
    stage.position.x = Math.max(minPosX, Math.min(maxPosX, stage.position.x));
  }
  if (maxPosY > minPosY) {
    stage.position.y = Math.max(minPosY, Math.min(maxPosY, stage.position.y));
  }
}

export function setupCameraControls(app: Application, stage: Container): () => void {
  const canvas = app.canvas as HTMLCanvasElement;

  const onKeyDown = (e: KeyboardEvent): void => {
    state.keysDown.add(e.key);
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    state.keysDown.delete(e.key);
  };

  const onMouseDown = (e: MouseEvent): void => {
    // Middle mouse or right mouse to drag
    if (e.button === 1 || e.button === 2) {
      state.isDragging = true;
      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;
      e.preventDefault();
    }
  };

  const onMouseUp = (e: MouseEvent): void => {
    if (e.button === 1 || e.button === 2) {
      state.isDragging = false;
    }
  };

  const onMouseMove = (e: MouseEvent): void => {
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;

    if (state.isDragging) {
      const dx = e.clientX - state.lastMouseX;
      const dy = e.clientY - state.lastMouseY;
      stage.position.x += dx;
      stage.position.y += dy;
      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;
      clampCamera(stage, app.screen.width, app.screen.height);
    }
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    const oldScale = stage.scale.x;
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldScale + direction * ZOOM_STEP));

    // Zoom toward mouse position
    const mouseWorldX = (e.clientX - stage.position.x) / oldScale;
    const mouseWorldY = (e.clientY - stage.position.y) / oldScale;

    stage.scale.set(newScale);
    stage.position.x = e.clientX - mouseWorldX * newScale;
    stage.position.y = e.clientY - mouseWorldY * newScale;
    clampCamera(stage, app.screen.width, app.screen.height);
  };

  const onContextMenu = (e: MouseEvent): void => {
    // Only prevent default when drag-panning; let game handle contextmenu otherwise
    if (state.isDragging) {
      e.preventDefault();
    }
  };

  // Per-frame update for keyboard pan and edge scrolling
  const tickerCallback = (): void => {
    let dx = 0;
    let dy = 0;

    // WASD / arrow keys
    if (state.keysDown.has('w') || state.keysDown.has('ArrowUp')) dy += PAN_SPEED;
    if (state.keysDown.has('s') || state.keysDown.has('ArrowDown')) dy -= PAN_SPEED;
    if (state.keysDown.has('a') || state.keysDown.has('ArrowLeft')) dx += PAN_SPEED;
    if (state.keysDown.has('d') || state.keysDown.has('ArrowRight')) dx -= PAN_SPEED;

    // Edge scrolling
    const sw = app.screen.width;
    const sh = app.screen.height;
    if (state.mouseX < EDGE_SCROLL_MARGIN) dx += EDGE_SCROLL_SPEED;
    if (state.mouseX > sw - EDGE_SCROLL_MARGIN) dx -= EDGE_SCROLL_SPEED;
    if (state.mouseY < EDGE_SCROLL_MARGIN) dy += EDGE_SCROLL_SPEED;
    if (state.mouseY > sh - EDGE_SCROLL_MARGIN) dy -= EDGE_SCROLL_SPEED;

    if (dx !== 0 || dy !== 0) {
      stage.position.x += dx;
      stage.position.y += dy;
      clampCamera(stage, sw, sh);
    }
  };

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
