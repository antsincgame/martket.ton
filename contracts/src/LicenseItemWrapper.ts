/**
 * Manual TypeScript wrapper for the LicenseItem Tact contract v2 (TEP-62/64).
 *
 * v2 adds BuyerBurn (owner-initiated burn within trial window → escrow refund)
 * and burnDeadline field.
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

// ─── Opcodes ─────────────────────────────────────────────────────────

export const OP_DEPLOY            = 0x946a98b6;
export const OP_TRANSFER          = 0x5fcc3d14;
export const OP_BURN              = 0x595f07bc;
export const OP_BUYER_BURN        = 0x7a1b3c5d;
export const OP_GET_STATIC_DATA   = 0x2fcb26a2;
export const OP_REPORT_STATIC     = 0x8b771735;
export const OP_OWNER_ASSIGNED    = 0x05138d91;
export const OP_EXCESSES          = 0xd53276db;

// ─── Init parameters ────────────────────────────────────────────────

export interface LicenseItemInitParams {
  index: bigint;
  collection: Address;
  ownerAddress: Address;
  escrowAddress: Address;
  transferLimit: number;
  content: Cell;
  burnDeadline: number;
}

function buildDataCell(params: LicenseItemInitParams): Cell {
  return beginCell()
    .storeUint(params.index, 256)
    .storeAddress(params.collection)
    .storeAddress(params.ownerAddress)
    .storeAddress(params.escrowAddress)
    .storeUint(params.transferLimit, 8)
    .storeUint(0, 8)  // transfers = 0
    .storeRef(params.content)
    .storeUint(params.burnDeadline, 32)
    .endCell();
}

// ─── Contract class ─────────────────────────────────────────────────

export class LicenseItem implements Contract {
  readonly address: Address;
  readonly init: StateInit;

  constructor(address: Address, init: StateInit) {
    this.address = address;
    this.init = init;
  }

  static fromInit(code: Cell, params: LicenseItemInitParams): LicenseItem {
    const data = buildDataCell(params);
    const init: StateInit = { code, data };
    const addr = contractAddress(0, init);
    return new LicenseItem(addr, init);
  }

  static computeAddress(code: Cell, params: LicenseItemInitParams): Address {
    const data = buildDataCell(params);
    return contractAddress(0, { code, data });
  }

  // ─── Send helpers ────────────────────────────────────────────────

  async sendBurn(provider: ContractProvider, via: Sender, queryId: bigint, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_BURN, 32).storeUint(queryId, 64).endCell(),
    });
  }

  async sendBuyerBurn(provider: ContractProvider, via: Sender, queryId: bigint, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.1'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_BUYER_BURN, 32).storeUint(queryId, 64).endCell(),
    });
  }

  async sendGetStaticData(provider: ContractProvider, via: Sender, queryId: bigint, value?: bigint) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_GET_STATIC_DATA, 32).storeUint(queryId, 64).endCell(),
    });
  }

  // ─── Getters ─────────────────────────────────────────────────────

  async getNftData(provider: ContractProvider): Promise<{
    init: boolean;
    index: bigint;
    collection: Address;
    owner: Address;
    content: Cell;
  }> {
    const result = await provider.get('get_nft_data', []);
    return {
      init: result.stack.readBoolean(),
      index: result.stack.readBigNumber(),
      collection: result.stack.readAddress(),
      owner: result.stack.readAddress(),
      content: result.stack.readCell(),
    };
  }

  async getEscrowAddress(provider: ContractProvider): Promise<Address> {
    const result = await provider.get('escrow_address', []);
    return result.stack.readAddress();
  }

  async getSoulboundInfo(provider: ContractProvider): Promise<{
    transferLimit: number;
    transfers: number;
  }> {
    const result = await provider.get('soulbound_info', []);
    return {
      transferLimit: result.stack.readNumber(),
      transfers: result.stack.readNumber(),
    };
  }

  async getBurnDeadline(provider: ContractProvider): Promise<number> {
    const result = await provider.get('burn_deadline', []);
    return result.stack.readNumber();
  }
}

// ─── Payload builders ────────────────────────────────────────────────

export function buildBurnPayload(queryId: bigint = 0n): Cell {
  return beginCell().storeUint(OP_BURN, 32).storeUint(queryId, 64).endCell();
}

export function buildBuyerBurnPayload(queryId: bigint = 0n): Cell {
  return beginCell().storeUint(OP_BUYER_BURN, 32).storeUint(queryId, 64).endCell();
}

export function buildGetStaticDataPayload(queryId: bigint = 0n): Cell {
  return beginCell().storeUint(OP_GET_STATIC_DATA, 32).storeUint(queryId, 64).endCell();
}
