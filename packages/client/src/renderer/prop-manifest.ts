import type { TerrainType, HexModifier } from '@hexwar/engine';

export interface PropDefinition {
  readonly id: string;
  readonly glbPath: string;
  readonly probability: number;
  readonly maxPerHex: number;
  readonly scaleRange: readonly [number, number];
  /** Model-space Y minimum — used to shift the prop up so its base sits on the hex surface. */
  readonly yMin: number;
}

export interface SurfacePropDefinition {
  readonly id: string;
  readonly glbPath: string;
  readonly scale: number;
  readonly directional: boolean;
  /** X-axis rotation to lay asset flat (sign depends on authoring convention). */
  readonly xRot: number;
}

const PLAINS_PROPS: readonly PropDefinition[] = [];

const FOREST_PROPS: readonly PropDefinition[] = [
  { id: 'tree_d', glbPath: '/models/props/prop_tree_d.glb', probability: 0.9, maxPerHex: 4, scaleRange: [0.3, 0.8], yMin: -0.689 },
  { id: 'tree_b', glbPath: '/models/props/prop_tree_b.glb', probability: 0.5, maxPerHex: 2, scaleRange: [0.7, 1.8], yMin: -1.0 },
  { id: 'tree_c', glbPath: '/models/props/prop_tree_c.glb', probability: 0.2, maxPerHex: 1, scaleRange: [0.4, 1.2], yMin: -0.567 },
  { id: 'tree_a', glbPath: '/models/props/prop_tree_a.glb', probability: 0.06, maxPerHex: 1, scaleRange: [1.0, 2.4], yMin: -0.972 },
];

const MOUNTAIN_PROPS: readonly PropDefinition[] = [];

const CITY_PROPS: readonly PropDefinition[] = [];

export const PROP_MANIFEST: Record<TerrainType, readonly PropDefinition[]> = {
  plains: PLAINS_PROPS,
  forest: FOREST_PROPS,
  mountain: MOUNTAIN_PROPS,
  city: CITY_PROPS,
};

const RIVER_PROPS: readonly PropDefinition[] = [];

const BRIDGE_PROPS: readonly PropDefinition[] = [];

const HIGHWAY_PROPS: readonly PropDefinition[] = [];

export const MODIFIER_PROPS: Partial<Record<HexModifier, readonly PropDefinition[]>> = {
  river: RIVER_PROPS,
  lake: RIVER_PROPS,
  bridge: BRIDGE_PROPS,
  highway: HIGHWAY_PROPS,
};

export const SURFACE_PROPS: Partial<Record<HexModifier, SurfacePropDefinition>> = {
  bridge:  { id: 'bridge_deck',   glbPath: '/models/props/prop_bridge_deck.glb',   scale: 1.0, directional: true,  xRot: Math.PI / 2 },
};

const TREE_IDS = new Set(['tree_a', 'tree_b', 'tree_c', 'tree_d']);

export function isTreeProp(id: string): boolean {
  return TREE_IDS.has(id);
}

export const ALL_PROP_PATHS: readonly string[] = [
  ...new Set([
    ...PLAINS_PROPS,
    ...FOREST_PROPS,
    ...MOUNTAIN_PROPS,
    ...CITY_PROPS,
    ...RIVER_PROPS,
    ...BRIDGE_PROPS,
    ...HIGHWAY_PROPS,
  ].map((p) => p.glbPath).concat(
    Object.values(SURFACE_PROPS).map((s) => s!.glbPath),
  )),
];
