import { logger } from '../../logger.js';
import { resolveNetwork } from '../../config/network.js';

/**
 * On-chain integration config. All values come from env so we can swap
 * testnet ↔ mainnet without code changes. License NFT integration is
 * disabled gracefully if any required value is missing.
 */
export interface OnchainConfig {
  enabled: boolean;
  network: 'mainnet' | 'testnet';
  apiEndpoint: string;
  apiKey: string;
  oracleMnemonic: string;
  /** Base64 BOC of the compiled LicenseItem code cell. */
  licenseItemCodeBoc: string;
  /** Base64 BOC of the compiled AppCollection code cell. */
  appCollectionCodeBoc: string;
  /** Default mint gas budget in nanotons. */
  mintGasNano: bigint;
  /** Default burn gas budget in nanotons. */
  burnGasNano: bigint;
}

function env(name: string, fallback = ''): string {
  return (process.env[name] || '').trim() || fallback;
}

export function loadOnchainConfig(): OnchainConfig {
  // Single source of truth for the active network: config/network.ts (pinned by
  // TON_NETWORK, defaults to mainnet). Previously this module hard-coded its own
  // `testnet` default for the SAME env var — when TON_NETWORK was unset, commerce
  // pinned mainnet while the mint worker ran testnet (split-brain). Delegating
  // here keeps the two halves of the money path on one network.
  const network = resolveNetwork();
  const defaultEndpoint =
    network === 'mainnet'
      ? 'https://toncenter.com/api/v2/jsonRPC'
      : 'https://testnet.toncenter.com/api/v2/jsonRPC';
  const apiEndpoint = env('TON_API_ENDPOINT', defaultEndpoint);
  const apiKey = env('TON_API_KEY');
  const oracleMnemonic = env('ORACLE_MNEMONIC');
  const licenseItemCodeBoc = env('LICENSE_NFT_ITEM_CODE_BOC');
  const appCollectionCodeBoc = env('APP_COLLECTION_CODE_BOC');

  const enabled = Boolean(oracleMnemonic && licenseItemCodeBoc && appCollectionCodeBoc);

  if (!enabled) {
    logger.warn(
      '[onchain] License NFT integration disabled — missing one of ORACLE_MNEMONIC / LICENSE_NFT_ITEM_CODE_BOC / APP_COLLECTION_CODE_BOC. Falling back to off-chain pseudo-license mode.',
    );
  }

  return {
    enabled,
    network,
    apiEndpoint,
    apiKey,
    oracleMnemonic,
    licenseItemCodeBoc,
    appCollectionCodeBoc,
    mintGasNano: BigInt(env('LICENSE_MINT_GAS_NANO', '250000000')),
    burnGasNano: BigInt(env('LICENSE_BURN_GAS_NANO', '70000000')),
  };
}
