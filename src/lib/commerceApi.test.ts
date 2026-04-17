import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commerceUrl,
  fetchSellerDisputes,
  fetchSellerOrders,
  type SellerDisputeRow,
  type SellerOrderRow,
} from './commerceApi';

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  const status = init?.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockFetch = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

describe('commerceUrl', () => {
  it('prepends /api/v1/commerce regardless of leading slash', () => {
    expect(commerceUrl('/config')).toMatch(/\/api\/v1\/commerce\/config$/);
    expect(commerceUrl('config')).toMatch(/\/api\/v1\/commerce\/config$/);
  });
});

describe('fetchSellerOrders', () => {
  const wallet = 'EQTEST';

  it('returns orders array on 200 and forwards Authorization header', async () => {
    const orders: SellerOrderRow[] = [
      {
        id: 'o1',
        listingId: 'l1',
        listingTitle: 'Demo App',
        buyerWallet: 'EQBUYER',
        state: 'paid',
        amountRaw: '1000000000',
        currency: 'TON',
        memo: 'm1',
        tonTxHash: 'hash1',
        createdAt: '2026-04-17T00:00:00.000Z',
      },
    ];
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { orders } }));

    const result = await fetchSellerOrders(wallet, 'Bearer abc', 25);

    expect(result).toEqual(orders);
    expect(mockFetch()).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch().mock.calls[0];
    expect(String(url)).toContain(`/sellers/${wallet}/orders?limit=25`);
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer abc' });
  });

  it('omits Authorization header when token is missing', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { orders: [] } }));
    await fetchSellerOrders(wallet);
    const [, init] = mockFetch().mock.calls[0];
    expect((init as RequestInit).headers).toBeUndefined();
  });

  it('throws human-readable error on non-2xx', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'forbidden' }, { status: 403 }),
    );
    await expect(fetchSellerOrders(wallet)).rejects.toThrow('forbidden');
  });
});

describe('fetchSellerDisputes', () => {
  const wallet = 'EQTEST';

  it('returns disputes array on 200', async () => {
    const disputes: SellerDisputeRow[] = [
      {
        id: 'd1',
        orderId: 'o1',
        buyerWallet: 'EQBUYER',
        reason: 'не работает',
        status: 'open',
        resolutionNote: '',
        createdAt: '2026-04-17T00:00:00.000Z',
        order: {
          listingTitle: 'Demo App',
          amountRaw: '500000000',
          currency: 'TON',
          state: 'paid',
        },
      },
    ];
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { disputes } }));

    const result = await fetchSellerDisputes(wallet);

    expect(result).toEqual(disputes);
    const [url] = mockFetch().mock.calls[0];
    expect(String(url)).toContain(`/sellers/${wallet}/disputes`);
  });

  it('throws on backend error', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'boom' }, { status: 500 }),
    );
    await expect(fetchSellerDisputes(wallet)).rejects.toThrow('boom');
  });
});
