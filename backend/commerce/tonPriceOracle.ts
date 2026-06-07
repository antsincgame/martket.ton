/**
 * TON/USD price oracle with cascading providers and 15-minute cache.
 *
 * Single source of truth for TON↔USD conversion across the entire commerce
 * backend: listing creation, order pricing, and the public /api/ton-price
 * endpoint all consume this module.
 *
 * Provider chain (first success wins):
 *   1. CoinCap v2 — free, 200 req/min, no key
 *   2. CoinMarketRate — free, no registration
 *
 * With a 15 min cache a single instance makes at most 4 requests/hour.
 */

import { logger } from '../logger.js';

const CACHE_TTL_MS = 15 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;

interface PriceCache {
  usd: number;
  updatedAt: string;
  fetchedAt: number;
  source: string;
}

let cache: PriceCache | null = null;

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromCoinCap(): Promise<number> {
  const url = 'https://api.coincap.io/v2/assets/toncoin';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CoinCap HTTP ${res.status}`);
  const data = (await res.json()) as { data?: { priceUsd?: string } };
  const price = Number(data?.data?.priceUsd);
  if (!price || price <= 0) throw new Error('CoinCap returned invalid price');
  return price;
}

async function fetchFromCoinMarketRate(): Promise<number> {
  const url = 'https://coinmarketrate.com/api/v1/toncoin/?amount=1&currency=usd';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CoinMarketRate HTTP ${res.status}`);
  const data = (await res.json()) as { price?: number; data?: { price?: number } };
  const price = Number(data?.price ?? data?.data?.price);
  if (!price || price <= 0) throw new Error('CoinMarketRate returned invalid price');
  return price;
}

interface PriceProvider {
  name: string;
  fetch: () => Promise<number>;
}

const providers: PriceProvider[] = [
  { name: 'CoinCap', fetch: fetchFromCoinCap },
  { name: 'CoinMarketRate', fetch: fetchFromCoinMarketRate },
];

async function fetchPriceFromChain(): Promise<{ usd: number; source: string }> {
  for (const provider of providers) {
    try {
      const usd = await provider.fetch();
      logger.info(`[tonPriceOracle] ${provider.name}: $${usd.toFixed(4)}`);
      return { usd, source: provider.name };
    } catch (err) {
      logger.warn(
        `[tonPriceOracle] ${provider.name} failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  throw new Error('All price providers failed');
}

export async function getTonUsdPrice(): Promise<number> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.usd;
  }

  try {
    const { usd, source } = await fetchPriceFromChain();
    cache = { usd, updatedAt: new Date().toISOString(), fetchedAt: now, source };
    return usd;
  } catch (err) {
    logger.warn('[tonPriceOracle] all providers failed:', err instanceof Error ? err.message : err);
    if (cache) {
      return cache.usd;
    }
    const fallback = Number(process.env.TON_USD_FALLBACK);
    if (Number.isFinite(fallback) && fallback > 0) {
      logger.warn(`[tonPriceOracle] using TON_USD_FALLBACK=$${fallback.toFixed(4)}`);
      cache = {
        usd: fallback,
        updatedAt: new Date().toISOString(),
        fetchedAt: now,
        source: 'TON_USD_FALLBACK',
      };
      return fallback;
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
