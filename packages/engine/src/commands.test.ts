import { describe, it, expect } from 'vitest';
import { createCommandPool, spendCommand, canIssueCommand, validateDirectiveTarget } from './commands';
import type { Command, DirectiveTarget } from './types';

describe('createCommandPool', () => {
  it('starts with 4 CP', () => {
    const pool = createCommandPool();
    expect(pool.remaining).toBe(4);
  });

  it('commandedUnitIds is empty Set', () => {
    const pool = createCommandPool();
    expect(pool.commandedUnitIds).toBeInstanceOf(Set);
    expect(pool.commandedUnitIds.size).toBe(0);
  });
});

describe('spendCommand', () => {
  it('decrements CP by 1', () => {
    const pool = createCommandPool();
    const command: Command = { type: 'retreat', unitId: 'u1' };
    const next = spendCommand(pool, command);
    expect(next.remaining).toBe(3);
  });

  it('adds unitId to commandedUnitIds', () => {
    const pool = createCommandPool();
    const command: Command = { type: 'redirect', unitId: 'u1', newDirective: 'hold' };
    const next = spendCommand(pool, command);
    expect(next.commandedUnitIds.has('u1')).toBe(true);
  });

  it('throws when no CP remaining', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u1' });
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u2' });
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u3' });
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u4' });

    expect(() =>
      spendCommand(pool, { type: 'retreat', unitId: 'u5' }),
    ).toThrow('No command points remaining');
  });

  it('throws when unit already commanded this turn', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u1' });

    expect(() =>
      spendCommand(pool, { type: 'retreat', unitId: 'u1' }),
    ).toThrow('Unit u1 already commanded this turn');
  });

  it('returns new object (does not mutate input)', () => {
    const pool = createCommandPool();
    const command: Command = { type: 'retreat', unitId: 'u1' };
    const next = spendCommand(pool, command);

    expect(next).not.toBe(pool);
    expect(pool.remaining).toBe(4);
    expect(pool.commandedUnitIds.size).toBe(0);
  });
});

describe('canIssueCommand', () => {
  it('true when CP available and unit not commanded', () => {
    const pool = createCommandPool();
    expect(canIssueCommand(pool, 'u1')).toBe(true);
  });

  it('false when unit already commanded', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u1' });
    expect(canIssueCommand(pool, 'u1')).toBe(false);
  });

  it('false when no CP remaining', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u1' });
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u2' });
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u3' });
    pool = spendCommand(pool, { type: 'retreat', unitId: 'u4' });
    expect(canIssueCommand(pool, 'u5')).toBe(false);
  });
});

describe('validateDirectiveTarget', () => {
  it('rejects hunt without enemy-unit target', () => {
    const target: DirectiveTarget = { type: 'city', cityId: 'city-1' };
    expect(() => validateDirectiveTarget('hunt', target)).toThrow();
  });
  it('accepts hunt with enemy-unit target', () => {
    const target: DirectiveTarget = { type: 'enemy-unit', unitId: 'unit-1' };
    expect(() => validateDirectiveTarget('hunt', target)).not.toThrow();
  });
  it('rejects capture without city target', () => {
    const target: DirectiveTarget = { type: 'hex', hex: { q: 0, r: 0, s: 0 } };
    expect(() => validateDirectiveTarget('capture', target)).toThrow();
  });
  it('accepts capture with city target', () => {
    const target: DirectiveTarget = { type: 'city', cityId: 'city-1' };
    expect(() => validateDirectiveTarget('capture', target)).not.toThrow();
  });
  it('accepts advance with any target type', () => {
    const target: DirectiveTarget = { type: 'hex', hex: { q: 0, r: 0, s: 0 } };
    expect(() => validateDirectiveTarget('advance', target)).not.toThrow();
  });
});
