/**
 * Mint worker: опрашивает Appwrite на orders в pending_payment с escrow address,
 * проверяет on-chain что escrow в FUNDED, и триггерит MintLicense от owner.
 *
 * Option C flow:
 *   1. Buyer отправляет PayEscrow на escrow address через TonConnect
 *   2. Escrow переходит в FUNDED (on-chain state=1)
 *   3. Этот worker polls: видит FUNDED → шлёт MintLicense от owner в Collection
 *      с escrowAddress=escrow.address (критично для refund-петли)
 *   4. Collection deploys LicenseItem, LicenseItem шлёт RegisterLicense обратно
 *   5. Worker видит licenseAddress != zero → order.state = PAID
 *
 * Retry strategy: сохраняет mintAttempts в order, при >5 попыток помечает
 * order как FAILED_MINT (buyer может сделать RefundIfNotMinted через grace).
 */

import { Address, Cell } from '@ton/core';
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
import {
  getSigner,
  sendMintLicense,
  buildLicenseContent,
  type MintLicenseArgs,
} from './mintSigner.js';
import { logger } from '../logger.js';
import { writeAudit } from './audit.js';
import { recordLedgerEntry } from '../core/ledgerService.js';

const POLL_INTERVAL_MS = parseInt(process.env.MINT_WORKER_POLL_MS || '30000', 10);
const MAX_MINT_ATTEMPTS = 5;
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
    logger.warn(`[mintWorker] getEscrowState failed for ${escrowAddress}:`, err instanceof Error ? err.message : err);
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
  if (!cfg.collectionAddress || !cfg.collectionOwnerMnemonic) {
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
    .filter((o) => (o.mintAttempts ?? 0) < MAX_MINT_ATTEMPTS)
    .slice(0, MAX_ORDERS_PER_TICK);

  if (orders.length === 0) return;

  logger.info(`[mintWorker] ${network}: processing ${orders.length} pending orders`);

  const signer = await getSigner(network, cfg.collectionOwnerMnemonic, cfg.tonapiBase, cfg.tonapiKey);
  const collectionAddr = Address.parse(cfg.collectionAddress);

  for (const order of orders) {
    try {
      await processOrder(order, network, signer, collectionAddr, cfg);
    } catch (err) {
      logger.warn(`[mintWorker] order ${order.$id} failed:`, err instanceof Error ? err.message : err);
      await db
        .updateDocument(DATABASE_ID, COL_ORDERS, order.$id, {
          mintAttempts: (order.mintAttempts ?? 0) + 1,
        })
        .catch(() => {});
    }
  }
}

async function processOrder(
  order: PendingOrderRow,
  network: TonNetwork,
  signer: Awaited<ReturnType<typeof getSigner>>,
  collectionAddr: Address,
  cfg: ReturnType<typeof getNetworkConfig>,
): Promise<void> {
  const db = databases();
  const escrowAddr = order.escrowAddress!;

  // Шаг 1: escrow в FUNDED?
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

  // Шаг 2: license уже замижена?
  const licenseAddr = await getEscrowLicenseAddress(escrowAddr, cfg.tonapiBase, cfg.tonapiKey);
  const isZeroAddr = !licenseAddr || licenseAddr.match(/^EQAAAAA|^UQAAAAA/) !== null;
  if (!isZeroAddr) {
    await onMintConfirmed(order, licenseAddr!);
    return;
  }

  // Шаг 3: mint. v4.1 — минимальный payload с escrowAddress.
  const licenseContentUri = order.licenseContentUri ||
    `https://cdn.example.org/license/${order.$id}.json`;

  const mintArgs: MintLicenseArgs = {
    queryId:           BigInt(Date.now()),
    buyerAddress:      Address.parse(order.buyerWallet),
    escrowAddress:     Address.parse(escrowAddr),
    transferLimit:     0n,
    individualContent: buildLicenseContent(licenseContentUri),
    burnDeadline:      BigInt(Math.floor(Date.now() / 1000) + cfg.trialWindowSec),
  };

  await sendMintLicense(signer, collectionAddr, mintArgs);

  await db.updateDocument(DATABASE_ID, COL_ORDERS, order.$id, {
    mintAttempts: (order.mintAttempts ?? 0) + 1,
  });

  await writeAudit(order.buyerWallet, 'mint_sent', 'order', order.$id, {
    escrowAddress: escrowAddr,
    network,
  });

  logger.info(`[mintWorker] mint triggered for order ${order.$id} (escrow=${escrowAddr})`);
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
    }).catch((err) => logger.warn('[mintWorker] ledger mint_license:', err instanceof Error ? err.message : err));

    logger.info(`[mintWorker] mint confirmed for order ${order.$id}: license=${licenseAddress}`);
  } catch (err) {
    logger.warn(`[mintWorker] onMintConfirmed failed for ${order.$id}:`, err instanceof Error ? err.message : err);
  }
}

async function tick(): Promise<void> {
  try {
    await Promise.all([
      processTick('mainnet').catch((e) => logger.warn('[mintWorker] mainnet tick failed:', e)),
      processTick('testnet').catch((e) => logger.warn('[mintWorker] testnet tick failed:', e)),
    ]);
  } finally {
    if (running) {
      currentTimer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  }
}

export function startMintWorker(): void {
  if (running) {
    logger.warn('[mintWorker] already running');
    return;
  }

  const mainnetCfg = getNetworkConfig('mainnet');
  const testnetCfg = getNetworkConfig('testnet');
  const mainnetEnabled = !!(mainnetCfg.collectionAddress && mainnetCfg.collectionOwnerMnemonic);
  const testnetEnabled = !!(testnetCfg.collectionAddress && testnetCfg.collectionOwnerMnemonic);

  if (!mainnetEnabled && !testnetEnabled) {
    logger.info('[mintWorker] disabled — COLLECTION_ADDRESS or COLLECTION_OWNER_MNEMONIC not set for either network');
    return;
  }

  running = true;
  logger.info(
    `[mintWorker] started (mainnet=${mainnetEnabled}, testnet=${testnetEnabled}, poll=${POLL_INTERVAL_MS}ms)`,
  );

  currentTimer = setTimeout(tick, 5_000);
}

export function stopMintWorker(): void {
  running = false;
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  logger.info('[mintWorker] stopped');
}
