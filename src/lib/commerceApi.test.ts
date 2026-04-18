import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commerceUrl,
  fetchSellerOrders,
  fetchBuyerOrders,
  createCommerceOrder,
  fetchCommerceConfig,
  CommerceApiError,
  type SellerOrderRow,
} from './commerceApi';

vi.mock('./appwriteAuth', () => ({
  getJwt: vi.fn().mockResolvedValue('mock-jwt-token'),
}));

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
  vi.restoreAllMocks();
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

  it('returns orders array on 200 and forwards explicit Authorization header', async () => {
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

  it('uses JWT from getJwt when no explicit auth provided', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { orders: [] } }));
    await fetchSellerOrders(wallet);
    const [, init] = mockFetch().mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer mock-jwt-token');
  });

  it('throws CommerceApiError on non-2xx', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'forbidden' }, { status: 403 }),
    );
    await expect(fetchSellerOrders(wallet)).rejects.toThrow('forbidden');
  });

  it('thrown error is instance of CommerceApiError', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'denied' }, { status: 403 }),
    );
    try {
      await fetchSellerOrders(wallet);
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CommerceApiError);
    }
  });
});

describe('fetchBuyerOrders', () => {
  it('returns orders via commerceAuthFetch with JWT', async () => {
    const orders = [{ id: 'o1', state: 'paid' }];
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: { orders } }));

    const result = await fetchBuyerOrders();
    expect(result).toEqual(orders);

    const [url, init] = mockFetch().mock.calls[0];
    expect(String(url)).toContain('/buyers/me/orders');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer mock-jwt-token');
  });

  it('throws on 401', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'Unauthorized' }, { status: 401 }),
    );
    await expect(fetchBuyerOrders()).rejects.toThrow('Unauthorized');
  });
});

describe('createCommerceOrder', () => {
  it('sends POST with listingId, buyerWallet and JWT', async () => {
    const orderData = { orderId: 'ord_1', memo: 'memo_1', amountRaw: '1000' };
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: orderData }));

    const result = await createCommerceOrder('listing_1', 'EQBUYER');
    expect(result).toEqual(orderData);

    const [url, init] = mockFetch().mock.calls[0];
    expect(String(url)).toContain('/orders');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ listingId: 'listing_1', buyerWallet: 'EQBUYER' });
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBe('Bearer mock-jwt-token');
  });

  it('includes error code in CommerceApiError', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'Wallet mismatch', code: 'WALLET_MISMATCH' }, { status: 403 }),
    );
    try {
      await createCommerceOrder('l1', 'EQ1');
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CommerceApiError);
      expect((err as CommerceApiError).code).toBe('WALLET_MISMATCH');
      expect((err as CommerceApiError).message).toContain('WALLET_MISMATCH');
    }
  });
});

describe('fetchCommerceConfig', () => {
  it('returns config data on success', async () => {
    const config = { operatorWallet: 'EQ_OP', feeBps: 500 };
    mockFetch().mockResolvedValueOnce(jsonResponse({ data: config }));
    const result = await fetchCommerceConfig();
    expect(result).toEqual(config);
  });

  it('returns null on network error', async () => {
    mockFetch().mockRejectedValueOnce(new Error('network'));
    const result = await fetchCommerceConfig();
    expect(result).toBeNull();
  });

  it('returns null on non-2xx', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'not configured' }, { status: 503 }),
    );
    const result = await fetchCommerceConfig();
    expect(result).toBeNull();
  });
});
