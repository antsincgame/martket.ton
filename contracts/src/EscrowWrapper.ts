/**
 * Manual TypeScript wrapper for the Escrow Tact contract.
 *
 * Once the Tact compiler is set up, replace this with the auto-generated
 * wrapper from contracts/build/Escrow.ts. The opcodes and data layout here
 * mirror the Tact contract exactly.
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

// ─── Message opcodes (Tact auto-generates these from message names) ──

export const OP_DEPLOY          = 0x946a98b6; // Deployable trait
export const OP_PAY_ESCROW      = 0xd2e5b971; // PayEscrow
export const OP_CONFIRM         = 0x45dfb5a1; // ConfirmDelivery
export const OP_OPEN_DISPUTE    = 0x03a24519; // OpenDispute
export const OP_RESOLVE_REFUND  = 0xf5a93bdf; // ResolveRefund
export const OP_RESOLVE_RELEASE = 0xfe22fa25; // ResolveRelease
export const OP_TIMEOUT_RELEASE = 0xdf33209a; // TimeoutRelease

// ─── Escrow state enum ───────────────────────────────────────────────

export const ESCROW_STATE = {
  INIT: 0,
  FUNDED: 1,
  DISPUTED: 2,
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
  feeBps: number;
  disputeWindowSec: number;
}

// ─── Build init data cell ───────────────────────────────────────────

function buildDataCell(params: EscrowInitParams): Cell {
  return beginCell()
    .storeUint(params.orderId, 256)
    .storeAddress(params.buyer)
    .storeAddress(params.seller)
    .storeAddress(params.treasury)
    .storeCoins(params.amountNano)
    .storeUint(params.feeBps, 16)
    .storeUint(params.disputeWindowSec, 32)
    .storeUint(0, 8)   // state = INIT
    .storeUint(0, 32)  // paidAt = 0
    .endCell();
}

// ─── Contract class ─────────────────────────────────────────────────

export class Escrow implements Contract {
  readonly address: Address;
  readonly init: StateInit;

  constructor(
    address: Address,
    init: StateInit,
  ) {
    this.address = address;
    this.init = init;
  }

  /**
   * Create an Escrow instance from init parameters.
   * The code cell must come from the compiled Tact contract.
   */
  static fromInit(code: Cell, params: EscrowInitParams): Escrow {
    const data = buildDataCell(params);
    const init: StateInit = { code, data };
    const addr = contractAddress(0, init);
    return new Escrow(addr, init);
  }

  /**
   * Compute the deterministic contract address without creating the full wrapper.
   */
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

  async sendOpenDispute(provider: ContractProvider, via: Sender, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_OPEN_DISPUTE, 32).storeUint(0, 64).endCell(),
    });
  }

  async sendResolveRefund(provider: ContractProvider, via: Sender, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_RESOLVE_REFUND, 32).storeUint(0, 64).endCell(),
    });
  }

  async sendResolveRelease(provider: ContractProvider, via: Sender, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_RESOLVE_RELEASE, 32).storeUint(0, 64).endCell(),
    });
  }

  async sendTimeoutRelease(provider: ContractProvider, via: Sender, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_TIMEOUT_RELEASE, 32).storeUint(0, 64).endCell(),
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
    feeBps: number;
    disputeWindowSec: number;
    state: number;
    paidAt: number;
  }> {
    const result = await provider.get('details', []);
    return {
      orderId: result.stack.readBigNumber(),
      amountNano: result.stack.readBigNumber(),
      feeBps: result.stack.readNumber(),
      disputeWindowSec: result.stack.readNumber(),
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
}

// ─── Payload builders (for frontend TonConnect integration) ──────────

export function buildPayEscrowPayload(): Cell {
  return beginCell().storeUint(OP_PAY_ESCROW, 32).storeUint(0, 64).endCell();
}

export function buildConfirmDeliveryPayload(): Cell {
  return beginCell().storeUint(OP_CONFIRM, 32).storeUint(0, 64).endCell();
}

export function buildOpenDisputePayload(): Cell {
  return beginCell().storeUint(OP_OPEN_DISPUTE, 32).storeUint(0, 64).endCell();
}

export function buildResolveRefundPayload(): Cell {
  return beginCell().storeUint(OP_RESOLVE_REFUND, 32).storeUint(0, 64).endCell();
}

export function buildResolveReleasePayload(): Cell {
  return beginCell().storeUint(OP_RESOLVE_RELEASE, 32).storeUint(0, 64).endCell();
}

export function buildTimeoutReleasePayload(): Cell {
  return beginCell().storeUint(OP_TIMEOUT_RELEASE, 32).storeUint(0, 64).endCell();
}

/**
 * Build the StateInit for TonConnect — base64 of the BOC.
 */
export function stateInitToBase64(init: StateInit): string {
  const cell = beginCell()
    .storeBit(false)  // split_depth
    .storeBit(false)  // special
    .storeBit(true)   // code present
    .storeRef(init.code!)
    .storeBit(true)   // data present
    .storeRef(init.data!)
    .storeBit(false)  // library
    .endCell();
  return cell.toBoc().toString('base64');
}
