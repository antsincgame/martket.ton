import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { accountMock } = vi.hoisted(() => ({
  accountMock: {
    createEmailToken: vi.fn(),
    createSession: vi.fn(),
    createOAuth2Token: vi.fn(),
    get: vi.fn(),
    createJWT: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

vi.mock('./appwriteClient', () => ({
  appwriteAccount: accountMock,
  isAppwriteConfigured: true,
}));

vi.mock('appwrite', () => ({
  OAuthProvider: { Github: 'github' },
}));

import {
  sendEmailOtp,
  verifyEmailOtp,
  completeOAuthCallback,
  startGithubOAuth,
  getCurrentUser,
  getJwt,
  logout,
  __resetJwtCacheForTesting,
} from './appwriteAuth';

const ORIGIN = 'https://example.com';

beforeEach(() => {
  Object.values(accountMock).forEach((fn) => fn.mockReset());
  __resetJwtCacheForTesting();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, origin: ORIGIN },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sendEmailOtp', () => {
  it('calls createEmailToken with trimmed email', async () => {
    accountMock.createEmailToken.mockResolvedValueOnce({ userId: 'u_42' });
    const res = await sendEmailOtp('  user@example.com  ');
    expect(res).toEqual({ userId: 'u_42' });
    expect(accountMock.createEmailToken).toHaveBeenCalledWith('unique()', 'user@example.com');
  });

  it('rejects empty email', async () => {
    await expect(sendEmailOtp('   ')).rejects.toThrow(/email/);
    expect(accountMock.createEmailToken).not.toHaveBeenCalled();
  });
});

describe('verifyEmailOtp', () => {
  it('exchanges userId+otp for a session', async () => {
    accountMock.createSession.mockResolvedValueOnce({ $id: 's1' });
    await verifyEmailOtp('u', '123456');
    expect(accountMock.createSession).toHaveBeenCalledWith('u', '123456');
  });

  it('rejects when userId or otp is missing', async () => {
    await expect(verifyEmailOtp('', '123456')).rejects.toThrow();
    await expect(verifyEmailOtp('u', '')).rejects.toThrow();
    expect(accountMock.createSession).not.toHaveBeenCalled();
  });

  it('invalidates JWT cache after session change', async () => {
    accountMock.createJWT.mockResolvedValueOnce({ jwt: 'first' });
    accountMock.createSession.mockResolvedValueOnce({ $id: 's1' });
    accountMock.createJWT.mockResolvedValueOnce({ jwt: 'second' });
    expect(await getJwt()).toBe('first');
    await verifyEmailOtp('u', '123456');
    expect(await getJwt()).toBe('second');
  });
});

describe('completeOAuthCallback', () => {
  it('exchanges userId+secret for a session', async () => {
    accountMock.createSession.mockResolvedValueOnce({ $id: 's1' });
    await completeOAuthCallback('u', 's');
    expect(accountMock.createSession).toHaveBeenCalledWith('u', 's');
  });
});

describe('startGithubOAuth', () => {
  it('redirects via OAuth2Token', async () => {
    await startGithubOAuth();
    expect(accountMock.createOAuth2Token).toHaveBeenCalledWith(
      'github',
      `${ORIGIN}/auth/callback`,
      `${ORIGIN}/auth/callback`,
    );
  });
});

describe('getCurrentUser', () => {
  it('returns user with active session', async () => {
    accountMock.get.mockResolvedValueOnce({ $id: 'u', email: 'a@b.c' });
    expect(await getCurrentUser()).toEqual({ $id: 'u', email: 'a@b.c' });
  });

  it('returns null when no session', async () => {
    accountMock.get.mockRejectedValueOnce(new Error('no session'));
    expect(await getCurrentUser()).toBeNull();
  });
});

describe('getJwt', () => {
  it('caches JWT within TTL', async () => {
    accountMock.createJWT.mockResolvedValueOnce({ jwt: 'tok-1' });
    expect(await getJwt()).toBe('tok-1');
    expect(await getJwt()).toBe('tok-1');
    expect(accountMock.createJWT).toHaveBeenCalledTimes(1);
  });

  it('returns null on SDK failure', async () => {
    accountMock.createJWT.mockRejectedValueOnce(new Error('expired'));
    expect(await getJwt()).toBeNull();
  });
});

describe('logout', () => {
  it('calls deleteSession and clears JWT cache', async () => {
    accountMock.createJWT.mockResolvedValueOnce({ jwt: 't' });
    accountMock.deleteSession.mockResolvedValueOnce(undefined);
    accountMock.createJWT.mockResolvedValueOnce({ jwt: 'fresh' });
    await getJwt();
    await logout();
    expect(accountMock.deleteSession).toHaveBeenCalledWith('current');
    expect(await getJwt()).toBe('fresh');
  });

  it('does not throw on failure', async () => {
    accountMock.deleteSession.mockRejectedValueOnce(new Error('network'));
    await expect(logout()).resolves.toBeUndefined();
  });
});
