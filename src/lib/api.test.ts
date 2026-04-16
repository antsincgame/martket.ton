import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAuditLogs, fetchAdminStats, fetchUsers, fetchTonBalance, ApiError } from './api';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.stubEnv('VITE_COMMERCE_API_URL', 'http://localhost:8081');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  });
}

describe('fetchAuditLogs', () => {
  it('returns audit log entries on success', async () => {
    const logs = [
      { id: '1', user_id: 'u1', action: 'login', resource: 'session', resource_id: null, result: 'success', metadata: null, ip_address: '1.2.3.4', user_agent: 'test', created_at: '2025-01-01' },
    ];
    mockFetch.mockReturnValue(jsonResponse({ success: true, data: logs }));

    const result = await fetchAuditLogs('test-token', 10);
    expect(result).toEqual(logs);

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/audit-logs?limit=10');
    expect(opts.headers).toHaveProperty('Authorization', 'Bearer test-token');
  });

  it('throws ApiError on non-ok response', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ message: 'Forbidden', code: 'FORBIDDEN' }, 403),
    );

    await expect(fetchAuditLogs('bad-token')).rejects.toThrow(ApiError);
  });
});

describe('fetchAdminStats', () => {
  it('returns stats data on success', async () => {
    const stats = { demiurges: 5, products: 10, publishedProducts: 7, recentActivity: 3 };
    mockFetch.mockReturnValue(jsonResponse({ success: true, data: stats }));

    const result = await fetchAdminStats('token');
    expect(result).toEqual(stats);
  });
});

describe('fetchUsers', () => {
  it('returns user profiles on success', async () => {
    const users = [{ id: '1', email: 'a@b.c', display_name: 'Test', role: 'demiurge' }];
    mockFetch.mockReturnValue(jsonResponse({ success: true, data: users }));

    const result = await fetchUsers('token');
    expect(result).toEqual(users);
  });
});

describe('fetchTonBalance', () => {
  it('converts nanotons to human-readable format', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ balance: '1500000000' }),
    );

    const result = await fetchTonBalance('EQtest');
    expect(result).toBe('1.5');
  });

  it('handles whole number balance', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ balance: '5000000000' }),
    );

    const result = await fetchTonBalance('EQtest');
    expect(result).toBe('5');
  });

  it('returns "0" on fetch failure', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({ ok: false, status: 500, statusText: 'Error' }),
    );

    const result = await fetchTonBalance('EQtest');
    expect(result).toBe('0');
  });

  it('returns "0" when balance is missing', async () => {
    mockFetch.mockReturnValue(jsonResponse({}));

    const result = await fetchTonBalance('EQtest');
    expect(result).toBe('0');
  });

  it('handles very large balances', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ balance: '123456789012345678' }),
    );

    const result = await fetchTonBalance('EQtest');
    expect(result).toMatch(/^123456789\.012345678$/);
  });

  it('encodes address in URL', async () => {
    mockFetch.mockReturnValue(jsonResponse({ balance: '0' }));

    await fetchTonBalance('EQ+special/chars');
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [string];
    expect(lastCall[0]).toContain('EQ%2Bspecial%2Fchars');
  });
});
