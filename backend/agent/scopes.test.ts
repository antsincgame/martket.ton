import { describe, expect, it } from 'vitest';
import {
  ALL_SCOPES,
  parseScopes,
  serializeScopes,
  expandScopes,
  hasAllScopes,
} from './scopes.js';

describe('parseScopes', () => {
  it('returns empty array for null/empty input', () => {
    expect(parseScopes(null)).toEqual([]);
    expect(parseScopes('')).toEqual([]);
    expect(parseScopes(undefined)).toEqual([]);
  });

  it('parses canonical CSV', () => {
    const r = parseScopes('listings:read,orders:read');
    expect(r).toEqual(['listings:read', 'orders:read']);
  });

  it('drops unknown scopes silently', () => {
    const r = parseScopes('listings:read,unknown:scope,orders:read');
    expect(r).toEqual(['listings:read', 'orders:read']);
  });

  it('trims whitespace', () => {
    const r = parseScopes(' listings:read , orders:read ');
    expect(r).toEqual(['listings:read', 'orders:read']);
  });
});

describe('serializeScopes', () => {
  it('produces canonical order regardless of input order', () => {
    expect(serializeScopes(['orders:read', 'listings:read'])).toBe('listings:read,orders:read');
  });

  it('de-duplicates', () => {
    expect(serializeScopes(['listings:read', 'listings:read'])).toBe('listings:read');
  });
});

describe('expandScopes', () => {
  it('listings:write implies listings:read', () => {
    const out = expandScopes(['listings:write']);
    expect(out.has('listings:write')).toBe(true);
    expect(out.has('listings:read')).toBe(true);
  });

  it('distribution:write implies listings:read', () => {
    const out = expandScopes(['distribution:write']);
    expect(out.has('listings:read')).toBe(true);
  });

  it('orders:read does not imply anything else', () => {
    const out = expandScopes(['orders:read']);
    expect(Array.from(out)).toEqual(['orders:read']);
  });
});

describe('hasAllScopes', () => {
  it('passes when all required scopes are granted explicitly', () => {
    expect(hasAllScopes(['listings:read', 'orders:read'], ['listings:read'])).toBe(true);
    expect(hasAllScopes(['listings:read', 'orders:read'], ['orders:read'])).toBe(true);
  });

  it('passes via implication', () => {
    expect(hasAllScopes(['listings:write'], ['listings:read'])).toBe(true);
    expect(hasAllScopes(['distribution:write'], ['listings:read'])).toBe(true);
  });

  it('fails when a required scope is missing', () => {
    expect(hasAllScopes(['listings:read'], ['listings:write'])).toBe(false);
    expect(hasAllScopes(['orders:read'], ['listings:read'])).toBe(false);
  });

  it('passes for empty required (the no-op gate)', () => {
    expect(hasAllScopes([], [])).toBe(true);
    expect(hasAllScopes(['listings:read'], [])).toBe(true);
  });
});

describe('ALL_SCOPES', () => {
  it('exposes the canonical set', () => {
    expect(ALL_SCOPES).toContain('listings:read');
    expect(ALL_SCOPES).toContain('listings:write');
    expect(ALL_SCOPES).toContain('orders:read');
    expect(ALL_SCOPES).toContain('distribution:write');
    expect(ALL_SCOPES).toContain('instructions:read');
    expect(ALL_SCOPES).toContain('products:write');
  });
});

describe('products:write', () => {
  it('is a standalone write scope that implies nothing else', () => {
    expect(Array.from(expandScopes(['products:write']))).toEqual(['products:write']);
  });

  it('does not satisfy listing scopes and vice versa', () => {
    expect(hasAllScopes(['products:write'], ['listings:write'])).toBe(false);
    expect(hasAllScopes(['listings:write'], ['products:write'])).toBe(false);
  });
});

describe('orders:buy', () => {
  it('is in the canonical set and round-trips', () => {
    expect(ALL_SCOPES).toContain('orders:buy');
    expect(parseScopes('orders:buy')).toEqual(['orders:buy']);
    expect(serializeScopes(['orders:buy'])).toBe('orders:buy');
  });

  it('is standalone — implies nothing, satisfied by nothing else', () => {
    expect(Array.from(expandScopes(['orders:buy']))).toEqual(['orders:buy']);
    // A buyer token must not unlock seller surfaces and vice versa.
    expect(hasAllScopes(['orders:buy'], ['orders:read'])).toBe(false);
    expect(hasAllScopes(['orders:buy'], ['listings:write'])).toBe(false);
    expect(hasAllScopes(['orders:read'], ['orders:buy'])).toBe(false);
    expect(hasAllScopes(['listings:write', 'distribution:write', 'products:write'], ['orders:buy'])).toBe(false);
  });
});

describe('instructions:read', () => {
  it('is a standalone read scope that implies nothing else', () => {
    expect(Array.from(expandScopes(['instructions:read']))).toEqual(['instructions:read']);
  });

  it('parses and round-trips', () => {
    expect(parseScopes('instructions:read')).toEqual(['instructions:read']);
    expect(serializeScopes(['instructions:read'])).toBe('instructions:read');
  });

  it('does not satisfy unrelated scopes', () => {
    expect(hasAllScopes(['instructions:read'], ['listings:read'])).toBe(false);
  });
});
