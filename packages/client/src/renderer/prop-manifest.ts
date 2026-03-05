import type { TerrainType, HexModifier } from '@hexwar/engine';

export interface PropDefinition {
  readonly id: string;
  readonly glbPath: string;
  readonly probability: number;
  readonly maxPerHex: number;
  readonly scaleRange: readonly [number, number];
}

const PLAINS_PROPS: readonly PropDefinition[] = [
  { id: 'dead_grass',    glbPath: '/models/props/prop_dead_grass.glb',    probability: 0.4,  maxPerHex: 2, scaleRange: [0.3, 0.5] },
  { id: 'rocks_small',   glbPath: '/models/props/prop_rocks_small.glb',   probability: 0.3,  maxPerHex: 2, scaleRange: [0.2, 0.4] },
  { id: 'road_stripe',   glbPath: '/models/props/prop_road_stripe.glb',   probability: 0.1,  maxPerHex: 1, scaleRange: [0.4, 0.6] },
  { id: 'concrete_pipe', glbPath: '/models/props/prop_concrete_pipe.glb', probability: 0.08, maxPerHex: 1, scaleRange: [0.3, 0.5] },
  { id: 'survey_stakes', glbPath: '/models/props/prop_survey_stakes.glb', probability: 0.08, maxPerHex: 1, scaleRange: [0.3, 0.4] },
  { id: 'tire',          glbPath: '/models/props/prop_tire.glb',          probability: 0.06, maxPerHex: 1, scaleRange: [0.2, 0.3] },
];

const FOREST_PROPS: readonly PropDefinition[] = [
  { id: 'tree_a',             glbPath: '/models/props/prop_tree_a.glb',             probability: 0.7,  maxPerHex: 1, scaleRange: [0.5, 0.8] },
  { id: 'tree_b',             glbPath: '/models/props/prop_tree_b.glb',             probability: 0.5,  maxPerHex: 1, scaleRange: [0.4, 0.7] },
  { id: 'tree_c',             glbPath: '/models/props/prop_tree_c.glb',             probability: 0.3,  maxPerHex: 1, scaleRange: [0.4, 0.6] },
  { id: 'fallen_log',         glbPath: '/models/props/prop_fallen_log.glb',         probability: 0.2,  maxPerHex: 1, scaleRange: [0.3, 0.5] },
  { id: 'road_sign',          glbPath: '/models/props/prop_road_sign.glb',          probability: 0.08, maxPerHex: 1, scaleRange: [0.3, 0.5] },
  { id: 'overgrown_footing',  glbPath: '/models/props/prop_overgrown_footing.glb',  probability: 0.1,  maxPerHex: 1, scaleRange: [0.3, 0.5] },
];

const MOUNTAIN_PROPS: readonly PropDefinition[] = [
  { id: 'rock_peak_a',    glbPath: '/models/props/prop_rock_peak_a.glb',    probability: 0.6, maxPerHex: 1, scaleRange: [0.6, 1.0] },
  { id: 'rock_peak_b',    glbPath: '/models/props/prop_rock_peak_b.glb',    probability: 0.4, maxPerHex: 1, scaleRange: [0.5, 0.8] },
  { id: 'rock_peak_c',    glbPath: '/models/props/prop_rock_peak_c.glb',    probability: 0.2, maxPerHex: 1, scaleRange: [0.4, 0.7] },
  { id: 'retaining_wall',  glbPath: '/models/props/prop_retaining_wall.glb', probability: 0.1, maxPerHex: 1, scaleRange: [0.4, 0.6] },
];

const CITY_PROPS: readonly PropDefinition[] = [
  { id: 'jersey_barrier', glbPath: '/models/props/prop_jersey_barrier.glb', probability: 0.3,  maxPerHex: 2, scaleRange: [0.2, 0.3] },
  { id: 'utility_pole',   glbPath: '/models/props/prop_utility_pole.glb',   probability: 0.2,  maxPerHex: 1, scaleRange: [0.4, 0.6] },
  { id: 'scaffolding',    glbPath: '/models/props/prop_scaffolding.glb',    probability: 0.15, maxPerHex: 1, scaleRange: [0.4, 0.6] },
  { id: 'dumpster',       glbPath: '/models/props/prop_dumpster.glb',       probability: 0.1,  maxPerHex: 1, scaleRange: [0.2, 0.3] },
];

export const PROP_MANIFEST: Record<TerrainType, readonly PropDefinition[]> = {
  plains: PLAINS_PROPS,
  forest: FOREST_PROPS,
  mountain: MOUNTAIN_PROPS,
  city: CITY_PROPS,
};

const RIVER_PROPS: readonly PropDefinition[] = [
  { id: 'water_reeds',   glbPath: '/models/props/prop_water_reeds.glb',   probability: 0.5, maxPerHex: 2, scaleRange: [0.3, 0.5] },
  { id: 'water_debris',  glbPath: '/models/props/prop_water_debris.glb',  probability: 0.2, maxPerHex: 1, scaleRange: [0.3, 0.4] },
];

const BRIDGE_PROPS: readonly PropDefinition[] = [
  { id: 'bridge_span',   glbPath: '/models/props/prop_bridge_span.glb',   probability: 1.0, maxPerHex: 1, scaleRange: [0.6, 0.8] },
];

const HIGHWAY_PROPS: readonly PropDefinition[] = [
  { id: 'road_guardrail', glbPath: '/models/props/prop_road_guardrail.glb', probability: 0.3, maxPerHex: 1, scaleRange: [0.3, 0.5] },
];

export const MODIFIER_PROPS: Partial<Record<HexModifier, readonly PropDefinition[]>> = {
  river: RIVER_PROPS,
  lake: RIVER_PROPS,
  bridge: BRIDGE_PROPS,
  highway: HIGHWAY_PROPS,
};

const TREE_IDS = new Set(['tree_a', 'tree_b', 'tree_c']);

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
  ].map((p) => p.glbPath)),
];
