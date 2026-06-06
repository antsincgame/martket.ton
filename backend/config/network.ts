import type { Request } from 'express';
import { logger } from '../logger.js';

export type TonNetwork = 'mainnet' | 'testnet';

export interface NetworkConfig {
  network: TonNetwork;
  tonapiBase: string;
  tonapiKey: string;
  treasuryAddress: string;
  trialWindowSec: number;
  /**
   * AppCollection contract address. Если не задан, escrow flow отключён
   * (buyer будет платить напрямую на treasury по memo, legacy path).
   */
  collectionAddress: string;
  /**
   * Owner address Collection (= backend signer wallet). Используется для
   * Option C mint flow: backend с этого wallet'а шлёт MintLicense после
   * индексации PayEscrow. Должен соответствовать ownerAddress в Collection.init.
   */
  collectionOwnerAddress: string;
  /**
   * Mnemonic (24 words) кошелька owner'а. Нужен для подписи MintLicense
   * транзакций в mint worker'е. СЕКРЕТ: никогда не логировать, не возвращать
   * в API response, хранить только в env/secrets.
   *
   * Формат: 24 слова через пробел, BIP39 English wordlist.
   */
  collectionOwnerMnemonic: string;
}

const NETWORK_HEADER = 'x-ton-network';

function env(name: string, fallback = ''): string {
  return (process.env[name] || '').trim() || fallback;
}

function envInt(name: string, fallback: number): number {
  const v = parseInt(env(name, String(fallback)), 10);
  return Number.isFinite(v) ? v : fallback;
}

const configs: Record<TonNetwork, NetworkConfig> = {
  mainnet: {
    network: 'mainnet',
    tonapiBase: env('TONAPI_BASE_URL_MAINNET', env('TONAPI_BASE_URL', 'https://tonapi.io')),
    tonapiKey: env('TONAPI_KEY_MAINNET', env('TONAPI_KEY', '')),
    treasuryAddress: env('TREASURY_WALLET_ADDRESS_MAINNET', env('TREASURY_WALLET_ADDRESS', '')),
    trialWindowSec: envInt('TRIAL_WINDOW_SEC', 259200),
    collectionAddress: env('COLLECTION_ADDRESS_MAINNET', env('COLLECTION_ADDRESS', '')),
    collectionOwnerAddress: env('COLLECTION_OWNER_ADDRESS_MAINNET', env('COLLECTION_OWNER_ADDRESS', '')),
    collectionOwnerMnemonic: env('COLLECTION_OWNER_MNEMONIC_MAINNET', env('COLLECTION_OWNER_MNEMONIC', '')),
  },
  testnet: {
    network: 'testnet',
    tonapiBase: env('TONAPI_BASE_URL_TESTNET', 'https://testnet.tonapi.io'),
    tonapiKey: env('TONAPI_KEY_TESTNET', env('TONAPI_KEY', '')),
    treasuryAddress: env('TREASURY_WALLET_ADDRESS_TESTNET', env('TREASURY_WALLET_ADDRESS', '')),
    trialWindowSec: envInt('TRIAL_WINDOW_SEC', 259200),
    collectionAddress: env('COLLECTION_ADDRESS_TESTNET', env('COLLECTION_ADDRESS', '')),
    collectionOwnerAddress: env('COLLECTION_OWNER_ADDRESS_TESTNET', env('COLLECTION_OWNER_ADDRESS', '')),
    collectionOwnerMnemonic: env('COLLECTION_OWNER_MNEMONIC_TESTNET', env('COLLECTION_OWNER_MNEMONIC', '')),
  },
};

/**
 * The active TON network is SERVER-PINNED via the TON_NETWORK env var (the same
 * source tonforge/onchain/config.ts reads). The client-supplied `x-ton-network`
 * header / `?network` query is advisory ONLY — it must never decide which
 * treasury / collection / tonapi the backend verifies payments against.
 * Otherwise a client could pay with free testnet TON and have it verified as a
 * mainnet purchase (network-confusion theft).
 *
 * Operators MUST set TON_NETWORK explicitly so that commerce and the on-chain
 * mint worker agree on a single network. Defaults to mainnet here to preserve
 * the previous commerce default when the var is unset.
 */
function pinnedNetwork(): TonNetwork {
  return env('TON_NETWORK', 'mainnet') === 'testnet' ? 'testnet' : 'mainnet';
}

export function resolveNetwork(req?: Request): TonNetwork {
  const pinned = pinnedNetwork();
  if (req) {
    const requested =
      req.get(NETWORK_HEADER) ||
      (typeof req.query.network === 'string' ? req.query.network : '');
    if (requested && requested !== pinned) {
      logger.warn(
        `[network] ignoring client-requested network '${requested}'; server is pinned to '${pinned}'`,
      );
    }
  }
  return pinned;
}

export function getNetworkConfig(network: TonNetwork): NetworkConfig {
  return configs[network];
}

export function resolveNetworkConfig(req: Request): NetworkConfig {
  return getNetworkConfig(resolveNetwork(req));
}
