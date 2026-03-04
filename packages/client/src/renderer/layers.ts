import { Application, Container } from 'pixi.js';

export let terrainLayer: Container;
export let deployZoneLayer: Container;
export let fogLayer: Container;
export let unitLayer: Container;
export let effectsLayer: Container;
export let objectiveLayer: Container;
export let uiLayer: Container;

export function setupLayers(app: Application): void {
  terrainLayer = new Container();
  deployZoneLayer = new Container();
  fogLayer = new Container();
  unitLayer = new Container();
  effectsLayer = new Container();
  objectiveLayer = new Container();
  uiLayer = new Container();

  terrainLayer.label = 'terrainLayer';
  deployZoneLayer.label = 'deployZoneLayer';
  fogLayer.label = 'fogLayer';
  unitLayer.label = 'unitLayer';
  effectsLayer.label = 'effectsLayer';
  objectiveLayer.label = 'objectiveLayer';
  uiLayer.label = 'uiLayer';

  app.stage.addChild(terrainLayer);
  app.stage.addChild(deployZoneLayer);
  app.stage.addChild(fogLayer);
  app.stage.addChild(unitLayer);
  app.stage.addChild(effectsLayer);
  app.stage.addChild(objectiveLayer);
  app.stage.addChild(uiLayer);
}
