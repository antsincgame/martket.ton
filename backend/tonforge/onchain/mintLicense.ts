import { Address, beginCell } from '@ton/core';
import { logger } from '../../logger.js';
import { loadOnchainConfig } from './config.js';
import { getTonClient } from './tonClient.js';
import { sendFromOracle } from './oracleWallet.js';
import {
  buildIndividualContent,
  buildMintLicensePayload,
  computeItemAddress,
} from './contractSchemas.js';

export interface MintLicenseInput {
  collectionAddress: string;
  buyerWallet: string;
  escrowAddress: string;
  index: bigint;
  /** Off-chain JSON URI for the individual NFT metadata. */
  metadataUri: string;
  /** 0 = soulbound, >0 allows N transfers. */
  transferLimit: number;
  /** Unix timestamp after which BuyerBurn is no longer allowed. */
  burnDeadline: number;
}

export interface MintLicenseResult {
  itemAddress: string;
  txSeqno: number;
  txQueryId: bigint;
}

/**
 * Send a MintLicense message from the oracle wallet to the AppCollection.
 * Computes the deterministic item address client-side so callers can poll it.
 */
export async function mintLicense(input: MintLicenseInput): Promise<MintLicenseResult> {
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) {
    throw new Error('ONCHAIN_DISABLED');
  }

  const collection = Address.parse(input.collectionAddress);
  const buyer = Address.parse(input.buyerWallet);
  const escrow = Address.parse(input.escrowAddress);

  const individualContent = buildIndividualContent(input.metadataUri);

  const itemAddress = await computeItemAddress({
    index: input.index,
    collection,
    ownerAddress: buyer,
    escrowAddress: escrow,
    transferLimit: input.transferLimit,
    burnDeadline: input.burnDeadline,
    content: individualContent,
  });

  const queryId = BigInt(Date.now());
  const payload = buildMintLicensePayload({
    queryId,
    buyerAddress: buyer,
    escrowAddress: escrow,
    transferLimit: input.transferLimit,
    burnDeadline: input.burnDeadline,
    individualContent,
  });

  const seqno = await sendFromOracle([
    { to: collection, value: cfg.mintGasNano, bounce: true, body: payload },
  ]);

  logger.info(
    `[onchain.mint] sent MintLicense queryId=${queryId} index=${input.index} item=${itemAddress.toString()} buyer=${buyer.toString()}`,
  );

  return {
    itemAddress: itemAddress.toString(),
    txSeqno: seqno,
    txQueryId: queryId,
  };
}

export interface PollItemDeployedOpts {
  itemAddress: string;
  /** Total wait in ms; default 30s. */
  timeoutMs?: number;
  /** Interval in ms; default 2.5s. */
  intervalMs?: number;
}

/**
 * Wait until the freshly minted LicenseItem becomes active and exposes
 * get_nft_data. Returns true on success, false on timeout.
 */
export async function pollItemDeployed(opts: PollItemDeployedOpts): Promise<boolean> {
  const timeout = opts.timeoutMs ?? 30_000;
  const interval = opts.intervalMs ?? 2_500;
  const deadline = Date.now() + timeout;
  const addr = Address.parse(opts.itemAddress);
  const client = getTonClient();

  while (Date.now() < deadline) {
    try {
      const state = await client.getContractState(addr);
      if (state.state === 'active') {
        await client.runMethod(addr, 'get_nft_data');
        return true;
      }
    } catch (err) {
      logger.warn('[onchain.mint] poll attempt failed:', err);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  logger.warn(`[onchain.mint] poll timeout for ${opts.itemAddress}`);
  return false;
}

// Silence unused-var false positive when beginCell isn't needed yet.
void beginCell;
