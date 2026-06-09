/**
 * TON/USD price oracle with cascading providers and 15-minute cache.
 *
 * Единый источник истины для конвертации TON↔USD во всём commerce-бэкенде:
 * создание листингов, расчёт заказов и публичный /api/ton-price берут цену отсюда.
 *
 * Цепочка провайдеров (первый успех выигрывает):
 *   1. CoinGecko      — бесплатный, без ключа
 *   2. Binance        — бесплатный публичный тикер TONUSDT
 *   3. CoinMarketRate — бесплатный, без регистрации (последний резерв)
 *
 * Любая цена вне коридора [MIN_SANE_USD, MAX_SANE_USD] считается невалидной
 * (защита от битого/манипулированного ответа провайдера).
 *
 * При 15-минутном кэше один инстанс делает не более ~4 запросов/час.
 */

import { logger } from '../logger.js';

const CACHE_TTL_MS = 15 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;

// Разумный коридор цены TON в USD. Значения вне него отбрасываются.
const MIN_SANE_USD = 0.1;
const MAX_SANE_USD = 100;

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
    return await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
  } finally {
    clearTimeout(timer);
  }
}

/** Проверка, что цена положительна и в разумном коридоре. Бросает при невалидной. */
function assertSane(price: number, provider: string): number {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`${provider} returned non-positive price`);
  }
  if (price < MIN_SANE_USD || price > MAX_SANE_USD) {
    throw new Error(`${provider} price $${price} out of sane range [${MIN_SANE_USD}, ${MAX_SANE_USD}]`);
  }
  return price;
}

async function fetchFromCoinGecko(): Promise<number> {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = (await res.json()) as { 'the-open-network'?: { usd?: number } };
  return assertSane(Number(data?.['the-open-network']?.usd), 'CoinGecko');
}

async function fetchFromBinance(): Promise<number> {
  const url = 'https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const data = (await res.json()) as { price?: string };
  return assertSane(Number(data?.price), 'Binance');
}

async function fetchFromCoinMarketRate(): Promise<number> {
  const url = 'https://coinmarketrate.com/api/v1/toncoin/?amount=1&currency=usd';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CoinMarketRate HTTP ${res.status}`);
  const data = (await res.json()) as { price?: number; data?: { price?: number } };
  return assertSane(Number(data?.price ?? data?.data?.price), 'CoinMarketRate');
}

interface PriceProvider {
  name: string;
  fetch: () => Promise<number>;
}

const providers: PriceProvider[] = [
  { name: 'CoinGecko', fetch: fetchFromCoinGecko },
  { name: 'Binance', fetch: fetchFromBinance },
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
    if (Number.isFinite(fallback) && fallback >= MIN_SANE_USD && fallback <= MAX_SANE_USD) {
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
