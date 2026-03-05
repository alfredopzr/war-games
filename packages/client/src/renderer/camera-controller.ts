import { getThreeContext, fitCameraToMap, resizeThreeRenderers } from './three-scene';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let elevationMap: Map<string, number> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Always returns false — no drag interaction with a static camera. */
export function wasDrag(): boolean {
  return false;
}

/** Store map parameters so resize can refit the camera. */
export function setMapParams(elev: Map<string, number>): void {
  elevationMap = elev;
}

/** Refit camera to current map. Call after map data is available. */
export function refitCamera(): void {
  if (elevationMap) {
    fitCameraToMap(elevationMap);
  }
}

/**
 * Attach a ResizeObserver so the camera re-fits on viewport resize.
 * Also resizes the Three.js renderers. Returns a cleanup function.
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

  return () => {
    cancelAnimationFrame(rafId);
    observer.disconnect();
  };
}
