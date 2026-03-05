import type { Application, Container } from 'pixi.js';

/* ── Types ────────────────────────────────────────────────────────── */

interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/* ── State ────────────────────────────────────────────────────────── */

let mapBounds: MapBounds | null = null;

/** World-space padding around the map edges. */
const PADDING = 20;

/* ── Public helpers ───────────────────────────────────────────────── */

export function setMapBounds(bounds: MapBounds): void {
  mapBounds = bounds;
}

/** Always returns false — no drag interaction with a static camera. */
export function wasDrag(): boolean {
  return false;
}

/**
 * Compute zoom and position so the full map fits in the viewport,
 * then apply to stage.
 */
export function fitCameraToMap(stage: Container, app: Application, bounds: MapBounds): void {
  // Force PixiJS to sync canvas size with its resizeTo container
  app.resize();

  const mapW = bounds.maxX - bounds.minX + PADDING * 2;
  const mapH = bounds.maxY - bounds.minY + PADDING * 2;

  const screenW = app.screen.width;
  const screenH = app.screen.height;

  const zoom = Math.min(screenW / mapW, screenH / mapH);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  stage.scale.set(zoom);
  stage.position.x = screenW / 2 - centerX * zoom;
  stage.position.y = screenH / 2 - centerY * zoom;
}

/* ── Setup ────────────────────────────────────────────────────────── */

/**
 * Attach a ResizeObserver so the camera re-fits on viewport resize.
 * Returns a cleanup function.
 */
export function setupStaticCamera(app: Application, stage: Container): () => void {
  const canvas = app.canvas as HTMLCanvasElement;
  const container = canvas.parentElement;
  let rafId = 0;

  const observer = new ResizeObserver(() => {
    // Wait one frame so PixiJS (resizeTo: container) updates app.screen first
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      if (mapBounds) {
        fitCameraToMap(stage, app, mapBounds);
      }
    });
  });

  // Observe the container, not the canvas — PixiJS controls the canvas size
  if (container) {
    observer.observe(container);
  }

  return () => {
    cancelAnimationFrame(rafId);
    observer.disconnect();
  };
}
