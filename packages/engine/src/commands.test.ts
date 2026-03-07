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
  const makeRedirect = (unitId: string): Command => ({
    type: 'redirect',
    unitId,
    newMovementDirective: 'advance',
    newAttackDirective: 'shoot-on-sight',
    newSpecialtyModifier: null,
  });

  it('decrements CP by 1', () => {
    const pool = createCommandPool();
    const next = spendCommand(pool, makeRedirect('u1'));
    expect(next.remaining).toBe(3);
  });

  it('adds unitId to commandedUnitIds', () => {
    const pool = createCommandPool();
    const next = spendCommand(pool, makeRedirect('u1'));
    expect(next.commandedUnitIds.has('u1')).toBe(true);
  });

  it('throws when no CP remaining', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, makeRedirect('u1'));
    pool = spendCommand(pool, makeRedirect('u2'));
    pool = spendCommand(pool, makeRedirect('u3'));
    pool = spendCommand(pool, makeRedirect('u4'));

    expect(() =>
      spendCommand(pool, makeRedirect('u5')),
    ).toThrow('No command points remaining');
  });

  it('throws when unit already commanded this turn', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, makeRedirect('u1'));

    expect(() =>
      spendCommand(pool, makeRedirect('u1')),
    ).toThrow('Unit u1 already commanded this turn');
  });

  it('returns new object (does not mutate input)', () => {
    const pool = createCommandPool();
    const next = spendCommand(pool, makeRedirect('u1'));

    expect(next).not.toBe(pool);
    expect(pool.remaining).toBe(4);
    expect(pool.commandedUnitIds.size).toBe(0);
  });
});

describe('canIssueCommand', () => {
  const makeRedirect = (unitId: string): Command => ({
    type: 'redirect',
    unitId,
    newMovementDirective: 'advance',
    newAttackDirective: 'shoot-on-sight',
    newSpecialtyModifier: null,
  });

  it('true when CP available and unit not commanded', () => {
    const pool = createCommandPool();
    expect(canIssueCommand(pool, 'u1')).toBe(true);
  });

  it('false when unit already commanded', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, makeRedirect('u1'));
    expect(canIssueCommand(pool, 'u1')).toBe(false);
  });

  it('false when no CP remaining', () => {
    let pool = createCommandPool();
    pool = spendCommand(pool, makeRedirect('u1'));
    pool = spendCommand(pool, makeRedirect('u2'));
    pool = spendCommand(pool, makeRedirect('u3'));
    pool = spendCommand(pool, makeRedirect('u4'));
    expect(canIssueCommand(pool, 'u5')).toBe(false);
  });
});

describe('validateDirectiveTarget', () => {
  it('does not throw for advance with any target', () => {
    const target: DirectiveTarget = { type: 'hex', hex: { q: 0, r: 0, s: 0 } };
    expect(() => validateDirectiveTarget('advance', target)).not.toThrow();
  });

  it('does not throw for hold with hex target', () => {
    const target: DirectiveTarget = { type: 'hex', hex: { q: 0, r: 0, s: 0 } };
    expect(() => validateDirectiveTarget('hold', target)).not.toThrow();
  });

  it('does not throw for patrol with hex target', () => {
    const target: DirectiveTarget = { type: 'hex', hex: { q: 5, r: 3, s: -8 } };
    expect(() => validateDirectiveTarget('patrol', target)).not.toThrow();
  });
});
