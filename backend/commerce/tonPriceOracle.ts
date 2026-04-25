/**
 * CoinGecko TON/USD price oracle with 15-minute cache.
 *
 * Single source of truth for TON↔USD conversion across the entire commerce
 * backend: listing creation, order pricing, and the public /api/ton-price
 * endpoint all consume this module.
 *
 * Free CoinGecko demo API: ~30 req/min.  With a 15 min cache a single
 * instance makes at most 4 requests/hour — well within limits.
 */

import { logger } from '../logger.js';

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd';

const CACHE_TTL_MS = 15 * 60_000;

interface PriceCache {
  usd: number;
  updatedAt: string;
  fetchedAt: number;
}

let cache: PriceCache | null = null;

export async function getTonUsdPrice(): Promise<number> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.usd;
  }

  try {
    const res = await fetch(COINGECKO_URL);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = (await res.json()) as { 'the-open-network'?: { usd?: number } };
    const usd = data['the-open-network']?.usd ?? 0;
    if (usd <= 0) throw new Error('CoinGecko returned zero/negative price');

    cache = { usd, updatedAt: new Date().toISOString(), fetchedAt: now };
    return usd;
  } catch (err) {
    logger.warn('[tonPriceOracle] fetch failed:', err instanceof Error ? err.message : err);
    if (cache) {
      return cache.usd;
    }
    throw new Error('TON price unavailable and no stale cache');
  }
}

export function getCachedTonPrice(): PriceCache | null {
  return cache;
}

export function usdToTonHuman(usd: number, tonUsdRate: number): string {
  if (tonUsdRate <= 0) throw new Error('Invalid TON/USD rate');
  const ton = usd / tonUsdRate;
  const [whole, frac = ''] = ton.toFixed(9).split('.');
  const trimmed = frac.replace(/0+$/, '');
  return trimmed.length ? `${whole}.${trimmed}` : whole!;
}
