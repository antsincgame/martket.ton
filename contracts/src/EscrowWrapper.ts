/**
 * Manual TypeScript wrapper for the Escrow Tact contract (v3).
 *
 * v3: split amount into sellerAmountNano + feeNano (fee поверх seller price),
 * added RefundIfNotMinted + bounced handlers.
 *
 * Note: Основной канал работы с контрактом — автосгенерированный Tact-wrapper
 * из contracts/build/Escrow_Escrow.ts. Этот manual wrapper нужен только
 * когда автоген недоступен (например в средах без Tact-билда).
 */

import {
  Address,
  beginCell,
  Cell,
  contractAddress,
  type Contract,
  type ContractProvider,
  type Sender,
  type SendMode,
  type StateInit,
  toNano,
} from '@ton/core';

// ─── Message opcodes ─────────────────────────────────────────────────

export const OP_DEPLOY                 = 0x946a98b6;
export const OP_PAY_ESCROW             = 0xd2e5b971;
export const OP_CONFIRM                = 0x45dfb5a1;
export const OP_TIMEOUT_RELEASE        = 0x7f8c9a12;
export const OP_REGISTER_LICENSE       = 0x70e30189;
export const OP_REFUND_ON_BURN         = 0x9b3c2d45;
export const OP_REFUND_IF_NOT_MINTED   = 0x5a8e1f23;

// ─── Escrow state enum ───────────────────────────────────────────────

export const ESCROW_STATE = {
  INIT: 0,
  FUNDED: 1,
  RELEASED: 3,
  REFUNDED: 4,
} as const;

// ─── Init parameters ────────────────────────────────────────────────

export interface EscrowInitParams {
  orderId: bigint;
  buyer: Address;
  seller: Address;
  treasury: Address;
  amountNano: bigint;
  sellerAmountNano: bigint;
  feeNano: bigint;
  trialWindowSec: number;
}

/**
 * Адрес нулевого workchain-а как плейсхолдер для licenseAddress в data cell.
 * Должен совпадать с результатом newAddress(0, 0) в Tact.
 */
const ZERO_ADDRESS = new Address(0, Buffer.alloc(32, 0));

function buildDataCell(params: EscrowInitParams): Cell {
  if (params.sellerAmountNano + params.feeNano !== params.amountNano) {
    throw new Error('Amount split mismatch: sellerAmountNano + feeNano must equal amountNano');
  }

  return beginCell()
    .storeUint(params.orderId, 256)
    .storeAddress(params.buyer)
    .storeAddress(params.seller)
    .storeAddress(params.treasury)
    .storeCoins(params.amountNano)
    .storeCoins(params.sellerAmountNano)
    .storeCoins(params.feeNano)
    .storeUint(params.trialWindowSec, 32)
    .storeUint(0, 8)   // state = INIT
    .storeUint(0, 32)  // paidAt = 0
    .storeAddress(ZERO_ADDRESS)
    .storeUint(0, 1)   // registered-like reserved padding if нужен — не для escrow
    .endCell();
}

// ─── Contract class ─────────────────────────────────────────────────

export class Escrow implements Contract {
  readonly address: Address;
  readonly init: StateInit;

  constructor(address: Address, init: StateInit) {
    this.address = address;
    this.init = init;
  }

  static fromInit(code: Cell, params: EscrowInitParams): Escrow {
    const data = buildDataCell(params);
    const init: StateInit = { code, data };
    const addr = contractAddress(0, init);
    return new Escrow(addr, init);
  }

  static computeAddress(code: Cell, params: EscrowInitParams): Address {
    const data = buildDataCell(params);
    return contractAddress(0, { code, data });
  }

  // ─── Send helpers ─────────────────────────────────────────────────

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_DEPLOY, 32).storeUint(0, 64).endCell(),
    });
  }

  async sendPay(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_PAY_ESCROW, 32).storeUint(0, 64).endCell(),
    });
  }

  async sendConfirmDelivery(provider: ContractProvider, via: Sender, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_CONFIRM, 32).storeUint(0, 64).endCell(),
    });
  }

  async sendTimeoutRelease(provider: ContractProvider, via: Sender, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_TIMEOUT_RELEASE, 32).storeUint(0, 64).endCell(),
    });
  }

  async sendRefundIfNotMinted(provider: ContractProvider, via: Sender, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_REFUND_IF_NOT_MINTED, 32).storeUint(0, 64).endCell(),
    });
  }

  // ─── Getters ──────────────────────────────────────────────────────

  async getState(provider: ContractProvider): Promise<number> {
    const result = await provider.get('state', []);
    return result.stack.readNumber();
  }

  async getDetails(provider: ContractProvider): Promise<{
    orderId: bigint;
    amountNano: bigint;
    sellerAmountNano: bigint;
    feeNano: bigint;
    trialWindowSec: number;
    state: number;
    paidAt: number;
  }> {
    const result = await provider.get('details', []);
    return {
      orderId: result.stack.readBigNumber(),
      amountNano: result.stack.readBigNumber(),
      sellerAmountNano: result.stack.readBigNumber(),
      feeNano: result.stack.readBigNumber(),
      trialWindowSec: result.stack.readNumber(),
      state: result.stack.readNumber(),
      paidAt: result.stack.readNumber(),
    };
  }

  async getParties(provider: ContractProvider): Promise<{
    buyer: Address;
    seller: Address;
    treasury: Address;
  }> {
    const result = await provider.get('parties', []);
    return {
      buyer: result.stack.readAddress(),
      seller: result.stack.readAddress(),
      treasury: result.stack.readAddress(),
    };
  }

  async getLicenseAddress(provider: ContractProvider): Promise<Address> {
    const result = await provider.get('license_address', []);
    return result.stack.readAddress();
  }
}

// ─── Payload builders ────────────────────────────────────────────────

export function buildPayEscrowPayload(): Cell {
  return beginCell().storeUint(OP_PAY_ESCROW, 32).storeUint(0, 64).endCell();
}

export function buildConfirmDeliveryPayload(): Cell {
  return beginCell().storeUint(OP_CONFIRM, 32).storeUint(0, 64).endCell();
}

export function buildTimeoutReleasePayload(): Cell {
  return beginCell().storeUint(OP_TIMEOUT_RELEASE, 32).storeUint(0, 64).endCell();
}

export function buildRefundIfNotMintedPayload(): Cell {
  return beginCell().storeUint(OP_REFUND_IF_NOT_MINTED, 32).storeUint(0, 64).endCell();
}

export function stateInitToBase64(init: StateInit): string {
  const cell = beginCell()
    .storeBit(false)
    .storeBit(false)
    .storeBit(true)
    .storeRef(init.code!)
    .storeBit(true)
    .storeRef(init.data!)
    .storeBit(false)
    .endCell();
  return cell.toBoc().toString('base64');
}
