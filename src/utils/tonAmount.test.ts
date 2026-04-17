import { describe, expect, it } from 'vitest';
import { formatAmount, nanoRawToTonHuman, shortAddress, shortHash } from './tonAmount';

describe('nanoRawToTonHuman', () => {
  it('returns "0" for empty input', () => {
    expect(nanoRawToTonHuman('')).toBe('0');
  });

  it('handles whole TON amounts', () => {
    expect(nanoRawToTonHuman('1000000000')).toBe('1');
    expect(nanoRawToTonHuman('5000000000')).toBe('5');
  });

  it('handles fractional amounts and trims trailing zeros', () => {
    expect(nanoRawToTonHuman('1500000000')).toBe('1.5');
    expect(nanoRawToTonHuman('1230000000')).toBe('1.23');
    expect(nanoRawToTonHuman('1234500000')).toBe('1.2345');
  });

  it('handles values smaller than 1 TON with leading zero', () => {
    expect(nanoRawToTonHuman('500000000')).toBe('0.5');
    expect(nanoRawToTonHuman('1')).toBe('0.000000001');
  });

  it('preserves negative sign', () => {
    expect(nanoRawToTonHuman('-1500000000')).toBe('-1.5');
  });

  it('keeps large amounts intact', () => {
    expect(nanoRawToTonHuman('1234567890123456789')).toBe('1234567890.123456789');
  });
});

describe('formatAmount', () => {
  it('formats TON via nanoRawToTonHuman', () => {
    expect(formatAmount('1500000000', 'TON')).toBe('1.5 TON');
  });

  it('passes other currencies through unchanged', () => {
    expect(formatAmount('123', 'USDT')).toBe('123 USDT');
  });
});

describe('shortAddress', () => {
  it('returns dash for empty/null input', () => {
    expect(shortAddress(null)).toBe('—');
    expect(shortAddress('')).toBe('—');
  });

  it('keeps short addresses verbatim', () => {
    expect(shortAddress('abc')).toBe('abc');
  });

  it('truncates long addresses to 4…4', () => {
    const addr = 'EQABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    expect(shortAddress(addr)).toBe('EQAB…7890');
  });
});

describe('shortHash', () => {
  it('returns dash for empty/null input', () => {
    expect(shortHash(null)).toBe('—');
    expect(shortHash('')).toBe('—');
  });

  it('keeps short hashes verbatim', () => {
    expect(shortHash('deadbeef')).toBe('deadbeef');
  });

  it('truncates long hashes to 6…4', () => {
    const hash = '0123456789abcdef0123456789abcdef';
    expect(shortHash(hash)).toBe('012345…cdef');
  });
});
