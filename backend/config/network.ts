import type { Request } from 'express';

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
  },
  testnet: {
    network: 'testnet',
    tonapiBase: env('TONAPI_BASE_URL_TESTNET', 'https://testnet.tonapi.io'),
    tonapiKey: env('TONAPI_KEY_TESTNET', env('TONAPI_KEY', '')),
    treasuryAddress: env('TREASURY_WALLET_ADDRESS_TESTNET', env('TREASURY_WALLET_ADDRESS', '')),
    trialWindowSec: envInt('TRIAL_WINDOW_SEC', 259200),
    collectionAddress: env('COLLECTION_ADDRESS_TESTNET', env('COLLECTION_ADDRESS', '')),
    collectionOwnerAddress: env('COLLECTION_OWNER_ADDRESS_TESTNET', env('COLLECTION_OWNER_ADDRESS', '')),
  },
};

export function resolveNetwork(req: Request): TonNetwork {
  const header = req.get(NETWORK_HEADER);
  if (header === 'testnet') return 'testnet';
  const query = req.query.network;
  if (query === 'testnet') return 'testnet';
  return 'mainnet';
}

export function getNetworkConfig(network: TonNetwork): NetworkConfig {
  return configs[network];
}

export function resolveNetworkConfig(req: Request): NetworkConfig {
  return getNetworkConfig(resolveNetwork(req));
}
