import { TonClient } from '@ton/ton';
import { Cell } from '@ton/core';
import { logger } from '../../logger.js';
import { loadOnchainConfig } from './config.js';

let cachedClient: TonClient | null = null;
let cachedItemCode: Cell | null = null;
let cachedCollectionCode: Cell | null = null;

export function getTonClient(): TonClient {
  if (cachedClient) return cachedClient;
  const cfg = loadOnchainConfig();
  cachedClient = new TonClient({
    endpoint: cfg.apiEndpoint,
    apiKey: cfg.apiKey || undefined,
  });
  logger.info(`[onchain] TonClient initialized for ${cfg.network} (${cfg.apiEndpoint})`);
  return cachedClient;
}

export function getLicenseItemCode(): Cell {
  if (cachedItemCode) return cachedItemCode;
  const cfg = loadOnchainConfig();
  if (!cfg.licenseItemCodeBoc) {
    throw new Error('LICENSE_NFT_ITEM_CODE_BOC env var is not set');
  }
  cachedItemCode = Cell.fromBase64(cfg.licenseItemCodeBoc);
  return cachedItemCode;
}

export function getAppCollectionCode(): Cell {
  if (cachedCollectionCode) return cachedCollectionCode;
  const cfg = loadOnchainConfig();
  if (!cfg.appCollectionCodeBoc) {
    throw new Error('APP_COLLECTION_CODE_BOC env var is not set');
  }
  cachedCollectionCode = Cell.fromBase64(cfg.appCollectionCodeBoc);
  return cachedCollectionCode;
}

export function resetTonClientCache(): void {
  cachedClient = null;
  cachedItemCode = null;
  cachedCollectionCode = null;
}
