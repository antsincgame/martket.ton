import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, type OpenedContract } from '@ton/ton';
import { logger } from '../../logger.js';
import { loadOnchainConfig } from './config.js';
import { getTonClient } from './tonClient.js';

interface OracleHandle {
  wallet: OpenedContract<WalletContractV4>;
  publicKey: Buffer;
  secretKey: Buffer;
}

let cached: OracleHandle | null = null;

export async function getOracleWallet(): Promise<OracleHandle> {
  if (cached) return cached;
  const cfg = loadOnchainConfig();
  if (!cfg.oracleMnemonic) {
    throw new Error('ORACLE_MNEMONIC env var is not set');
  }
  const words = cfg.oracleMnemonic.split(/\s+/).filter(Boolean);
  if (words.length !== 24) {
    throw new Error(`ORACLE_MNEMONIC must be 24 words, got ${words.length}`);
  }
  const keyPair = await mnemonicToWalletKey(words);
  const walletContract = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const wallet = getTonClient().open(walletContract);
  cached = { wallet, publicKey: keyPair.publicKey, secretKey: keyPair.secretKey };
  logger.info(`[onchain] Oracle wallet ready: ${walletContract.address.toString()}`);
  return cached;
}

export async function getOracleAddressString(): Promise<string> {
  const handle = await getOracleWallet();
  return handle.wallet.address.toString();
}

export function resetOracleCache(): void {
  cached = null;
}
