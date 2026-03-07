import { describe, it, expect, beforeEach } from 'vitest';
import { BUILDING_STATS, createBuilding, resetBuildingIdCounter, validateBuild } from './buildings';
import { createHex, hexToKey, hexNeighbors } from './hex';
import { createGame, placeUnit, startBattlePhase } from './game-state';
import { resetUnitIdCounter } from './units';
import type { GameState } from './types';

beforeEach(() => {
  resetBuildingIdCounter();
  resetUnitIdCounter();
});

describe('BUILDING_STATS', () => {
  it('recon-tower has vision range 4 and costs 75', () => {
    const stats = BUILDING_STATS['recon-tower'];
    expect(stats.cost).toBe(75);
    expect(stats.visionRange).toBe(4);
  });

  it('mortar has attack range 3, min 2, atk 2, costs 150', () => {
    const stats = BUILDING_STATS.mortar;
    expect(stats.cost).toBe(150);
    expect(stats.attackRange).toBe(3);
    expect(stats.minAttackRange).toBe(2);
    expect(stats.atk).toBe(2);
  });

  it('mines deal 2 damage and cost 50', () => {
    const stats = BUILDING_STATS.mines;
    expect(stats.cost).toBe(50);
    expect(stats.damage).toBe(2);
  });

  it('defensive-position has +0.5 defense bonus and costs 100', () => {
    const stats = BUILDING_STATS['defensive-position'];
    expect(stats.cost).toBe(100);
    expect(stats.defenseBonus).toBe(0.5);
  });
});

describe('createBuilding', () => {
  it('creates a building with correct fields', () => {
    const pos = createHex(2, 3);
    const building = createBuilding('recon-tower', 'player1', pos);
    expect(building.id).toBe('building-1');
    expect(building.type).toBe('recon-tower');
    expect(building.owner).toBe('player1');
    expect(building.position).toEqual(pos);
    expect(building.isRevealed).toBe(true);
  });

  it('mines are created hidden (isRevealed = false)', () => {
    const building = createBuilding('mines', 'player2', createHex(0, 0));
    expect(building.isRevealed).toBe(false);
  });

  it('increments building IDs', () => {
    const b1 = createBuilding('mortar', 'player1', createHex(0, 0));
    const b2 = createBuilding('mines', 'player1', createHex(1, 0));
    expect(b1.id).toBe('building-1');
    expect(b2.id).toBe('building-2');
  });
});

describe('validateBuild', () => {
  let state: GameState;

  function findDeployHexWithValidNeighbor(gs: GameState): {
    deployHex: import('./types').CubeCoord;
    adjacent: import('./types').CubeCoord;
  } {
    const dzKeys = new Set([
      ...gs.map.player1Deployment.map(hexToKey),
      ...gs.map.player2Deployment.map(hexToKey),
    ]);
    for (const dh of gs.map.player1Deployment) {
      const adj = hexNeighbors(dh).find((h) => {
        const key = hexToKey(h);
        const terrain = gs.map.terrain.get(key);
        return terrain !== undefined && terrain !== 'mountain' && !dzKeys.has(key);
      });
      if (adj) return { deployHex: dh, adjacent: adj };
    }
    throw new Error('No suitable deployment hex found for test');
  }

  let validAdjacent: import('./types').CubeCoord;

  beforeEach(() => {
    state = createGame(42);
    const { deployHex, adjacent } = findDeployHexWithValidNeighbor(state);
    validAdjacent = adjacent;
    placeUnit(state, 'player1', 'engineer', deployHex);
    startBattlePhase(state);
  });

  it('succeeds for valid build on adjacent hex', () => {
    const engineer = state.players.player1.units[0]!;
    const result = validateBuild(state, engineer.id, 'player1', 'recon-tower', validAdjacent);
    expect(result.valid).toBe(true);
  });

  it('fails if unit is not an engineer', () => {
    const deployHex = state.map.player1Deployment[1]!;
    const infantry = {
      id: 'test-inf',
      type: 'infantry' as const,
      owner: 'player1' as const,
      hp: 3,
      position: deployHex,
      directive: 'advance' as const,
      directiveTarget: { type: 'central-objective' as const },
      hasActed: false,
    };
    state.players.player1.units.push(infantry);
    const adjacent = hexNeighbors(deployHex).find((h) => {
      const key = hexToKey(h);
      return state.map.terrain.has(key) && state.map.terrain.get(key) !== 'mountain';
    })!;
    const result = validateBuild(state, 'test-inf', 'player1', 'mines', adjacent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('engineer');
  });

  it('fails if engineer has already acted', () => {
    const engineer = state.players.player1.units[0]!;
    engineer.hasActed = true;
    const adjacent = hexNeighbors(engineer.position).find((h) => {
      const key = hexToKey(h);
      return state.map.terrain.has(key) && state.map.terrain.get(key) !== 'mountain';
    })!;
    const result = validateBuild(state, engineer.id, 'player1', 'mines', adjacent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('acted');
  });

  it('fails if target hex is not adjacent', () => {
    const engineer = state.players.player1.units[0]!;
    const result = validateBuild(state, engineer.id, 'player1', 'mines', engineer.position);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('adjacent');
  });

  it('fails if building already exists on target hex', () => {
    const engineer = state.players.player1.units[0]!;
    state.buildings.push(createBuilding('mines', 'player1', validAdjacent));
    const result = validateBuild(state, engineer.id, 'player1', 'recon-tower', validAdjacent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('building');
  });

  it('fails if player cannot afford the building', () => {
    const engineer = state.players.player1.units[0]!;
    state.players.player1.resources = 0;
    const result = validateBuild(state, engineer.id, 'player1', 'mortar', validAdjacent);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('afford');
  });
});
