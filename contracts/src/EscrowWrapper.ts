/**
 * Manual TypeScript wrapper for the Escrow Tact contract (v2).
 *
 * v2 removes dispute/arbitration, adds RegisterLicense + RefundOnBurn
 * for trustless buyer-initiated burn-and-refund.
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

export const OP_DEPLOY            = 0x946a98b6;
export const OP_PAY_ESCROW        = 0xd2e5b971;
export const OP_CONFIRM           = 0x45dfb5a1;
export const OP_TIMEOUT_RELEASE   = 0xdf33209a;
export const OP_REGISTER_LICENSE  = 0x70e30189;
export const OP_REFUND_ON_BURN    = 0x7e16b985;

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
  feeBps: number;
  trialWindowSec: number;
}

function buildDataCell(params: EscrowInitParams): Cell {
  return beginCell()
    .storeUint(params.orderId, 256)
    .storeAddress(params.buyer)
    .storeAddress(params.seller)
    .storeAddress(params.treasury)
    .storeCoins(params.amountNano)
    .storeUint(params.feeBps, 16)
    .storeUint(params.trialWindowSec, 32)
    .storeUint(0, 8)   // state = INIT
    .storeUint(0, 32)  // paidAt = 0
    .storeAddress(Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c')) // licenseAddress = zero
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

  async sendRegisterLicense(
    provider: ContractProvider,
    via: Sender,
    licenseAddress: Address,
    value?: bigint,
  ) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell()
        .storeUint(OP_REGISTER_LICENSE, 32)
        .storeAddress(licenseAddress)
        .endCell(),
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
    trialWindowSec: number;
    state: number;
    paidAt: number;
  }> {
    const result = await provider.get('details', []);
    return {
      orderId: result.stack.readBigNumber(),
      amountNano: result.stack.readBigNumber(),
      feeBps: result.stack.readNumber(),
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
