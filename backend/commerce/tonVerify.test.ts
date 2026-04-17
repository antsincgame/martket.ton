import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { addressesEqual, verifyPaymentByMemo, verifyNativeTonTransfer } from './tonVerify.js';

describe('addressesEqual', () => {
  it('returns true for identical raw strings', () => {
    expect(addressesEqual('EQAbc', 'EQAbc')).toBe(true);
  });

  it('returns true when both are empty/undefined', () => {
    expect(addressesEqual(undefined, undefined)).toBe(true);
    expect(addressesEqual('', '')).toBe(true);
  });

  it('returns false for clearly different strings', () => {
    expect(addressesEqual('EQAbc', 'EQXyz')).toBe(false);
  });

  it('trims whitespace in fallback comparison', () => {
    expect(addressesEqual('  abc  ', 'abc')).toBe(true);
  });
});

describe('verifyNativeTonTransfer (fetch mocked)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockFetch = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

  it('returns NO_IN_MSG when transaction has no in_msg', async () => {
    mockFetch().mockResolvedValueOnce(
      new Response(JSON.stringify({ hash: 'abc' }), { status: 200 }),
    );

    const result = await verifyNativeTonTransfer({
      txHash: 'abc',
      treasuryAddress: 'EQTREASURY',
      fromAddress: 'EQBUYER',
      expectedAmountRaw: '1000000000',
      expectedMemo: 'memo1',
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('NO_IN_MSG');
  });

  it('returns ok:true when all fields match', async () => {
    mockFetch().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          hash: 'abc',
          in_msg: {
            destination_address: 'EQTREASURY',
            source_address: 'EQBUYER',
            value: '1000000000',
            decoded_body: { type: 'text_comment', value: 'memo1' },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await verifyNativeTonTransfer({
      txHash: 'abc',
      treasuryAddress: 'EQTREASURY',
      fromAddress: 'EQBUYER',
      expectedAmountRaw: '1000000000',
      expectedMemo: 'memo1',
    });

    expect(result.ok).toBe(true);
  });

  it('returns AMOUNT_TOO_LOW when value is insufficient', async () => {
    mockFetch().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          hash: 'abc',
          in_msg: {
            destination_address: 'EQTREASURY',
            source_address: 'EQBUYER',
            value: '500000000',
            decoded_body: { text: 'memo1' },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await verifyNativeTonTransfer({
      txHash: 'abc',
      treasuryAddress: 'EQTREASURY',
      fromAddress: 'EQBUYER',
      expectedAmountRaw: '1000000000',
      expectedMemo: 'memo1',
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('AMOUNT_TOO_LOW');
  });

  it('throws on TonAPI error', async () => {
    mockFetch().mockResolvedValueOnce(
      new Response('Service unavailable', { status: 503 }),
    );

    await expect(
      verifyNativeTonTransfer({
        txHash: 'abc',
        treasuryAddress: 'EQTREASURY',
        fromAddress: 'EQBUYER',
        expectedAmountRaw: '1000000000',
        expectedMemo: 'memo1',
      }),
    ).rejects.toThrow('TonAPI 503');
  });
});

describe('verifyPaymentByMemo (fetch mocked)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  const mockFetch = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

  it('returns TX_NOT_FOUND_BY_MEMO when no matching tx found', async () => {
    mockFetch().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ transactions: [] }), { status: 200 })),
    );

    const promise = verifyPaymentByMemo('EQTREASURY', {
      buyerWallet: 'EQBUYER',
      amountRaw: '1000000000',
      memo: 'cm_test123',
    });

    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
    }

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('TX_NOT_FOUND_BY_MEMO');
  });

  it('returns ok:true with txHash when matching tx found on first poll', async () => {
    mockFetch().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          transactions: [
            {
              hash: 'real_hash_abc',
              in_msg: {
                destination_address: 'EQTREASURY',
                source_address: 'EQBUYER',
                value: '1000000000',
                decoded_body: { type: 'text_comment', value: 'cm_test123' },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await verifyPaymentByMemo('EQTREASURY', {
      buyerWallet: 'EQBUYER',
      amountRaw: '1000000000',
      memo: 'cm_test123',
    });

    expect(result.ok).toBe(true);
    expect(result.txHash).toBe('real_hash_abc');
  });
});
