import { describe, expect, it } from 'vitest';
import { sessionQueryKeys } from './sessionQueries';

describe('sessionQueryKeys', () => {
  it('all root key is stable and isolated', () => {
    expect(sessionQueryKeys.all).toEqual(['session']);
  });

  it('produces hierarchical, namespaced keys', () => {
    expect(sessionQueryKeys.library()).toEqual(['session', 'library']);
    expect(sessionQueryKeys.products()).toEqual(['session', 'products']);
    expect(sessionQueryKeys.stats()).toEqual(['session', 'stats']);
    expect(sessionQueryKeys.payouts()).toEqual(['session', 'payouts']);
    expect(sessionQueryKeys.transactions()).toEqual(['session', 'transactions']);
  });

  it('keys are unique per resource so invalidations stay surgical', () => {
    const keys = [
      sessionQueryKeys.library(),
      sessionQueryKeys.products(),
      sessionQueryKeys.stats(),
      sessionQueryKeys.payouts(),
      sessionQueryKeys.transactions(),
    ].map((k) => k.join('/'));
    const set = new Set(keys);
    expect(set.size).toBe(keys.length);
  });

  it('every typed key starts with the root segment', () => {
    for (const make of [
      sessionQueryKeys.library,
      sessionQueryKeys.products,
      sessionQueryKeys.stats,
      sessionQueryKeys.payouts,
      sessionQueryKeys.transactions,
    ]) {
      expect(make()[0]).toBe('session');
    }
  });
});
