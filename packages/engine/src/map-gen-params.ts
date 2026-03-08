// =============================================================================
// HexWar — Map Generation Parameters
// =============================================================================
// Every tunable value the procedural map generator needs. All exported as
// constants so the Monte Carlo harness can sweep them.
// =============================================================================

import type { TerrainType } from './types';

// -----------------------------------------------------------------------------
// §1 Map Shape & Size
// -----------------------------------------------------------------------------

/** Radius of the macro-grid in macro-hexes. Total macro-hexes = 3R²+3R+1. */
export const R_MACRO = 3;

/** Rings of mini-hexes per macro-hex. Total minis per macro = 3R²+3R+1. */
export const R_MINI = 5;

/** Cube distance between adjacent macro-hex centers: 2R+1. */
export const MACRO_SPACING = 2 * R_MINI + 1; // = 11 for R_MINI=5

// -----------------------------------------------------------------------------
// §2 Land Use Distribution
// -----------------------------------------------------------------------------

/** Target fraction of macro-hexes per terrain type. Must sum to 1.0. */
export const LAND_PCT_PLAINS = 0.35;
export const LAND_PCT_FOREST = 0.25;
export const LAND_PCT_MOUNTAIN = 0.25;
export const LAND_PCT_CITY = 0.15;

/** Acceptable deviation from target percentages (e.g. 0.1 = ±10%). */
export const LAND_PCT_TOLERANCE = 0.1;

/** Spatial frequency of terrain assignment noise. Low = large biomes. */
export const LAND_NOISE_FREQ = 0.15;

// -----------------------------------------------------------------------------
// §3 Land Use Adjacency Rules
// -----------------------------------------------------------------------------

/** Weight [0,1] for mountain clustering bonus in noise. */
export const MTN_CLUSTER_WEIGHT = 0.5;

/** Minimum macro-hex distance between city macro-hexes. */
export const CITY_MIN_MACRO_DIST = 2;

/** Weight [0,1] for forest-plains transition preference. */
export const FOREST_PLAINS_WEIGHT = 0.3;

// -----------------------------------------------------------------------------
// §4 Deploy Zones
// -----------------------------------------------------------------------------

/**
 * Corner indices (into CUBE_DIRECTIONS) for 2-player deploy zones.
 * Indices 0 and 3 are opposite corners of the hex boundary.
 */
export const DEPLOY_CORNERS_2P: readonly number[] = [0, 3];

/** Allowed terrain types in deploy zones. */
export const DEPLOY_TERRAIN: readonly TerrainType[] = ['plains', 'forest'];

/** Forced elevation in deploy zones. */
export const DEPLOY_ELEV = 0;

// -----------------------------------------------------------------------------
// §5 City Placement
// -----------------------------------------------------------------------------

/** Target number of city macro-hexes (including the center). */
export const CITY_COUNT = 5;

/** Minimum macro-hex distance between any two city macro-hex centers. */
export const CITY_MIN_DIST = 2;

/** Minimum macro-hex distance from any deploy zone macro-hex. */
export const CITY_MIN_DEPLOY_DIST = 2;

/** Maximum elevation for mini-hexes in a city macro-hex. */
export const CITY_ELEV_MAX = 1.0;

// -----------------------------------------------------------------------------
// §6 Mountain Elevation
// -----------------------------------------------------------------------------

/** Minimum peak height. */
export const MTN_PEAK_MIN = 8.0;

/** Maximum peak height. The tallest mountain on the map is forced to this. */
export const MTN_PEAK_MAX = 20.0;

/** Max cube distance from macro-hex center for peak placement. */
export const MTN_PEAK_OFFSET = 3;

/** Minimum elevation for any mini-hex in a mountain macro-hex. */
export const MTN_BASE_ELEV = 2.0;

/** Slope falloff exponent. 1=linear, 2=quadratic, 3=steep. */
export const MTN_FALLOFF_EXP = 2;

/** Number of noise octaves for directional slope variation. */
export const MTN_DIR_OCTAVES = 3;

/** How much direction affects slope (0=uniform, 1=very directional). */
export const MTN_DIR_AMP = 0.4;

/**
 * Standard deviation of per-hex slope roughness.
 * 0 = perfectly smooth mathematical falloff.
 * Higher = more jagged, realistic terrain.
 */
export const MTN_SLOPE_ROUGHNESS = 0.15;

/**
 * Autocorrelation of slope roughness [0, 1].
 * 0 = each hex independent (chaotic).
 * 1 = steep sections stay steep, gentle stays gentle (ridgelines/gullies).
 */
export const MTN_SLOPE_MOMENTUM = 0.7;

/** Noise frequency for slope roughness. Low = broad ridges, high = jagged. */
export const MTN_SLOPE_NOISE_FREQ = 0.4;

// -----------------------------------------------------------------------------
// §7 Non-Mountain Elevation
// -----------------------------------------------------------------------------

/** [min, max] elevation for plains mini-hexes. */
export const PLAINS_ELEV_RANGE: readonly [number, number] = [-0.5, 0.5];

/** [min, max] elevation for forest mini-hexes. */
export const FOREST_ELEV_RANGE: readonly [number, number] = [0.5, 3.0];

/** [min, max] elevation for city mini-hexes. */
export const CITY_ELEV_RANGE: readonly [number, number] = [0, 1.0];

/** Spatial frequency for non-mountain elevation noise. */
export const ELEV_NOISE_FREQ = 0.14;

/**
 * Smoothing iterations for elevation at macro-hex boundaries.
 * Each iteration blends boundary hexes toward their neighbors' average.
 * Low = sharp cliffs with slight taper. High = gradual foothills.
 */
export const ELEV_BOUNDARY_SMOOTH_PASSES = 4;

/** How many hex rings from a macro-hex boundary are affected by smoothing. */
export const ELEV_BOUNDARY_SMOOTH_DEPTH = 3;

// -----------------------------------------------------------------------------
// §9 Fairness Metrics
// -----------------------------------------------------------------------------

/** Max seed re-roll attempts before accepting best-effort map. */
export const MAX_REROLL = 10;

/** Max delta in average deploy-to-nearest-city distance (macro-hex units). */
export const FAIR_CITY_DIST_THRESHOLD = 1.0;

/** Max delta in accessible terrain composition ratio. */
export const FAIR_TERRAIN_MIX_THRESHOLD = 0.15;

/** Max delta in average A* path cost to cities. */
export const FAIR_PATH_COST_THRESHOLD = 3.0;

/** Max delta in cliff-wall edges facing each player's approach. */
export const FAIR_MTN_WALL_THRESHOLD = 3;

/** Max delta in city clustering bias. */
export const FAIR_CITY_CLUSTER_THRESHOLD = 0.2;

// -----------------------------------------------------------------------------
// §8 Hex Modifier Parameters (Rivers, Highways)
// -----------------------------------------------------------------------------

/** Enable river generation. */
export const RIVER_ENABLED = true;

/** Number of rivers to generate. */
export const RIVER_COUNT = 1;

/** Number of bridge crossing points per river. */
export const BRIDGES_PER_RIVER = 2;

/** Minimum hex distance between bridges on the same river. */
export const BRIDGE_MIN_SPACING = 5;

/** Minimum hex distance from any deploy zone hex for river placement. */
export const RIVER_DEPLOY_BUFFER = 8;

/** Minimum hexes in a river path. */
export const RIVER_MIN_LENGTH = 15;

/** Weight of steepest-descent vs perpendicular bias [0=pure perp, 1=pure downhill]. */
export const RIVER_DOWNHILL_WEIGHT = 0.7;

/** Random jitter amplitude for natural meandering. */
export const RIVER_MEANDER = 0.4;

/** Uphill tolerance per step — allows crossing micro-humps in flat terrain. */
export const RIVER_MIN_DROP = 0.1;

/** Radius of lake flood-fill when river hits a local minimum. */
export const RIVER_LAKE_RADIUS = 2;

/** Number of branches in a delta when river reaches flat lowlands. */
export const RIVER_DELTA_BRANCHES = 3;

/** Max length of each delta branch. */
export const RIVER_DELTA_MAX_LENGTH = 4;

/** Elevation threshold below which river terminates as delta. */
export const RIVER_DELTA_ELEV_THRESHOLD = 0;

/** Enable highway generation. */
export const HIGHWAY_ENABLED = true;

/** Number of city-to-city highway routes. */
export const HIGHWAY_COUNT = 2;

/** Max elevation delta between adjacent highway hexes. */
export const HIGHWAY_MAX_SLOPE = 0.5;

// -----------------------------------------------------------------------------
// §10 Elevation Movement
// -----------------------------------------------------------------------------

/** Extra movement cost per unit of uphill elevation delta. */
export const CLIMB_COST_PER_ELEV = 0.5;

/** Max elevation delta per step that any unit can traverse without climbing. */
export const CLIMB_THRESHOLD = 3;

/** Downhill cost multiplier (0 = free, 1 = same as flat). */
export const DOWNHILL_COST_MULT = 0;

// -----------------------------------------------------------------------------
// §11 Movement Range Scaling
// -----------------------------------------------------------------------------

/**
 * Movement range divisors per unit type.
 * moveRange = floor(mapDiameter / divisor)
 * Tuned so units feel distinct but none crosses the full map in one turn.
 */
export const MOVE_DIVISOR_INFANTRY = 8;
export const MOVE_DIVISOR_TANK = 7;
export const MOVE_DIVISOR_ARTILLERY = 12;
export const MOVE_DIVISOR_RECON = 5;
export const MOVE_DIVISOR_ENGINEER = 8;

/**
 * Vision range divisors per unit type.
 * visionRange = floor(mapDiameter / divisor)
 * Vision is slightly less than move range — you can almost see everywhere
 * you can reach, but not quite. Creates meaningful "push into the dark."
 * Recon is the exception: vision = move range (the scout fantasy).
 */
export const VISION_DIVISOR_INFANTRY = 11;
export const VISION_DIVISOR_TANK = 11;
export const VISION_DIVISOR_ARTILLERY = 15;
export const VISION_DIVISOR_RECON = 5;
export const VISION_DIVISOR_ENGINEER = 11;

/** Highways won't route through hexes above this elevation. */
export const HIGHWAY_MAX_ELEVATION = 2.0;

/** Smoothing passes to flatten highway hexes after route selection. */
export const HIGHWAY_SMOOTH_PASSES = 3;

// -----------------------------------------------------------------------------
// §12 Vision Parameters
// -----------------------------------------------------------------------------

/** Vision range penalty for units on forest hexes. */
export const FOREST_VISION_PENALTY = 2;

/** Eye-height offset for LoS. Raises the sight line so minor terrain bumps don't block. */
export const LOS_EYE_HEIGHT = 1.8;
