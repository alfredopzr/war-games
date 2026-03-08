// =============================================================================
// HexWar — AI vs AI Headless Match Runner
// =============================================================================
// Runs N headless matches between two AI instances for balance data.
// All MATH_AUDIT data is extracted directly from state.pendingEvents —
// the typed event log produced by the resolution pipeline.
// =============================================================================

import type {
  GameState,
  PlayerId,
  UnitType,
  TerrainType,
  CubeCoord,
  ApproachCategory,
  AttackDirective,
} from './types';
import { createGame, placeUnit, startBattlePhase, checkRoundEnd, scoreRound } from './game-state';
import { aiBuildPhase, aiBattlePhase } from './ai';
import { resolveTurn } from './resolution-pipeline';
import { createCommandPool } from './commands';
import { mulberry32 } from './rng';
import { resetUnitIdCounter } from './units';
import { cubeDistance, hexToKey, keyToHex, hexNeighbors } from './hex';
import { findPath } from './pathfinding';
import { computeMovementCostField } from './pathfinding';
import { calculateVisibility } from './vision';
import { COMBAT_RNG_MIN, COMBAT_RNG_RANGE } from './combat';
import { calculateIncome, CITY_INCOME } from './economy';

// =============================================================================
// Types
// =============================================================================

export type KillVerdict = 'TOO_FAST' | 'OK' | 'TOO_SLOW';

export interface KillRecord {
  readonly attackerType: UnitType;
  readonly defenderType: UnitType;
  readonly typeAdvantage: number;
  readonly hitCount: number;
  readonly verdict: KillVerdict;
  readonly terrain: string;
  readonly approach: ApproachCategory;
  readonly attackerROE: AttackDirective;
  readonly round: number;
  readonly turn: number;
}

export interface RoundResult {
  readonly roundNumber: number;
  readonly winner: PlayerId | null;
  readonly reason: 'king-of-the-hill' | 'elimination' | 'turn-limit' | null;
  readonly turns: number;
  readonly p1Kills: number;
  readonly p2Kills: number;
  readonly p1UnitsAlive: number;
  readonly p2UnitsAlive: number;
  readonly kothTurnsHeld: number;
}

export type MapValidityClass = 'VALID' | 'DEGRADED' | 'BROKEN';

export interface MapValidity {
  readonly classification: MapValidityClass;
  readonly p1ReachableCities: number;
  readonly p2ReachableCities: number;
  readonly totalCities: number;
  readonly p1DeployExits: number;
  readonly p2DeployExits: number;
  readonly p1AvgCityCost: number;
  readonly p2AvgCityCost: number;
}

export interface MatchResult {
  readonly seed: number;
  readonly winner: PlayerId | null; // null = draw
  readonly rounds: number;
  readonly totalTurns: number;
  readonly kills: KillRecord[];
  readonly roundResults: RoundResult[];
  readonly p1FinalUnits: number;
  readonly p2FinalUnits: number;
  readonly mapValidity: MapValidity;
}

export interface BatchOptions {
  readonly matchCount: number;
  readonly baseSeed: number;
}

export interface MatchupVerdictCounts {
  readonly TOO_FAST: number;
  readonly OK: number;
  readonly TOO_SLOW: number;
  readonly total: number;
}

export interface BatchSummary {
  readonly matchCount: number;
  readonly p1Wins: number;
  readonly p2Wins: number;
  readonly draws: number;
  readonly p1WinRate: number;
  readonly p2WinRate: number;
  readonly drawRate: number;
  readonly avgTurns: number;
  readonly minTurns: number;
  readonly maxTurns: number;
  readonly results: MatchResult[];
  readonly matchupVerdicts: Record<string, MatchupVerdictCounts>;
  readonly playedMatches: number;
  readonly validMaps: number;
  readonly degradedMaps: number;
  readonly brokenMaps: number;
}

// =============================================================================
// Match Runner
// =============================================================================

const MAX_TURNS_PER_ROUND = 50;

export function runMatch(seed: number, log = false): MatchResult {
  resetUnitIdCounter();
  const rng = mulberry32(seed);
  const combatRng = (): number => COMBAT_RNG_MIN + rng() * COMBAT_RNG_RANGE;

  const state = createGame(seed);
  const tValidity = performance.now();
  const mapValidity = computeMapValidity(state);
  const validityMs = performance.now() - tValidity;

  if (log) {
    console.log(
      `[MATH_AUDIT] MAP_VALIDITY` +
      `  class:${mapValidity.classification}` +
      `  p1_reachable:${mapValidity.p1ReachableCities}/${mapValidity.totalCities}` +
      `  p2_reachable:${mapValidity.p2ReachableCities}/${mapValidity.totalCities}` +
      `  p1_exits:${mapValidity.p1DeployExits}` +
      `  p2_exits:${mapValidity.p2DeployExits}` +
      `  p1_avg_cost:${mapValidity.p1AvgCityCost.toFixed(1)}` +
      `  p2_avg_cost:${mapValidity.p2AvgCityCost.toFixed(1)}` +
      `  ms:${validityMs.toFixed(1)}`,
    );

    // MAP-03..11: Additional map diagnostic metrics
    logMapDiagnostics(state);
  }

  if (mapValidity.classification === 'BROKEN') {
    return {
      seed,
      winner: null,
      rounds: 0,
      totalTurns: 0,
      kills: [],
      roundResults: [],
      p1FinalUnits: 0,
      p2FinalUnits: 0,
      mapValidity,
    };
  }

  const kills: KillRecord[] = [];
  const roundResults: RoundResult[] = [];
  let totalTurns = 0;
  const totalHexes = state.map.terrain.size;

  // VIS-02: First contact tracking
  let p1FirstContact = -1;
  let p2FirstContact = -1;

  while (state.phase !== 'game-over') {
    // ----- Build Phase -----
    // Each player gets an independent RNG fork from the same sub-seed so both
    // select the same preset index — true mirror match, no P1-first bias.
    const buildSeed = Math.floor(rng() * 0x7fffffff);
    const p1BuildRng = mulberry32(buildSeed);
    const p2BuildRng = mulberry32(buildSeed);
    runBuildPhase(state, 'player1', p1BuildRng);
    runBuildPhase(state, 'player2', p2BuildRng);
    startBattlePhase(state);

    if (log) {
      const p1Units = state.players.player1.units;
      const p2Units = state.players.player2.units;
      const dep1 = state.map.player1Deployment[0];
      const dep2 = state.map.player2Deployment[0];
      const deployDist = dep1 && dep2 ? cubeDistance(dep1, dep2) : 0;
      console.log(
        `[MATH_AUDIT] MATCH_START  seed:${seed}  mapRadius:${state.map.mapRadius}  deployDist:${deployDist}` +
        `  p1Units:${p1Units.length}  p2Units:${p2Units.length}`,
      );
      logComposition(log, 'player1', p1Units.map((u) => u.type));
      logComposition(log, 'player2', p2Units.map((u) => u.type));
    }

    let roundTurns = 0;
    // hits[defenderId] = { count, attackerType (of most recent hit) }
    let hitsPerUnit = new Map<string, { count: number }>();
    let kothTurnsHeld = 0;

    // ----- Battle Phase -----
    while (state.phase === 'battle') {
      roundTurns++;
      totalTurns++;

      if (roundTurns > MAX_TURNS_PER_ROUND) {
        throw new Error(`Round ${state.round.roundNumber} exceeded ${MAX_TURNS_PER_ROUND} turns`);
      }

      const p1Cmds = aiBattlePhase(state, 'player1');
      const p2Cmds = aiBattlePhase(state, 'player2');

      state.round.commandPools = {
        player1: createCommandPool(),
        player2: createCommandPool(),
      };

      resolveTurn(state, p1Cmds, p2Cmds, combatRng);

      // ---- Read from the event log ----
      for (const event of state.pendingEvents) {
        // Track hits for kill timing (any hit event increments the counter)
        if (event.type === 'damage' || event.type === 'counter' || event.type === 'intercept') {
          const existing = hitsPerUnit.get(event.defenderId);
          if (existing) {
            existing.count++;
          } else {
            hitsPerUnit.set(event.defenderId, { count: 1 });
          }
        }

        if (event.type === 'kill') {
          const hits = hitsPerUnit.get(event.defenderId);
          // kill event itself is the final hit; prior hits may be 0 if one-shot
          const hitCount = hits ? hits.count + 1 : 1;
          const verdict: KillVerdict =
            hitCount < event.expectedHitsMin ? 'TOO_FAST' :
            hitCount > event.expectedHitsMax ? 'TOO_SLOW' :
            'OK';

          const record: KillRecord = {
            attackerType: event.attackerType,
            defenderType: event.defenderType,
            typeAdvantage: event.typeAdvantage,
            hitCount,
            verdict,
            terrain: event.defenderTerrain,
            approach: event.approachCategory,
            attackerROE: event.attackerAttackDirective,
            round: state.round.roundNumber,
            turn: roundTurns,
          };
          kills.push(record);

          if (log) {
            console.log(
              `[MATH_AUDIT] KILL` +
              `  attacker:${record.attackerType}` +
              `  defender:${record.defenderType}` +
              `  type_adv:${record.typeAdvantage}` +
              `  hits:${record.hitCount}` +
              `  terrain:${record.terrain}` +
              `  approach:${record.approach}` +
              `  roe:${record.attackerROE}` +
              `  verdict:${record.verdict}`,
            );
          }

          hitsPerUnit.delete(event.defenderId);
        }

        if (event.type === 'koth-progress') {
          kothTurnsHeld = event.turnsHeld;
        }
      }

      // VIS-01: Map coverage per turn
      if (log) {
        const p1Vis = calculateVisibility(
          state.players.player1.units,
          state.map.terrain,
          state.map.elevation,
          state.unitStats,
        );
        const p2Vis = calculateVisibility(
          state.players.player2.units,
          state.map.terrain,
          state.map.elevation,
          state.unitStats,
        );
        const p1Pct = ((p1Vis.size / totalHexes) * 100).toFixed(1);
        const p2Pct = ((p2Vis.size / totalHexes) * 100).toFixed(1);
        console.log(
          `[MATH_AUDIT] VISION  turn:${totalTurns}  p1_coverage:${p1Pct}%  p2_coverage:${p2Pct}%`,
        );

        // VIS-02: First contact — check if either player sees an enemy unit
        if (p1FirstContact < 0) {
          for (const enemy of state.players.player2.units) {
            if (p1Vis.has(hexToKey(enemy.position))) {
              p1FirstContact = totalTurns;
              break;
            }
          }
        }
        if (p2FirstContact < 0) {
          for (const enemy of state.players.player1.units) {
            if (p2Vis.has(hexToKey(enemy.position))) {
              p2FirstContact = totalTurns;
              break;
            }
          }
        }
      }

      const roundEnd = checkRoundEnd(state);
      if (roundEnd.roundOver) {
        const p1Alive = state.players.player1.units.length;
        const p2Alive = state.players.player2.units.length;
        const p1Kills = state.round.unitsKilledThisRound.player1;
        const p2Kills = state.round.unitsKilledThisRound.player2;

        if (log) {
          console.log(
            `[MATH_AUDIT] ROUND_END` +
            `  round:${state.round.roundNumber}` +
            `  winner:${roundEnd.winner}` +
            `  reason:${roundEnd.reason}` +
            `  turns:${roundTurns}` +
            `  kothHeld:${kothTurnsHeld}` +
            `  p1Kills:${p1Kills}  p2Kills:${p2Kills}` +
            `  p1Alive:${p1Alive}  p2Alive:${p2Alive}`,
          );

          // ECN-01 + ECN-05: Economy breakdown per player
          for (const pid of ['player1', 'player2'] as const) {
            let citiesHeld = 0;
            for (const owner of state.cityOwnership.values()) {
              if (owner === pid) citiesHeld++;
            }
            const wonRound = roundEnd.winner === pid;
            const lostRound = roundEnd.winner !== null && roundEnd.winner !== pid;
            const totalInc = calculateIncome({
              citiesHeld,
              unitsKilled: state.round.unitsKilledThisRound[pid],
              wonRound,
              lostRound,
            });
            const cityInc = citiesHeld * CITY_INCOME;
            const cityShare = totalInc > 0 ? ((cityInc / totalInc) * 100).toFixed(1) : '0.0';
            console.log(
              `[MATH_AUDIT] ECONOMY  player:${pid}  total:${totalInc}  cities:${citiesHeld}  city_share:${cityShare}%`,
            );
          }
        }

        roundResults.push({
          roundNumber: state.round.roundNumber,
          winner: roundEnd.winner,
          reason: roundEnd.reason,
          turns: roundTurns,
          p1Kills,
          p2Kills,
          p1UnitsAlive: p1Alive,
          p2UnitsAlive: p2Alive,
          kothTurnsHeld,
        });

        scoreRound(state, roundEnd.winner);
        hitsPerUnit = new Map();
        kothTurnsHeld = 0;
      }
    }
  }

  const winner = state.winner; // null = draw (all rounds exhausted with no decisive winner)

  const p1Final = state.players.player1.units.length;
  const p2Final = state.players.player2.units.length;

  if (log) {
    // VIS-02: First contact
    console.log(
      `[MATH_AUDIT] FIRST_CONTACT  p1_sees_p2:turn${p1FirstContact}  p2_sees_p1:turn${p2FirstContact}`,
    );

    console.log(
      `[MATH_AUDIT] MATCH_END` +
      `  seed:${seed}` +
      `  winner:${winner}` +
      `  rounds:${roundResults.length}` +
      `  totalTurns:${totalTurns}` +
      `  kills:${kills.length}` +
      `  p1Alive:${p1Final}  p2Alive:${p2Final}`,
    );
  }

  return { seed, winner, rounds: roundResults.length, totalTurns, kills, roundResults, p1FinalUnits: p1Final, p2FinalUnits: p2Final, mapValidity };
}

// =============================================================================
// Map Validity Gate
// =============================================================================

function computeMapValidity(state: GameState): MapValidity {
  const cityKeys: string[] = [];
  for (const key of state.cityOwnership.keys()) {
    cityKeys.push(key);
  }
  const totalCities = cityKeys.length;

  const p1Deploy = state.map.player1Deployment;
  const p2Deploy = state.map.player2Deployment;
  const p1Center = p1Deploy[Math.floor(p1Deploy.length / 2)]!;
  const p2Center = p2Deploy[Math.floor(p2Deploy.length / 2)]!;

  // Single Dijkstra flood per player — weighted cost to every reachable hex
  const p1Costs = computeMovementCostField(p1Center, state.map.terrain, 'infantry', undefined, state.map.modifiers, state.map.elevation);
  const p2Costs = computeMovementCostField(p2Center, state.map.terrain, 'infantry', undefined, state.map.modifiers, state.map.elevation);

  let p1ReachableCities = 0;
  let p2ReachableCities = 0;
  let p1CostSum = 0;
  let p2CostSum = 0;
  for (const key of cityKeys) {
    const p1Cost = p1Costs.get(key);
    if (p1Cost !== undefined) {
      p1CostSum += p1Cost;
      p1ReachableCities++;
    }
    const p2Cost = p2Costs.get(key);
    if (p2Cost !== undefined) {
      p2CostSum += p2Cost;
      p2ReachableCities++;
    }
  }

  // Deploy exit count: neighbors of deploy center that exist in the terrain map
  const p1Exits = hexNeighbors(p1Center).filter((n) => state.map.terrain.has(hexToKey(n))).length;
  const p2Exits = hexNeighbors(p2Center).filter((n) => state.map.terrain.has(hexToKey(n))).length;

  const p1AvgCityCost = p1ReachableCities > 0 ? p1CostSum / p1ReachableCities : Infinity;
  const p2AvgCityCost = p2ReachableCities > 0 ? p2CostSum / p2ReachableCities : Infinity;

  // Classification
  let classification: MapValidityClass;
  if (p1ReachableCities === 0 || p2ReachableCities === 0 || p1Exits === 0 || p2Exits === 0) {
    classification = 'BROKEN';
  } else if (p1ReachableCities < totalCities || p2ReachableCities < totalCities) {
    classification = 'DEGRADED';
  } else {
    classification = 'VALID';
  }

  return {
    classification,
    p1ReachableCities,
    p2ReachableCities,
    totalCities,
    p1DeployExits: p1Exits,
    p2DeployExits: p2Exits,
    p1AvgCityCost,
    p2AvgCityCost,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function runBuildPhase(state: GameState, playerId: PlayerId, rng: () => number): void {
  const actions = aiBuildPhase(state, playerId, rng);

  for (const action of actions) {
    placeUnit(
      state,
      playerId,
      action.unitType,
      action.position,
      action.movementDirective,
      action.attackDirective,
      action.specialtyModifier,
      action.directiveTarget,
    );
  }
}

function countTerrainNear(state: GameState, center: CubeCoord, radius: number): Record<TerrainType, number> {
  const counts: Record<TerrainType, number> = { plains: 0, forest: 0, mountain: 0, city: 0 };
  for (const [key, terrain] of state.map.terrain) {
    const hex = keyToHex(key);
    if (cubeDistance(center, hex) <= radius) {
      counts[terrain]++;
    }
  }
  return counts;
}

function logMapDiagnostics(state: GameState): void {
  const p1Center = state.map.player1Deployment[Math.floor(state.map.player1Deployment.length / 2)]!;
  const p2Center = state.map.player2Deployment[Math.floor(state.map.player2Deployment.length / 2)]!;
  const radius = Math.floor(state.map.mapRadius / 2);

  // MAP-03: FAIR_TERRAIN_MIX — terrain counts near each deploy zone
  const p1Terrain = countTerrainNear(state, p1Center, radius);
  const p2Terrain = countTerrainNear(state, p2Center, radius);
  console.log(
    `[MATH_AUDIT] MAP_TERRAIN_MIX  p1:plains=${p1Terrain.plains},forest=${p1Terrain.forest},mountain=${p1Terrain.mountain},city=${p1Terrain.city}` +
    `  p2:plains=${p2Terrain.plains},forest=${p2Terrain.forest},mountain=${p2Terrain.mountain},city=${p2Terrain.city}`,
  );

  // MAP-04: FAIR_MTN_WALL — mountain hexes on approach line between deploys
  const mapCenter = state.map.centralObjective;
  let p1MtnBlocking = 0;
  let p2MtnBlocking = 0;
  for (const [key, terrain] of state.map.terrain) {
    if (terrain !== 'mountain') continue;
    const hex = keyToHex(key);
    const distToCenter = cubeDistance(hex, mapCenter);
    const distToP1 = cubeDistance(hex, p1Center);
    const distToP2 = cubeDistance(hex, p2Center);
    // Mountain is "blocking" a player if it's between them and the center
    if (distToP1 < distToP2 && distToCenter < cubeDistance(p1Center, mapCenter)) p1MtnBlocking++;
    if (distToP2 < distToP1 && distToCenter < cubeDistance(p2Center, mapCenter)) p2MtnBlocking++;
  }
  console.log(`[MATH_AUDIT] MAP_MTN_WALL  p1_blocking:${p1MtnBlocking}  p2_blocking:${p2MtnBlocking}`);

  // MAP-05: FAIR_CITY_CLUSTER — average city distance to map center per side
  let p1CityDist = 0;
  let p2CityDist = 0;
  let cityCount = 0;
  for (const key of state.cityOwnership.keys()) {
    const hex = keyToHex(key);
    const toP1 = cubeDistance(hex, p1Center);
    const toP2 = cubeDistance(hex, p2Center);
    if (toP1 < toP2) p1CityDist += cubeDistance(hex, mapCenter);
    else p2CityDist += cubeDistance(hex, mapCenter);
    cityCount++;
  }
  console.log(`[MATH_AUDIT] MAP_CITY_CLUSTER  p1_side_avg_dist_to_center:${cityCount > 0 ? (p1CityDist / Math.max(1, cityCount)).toFixed(1) : 'N/A'}  p2_side_avg_dist_to_center:${cityCount > 0 ? (p2CityDist / Math.max(1, cityCount)).toFixed(1) : 'N/A'}`);

  // MAP-06: FAIR_DEPLOY_TERRAIN — terrain at deploy hexes
  const p1DepTerrain: Partial<Record<TerrainType, number>> = {};
  for (const hex of state.map.player1Deployment) {
    const t = state.map.terrain.get(hexToKey(hex)) ?? 'plains';
    p1DepTerrain[t] = (p1DepTerrain[t] ?? 0) + 1;
  }
  const p2DepTerrain: Partial<Record<TerrainType, number>> = {};
  for (const hex of state.map.player2Deployment) {
    const t = state.map.terrain.get(hexToKey(hex)) ?? 'plains';
    p2DepTerrain[t] = (p2DepTerrain[t] ?? 0) + 1;
  }
  const fmtTerrain = (t: Partial<Record<TerrainType, number>>): string =>
    Object.entries(t).map(([k, v]) => `${k}:${v}`).join(',');
  console.log(`[MATH_AUDIT] MAP_DEPLOY_TERRAIN  p1:${fmtTerrain(p1DepTerrain)}  p2:${fmtTerrain(p2DepTerrain)}`);

  // MAP-07: FAIR_ELEV_APPROACH — avg elevation on path from deploy to center
  const emptyOccupied = new Set<string>();
  for (const [pid, center] of [['p1', p1Center], ['p2', p2Center]] as const) {
    const path = findPath(center, mapCenter, state.map.terrain, 'infantry', emptyOccupied, undefined, state.map.modifiers, state.map.elevation);
    if (path) {
      let elevSum = 0;
      for (const hex of path) {
        elevSum += state.map.elevation.get(hexToKey(hex)) ?? 0;
      }
      console.log(`[MATH_AUDIT] MAP_ELEV_APPROACH  ${pid}_avg_elev:${(elevSum / path.length).toFixed(1)}`);
    } else {
      console.log(`[MATH_AUDIT] MAP_ELEV_APPROACH  ${pid}_avg_elev:NO_PATH`);
    }
  }

  // MAP-08: FAIR_VISION_ACCESS — high ground hexes (elev >= 4) reachable within N turns
  const highGroundThreshold = 4;
  let p1HighGround = 0;
  let p2HighGround = 0;
  for (const [key, elev] of state.map.elevation) {
    if (elev >= highGroundThreshold) {
      const hex = keyToHex(key);
      const d1 = cubeDistance(hex, p1Center);
      const d2 = cubeDistance(hex, p2Center);
      if (d1 <= radius) p1HighGround++;
      if (d2 <= radius) p2HighGround++;
    }
  }
  console.log(`[MATH_AUDIT] MAP_VISION_ACCESS  p1_high_ground:${p1HighGround}  p2_high_ground:${p2HighGround}`);

  // MAP-09: FAIR_CHOKE_POINTS — narrow passages (1-2 hex wide gaps between mountains)
  // TODO: Requires adjacency analysis of mountain clusters — UNINSTRUMENTED
  console.log(`[MATH_AUDIT] MAP_CHOKE_POINTS  UNINSTRUMENTED`);

  // MAP-10: FAIR_RIVER_CROSSINGS — bridge hexes on approach paths
  let p1Bridges = 0;
  let p2Bridges = 0;
  for (const [key, mod] of state.map.modifiers) {
    if (mod === 'bridge') {
      const hex = keyToHex(key);
      if (cubeDistance(hex, p1Center) < cubeDistance(hex, p2Center)) p1Bridges++;
      else p2Bridges++;
    }
  }
  console.log(`[MATH_AUDIT] MAP_RIVER_CROSSINGS  p1_nearby_bridges:${p1Bridges}  p2_nearby_bridges:${p2Bridges}`);

  // MAP-11: FAIR_HIGHWAY_ACCESS — highway hexes near each deploy zone
  let p1Highways = 0;
  let p2Highways = 0;
  for (const [key, mod] of state.map.modifiers) {
    if (mod === 'highway') {
      const hex = keyToHex(key);
      if (cubeDistance(hex, p1Center) <= radius) p1Highways++;
      if (cubeDistance(hex, p2Center) <= radius) p2Highways++;
    }
  }
  console.log(`[MATH_AUDIT] MAP_HIGHWAY_ACCESS  p1_highways:${p1Highways}  p2_highways:${p2Highways}`);
}

function logComposition(log: boolean, player: string, types: UnitType[]): void {
  if (!log) return;
  const counts: Partial<Record<UnitType, number>> = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;
  const summary = Object.entries(counts).map(([t, n]) => `${t}:${n}`).join(' ');
  console.log(`[MATH_AUDIT] COMPOSITION  player:${player}  ${summary}`);
}

// =============================================================================
// Batch Runner
// =============================================================================

export function runBatch(options: BatchOptions, log = false): BatchSummary {
  const { matchCount, baseSeed } = options;
  const results: MatchResult[] = [];
  let p1Wins = 0;
  let p2Wins = 0;
  let draws = 0;
  let validMaps = 0;
  let degradedMaps = 0;
  let brokenMaps = 0;

  for (let i = 0; i < matchCount; i++) {
    const result = runMatch(baseSeed + i, log);
    results.push(result);

    switch (result.mapValidity.classification) {
      case 'VALID': validMaps++; break;
      case 'DEGRADED': degradedMaps++; break;
      case 'BROKEN': brokenMaps++; break;
    }

    // BROKEN maps are excluded from gameplay aggregation
    if (result.mapValidity.classification !== 'BROKEN') {
      if (result.winner === 'player1') p1Wins++;
      else if (result.winner === 'player2') p2Wins++;
      else draws++;
    }
  }

  const playedResults = results.filter((r) => r.mapValidity.classification !== 'BROKEN');
  const playedMatches = playedResults.length;

  const allTurns = playedResults.map((r) => r.totalTurns);
  const avgTurns = playedMatches > 0 ? allTurns.reduce((a, b) => a + b, 0) / playedMatches : 0;
  const minTurns = playedMatches > 0 ? Math.min(...allTurns) : 0;
  const maxTurns = playedMatches > 0 ? Math.max(...allTurns) : 0;

  const matchupVerdicts: Record<string, MatchupVerdictCounts> = {};
  for (const result of playedResults) {
    for (const kill of result.kills) {
      const key = `${kill.attackerType} vs ${kill.defenderType} on ${kill.terrain}`;
      if (!matchupVerdicts[key]) {
        matchupVerdicts[key] = { TOO_FAST: 0, OK: 0, TOO_SLOW: 0, total: 0 };
      }
      const entry = matchupVerdicts[key] as { TOO_FAST: number; OK: number; TOO_SLOW: number; total: number };
      entry[kill.verdict]++;
      entry.total++;
    }
  }

  if (log) {
    console.log(`\n========== BATCH SUMMARY ==========`);
    console.log(`Matches: ${matchCount}  (played: ${playedMatches})`);
    console.log(`Map validity: VALID:${validMaps}  DEGRADED:${degradedMaps}  BROKEN:${brokenMaps}`);
    const denom = playedMatches || 1;
    console.log(`P1 wins: ${p1Wins} (${(p1Wins / denom * 100).toFixed(1)}%)`);
    console.log(`P2 wins: ${p2Wins} (${(p2Wins / denom * 100).toFixed(1)}%)`);
    console.log(`Draws:   ${draws} (${(draws / denom * 100).toFixed(1)}%)`);
    console.log(`Turns: avg=${avgTurns.toFixed(1)} min=${minTurns} max=${maxTurns}`);
    console.log(`\nKill Timing Verdicts:`);
    for (const [matchup, counts] of Object.entries(matchupVerdicts)) {
      const pctOk = counts.total > 0 ? ((counts.OK / counts.total) * 100).toFixed(0) : '0';
      const pctFast = counts.total > 0 ? ((counts.TOO_FAST / counts.total) * 100).toFixed(0) : '0';
      const pctSlow = counts.total > 0 ? ((counts.TOO_SLOW / counts.total) * 100).toFixed(0) : '0';
      console.log(
        `  ${matchup.padEnd(40)} OK:${pctOk}%  TOO_FAST:${pctFast}%  TOO_SLOW:${pctSlow}%  (n=${counts.total})`,
      );
    }
    console.log(`===================================\n`);
  }

  const denom = playedMatches || 1;
  return { matchCount, p1Wins, p2Wins, draws, p1WinRate: p1Wins / denom, p2WinRate: p2Wins / denom, drawRate: draws / denom, avgTurns, minTurns, maxTurns, results, matchupVerdicts, playedMatches, validMaps, degradedMaps, brokenMaps };
}
