import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { mahakalaHeaders, logShieldStatus } from './mahakala.js';
import { logger } from '../logger.js';

function createMockRes() {
  const headers = new Map<string, string>();
  return {
    setHeader: vi.fn((k: string, v: string) => headers.set(k, v)),
    _headers: headers,
  };
}

describe('mahakalaHeaders', () => {
  it('sets all required security headers', () => {
    const req = {} as Parameters<typeof mahakalaHeaders>[0];
    const res = createMockRes();
    const next = vi.fn();

    mahakalaHeaders(req, res as unknown as Parameters<typeof mahakalaHeaders>[1], next);

    expect(res._headers.get('X-Dharma-Shield')).toBe('mahakala');
    expect(res._headers.get('X-Shield-Integrity')).toBe('intact');
    expect(res._headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res._headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=(), payment=()');
    expect(res._headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res._headers.get('X-Frame-Options')).toBe('DENY');
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next() exactly once', () => {
    const req = {} as Parameters<typeof mahakalaHeaders>[0];
    const res = createMockRes();
    const next = vi.fn();

    mahakalaHeaders(req, res as unknown as Parameters<typeof mahakalaHeaders>[1], next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('logShieldStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs ACTIVE when integrity is intact', () => {
    logShieldStatus();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('ACTIVE'));
    expect(logger.error).not.toHaveBeenCalled();
  });
});
