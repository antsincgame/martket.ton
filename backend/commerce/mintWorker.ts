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
 *          (+ entitlement) via the shared reconcileOrderAfterMint handler — the
 *          SAME finalization the immediate tonforge path uses (single source of
 *          truth); this poller is the fallback if that immediate call failed.
 *        - state 3 (CONFIRMED/released) → order FULFILLED.
 *        - state 4 (REFUNDED) → order REFUNDED.
 *   3. If FUNDED but no license yet → do nothing; tonforge/mintWorker will mint
 *      and register, and a later tick reconciles the order.
 */

import { Address, Cell } from '@ton/core';
import {
  DATABASE_ID,
  COL_ORDERS,
  ORDER_STATE,
} from './constants.js';
import { databases, Query } from './appwrite.js';
import { getNetworkConfig, type TonNetwork } from '../config/network.js';
import { logger } from '../logger.js';
import { reconcileOrderAfterMint } from './handlers/reconcileOrderAfterMint.js';
import { addressesEqual } from './tonVerify.js';
import { findLicenseByOrderId } from './licenseRepository.js';

const POLL_INTERVAL_MS = parseInt(process.env.MINT_WORKER_POLL_MS || '30000', 10);
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

  // No per-order attempt cap here: the reconciler only reads on-chain escrow
  // state and must keep checking a PENDING_PAYMENT order until its escrow
  // resolves (funds → finalize, releases → fulfilled, refunds → refunded).
  // A cap on `order.mintAttempts` was dead (the field is never incremented), and
  // *activating* it would strand orders whose escrow settles after N ticks. The
  // real mint retry-budget lives on the License (tonforge/mintWorker).
  const orders = documents
    .map((d) => d as unknown as PendingOrderRow)
    .filter((o) => typeof o.escrowAddress === 'string' && o.escrowAddress.length > 0)
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

export type ReconcileAction =
  | { kind: 'finalize' }   // escrow FUNDED + license registered → finalize order to PAID
  | { kind: 'fulfilled' }  // escrow released (state 3) → order FULFILLED
  | { kind: 'refunded' }   // escrow refunded (state 4) → order REFUNDED
  | { kind: 'wait' }       // FUNDED but no license yet → tonforge/mintWorker owns the mint
  | { kind: 'noop' };      // unknown/other escrow state → nothing to reconcile

// The escrow's license_address getter can render in ANY TON form (mainnet
// EQ/UQ, testnet kQ/0Q, raw `0:…`), so detect "no LicenseItem registered yet"
// STRUCTURALLY — by the 256-bit account hash being all-zero — never by a string
// prefix. A prefix regex silently mis-classifies a testnet-form zero as a real
// license and would finalize the order BEFORE any NFT exists. An empty or
// unparseable value is treated as not-yet-minted (the safe direction: wait).
const ZERO_ACCOUNT_HASH = Buffer.alloc(32);
function isZeroLicenseAddress(licenseAddress: string | null): boolean {
  if (!licenseAddress) return true;
  try {
    return Address.parse(licenseAddress).hash.equals(ZERO_ACCOUNT_HASH);
  } catch {
    return true;
  }
}

/**
 * Pure reconciliation decision (the order-state machine). Given the on-chain
 * escrow state (1 = FUNDED, 3 = released/confirmed, 4 = refunded) and the license
 * address the escrow exposes, decide what to do with the order. Exported for unit
 * tests — the effectful `processOrder` is a thin wiring around it.
 */
export function decideReconcileAction(
  escrowState: number | null,
  licenseAddress: string | null,
  expectedLicenseAddress?: string | null,
): ReconcileAction {
  if (escrowState === 3) return { kind: 'fulfilled' };
  if (escrowState === 4) return { kind: 'refunded' };
  if (escrowState !== 1) return { kind: 'noop' };
  if (isZeroLicenseAddress(licenseAddress)) return { kind: 'wait' };
  // M-7 / CON-01: never finalize on a license address we did not mint. When the
  // expected item address is known (recorded on the order's license row by the
  // tonforge mint worker), the escrow's license_address MUST equal it; a
  // mismatch means a front-run registration of a foreign contract — wait and
  // let pollLicenseRegistered own confirmation rather than writing a bogus
  // entitlement/ledger row bound to the attacker's address.
  if (expectedLicenseAddress !== undefined) {
    if (!expectedLicenseAddress) return { kind: 'wait' };
    return addressesEqual(licenseAddress ?? '', expectedLicenseAddress)
      ? { kind: 'finalize' }
      : { kind: 'wait' };
  }
  return { kind: 'finalize' };
}

async function processOrder(
  order: PendingOrderRow,
  cfg: ReturnType<typeof getNetworkConfig>,
): Promise<void> {
  const db = databases();
  const escrowAddr = order.escrowAddress!;

  const state = await getEscrowState(escrowAddr, cfg.tonapiBase, cfg.tonapiKey);
  // Only query the license getter once the escrow is FUNDED.
  const licenseAddr =
    state === 1 ? await getEscrowLicenseAddress(escrowAddr, cfg.tonapiBase, cfg.tonapiKey) : null;
  // M-7: the address we actually minted for this order (set by the tonforge
  // worker on the license row). decideReconcileAction finalizes only on a match.
  const expectedLicense = state === 1 ? (await findLicenseByOrderId(order.$id))?.nftAddress ?? '' : null;
  const action = decideReconcileAction(state, licenseAddr, expectedLicense);

  switch (action.kind) {
    case 'fulfilled':
      await db.updateDocument(DATABASE_ID, COL_ORDERS, order.$id, { state: ORDER_STATE.FULFILLED });
      return;
    case 'refunded':
      await db.updateDocument(DATABASE_ID, COL_ORDERS, order.$id, { state: ORDER_STATE.REFUNDED });
      return;
    case 'finalize':
      // licenseAddr is non-zero here per decideReconcileAction. Delegate to the
      // single finalization handler shared with the immediate tonforge path
      // (idempotent: it no-ops if the order is already PAID/FULFILLED).
      await reconcileOrderAfterMint({
        orderId: order.$id,
        listingId: order.listingId,
        buyerWallet: order.buyerWallet,
        nftAddress: licenseAddr!,
        escrowAddress: order.escrowAddress ?? '',
      });
      return;
    case 'wait':
    case 'noop':
      // FUNDED-but-not-minted or unknown state → tonforge/mintWorker owns the mint;
      // a later tick reconciles the order once the license is registered.
      return;
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
