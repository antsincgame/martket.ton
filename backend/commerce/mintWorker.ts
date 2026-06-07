/**
 * Order reconciler (formerly the Option-C mint worker).
 *
 * CANONICAL CHANGE: minting now lives in ONE place — `tonforge/mintWorker`,
 * which mints into the per-seller `license.collectionAddress`, holds a
 * cluster-wide lock, and runs the full mint/refund/payout lifecycle. This module
 * NO LONGER MINTS. Keeping a second minter here (which targeted the *global*
 * collection) was both a double-mint race and, once orders route to per-seller
 * collections, an escrow↔mint collection mismatch.
 *
 * What it still does — purely reconcile order state from on-chain truth:
 *   1. Poll orders in `pending_payment` that carry an escrow address.
 *   2. Read the escrow's on-chain state:
 *        - state 1 (FUNDED) + license registered → finalize order → PAID
 *          (+ entitlement) via onMintConfirmed.
 *        - state 3 (CONFIRMED/released) → order FULFILLED.
 *        - state 4 (REFUNDED) → order REFUNDED.
 *   3. If FUNDED but no license yet → do nothing; tonforge/mintWorker will mint
 *      and register, and a later tick reconciles the order.
 */

import { Cell } from '@ton/core';
import {
  DATABASE_ID,
  COL_ORDERS,
  COL_ENTITLEMENTS,
  COL_LISTINGS,
  COL_LISTING_SECRETS,
  BUCKET_ASSETS,
  ORDER_STATE,
} from './constants.js';
import { databases, ID, Query } from './appwrite.js';
import { getNetworkConfig, type TonNetwork } from '../config/network.js';
import { logger } from '../logger.js';
import { writeAudit } from './audit.js';
import { recordLedgerEntry } from '../core/ledgerService.js';

const POLL_INTERVAL_MS = parseInt(process.env.MINT_WORKER_POLL_MS || '30000', 10);
const MAX_ATTEMPTS = 5;
const MAX_ORDERS_PER_TICK = 20;

let running = false;
let currentTimer: NodeJS.Timeout | null = null;

async function getEscrowState(
  escrowAddress: string,
  apiBase: string,
  apiKey: string,
): Promise<number | null> {
  const url = `${apiBase.replace(/\/+$/, '')}/v2/blockchain/accounts/${encodeURIComponent(escrowAddress)}/methods/state`;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 404) return null;
      return null;
    }
    const data = (await res.json()) as { decoded?: { state?: number }; stack?: Array<{ num?: string }> };
    if (data.decoded?.state !== undefined) return Number(data.decoded.state);
    const stackFirst = data.stack?.[0];
    if (stackFirst?.num !== undefined) return Number(BigInt(stackFirst.num));
    return null;
  } catch (err) {
    logger.warn(`[orderReconciler] getEscrowState failed for ${escrowAddress}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function getEscrowLicenseAddress(
  escrowAddress: string,
  apiBase: string,
  apiKey: string,
): Promise<string | null> {
  const url = `${apiBase.replace(/\/+$/, '')}/v2/blockchain/accounts/${encodeURIComponent(escrowAddress)}/methods/license_address`;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      stack?: Array<{ type?: string; cell?: string; num?: string }>;
      decoded?: Record<string, unknown>;
    };
    const first = data.stack?.[0];
    if (first?.cell) {
      try {
        const cell = Cell.fromBoc(Buffer.from(first.cell, 'base64'))[0];
        if (cell) {
          const slice = cell.beginParse();
          const addr = slice.loadAddress();
          return addr.toString();
        }
      } catch {
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

interface PendingOrderRow extends Record<string, unknown> {
  $id: string;
  listingId: string;
  buyerWallet: string;
  amountRaw: string;
  sellerNetAmountRaw?: string;
  state: string;
  escrowAddress?: string;
  mintAttempts?: number;
  tonTxHash?: string;
  listingSnapshotTitle?: string;
  licenseContentUri?: string;
}

async function processTick(network: TonNetwork): Promise<void> {
  const cfg = getNetworkConfig(network);
  // Reconciler runs whenever the v4 escrow flow is enabled (a collection is
  // configured). It no longer mints, so it does not need the owner mnemonic.
  if (!cfg.collectionAddress) {
    return;
  }

  const db = databases();

  const { documents } = await db.listDocuments(DATABASE_ID, COL_ORDERS, [
    Query.equal('state', ORDER_STATE.PENDING_PAYMENT),
    Query.orderAsc('$createdAt'),
    Query.limit(MAX_ORDERS_PER_TICK * 3),
  ]);

  const orders = documents
    .map((d) => d as unknown as PendingOrderRow)
    .filter((o) => typeof o.escrowAddress === 'string' && o.escrowAddress.length > 0)
    .filter((o) => (o.mintAttempts ?? 0) < MAX_ATTEMPTS)
    .slice(0, MAX_ORDERS_PER_TICK);

  if (orders.length === 0) return;

  logger.info(`[orderReconciler] ${network}: reconciling ${orders.length} pending order(s)`);

  for (const order of orders) {
    try {
      await processOrder(order, cfg);
    } catch (err) {
      logger.warn(`[orderReconciler] order ${order.$id} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

async function processOrder(
  order: PendingOrderRow,
  cfg: ReturnType<typeof getNetworkConfig>,
): Promise<void> {
  const db = databases();
  const escrowAddr = order.escrowAddress!;

  // Step 1: read escrow state.
  const state = await getEscrowState(escrowAddr, cfg.tonapiBase, cfg.tonapiKey);
  if (state === null) return;
  if (state !== 1) {
    if (state === 3 || state === 4) {
      await db.updateDocument(DATABASE_ID, COL_ORDERS, order.$id, {
        state: state === 3 ? ORDER_STATE.FULFILLED : ORDER_STATE.REFUNDED,
      });
    }
    return;
  }

  // Step 2: FUNDED — has tonforge/mintWorker already minted + registered a license?
  const licenseAddr = await getEscrowLicenseAddress(escrowAddr, cfg.tonapiBase, cfg.tonapiKey);
  const isZeroAddr = !licenseAddr || licenseAddr.match(/^EQAAAAA|^UQAAAAA/) !== null;
  if (!isZeroAddr) {
    await onMintConfirmed(order, licenseAddr!);
    return;
  }

  // FUNDED but not minted yet → tonforge/mintWorker owns the mint. Nothing to do
  // here; a later tick reconciles the order once the license is registered.
}

async function onMintConfirmed(order: PendingOrderRow, licenseAddress: string): Promise<void> {
  const db = databases();

  const { documents: existingEnt } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
    Query.equal('orderId', order.$id),
    Query.limit(1),
  ]);
  if (existingEnt.length > 0) {
    await db.updateDocument(DATABASE_ID, COL_ORDERS, order.$id, {
      state: ORDER_STATE.PAID,
      licenseAddress,
    });
    return;
  }

  try {
    const listing = await db.getDocument(DATABASE_ID, COL_LISTINGS, order.listingId);
    const { documents: secrets } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
      Query.equal('listingId', order.listingId),
      Query.limit(1),
    ]);
    let payload = (secrets[0]?.deliveryPayload as string) ||
      'Thank you for your purchase. License NFT minted to your wallet.';
    if (listing.assetFileId) {
      payload += `\n\n[File in Appwrite Storage: bucket ${BUCKET_ASSETS}, fileId ${listing.assetFileId}]`;
    }

    await db.createDocument(DATABASE_ID, COL_ENTITLEMENTS, ID.unique(), {
      orderId: order.$id,
      buyerWallet: order.buyerWallet,
      listingId: order.listingId,
      deliveryPayload: payload,
      licenseAddress,
    });

    await db.updateDocument(DATABASE_ID, COL_ORDERS, order.$id, {
      state: ORDER_STATE.PAID,
      licenseAddress,
    });

    await writeAudit(order.buyerWallet, 'mint_confirmed', 'order', order.$id, {
      licenseAddress,
    });

    recordLedgerEntry({
      entryType: 'mint_license',
      refType: 'order',
      refId: order.$id,
      buyerWallet: order.buyerWallet,
      amountTonRaw: order.amountRaw,
      licenseAddress,
      listingId: order.listingId,
      productName: order.listingSnapshotTitle ?? (listing['title'] as string) ?? '',
      escrowAddress: order.escrowAddress ?? null,
    }).catch((err) => logger.warn('[orderReconciler] ledger mint_license:', err instanceof Error ? err.message : err));

    logger.info(`[orderReconciler] order ${order.$id} finalized: license=${licenseAddress}`);
  } catch (err) {
    logger.warn(`[orderReconciler] onMintConfirmed failed for ${order.$id}:`, err instanceof Error ? err.message : err);
  }
}

async function tick(): Promise<void> {
  try {
    await Promise.all([
      processTick('mainnet').catch((e) => logger.warn('[orderReconciler] mainnet tick failed:', e)),
      processTick('testnet').catch((e) => logger.warn('[orderReconciler] testnet tick failed:', e)),
    ]);
  } finally {
    if (running) {
      currentTimer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  }
}

export function startMintWorker(): void {
  if (running) {
    logger.warn('[orderReconciler] already running');
    return;
  }

  const mainnetCfg = getNetworkConfig('mainnet');
  const testnetCfg = getNetworkConfig('testnet');
  const mainnetEnabled = !!mainnetCfg.collectionAddress;
  const testnetEnabled = !!testnetCfg.collectionAddress;

  if (!mainnetEnabled && !testnetEnabled) {
    logger.info('[orderReconciler] disabled — COLLECTION_ADDRESS not set for either network');
    return;
  }

  running = true;
  logger.info(
    `[orderReconciler] started (mainnet=${mainnetEnabled}, testnet=${testnetEnabled}, poll=${POLL_INTERVAL_MS}ms)`,
  );

  currentTimer = setTimeout(tick, 5_000);
}

export function stopMintWorker(): void {
  running = false;
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  logger.info('[orderReconciler] stopped');
}
