/**
 * Authoritative order create / confirm cores, extracted from `orderRoutes.ts`
 * so the human (session) surface and the buyer-agent (token) surface execute
 * the SAME money path — one escrow derivation, one fee clamp, one verification
 * chain. The routes own ONLY auth (who may act for `buyerWallet`); everything
 * the money touches lives here.
 *
 * Behaviour is a literal move of the v4/v3 logic that lived inline in
 * `POST /orders` and `POST /orders/:id/confirm` — see those routes' history.
 */

import crypto from 'crypto';
import {
  DATABASE_ID, COL_LISTINGS, COL_LISTING_SECRETS,
  COL_ORDERS, COL_ENTITLEMENTS, BUCKET_ASSETS,
  ORDER_STATE, LISTING_STATUS, CURRENCY, DEFAULT_PLATFORM_FEE_BPS,
} from './constants.js';
import { databases, ID, Query } from './appwrite.js';
import { computeOrderAmounts, nanoRawToTonHuman, effectiveSellerPriceRaw } from './money.js';
import { verifyPaymentByMemo, verifyPaymentToEscrow, addressesEqual } from './tonVerify.js';
import { computeEscrow, GAS_BREAKDOWN, verifyEscrowFunded } from './escrow.js';
import { screenWallet } from '../sanctions/screen.js';
import { checkWalletAml } from '../aml/amlbot.js';
import { resolveNetworkConfig } from '../config/network.js';
import { licenseMetadataBaseUrl } from '../config/metadata.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { recordLedgerEntry } from '../core/ledgerService.js';
import { appwriteCodeOrZero } from './helpers.js';
import { requireBuyerKycLite } from './handlers/requireBuyerKycLite.js';
import { ensureLicenseForOrder, ListingNoCollectionError } from './handlers/ensureLicenseForOrder.js';

type NetCfg = ReturnType<typeof resolveNetworkConfig>;

export interface OrderCoreFail {
  ok: false;
  status: number;
  body: Record<string, unknown>;
}
export interface OrderCoreOk {
  ok: true;
  data: Record<string, unknown>;
}
export type OrderCoreResult = OrderCoreOk | OrderCoreFail;

export interface CreateOrderParams {
  listingId: string;
  buyerWallet: string;
  netCfg: NetCfg;
  buyerIp: string | null;
  /**
   * 'wallet' — check Lite KYC against `buyerWallet`'s own profile (human
   * session flow, the historical behaviour).
   * 'verified-at-issuance' — buyer-agent token flow: the accountable human
   * owner's Lite KYC was verified when the token was issued (and the wallet
   * binding was ownership-proved), so the agent wallet itself has no profile.
   * Sanctions + AML still run against the PAYING wallet below in both modes.
   */
  kycLite: 'wallet' | 'verified-at-issuance';
}

export async function createOrderCore(params: CreateOrderParams): Promise<OrderCoreResult> {
  // buyerIp is accepted for interface symmetry with confirmOrderCore (which
  // stamps it into ledger rows); creation itself records no IP.
  const { listingId, buyerWallet, netCfg } = params;
  try {
    const screen = screenWallet(buyerWallet);
    if (!screen.ok) {
      return {
        ok: false, status: 451,
        body: { error: 'Wallet is on a sanctions list and cannot transact.', code: screen.reason || 'SANCTIONED' },
      };
    }

    if (params.kycLite === 'wallet') {
      const kycCheck = await requireBuyerKycLite(buyerWallet);
      if (!kycCheck.ok) {
        return { ok: false, status: kycCheck.status, body: { error: kycCheck.message, code: kycCheck.code } };
      }
    }

    // AML-скоринг покупателя (AMLBot) — после KYC-гейта, чтобы не тратить
    // платные проверки на тех, кто всё равно не может покупать. Fail-open:
    // блокирует только подтверждённый высокий риск (см. backend/aml/amlbot.ts).
    const aml = await checkWalletAml(buyerWallet);
    if (!aml.ok) {
      await writeAudit(buyerWallet, 'aml_block', 'listing', listingId, {
        buyerWallet,
        riskScore: aml.riskScore,
        stage: 'order_create',
      });
      return {
        ok: false, status: 451,
        body: { error: 'Wallet failed AML risk screening and cannot transact.', code: 'AML_HIGH_RISK', riskScore: aml.riskScore },
      };
    }

    const treasury = netCfg.treasuryAddress;
    if (!treasury) {
      return { ok: false, status: 503, body: { error: 'TREASURY_WALLET_ADDRESS not configured', code: 'CONFIG' } };
    }

    const db = databases();
    const listing = await db.getDocument(DATABASE_ID, COL_LISTINGS, listingId);
    if (listing['status'] !== LISTING_STATUS.ACTIVE) {
      return { ok: false, status: 400, body: { error: 'Listing is not active', code: 'LISTING_INACTIVE' } };
    }

    // Seller's ask — the SALE price when a discount is active, else the list
    // price. This single read drives amounts, the deterministic escrow address,
    // and order.amountRaw, so the whole escrow/confirm chain stays consistent.
    const sellerPriceRaw = effectiveSellerPriceRaw(
      listing as { priceAmountRaw?: string; sale_price_amount_raw?: string | null; sale_ends_at?: string | null },
    );
    // Platform fee is a PLATFORM policy, never below the configured minimum.
    // The seller-supplied platformFeeBps (validated 0..10000) could otherwise be
    // set to 0 to pay zero commission — clamp it up to DEFAULT_PLATFORM_FEE_BPS
    // here, at the authoritative money point, regardless of what's stored.
    const storedFeeBps = (listing['platformFeeBps'] as number) ?? DEFAULT_PLATFORM_FEE_BPS;
    const feeBps = Math.max(storedFeeBps, DEFAULT_PLATFORM_FEE_BPS);
    const amounts = computeOrderAmounts(sellerPriceRaw, feeBps);       // { seller, fee, total }
    const sellerWallet = listing['sellerWallet'] as string;

    const memo = `cm_${crypto.randomBytes(12).toString('hex')}`;

    // Per-seller collection (Phase 1): build the escrow around the LISTING's own
    // AppCollection so each seller's licenses are minted into their own
    // collection. The escrow, the license record (ensureLicenseForOrder) and the
    // mint (tonforge/mintWorker) MUST all reference the SAME collection. We use
    // the listing's collection_address as the single source of truth — NO global
    // fallback: ensureLicenseForOrder reads only the listing's collection and
    // throws on empty, so a global-backed escrow would be fundable-but-unmintable
    // (buyer pays, no NFT ever mints). Refuse such orders up front instead.
    const collectionAddress = (listing['collection_address'] as string | undefined)?.trim() || '';
    if (!collectionAddress) {
      return {
        ok: false, status: 400,
        body: { error: 'Listing has no NFT collection configured; cannot create an order.', code: 'LISTING_NO_COLLECTION' },
      };
    }

    const orderId = ID.unique();
    const licenseContentUri = (listing['licenseContentUri'] as string) ||
      `${licenseMetadataBaseUrl()}/${orderId}.json`;

    let escrowData: Awaited<ReturnType<typeof computeEscrow>> | null = null;
    try {
      escrowData = await computeEscrow({
        orderId,
        buyer: buyerWallet,
        seller: sellerWallet,
        treasury,
        amountNano: amounts.totalAmountNano,
        sellerAmountNano: amounts.sellerAmountNano,
        feeNano: amounts.feeNano,
        trialWindowSec: netCfg.trialWindowSec,
        collectionAddress,
        transferLimit: 0,  // soulbound
        licenseContentUri,
        network: netCfg.network,
      });
    } catch (err) {
      logger.warn('[commerce] escrow compute failed:', err instanceof Error ? err.message : err);
    }

    // B-3 fix: a configured collection means this is a v4 escrow order. If
    // computeEscrow failed, we must NOT fall through to the legacy treasury-by-
    // memo path on confirm — that path routes the buyer's FULL payment (seller +
    // fee) to treasury with no on-chain split and no mechanism to ever pay the
    // seller. Refuse the order instead of silently misrouting the seller's funds.
    if (!escrowData) {
      return {
        ok: false, status: 503,
        body: { error: 'Could not prepare the on-chain escrow for this order. Please retry shortly.', code: 'ESCROW_COMPUTE_FAILED' },
      };
    }

    const order = await db.createDocument(DATABASE_ID, COL_ORDERS, orderId, {
      listingId,
      buyerWallet,
      sellerWallet,                                 // v4: нужен worker'у для MintLicense
      amountRaw: amounts.totalAmountNano,           // Что buyer платит (seller + fee)
      sellerNetAmountRaw: amounts.sellerAmountNano, // Что получит seller
      currency: listing['currency'],
      memo,
      tonTxHash: '',
      state: ORDER_STATE.PENDING_PAYMENT,
      listingSnapshotTitle: listing['title'],
      // v4 escrow tracking поля (нужны mint worker'у)
      escrowAddress: escrowData.escrowAddress,
      licenseContentUri,
      mintAttempts: 0,
      licenseAddress: '',
    });

    await writeAudit(buyerWallet, 'order_create', 'order', order.$id, { listingId, memo });
    return {
      ok: true,
      data: {
        orderId: order.$id,
        memo,
        amountRaw: amounts.totalAmountNano,
        amountTonHuman: listing['currency'] === CURRENCY.TON
          ? nanoRawToTonHuman(amounts.totalAmountNano)
          : undefined,
        sellerAmountRaw: amounts.sellerAmountNano,
        sellerAmountTonHuman: listing['currency'] === CURRENCY.TON
          ? nanoRawToTonHuman(amounts.sellerAmountNano)
          : undefined,
        feeAmountRaw: amounts.feeNano,
        feeAmountTonHuman: listing['currency'] === CURRENCY.TON
          ? nanoRawToTonHuman(amounts.feeNano)
          : undefined,
        feeBps: amounts.feeBpsApplied,
        decimals: listing['decimals'],
        currency: listing['currency'],
        treasuryAddress: treasury,
        state: order['state'],
        escrow: {
          address: escrowData.escrowAddress,
          stateInit: escrowData.stateInitBase64,
          payload: escrowData.payloadBase64,
          totalAmountRaw: escrowData.totalAmountRaw,
          trialWindowSec: netCfg.trialWindowSec,
        },
        gasBreakdown: GAS_BREAKDOWN,
        nft: { willMint: true, collectionAddress },
      },
    };
  } catch (e: unknown) {
    const code = appwriteCodeOrZero(e);
    if (code === 404) return { ok: false, status: 404, body: { error: 'Listing not found', code: 'NOT_FOUND' } };
    logger.error('[commerce] order create:', e instanceof Error ? e.message : e);
    return { ok: false, status: 500, body: { error: 'Order creation failed', code: 'ORDER_CREATE' } };
  }
}

export interface ConfirmOrderParams {
  orderId: string;
  buyerWallet: string;
  netCfg: NetCfg;
  buyerIp: string | null;
  /**
   * Legacy v3 (treasury-by-memo) fulfilment bridges the purchase into the
   * session library — that needs the caller's session profile, so the session
   * route supplies it. The buyer-agent path omits it: agent purchases are v4
   * escrow orders whose library entry is the on-chain license itself.
   */
  bridgePurchase?: (listingRow: Record<string, unknown>, txHash: string) => Promise<void>;
}

export async function confirmOrderCore(params: ConfirmOrderParams): Promise<OrderCoreResult> {
  const { orderId, buyerWallet, netCfg, buyerIp } = params;
  try {
    const treasury = netCfg.treasuryAddress;
    if (!treasury) return { ok: false, status: 503, body: { error: 'Treasury not configured', code: 'CONFIG' } };
    const db = databases();
    const order = await db.getDocument(DATABASE_ID, COL_ORDERS, orderId);
    if (!addressesEqual(order['buyerWallet'] as string, buyerWallet)) {
      return { ok: false, status: 403, body: { error: 'Wallet does not match the order', code: 'WALLET_MISMATCH' } };
    }
    if (order['state'] !== ORDER_STATE.PENDING_PAYMENT) {
      return { ok: true, data: { state: order['state'], message: 'Order already processed' } };
    }

    const payScreen = screenWallet(buyerWallet);
    if (!payScreen.ok) {
      return {
        ok: false, status: 451,
        body: { error: 'Wallet is on a sanctions list and cannot transact.', code: payScreen.reason || 'SANCTIONED' },
      };
    }

    // Повторный AML-гейт на момент оплаты: между созданием заказа и оплатой
    // вердикт мог измениться. Из-за кэша (aml_checks) это почти всегда
    // бесплатное чтение, а не вторая платная проверка.
    const payAml = await checkWalletAml(buyerWallet);
    if (!payAml.ok) {
      await writeAudit(buyerWallet, 'aml_block', 'order', orderId, {
        buyerWallet,
        riskScore: payAml.riskScore,
        stage: 'order_confirm',
      });
      return {
        ok: false, status: 451,
        body: { error: 'Wallet failed AML risk screening and cannot transact.', code: 'AML_HIGH_RISK', riskScore: payAml.riskScore },
      };
    }

    const escrowAddress = (order['escrowAddress'] as string) || '';
    const apiOverrides = { base: netCfg.tonapiBase, key: netCfg.tonapiKey };

    // v4 path: verify payment to escrow address
    if (escrowAddress) {
      const check = await verifyPaymentToEscrow(
        escrowAddress,
        order['buyerWallet'] as string,
        order['amountRaw'] as string,
        apiOverrides,
      );
      if (!check.ok) {
        return {
          ok: false, status: 400,
          body: { error: 'Escrow payment not verified', code: 'PAYMENT_VERIFY_FAILED', reason: check.reason || 'UNKNOWN', details: check },
        };
      }

      // H-4: verifyPaymentToEscrow only proves SOME buyer→escrow tx with
      // value >= amount landed; it does NOT prove the escrow contract reached
      // FUNDED (a tx with no/invalid PayEscrow body, or a bounce, leaves state
      // INIT). Minting an NFT against a non-FUNDED escrow gives the buyer a
      // license the escrow can never pay the seller for. Require state==FUNDED
      // on-chain before recording the funding / creating the license.
      const funded = await verifyEscrowFunded(escrowAddress);
      if (!funded.ok) {
        return {
          ok: false, status: 409,
          body: { error: 'Escrow is not in FUNDED state on-chain yet', code: 'ESCROW_NOT_FUNDED', reason: funded.reason || 'UNKNOWN', state: funded.state },
        };
      }

      const realTxHash = check.txHash || '';
      // M-6: confirm is idempotent for the ledger. The order intentionally stays
      // PENDING_PAYMENT (the mint worker picks it up), so a repeated confirm
      // re-enters this block — record escrow_fund only on the FIRST confirm,
      // detected by an empty stored tonTxHash, to avoid duplicate ledger rows.
      const alreadyConfirmed = Boolean((order['tonTxHash'] as string | undefined)?.trim());

      // НЕ переводим state в PAID здесь! Mint worker фильтрует по
      // state == PENDING_PAYMENT для автоматической обработки. После успешного
      // mint worker сам выставит state=PAID и создаст entitlement.
      // Здесь только записываем tonTxHash (для аудита и отображения в UI).
      const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, {
        tonTxHash: realTxHash,
      });
      await writeAudit(buyerWallet, 'order_payment_verified', 'order', orderId, {
        txHash: realTxHash,
        flow: 'v4_escrow',
        escrowAddress,
      });

      if (!alreadyConfirmed) {
        const amountRaw = (order['amountRaw'] as string) || '0';
        const sellerNetRaw = (order['sellerNetAmountRaw'] as string) || '0';
        let platformFeeTonRaw: string;
        try {
          const diff = BigInt(amountRaw) - BigInt(sellerNetRaw);
          platformFeeTonRaw = diff > 0n ? String(diff) : '0';
        } catch {
          platformFeeTonRaw = '0';
        }
        recordLedgerEntry({
          entryType: 'escrow_fund',
          refType: 'order',
          refId: orderId,
          buyerWallet,
          sellerWallet: (order['sellerWallet'] as string) ?? null,
          amountUsd: 0,
          amountTonRaw: amountRaw,
          platformFeeTonRaw,
          txHash: realTxHash,
          escrowAddress,
          productName: (order['listingSnapshotTitle'] as string) ?? '',
          listingId: (order['listingId'] as string) ?? null,
          buyerIp,
        }).catch((err) => logger.warn('[commerce] ledger escrow_fund:', err));
      }

      const trialWindowSec = parseInt(process.env.TRIAL_WINDOW_SEC || '259200', 10);
      const trialEndsAt = new Date(Date.now() + trialWindowSec * 1000).toISOString();
      const listingForLicense = await db.getDocument(DATABASE_ID, COL_LISTINGS, order['listingId'] as string).catch(() => null);
      if (listingForLicense) {
        ensureLicenseForOrder(
          { $id: orderId, listingId: order['listingId'] as string, buyerWallet, escrowAddress },
          {
            collection_address:
              (listingForLicense['collection_address'] as string | undefined) ||
              (listingForLicense['collectionAddress'] as string | undefined),
            catalogProductId: listingForLicense['catalogProductId'] as string | undefined,
            sellerWallet: listingForLicense['sellerWallet'] as string | undefined,
          },
          trialEndsAt,
        ).catch((err) => {
          if (err instanceof ListingNoCollectionError) {
            logger.warn(`[commerce] ensureLicense: ${err.message}`);
          } else {
            logger.warn('[commerce] ensureLicense failed:', err instanceof Error ? err.message : err);
          }
        });
      }

      return {
        ok: true,
        data: {
          state: updated['state'],         // Останется PENDING_PAYMENT
          orderId: updated.$id,
          escrowAddress,
          tonTxHash: realTxHash,
          mintPending: true,
        },
      };
    }

    // Legacy v3 path: verify payment to treasury by memo
    const check = await verifyPaymentByMemo(treasury, {
      buyerWallet: order['buyerWallet'] as string,
      amountRaw: order['amountRaw'] as string,
      memo: order['memo'] as string,
    }, apiOverrides);
    if (!check.ok) {
      return {
        ok: false, status: 400,
        body: { error: 'Payment not verified', code: 'PAYMENT_VERIFY_FAILED', reason: check.reason || 'UNKNOWN', details: check },
      };
    }
    const realTxHash = check.txHash || '';

    const { documents: existingEnt } = await db.listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
      Query.equal('orderId', order.$id), Query.limit(1),
    ]);
    if (existingEnt.length > 0) {
      const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state: ORDER_STATE.PAID, tonTxHash: realTxHash });
      return { ok: true, data: { state: updated['state'], orderId: updated.$id, entitlement: { deliveryPayload: existingEnt[0]!['deliveryPayload'] } } };
    }
    const listingRow = await db.getDocument(DATABASE_ID, COL_LISTINGS, order['listingId'] as string);
    const { documents: secrets } = await db.listDocuments(DATABASE_ID, COL_LISTING_SECRETS, [
      Query.equal('listingId', order['listingId'] as string), Query.limit(1),
    ]);
    let payload = (secrets[0]?.['deliveryPayload'] as string) || 'Thank you for your purchase. Contact the seller via the listing page.';
    if (listingRow['assetFileId']) {
      payload += `\n\n[File in Appwrite Storage: bucket ${BUCKET_ASSETS}, fileId ${listingRow['assetFileId']}]`;
    }
    await db.createDocument(DATABASE_ID, COL_ENTITLEMENTS, ID.unique(), {
      orderId: order.$id, buyerWallet: order['buyerWallet'],
      listingId: order['listingId'], deliveryPayload: payload,
    });
    const updated = await db.updateDocument(DATABASE_ID, COL_ORDERS, orderId, { state: ORDER_STATE.PAID, tonTxHash: realTxHash });
    await writeAudit(buyerWallet, 'order_paid', 'order', orderId, { txHash: realTxHash, flow: 'v3_legacy' });

    recordLedgerEntry({
      entryType: 'escrow_release',
      refType: 'order',
      refId: orderId,
      buyerWallet,
      amountTonRaw: (order['amountRaw'] as string) ?? '0',
      txHash: realTxHash,
      productName: (listingRow['title'] as string) ?? '',
      listingId: (order['listingId'] as string) ?? null,
      buyerIp,
    }).catch((err) => logger.warn('[commerce] ledger v3 escrow_release:', err));

    if (params.bridgePurchase) {
      params.bridgePurchase(listingRow as unknown as Record<string, unknown>, realTxHash).catch((err) =>
        logger.warn('[commerce] bridge purchase:', err instanceof Error ? err.message : err),
      );
    }

    return { ok: true, data: { state: updated['state'], orderId: updated.$id, entitlement: { deliveryPayload: payload } } };
  } catch (e: unknown) {
    const code = appwriteCodeOrZero(e);
    if (code === 404) return { ok: false, status: 404, body: { error: 'Order not found', code: 'NOT_FOUND' } };
    logger.error('[commerce] order confirm:', e instanceof Error ? e.message : e);
    return { ok: false, status: 500, body: { error: 'Order confirmation failed', code: 'ORDER_CONFIRM' } };
  }
}
