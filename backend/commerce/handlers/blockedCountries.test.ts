import { describe, expect, it } from 'vitest';
import { isBlockedCountry, getBlockedCountryCodes } from './blockedCountries.js';

describe('isBlockedCountry', () => {
  const SANCTIONED = ['KP', 'IR', 'CU', 'SY', 'RU'];
  const ALLOWED = ['US', 'DE', 'JP', 'EE', 'BR', 'KR', 'UA', 'CN'];

  it.each(SANCTIONED)('blocks sanctioned country: %s', (code) => {
    expect(isBlockedCountry(code)).toBe(true);
  });

  it.each(ALLOWED)('allows non-sanctioned country: %s', (code) => {
    expect(isBlockedCountry(code)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isBlockedCountry('kp')).toBe(true);
    expect(isBlockedCountry('Ir')).toBe(true);
    expect(isBlockedCountry('us')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isBlockedCountry('')).toBe(false);
  });
});

describe('getBlockedCountryCodes', () => {
  it('returns a non-empty set', () => {
    const codes = getBlockedCountryCodes();
    expect(codes.size).toBeGreaterThanOrEqual(5);
  });

  it('contains all expected OFAC/EU codes', () => {
    const codes = getBlockedCountryCodes();
    for (const c of ['KP', 'IR', 'CU', 'SY', 'RU']) {
      expect(codes.has(c), `should contain ${c}`).toBe(true);
    }
  });
});
