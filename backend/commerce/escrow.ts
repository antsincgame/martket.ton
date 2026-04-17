/**
 * Escrow contract integration for the commerce backend.
 *
 * Computes deterministic escrow addresses and builds TonConnect-ready
 * payloads from order parameters. Uses the Tact-generated wrapper
 * at contracts/build/Escrow_Escrow.ts.
 */

import { Address, beginCell, type Cell, type StateInit, contractAddress, toNano } from '@ton/core';
import { logger } from '../logger.js';

const ESCROW_GAS_BUFFER = toNano('0.15');

let _cachedCode: Cell | null = null;
let _EscrowClass: EscrowStaticApi | null = null;

interface EscrowStaticApi {
  init(
    orderId: bigint, buyer: Address, seller: Address, treasury: Address,
    amountNano: bigint, feeBps: bigint, disputeWindowSec: bigint,
  ): Promise<{ code: Cell; data: Cell }>;
}

async function loadEscrow(): Promise<EscrowStaticApi> {
  if (_EscrowClass) return _EscrowClass;
  const mod = await import('../../contracts/build/Escrow_Escrow.js');
  _EscrowClass = mod.Escrow as unknown as EscrowStaticApi;
  return _EscrowClass;
}

export interface EscrowOrderParams {
  orderId: string;
  buyer: string;
  seller: string;
  treasury: string;
  amountNano: string;
  feeBps: number;
  disputeWindowSec: number;
}

export interface EscrowComputeResult {
  escrowAddress: string;
  stateInitBase64: string;
  payloadBase64: string;
  totalAmountRaw: string;
}

function orderIdToBigint(orderId: string): bigint {
  const hash = Buffer.from(orderId.replace(/-/g, '').padEnd(64, '0').slice(0, 64), 'hex');
  let n = 0n;
  for (let i = 0; i < 32; i++) {
    n = (n << 8n) | BigInt(hash[i]!);
  }
  return n;
}

export async function computeEscrow(params: EscrowOrderParams): Promise<EscrowComputeResult> {
  const Escrow = await loadEscrow();
  const orderId = orderIdToBigint(params.orderId);
  const buyer = Address.parse(params.buyer);
  const seller = Address.parse(params.seller);
  const treasury = Address.parse(params.treasury);
  const amountNano = BigInt(params.amountNano);

  const init = await Escrow.init(
    orderId,
    buyer,
    seller,
    treasury,
    amountNano,
    BigInt(params.feeBps),
    BigInt(params.disputeWindowSec),
  );

  const stateInit: StateInit = { code: init.code, data: init.data };
  const escrowAddr = contractAddress(0, stateInit);

  const stateInitCell = beginCell()
    .storeBit(false)
    .storeBit(false)
    .storeBit(true)
    .storeRef(init.code)
    .storeBit(true)
    .storeRef(init.data)
    .storeBit(false)
    .endCell();

  const OP_PAY_ESCROW = 0xd2e5b971;
  const payloadCell = beginCell()
    .storeUint(OP_PAY_ESCROW, 32)
    .storeUint(0, 64)
    .endCell();

  const totalAmount = amountNano + ESCROW_GAS_BUFFER;

  if (!_cachedCode) {
    _cachedCode = init.code;
    logger.info(`[escrow] code hash loaded: ${init.code.hash().toString('hex').slice(0, 16)}…`);
  }

  return {
    escrowAddress: escrowAddr.toString(),
    stateInitBase64: stateInitCell.toBoc().toString('base64'),
    payloadBase64: payloadCell.toBoc().toString('base64'),
    totalAmountRaw: totalAmount.toString(),
  };
}

export function buildResolveRefundPayload(): string {
  const OP_RESOLVE_REFUND = 0xf5a93bdf;
  const cell = beginCell().storeUint(OP_RESOLVE_REFUND, 32).storeUint(0, 64).endCell();
  return cell.toBoc().toString('base64');
}

export function buildResolveReleasePayload(): string {
  const OP_RESOLVE_RELEASE = 0xfe22fa25;
  const cell = beginCell().storeUint(OP_RESOLVE_RELEASE, 32).storeUint(0, 64).endCell();
  return cell.toBoc().toString('base64');
}

export function buildConfirmDeliveryPayload(): string {
  const OP_CONFIRM = 0x45dfb5a1;
  const cell = beginCell().storeUint(OP_CONFIRM, 32).storeUint(0, 64).endCell();
  return cell.toBoc().toString('base64');
}

export function buildOpenDisputePayload(): string {
  const OP_OPEN_DISPUTE = 0x03a24519;
  const cell = beginCell().storeUint(OP_OPEN_DISPUTE, 32).storeUint(0, 64).endCell();
  return cell.toBoc().toString('base64');
}
