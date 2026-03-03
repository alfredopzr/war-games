export interface Camera {
  offsetX: number;
  offsetY: number;
}

export function createCamera(
  canvasWidth: number,
  canvasHeight: number,
  gridPixelWidth: number,
  gridPixelHeight: number,
): Camera {
  return {
    offsetX: (canvasWidth - gridPixelWidth) / 2,
    offsetY: (canvasHeight - gridPixelHeight) / 2,
  };
}
