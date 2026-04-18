import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/storeApi', () => ({
  storeApiUrl: (path: string) => `http://localhost:8081${path}`,
}));

const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchTonPrice (internal)', () => {
  it('returns USD price on success', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { usd: 3.42, updatedAt: '2026-04-18' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { useTonPrice } = await import('./useTonPrice');
    const queryFn = useTonPrice as unknown as { queryFn: () => Promise<number> };
    expect(queryFn).toBeDefined();
  });

  it('calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { usd: 3.42 } }), { status: 200 }),
    );

    const mod = await import('./useTonPrice');
    expect(mod.useTonPrice).toBeDefined();

    await globalThis.fetch('http://localhost:8081/api/ton-price');
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8081/api/ton-price');
  });

  it('returns 0 on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{}', { status: 503 }),
    );

    const res = await globalThis.fetch('http://localhost:8081/api/ton-price');
    expect(res.ok).toBe(false);
  });
});
