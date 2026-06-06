/**
 * Per-seller AppCollection provisioning (Phase 1: platform-owned collections).
 *
 * Each seller gets a distinct AppCollection whose on-chain owner is the platform
 * COLLECTION_OWNER key — so the existing mint worker (which signs with that key)
 * can mint into it without any contract change. The collection is deployed by
 * the platform; the seller never signs.
 *
 * The deterministic address derivation mirrors `contracts/scripts/deployCollection.ts`
 * EXACTLY (same fromInit args + TEP-64 content cells) so the address this service
 * computes equals the address the canonical deploy script would produce.
 *
 * Safety: this is gated on COLLECTION_OWNER being configured for the network
 * (same pattern as mintWorker). Without it, provisioning refuses instead of
 * producing a half-state. It does NOT change the existing listing/mint flow —
 * a listing still references a collection address explicitly.
 *
 * NOTE: the on-chain deploy requires the Tact build artifact
 * (contracts/build/AppCollection_AppCollection.js), a funded COLLECTION_OWNER
 * wallet, and TON network access. It is verified on testnet via the runbook,
 * not in unit tests. The pure helpers below ARE unit-tested.
 */

import { createHash } from 'crypto';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import { getNetworkConfig, type TonNetwork } from '../config/network.js';
import { logger } from '../logger.js';
import {
  findSellerCollection,
  upsertPendingCollection,
  markDeployed,
  markFailed,
} from './sellerCollectionRepository.js';

export class ProvisionConfigError extends Error {
  readonly code = 'PROVISION_NOT_CONFIGURED';
}

// ─── Pure helpers (unit-tested) ─────────────────────────────────────

/** TEP-64 off-chain content cell: prefix 0x01 + snake string URI. */
export function buildOffchainContent(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}

/**
 * Deterministic 256-bit appId per (seller, network). Stable so the same seller
 * always maps to the same collection address; distinct per seller so addresses
 * never collide.
 */
export function deriveAppId(sellerWallet: string, network: TonNetwork): bigint {
  const hex = createHash('sha256').update(`${network}:${sellerWallet}`).digest('hex');
  return BigInt('0x' + hex);
}

function metadataBase(): string {
  return (process.env.COLLECTION_METADATA_BASE || 'https://cdn.tonforge.org/collections').replace(/\/+$/, '');
}

/** Deterministic per-seller metadata URIs (part of the address derivation). */
export function buildSellerMetadataUris(
  sellerWallet: string,
  network: TonNetwork,
): { metadataUri: string; itemBaseUri: string } {
  const base = `${metadataBase()}/${network}/${sellerWallet}`;
  return { metadataUri: `${base}/collection.json`, itemBaseUri: `${base}/items/` };
}

// ─── Address derivation (needs Tact build artifact at runtime) ──────

interface AppCollectionStatic {
  fromInit(
    appId: bigint,
    ownerAddress: Address,
    collectionContent: Cell,
    commonContent: Cell,
  ): Promise<{ address: Address; init: { code: Cell; data: Cell } }>;
}

let _AppCollection: AppCollectionStatic | null = null;

async function loadAppCollection(): Promise<AppCollectionStatic> {
  if (_AppCollection) return _AppCollection;
  // Same mechanism escrow.ts uses: the Tact autogen wrapper lives in
  // contracts/build/ (gitignored) and is resolved at runtime, not by tsc.
  const modPath = '../../contracts/build/AppCollection_AppCollection.js';
  const mod = (await import(modPath)) as { AppCollection: AppCollectionStatic };
  _AppCollection = mod.AppCollection;
  return _AppCollection;
}

export async function computeCollectionInit(
  appId: bigint,
  ownerAddress: Address,
  metadataUri: string,
  itemBaseUri: string,
): Promise<{ address: Address; init: { code: Cell; data: Cell } }> {
  const AppCollection = await loadAppCollection();
  return AppCollection.fromInit(
    appId,
    ownerAddress,
    buildOffchainContent(metadataUri),
    buildOffchainContent(itemBaseUri),
  );
}

// ─── On-chain deploy (infra; testnet-verified, not unit-tested) ─────

function jsonRpcEndpoint(network: TonNetwork): string {
  return network === 'mainnet'
    ? 'https://toncenter.com/api/v2/jsonRPC'
    : 'https://testnet.toncenter.com/api/v2/jsonRPC';
}

async function deployCollectionOnChain(params: {
  network: TonNetwork;
  mnemonic: string;
  address: Address;
  init: { code: Cell; data: Cell };
}): Promise<{ deployed: boolean }> {
  const { mnemonicToPrivateKey } = await import('@ton/crypto');
  const { TonClient, WalletContractV4 } = await import('@ton/ton');
  const { internal, SendMode } = await import('@ton/core');

  const keypair = await mnemonicToPrivateKey(params.mnemonic.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey });
  const client = new TonClient({
    endpoint: jsonRpcEndpoint(params.network),
    apiKey: process.env.TON_API_KEY,
  });

  // Idempotent: if already active on-chain, nothing to do.
  const existing = await client.getContractState(params.address);
  if (existing.state === 'active') return { deployed: false };

  const opened = client.open(wallet);
  const seqno: number = await opened.getSeqno();
  const deployBody = beginCell().storeUint(0x946a98b6, 32).storeUint(0, 64).endCell();

  await opened.sendTransfer({
    seqno,
    secretKey: keypair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: params.address,
        value: toNano(process.env.COLLECTION_FUND_TON || '0.1'),
        bounce: false,
        init: params.init,
        body: deployBody,
      }),
    ],
  });

  // Poll until active.
  for (let i = 0; i < 30; i += 1) {
    const state = await client.getContractState(params.address);
    if (state.state === 'active') return { deployed: true };
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`Collection ${params.address.toString()} did not become active in time`);
}

// ─── Orchestrator ──────────────────────────────────────────────────

export interface ProvisionResult {
  collectionAddress: string;
  status: 'deployed';
  alreadyDeployed: boolean;
  appId: string;
}

/**
 * Provision (idempotently) the platform-owned collection for a seller on a
 * network: derive the deterministic address, record intent, deploy if needed,
 * and mark deployed. Returns the collection address the seller should attach to
 * their listings.
 */
export async function provisionSellerCollection(
  sellerWallet: string,
  network: TonNetwork,
): Promise<ProvisionResult> {
  const cfg = getNetworkConfig(network);
  if (!cfg.collectionOwnerMnemonic || !cfg.collectionOwnerAddress) {
    throw new ProvisionConfigError(`COLLECTION_OWNER is not configured for ${network}`);
  }

  const existing = await findSellerCollection(sellerWallet, network);
  if (existing?.status === 'deployed' && existing.collectionAddress) {
    return {
      collectionAddress: existing.collectionAddress,
      status: 'deployed',
      alreadyDeployed: true,
      appId: existing.appId,
    };
  }

  const appId = existing?.appId ? BigInt(existing.appId) : deriveAppId(sellerWallet, network);
  const { metadataUri, itemBaseUri } = buildSellerMetadataUris(sellerWallet, network);
  const ownerAddress = Address.parse(cfg.collectionOwnerAddress);

  const { address, init } = await computeCollectionInit(appId, ownerAddress, metadataUri, itemBaseUri);
  const collectionAddress = address.toString({ testOnly: network === 'testnet' });

  const record = await upsertPendingCollection({
    sellerWallet,
    network,
    appId: appId.toString(),
    collectionAddress,
    ownerWallet: sellerWallet,
    metadataUri,
    itemBaseUri,
  });

  try {
    await deployCollectionOnChain({ network, mnemonic: cfg.collectionOwnerMnemonic, address, init });
    await markDeployed(record.$id, { collectionAddress });
    logger.info(`[provisioner] collection deployed for ${sellerWallet} (${network}): ${collectionAddress}`);
    return { collectionAddress, status: 'deployed', alreadyDeployed: false, appId: appId.toString() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(record.$id, msg);
    logger.error(`[provisioner] deploy failed for ${sellerWallet} (${network}): ${msg}`);
    throw err;
  }
}
