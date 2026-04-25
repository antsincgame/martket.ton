import { describe, expect, it } from 'vitest';
import { tonHumanToNanoRaw, applyFeeBps, nanoRawToTonHuman, tonToNanoRaw } from './money.js';

describe('tonHumanToNanoRaw', () => {
  it('converts whole TON to nanoRaw', () => {
    expect(tonHumanToNanoRaw('1')).toBe('1000000000');
    expect(tonHumanToNanoRaw('5')).toBe('5000000000');
  });

  it('converts fractional TON to nanoRaw', () => {
    expect(tonHumanToNanoRaw('1.5')).toBe('1500000000');
    expect(tonHumanToNanoRaw('0.1')).toBe('100000000');
    expect(tonHumanToNanoRaw('0.000000001')).toBe('1');
  });

  it('accepts number input', () => {
    expect(tonHumanToNanoRaw(2)).toBe('2000000000');
  });

  it('throws on invalid input', () => {
    expect(() => tonHumanToNanoRaw('abc')).toThrow('INVALID_PRICE');
    expect(() => tonHumanToNanoRaw('-1')).toThrow('INVALID_PRICE');
  });
});

describe('applyFeeBps', () => {
  it('applies 5% (500 bps) fee correctly', () => {
    const net = applyFeeBps('1000000000', 500);
    expect(net).toBe('950000000');
  });

  it('applies 0 bps (no fee)', () => {
    expect(applyFeeBps('1000000000', 0)).toBe('1000000000');
  });

  it('clamps bps to valid range', () => {
    expect(applyFeeBps('1000000000', 10000)).toBe('0');
    expect(applyFeeBps('1000000000', -100)).toBe('1000000000');
  });
});

describe('nanoRawToTonHuman', () => {
  it('converts nanoRaw to human-readable TON', () => {
    expect(nanoRawToTonHuman('1000000000')).toBe('1');
    expect(nanoRawToTonHuman('1500000000')).toBe('1.5');
    expect(nanoRawToTonHuman('1')).toBe('0.000000001');
  });

  it('handles zero', () => {
    expect(nanoRawToTonHuman('0')).toBe('0');
  });
});

describe('tonToNanoRaw', () => {
  it('converts TON amount to nano', () => {
    expect(tonToNanoRaw(1)).toBe('1000000000');
    expect(tonToNanoRaw(1.5)).toBe('1500000000');
    expect(tonToNanoRaw(0)).toBe('0');
  });
});
