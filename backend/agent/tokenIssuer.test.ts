import { describe, expect, it } from 'vitest';
import {
  hashToken,
  tokenPrefix,
  constantTimeHashEqual,
  TOKEN_PREFIX,
} from './tokenIssuer.js';

describe('hashToken', () => {
  it('returns a 64-char hex digest', () => {
    const h = hashToken('tfa_test_value');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashToken('tfa_x')).toBe(hashToken('tfa_x'));
  });

  it('changes with input', () => {
    expect(hashToken('tfa_x')).not.toBe(hashToken('tfa_y'));
  });
});

describe('tokenPrefix', () => {
  it('keeps the tfa_ prefix and exposes 8 random chars', () => {
    const t = `${TOKEN_PREFIX}AbCdEfGhIjKlMnOp`;
    const p = tokenPrefix(t);
    expect(p.startsWith(TOKEN_PREFIX)).toBe(true);
    // tfa_ (4) + 8 visible
    expect(p.length).toBe(12);
    expect(p).toBe('tfa_AbCdEfGh');
  });
});

describe('constantTimeHashEqual', () => {
  it('returns true for equal hashes', () => {
    const h = hashToken('tfa_x');
    expect(constantTimeHashEqual(h, h)).toBe(true);
  });

  it('returns false for different hashes', () => {
    expect(constantTimeHashEqual(hashToken('tfa_x'), hashToken('tfa_y'))).toBe(false);
  });

  it('returns false for length mismatch (no throw)', () => {
    expect(constantTimeHashEqual('abc', 'abcd')).toBe(false);
  });
});
