import { Application } from 'pixi.js';

let pixiApp: Application | null = null;

export async function initPixiApp(container: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    background: 0x000000,
    resizeTo: container,
    antialias: true,
  });
  container.appendChild(app.canvas);
  pixiApp = app;
  return app;
}

export function getPixiApp(): Application {
  if (!pixiApp) {
    throw new Error('PixiJS app not initialized — call initPixiApp first');
  }
  return pixiApp;
}

export function destroyPixiApp(): void {
  if (pixiApp) {
    pixiApp.destroy(true, { children: true });
    pixiApp = null;
  }
}
