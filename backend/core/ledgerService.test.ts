import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../commerce/tonPriceOracle.js', () => ({ getTonUsdPrice: vi.fn() }));
vi.mock('./ledgerRepository.js', () => ({ insertLedgerEntry: vi.fn() }));

import { recordLedgerEntry } from './ledgerService.js';
import { getTonUsdPrice } from '../commerce/tonPriceOracle.js';
import { insertLedgerEntry } from './ledgerRepository.js';

const mPrice = getTonUsdPrice as unknown as ReturnType<typeof vi.fn>;
const mInsert = insertLedgerEntry as unknown as ReturnType<typeof vi.fn>;

type Params = Parameters<typeof recordLedgerEntry>[0];
const baseParams = {
  entryType: 'purchase',
  refType: 'order',
  refId: 'ord-1',
  amountUsd: 10,
  amountTonRaw: '1000000000',
} as Params;

beforeEach(() => {
  vi.clearAllMocks();
  mInsert.mockImplementation(async (p: { ton_usd_rate?: number | null }) => ({ id: 'led-1', ...p }));
});

describe('recordLedgerEntry — ton_usd_rate integrity', () => {
  it('records the real rate when the oracle succeeds', async () => {
    mPrice.mockResolvedValue(5.25);
    await recordLedgerEntry(baseParams);
    expect(mInsert).toHaveBeenCalledTimes(1);
    expect(mInsert.mock.calls[0][0].ton_usd_rate).toBe(5.25);
  });

  it('records null (not a fabricated 0) when the oracle is unavailable', async () => {
    mPrice.mockRejectedValue(new Error('TON price unavailable and no stale cache'));
    await recordLedgerEntry(baseParams);
    expect(mInsert).toHaveBeenCalledTimes(1);
    expect(mInsert.mock.calls[0][0].ton_usd_rate).toBeNull();
  });
});
