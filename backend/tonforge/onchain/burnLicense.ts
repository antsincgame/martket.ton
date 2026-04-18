import { Address, internal, SendMode } from '@ton/core';
import { logger } from '../../logger.js';
import { loadOnchainConfig } from './config.js';
import { getTonClient } from './tonClient.js';
import { getOracleWallet } from './oracleWallet.js';
import { buildBurnLicensePayload } from './contractSchemas.js';

export interface BurnLicenseInput {
  collectionAddress: string;
  itemAddress: string;
}

export interface BurnLicenseResult {
  txSeqno: number;
  txQueryId: bigint;
}

/**
 * Send BurnLicense to the AppCollection, which forwards Burn{} to the item.
 * The item self-destructs and refunds its remaining balance to the buyer.
 */
export async function burnLicense(input: BurnLicenseInput): Promise<BurnLicenseResult> {
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) {
    throw new Error('ONCHAIN_DISABLED');
  }

  const collection = Address.parse(input.collectionAddress);
  const item = Address.parse(input.itemAddress);

  const queryId = BigInt(Date.now());
  const payload = buildBurnLicensePayload({ queryId, itemAddress: item });

  const oracle = await getOracleWallet();
  const seqno = await oracle.wallet.getSeqno();
  await oracle.wallet.sendTransfer({
    seqno,
    secretKey: oracle.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: collection,
        value: cfg.burnGasNano,
        bounce: true,
        body: payload,
      }),
    ],
  });

  logger.info(
    `[onchain.burn] sent BurnLicense queryId=${queryId} item=${item.toString()} collection=${collection.toString()}`,
  );

  return { txSeqno: seqno, txQueryId: queryId };
}

export interface PollItemBurnedOpts {
  itemAddress: string;
  timeoutMs?: number;
  intervalMs?: number;
}

/** Wait until the License contract is no longer active (i.e. burned). */
export async function pollItemBurned(opts: PollItemBurnedOpts): Promise<boolean> {
  const timeout = opts.timeoutMs ?? 60_000;
  const interval = opts.intervalMs ?? 3_000;
  const deadline = Date.now() + timeout;
  const addr = Address.parse(opts.itemAddress);
  const client = getTonClient();

  while (Date.now() < deadline) {
    try {
      const state = await client.getContractState(addr);
      if (state.state !== 'active') {
        return true;
      }
    } catch (err) {
      logger.warn('[onchain.burn] poll attempt failed:', err);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}
