import { describe, expect, it } from 'vitest';
import { buildPurchaseMemo, tonToNanoRaw } from './purchases.js';

describe('buildPurchaseMemo', () => {
  it('produces a deterministic value for the same input', () => {
    const a = buildPurchaseMemo('user_1', 'prod_42');
    const b = buildPurchaseMemo('user_1', 'prod_42');
    expect(a).toBe(b);
  });

  it('changes when buyer or product changes', () => {
    const base = buildPurchaseMemo('user_1', 'prod_42');
    expect(buildPurchaseMemo('user_2', 'prod_42')).not.toBe(base);
    expect(buildPurchaseMemo('user_1', 'prod_43')).not.toBe(base);
  });

  it('clamps to <= 120 characters to fit on-chain text comments', () => {
    const long = buildPurchaseMemo('u'.repeat(200), 'p'.repeat(200));
    expect(long.length).toBeLessThanOrEqual(120);
  });

  it('starts with the "pur:" namespace prefix', () => {
    expect(buildPurchaseMemo('u', 'p')).toBe('pur:p:u');
  });
});

describe('tonToNanoRaw', () => {
  it('converts integer TON to nanoton', () => {
    expect(tonToNanoRaw(1)).toBe('1000000000');
    expect(tonToNanoRaw(5)).toBe('5000000000');
  });

  it('handles fractional TON without floating-point drift', () => {
    expect(tonToNanoRaw(0.1)).toBe('100000000');
    expect(tonToNanoRaw(1.5)).toBe('1500000000');
    expect(tonToNanoRaw(0.123456789)).toBe('123456789');
  });

  it('handles zero (free products)', () => {
    expect(tonToNanoRaw(0)).toBe('0');
  });

  it('rejects negative amounts', () => {
    expect(() => tonToNanoRaw(-1)).toThrow();
  });

  it('rejects NaN and Infinity', () => {
    expect(() => tonToNanoRaw(NaN)).toThrow();
    expect(() => tonToNanoRaw(Infinity)).toThrow();
    expect(() => tonToNanoRaw(-Infinity)).toThrow();
  });

  it('preserves precision for typical marketplace prices', () => {
    expect(tonToNanoRaw(9.99)).toBe('9990000000');
    expect(tonToNanoRaw(199.95)).toBe('199950000000');
  });
});
