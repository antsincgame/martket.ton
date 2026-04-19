/**
 * Single source of truth for verifying that a buyer paid for an order.
 *
 * Two payment paths are supported:
 *   (a) escrowAddress present on the order → buyer paid the on-chain Escrow
 *       contract via PayEscrow. The contract self-checks sender == buyer
 *       and value >= price + gas, so we only need to confirm `state == FUNDED`
 *       via the contract getter. No tx hash is needed; the escrow address
 *       itself proves settlement.
 *   (b) no escrow on the order → fallback "treasury+memo": buyer sent a
 *       plain TON transfer to the platform treasury with the order memo as
 *       text comment. We scan recent transactions on the treasury wallet.
 *
 * Returns a tagged union so the caller never has to think about which path
 * was taken — just `result.ok` plus a stable `txHash` to persist on the order.
 */

import { verifyEscrowFunded } from '../escrow.js';
import { verifyPaymentByMemo } from '../tonVerify.js';
import { resolveNetworkConfig } from '../../config/network.js';
import type { Request } from 'express';

export interface PaymentVerifyOk {
  ok: true;
  /** Stable identifier persisted on the order. For escrow path it's
   *  `escrow:<address>`; for treasury path it's the actual TON tx hash. */
  txHash: string;
  path: 'escrow' | 'treasury';
}
export interface PaymentVerifyFail {
  ok: false;
  reason: string;
  details?: Record<string, unknown>;
}
export type PaymentVerifyResult = PaymentVerifyOk | PaymentVerifyFail;

export interface OrderPaymentInput {
  escrowAddress: string;
  buyerWallet: string;
  amountRaw: string;
  memo: string;
}

export async function verifyOrderPayment(
  req: Request,
  treasury: string,
  order: OrderPaymentInput,
): Promise<PaymentVerifyResult> {
  if (order.escrowAddress) {
    const escrowCheck = await verifyEscrowFunded(order.escrowAddress);
    if (!escrowCheck.ok) {
      return {
        ok: false,
        reason: escrowCheck.reason || 'ESCROW_NOT_FUNDED',
        details: { escrowAddress: order.escrowAddress, state: escrowCheck.state },
      };
    }
    return { ok: true, path: 'escrow', txHash: `escrow:${order.escrowAddress}` };
  }

  const netCfg = resolveNetworkConfig(req);
  const check = await verifyPaymentByMemo(
    treasury,
    {
      buyerWallet: order.buyerWallet,
      amountRaw: order.amountRaw,
      memo: order.memo,
    },
    { base: netCfg.tonapiBase, key: netCfg.tonapiKey },
  );
  if (!check.ok) {
    return {
      ok: false,
      reason: check.reason || 'TREASURY_NOT_FUNDED',
      details: { ...check } as Record<string, unknown>,
    };
  }
  return { ok: true, path: 'treasury', txHash: check.txHash || '' };
}
