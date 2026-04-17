import { describe, expect, it, vi } from 'vitest';

vi.mock('../core/appwriteServer.js', () => ({
  createUserContextClient: vi.fn(),
}));

vi.mock('../core/repository.js', () => ({
  findUserByAppwriteId: vi.fn(),
  upsertProfileForAppwriteUser: vi.fn(),
}));

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  isAdminRole,
  isModeratorRole,
  extractBearerToken,
} from './auth.js';

describe('isAdminRole', () => {
  it('passes admin and super_admin', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('super_admin')).toBe(true);
  });

  it('rejects non-admin roles', () => {
    expect(isAdminRole('moderator')).toBe(false);
    expect(isAdminRole('demiurge')).toBe(false);
    expect(isAdminRole('viewer')).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });
});

describe('isModeratorRole', () => {
  it('passes moderator, admin, super_admin', () => {
    expect(isModeratorRole('moderator')).toBe(true);
    expect(isModeratorRole('admin')).toBe(true);
    expect(isModeratorRole('super_admin')).toBe(true);
  });

  it('rejects regular and viewer roles', () => {
    expect(isModeratorRole('demiurge')).toBe(false);
    expect(isModeratorRole('viewer')).toBe(false);
    expect(isModeratorRole('seller')).toBe(false);
  });
});

describe('extractBearerToken', () => {
  function reqWith(authValue: string | null): { get: (h: string) => string | null } {
    return {
      get: (h: string) => (h.toLowerCase() === 'authorization' ? authValue : null),
    };
  }

  it('returns the token from a well-formed Bearer header', () => {
    expect(extractBearerToken(reqWith('Bearer abc123'))).toBe('abc123');
  });

  it('is case-insensitive on the scheme', () => {
    expect(extractBearerToken(reqWith('bearer xyz'))).toBe('xyz');
    expect(extractBearerToken(reqWith('BEARER xyz'))).toBe('xyz');
  });

  it('trims surrounding whitespace', () => {
    expect(extractBearerToken(reqWith('   Bearer   spaced-token   '))).toBe('spaced-token');
  });

  it('returns null when there is no Authorization header', () => {
    expect(extractBearerToken(reqWith(null))).toBeNull();
  });

  it('returns null for non-Bearer schemes (no silent fallthrough)', () => {
    expect(extractBearerToken(reqWith('Basic dXNlcjpwYXNz'))).toBeNull();
    expect(extractBearerToken(reqWith('Token raw'))).toBeNull();
  });

  it('returns null when the token portion is empty', () => {
    expect(extractBearerToken(reqWith('Bearer '))).toBeNull();
    expect(extractBearerToken(reqWith('Bearer'))).toBeNull();
  });

  it('preserves dots and dashes typical of JWTs', () => {
    const jwt = 'eyJhbGciOiJI.eyJzdWIiOiIxMjMifQ.signature-abc';
    expect(extractBearerToken(reqWith(`Bearer ${jwt}`))).toBe(jwt);
  });
});
