import { describe, it, expect } from 'vitest';
import { formatBattleEvent } from './battle-events';
import type { BattleEvent } from './types';

describe('formatBattleEvent', () => {
  it('formats move event', () => {
    const event: BattleEvent = {
      type: 'move', actingPlayer: 'player1', phase: 'movement', pipelinePhase: 0,
      unitId: 'u1', unitType: 'infantry',
      from: { q: 0, r: 0, s: 0 }, to: { q: 1, r: -1, s: 0 },
    };
    expect(formatBattleEvent(event)).toBe('P1 Infantry moved to (1,-1)');
  });

  it('formats damage event', () => {
    const event: BattleEvent = {
      type: 'damage', actingPlayer: 'player1', phase: 'combat', pipelinePhase: 0,
      attackerId: 'u1', attackerType: 'tank',
      attackerPosition: { q: 0, r: 0, s: 0 },
      attackerAttackDirective: 'shoot-on-sight',
      defenderId: 'u2', defenderType: 'infantry',
      defenderPosition: { q: 1, r: 0, s: -1 },
      damage: 2, defenderHpAfter: 1, defenderTerrain: 'plains',
      approachCategory: 'front',
    };
    expect(formatBattleEvent(event)).toBe('P1 Tank dealt 2 damage to Infantry (1 HP left)');
  });

  it('formats kill event', () => {
    const event: BattleEvent = {
      type: 'kill', actingPlayer: 'player2', phase: 'combat', pipelinePhase: 0,
      attackerId: 'u3', attackerType: 'artillery',
      attackerPosition: { q: 0, r: 0, s: 0 },
      attackerAttackDirective: 'shoot-on-sight',
      defenderId: 'u4', defenderType: 'recon',
      defenderPosition: { q: 2, r: 0, s: -2 },
      damage: 5, defenderTerrain: 'forest',
      approachCategory: 'flank',
    };
    expect(formatBattleEvent(event)).toBe('P2 Artillery destroyed Recon');
  });

  it('formats capture event', () => {
    const event: BattleEvent = {
      type: 'capture', actingPlayer: 'player1', phase: 'capture', pipelinePhase: 0,
      unitId: 'u1', unitType: 'infantry', cityKey: '3,0,-3', previousOwner: null,
    };
    expect(formatBattleEvent(event)).toBe('P1 Infantry captured a city');
  });

  it('formats recapture event', () => {
    const event: BattleEvent = {
      type: 'recapture', actingPlayer: 'player1', phase: 'capture', pipelinePhase: 0,
      unitId: 'u1', unitType: 'tank', cityKey: '3,0,-3', previousOwner: 'player2',
    };
    expect(formatBattleEvent(event)).toBe('P1 Tank recaptured a city from P2');
  });

  it('formats capture-damage event', () => {
    const event: BattleEvent = {
      type: 'capture-damage', actingPlayer: 'player2', phase: 'capture', pipelinePhase: 0,
      unitId: 'u5', unitType: 'infantry', cityKey: '1,0,-1', captureCost: 1, hpAfter: 2,
    };
    expect(formatBattleEvent(event)).toBe('P2 Infantry took 1 damage capturing a city (2 HP left)');
  });

  it('formats capture-death event', () => {
    const event: BattleEvent = {
      type: 'capture-death', actingPlayer: 'player1', phase: 'capture', pipelinePhase: 0,
      unitId: 'u1', unitType: 'recon', cityKey: '1,0,-1', captureCost: 1,
    };
    expect(formatBattleEvent(event)).toBe('P1 Recon died capturing a city');
  });

  it('formats objective-change lost event', () => {
    const event: BattleEvent = {
      type: 'objective-change', actingPlayer: 'player1', phase: 'objective', pipelinePhase: 0,
      objectiveHex: { q: 0, r: 0, s: 0 }, previousOccupier: 'player1', newOccupier: null,
    };
    expect(formatBattleEvent(event)).toBe('P1 lost control of the objective');
  });

  it('formats objective-change seized event', () => {
    const event: BattleEvent = {
      type: 'objective-change', actingPlayer: 'player2', phase: 'objective', pipelinePhase: 0,
      objectiveHex: { q: 0, r: 0, s: 0 }, previousOccupier: null, newOccupier: 'player2',
      unitId: 'u3', unitType: 'tank',
    };
    expect(formatBattleEvent(event)).toBe('P2 seized the objective');
  });

  it('formats koth-progress event', () => {
    const event: BattleEvent = {
      type: 'koth-progress', actingPlayer: 'player1', phase: 'objective', pipelinePhase: 0,
      occupier: 'player1', turnsHeld: 1, citiesHeld: 3,
    };
    expect(formatBattleEvent(event)).toBe('P1 holds objective (1/2 turns)');
  });

  it('formats round-end event', () => {
    const event: BattleEvent = {
      type: 'round-end', actingPlayer: 'player1', phase: 'round', pipelinePhase: 0,
      winner: 'player1', reason: 'king-of-the-hill',
    };
    expect(formatBattleEvent(event)).toBe('P1 wins the round (King of the Hill)');
  });

  it('formats round-end with null winner', () => {
    const event: BattleEvent = {
      type: 'round-end', actingPlayer: 'player1', phase: 'round', pipelinePhase: 0,
      winner: null, reason: 'turn-limit',
    };
    expect(formatBattleEvent(event)).toBe('No one wins the round (Turn Limit)');
  });

  it('formats game-end event', () => {
    const event: BattleEvent = {
      type: 'game-end', actingPlayer: 'player2', phase: 'round', pipelinePhase: 0,
      winner: 'player2',
    };
    expect(formatBattleEvent(event)).toBe('P2 wins the game!');
  });

  it('formats heal event', () => {
    const event: BattleEvent = {
      type: 'heal', actingPlayer: 'player1', phase: 'combat', pipelinePhase: 0,
      healerId: 'u1', healerType: 'infantry',
      targetId: 'u2', targetType: 'tank',
      targetPosition: { q: 0, r: 0, s: 0 },
      healAmount: 1, targetHpAfter: 4,
    };
    expect(formatBattleEvent(event)).toBe('P1 Infantry healed Tank +1 HP (4 HP)');
  });

  it('formats intercept event with engage response', () => {
    const event: BattleEvent = {
      type: 'intercept', actingPlayer: 'player1', phase: 'combat', pipelinePhase: 0,
      attackerId: 'u1', attackerType: 'recon',
      defenderId: 'u2', defenderType: 'infantry',
      attackerPosition: { q: 2, r: 0, s: -2 },
      hex: { q: 3, r: -1, s: -2 }, damage: 2, defenderResponse: 'engage',
    };
    expect(formatBattleEvent(event)).toBe('Recon intercepted Infantry for 2 damage (stopped)');
  });

  it('formats intercept event with flee response', () => {
    const event: BattleEvent = {
      type: 'intercept', actingPlayer: 'player1', phase: 'combat', pipelinePhase: 0,
      attackerId: 'u1', attackerType: 'recon',
      defenderId: 'u2', defenderType: 'infantry',
      attackerPosition: { q: 2, r: 0, s: -2 },
      hex: { q: 3, r: -1, s: -2 }, damage: 5, defenderResponse: 'flee',
    };
    expect(formatBattleEvent(event)).toBe('Recon intercepted Infantry for 5 damage (fled)');
  });

  it('formats intercept event with none response', () => {
    const event: BattleEvent = {
      type: 'intercept', actingPlayer: 'player1', phase: 'combat', pipelinePhase: 0,
      attackerId: 'u1', attackerType: 'recon',
      defenderId: 'u2', defenderType: 'infantry',
      attackerPosition: { q: 2, r: 0, s: -2 },
      hex: { q: 3, r: -1, s: -2 }, damage: 3, defenderResponse: 'none',
    };
    expect(formatBattleEvent(event)).toBe('Recon intercepted Infantry for 3 damage');
  });

  it('formats counter event', () => {
    const event: BattleEvent = {
      type: 'counter', actingPlayer: 'player2', phase: 'combat', pipelinePhase: 0,
      attackerId: 'u3', attackerType: 'infantry',
      attackerPosition: { q: 0, r: 0, s: 0 },
      defenderId: 'u4', defenderType: 'tank',
      defenderPosition: { q: 1, r: -1, s: 0 },
      damage: 1, defenderHpAfter: 3,
    };
    expect(formatBattleEvent(event)).toBe('Infantry counter-fired at Tank for 1 damage');
  });

  it('formats melee event', () => {
    const event: BattleEvent = {
      type: 'melee', actingPlayer: 'player1', phase: 'combat', pipelinePhase: 0,
      unitAId: 'u1', unitAType: 'infantry',
      unitBId: 'u2', unitBType: 'tank',
      hex: { q: 0, r: 0, s: 0 },
    };
    expect(formatBattleEvent(event)).toBe('Infantry engaged Tank in melee');
  });

  it('formats reveal event', () => {
    const event: BattleEvent = {
      type: 'reveal', actingPlayer: 'player1', phase: 'combat', pipelinePhase: 0,
      unitId: 'u1', unitType: 'recon',
      unitPosition: { q: 0, r: 0, s: 0 },
      hexes: [{ q: 1, r: 0, s: -1 }, { q: 2, r: 0, s: -2 }],
    };
    expect(formatBattleEvent(event)).toBe('P1 Recon revealed 2 hexes');
  });
});
