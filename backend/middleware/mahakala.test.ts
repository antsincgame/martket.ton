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
    removeHeader: vi.fn((k: string) => headers.delete(k)),
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
    expect(res._headers.get('Permissions-Policy')).toContain('camera=()');
    expect(res._headers.get('Permissions-Policy')).toContain('usb=()');
    expect(res._headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res._headers.get('X-Frame-Options')).toBe('DENY');
    expect(res._headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
    expect(res._headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
    expect(res._headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');
    expect(res.removeHeader).toHaveBeenCalledWith('Server');
    expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next() exactly once', () => {
    const req = {} as Parameters<typeof mahakalaHeaders>[0];
    const res = createMockRes();
    const next = vi.fn();

    mahakalaHeaders(req, res as unknown as Parameters<typeof mahakalaHeaders>[1], next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets HSTS in production', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const req = {} as Parameters<typeof mahakalaHeaders>[0];
      const res = createMockRes();
      const next = vi.fn();
      mahakalaHeaders(req, res as unknown as Parameters<typeof mahakalaHeaders>[1], next);
      expect(res._headers.get('Strict-Transport-Security')).toBe(
        'max-age=63072000; includeSubDomains; preload',
      );
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  it('omits HSTS outside production', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      const req = {} as Parameters<typeof mahakalaHeaders>[0];
      const res = createMockRes();
      const next = vi.fn();
      mahakalaHeaders(req, res as unknown as Parameters<typeof mahakalaHeaders>[1], next);
      expect(res._headers.has('Strict-Transport-Security')).toBe(false);
    } finally {
      process.env.NODE_ENV = orig;
    }
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
