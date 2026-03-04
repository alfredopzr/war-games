export interface Camera {
  offsetX: number;
  offsetY: number;
}

const HUD_HEIGHT = 56;

export function createCamera(
  canvasWidth: number,
  canvasHeight: number,
  gridPixelWidth: number,
  gridPixelHeight: number,
): Camera {
  const visibleHeight = canvasHeight - HUD_HEIGHT;
  return {
    offsetX: (canvasWidth - gridPixelWidth) / 2,
    offsetY: HUD_HEIGHT + (visibleHeight - gridPixelHeight) / 2,
  };
}
