/**
 * Manual TypeScript wrapper for the AppCollection Tact contract v2 (TEP-62).
 *
 * v2 adds burnDeadline to MintLicense and sends RegisterLicense to escrow
 * after minting.
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

export const OP_DEPLOY        = 0x946a98b6;
export const OP_MINT_LICENSE  = 0x6a3aaa14;
export const OP_BURN_LICENSE  = 0x4d8e8a14;
export const OP_CHANGE_OWNER  = 0x4d8b8b8b;

// ─── Init parameters ────────────────────────────────────────────────

export interface AppCollectionInitParams {
  appId: bigint;
  ownerAddress: Address;
  collectionContent: Cell;
  commonContent: Cell;
}

function buildDataCell(params: AppCollectionInitParams): Cell {
  return beginCell()
    .storeUint(params.appId, 256)
    .storeAddress(params.ownerAddress)
    .storeUint(0, 64)
    .storeRef(params.collectionContent)
    .storeRef(params.commonContent)
    .endCell();
}

// ─── Contract class ─────────────────────────────────────────────────

export class AppCollection implements Contract {
  readonly address: Address;
  readonly init: StateInit;

  constructor(address: Address, init: StateInit) {
    this.address = address;
    this.init = init;
  }

  static fromInit(code: Cell, params: AppCollectionInitParams): AppCollection {
    const data = buildDataCell(params);
    const init: StateInit = { code, data };
    const addr = contractAddress(0, init);
    return new AppCollection(addr, init);
  }

  static computeAddress(code: Cell, params: AppCollectionInitParams): Address {
    const data = buildDataCell(params);
    return contractAddress(0, { code, data });
  }

  // ─── Send helpers ────────────────────────────────────────────────

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: 0 as SendMode,
      body: beginCell().storeUint(OP_DEPLOY, 32).storeUint(0, 64).endCell(),
    });
  }

  async sendMintLicense(
    provider: ContractProvider,
    via: Sender,
    params: {
      queryId: bigint;
      buyerAddress: Address;
      escrowAddress: Address;
      transferLimit: number;
      individualContent: Cell;
      burnDeadline: number;
    },
    value?: bigint,
  ) {
    await provider.internal(via, {
      value: value ?? toNano('0.15'),
      sendMode: 0 as SendMode,
      body: buildMintLicensePayload(params),
    });
  }

  async sendBurnLicense(
    provider: ContractProvider,
    via: Sender,
    params: { queryId: bigint; itemAddress: Address },
    value?: bigint,
  ) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: buildBurnLicensePayload(params),
    });
  }

  async sendChangeOwner(
    provider: ContractProvider,
    via: Sender,
    params: { queryId: bigint; newOwner: Address },
    value?: bigint,
  ) {
    await provider.internal(via, {
      value: value ?? toNano('0.05'),
      sendMode: 0 as SendMode,
      body: buildChangeOwnerPayload(params),
    });
  }

  // ─── Getters ─────────────────────────────────────────────────────

  async getCollectionData(provider: ContractProvider): Promise<{
    nextItemIndex: bigint;
    collectionContent: Cell;
    owner: Address;
  }> {
    const result = await provider.get('get_collection_data', []);
    return {
      nextItemIndex: result.stack.readBigNumber(),
      collectionContent: result.stack.readCell(),
      owner: result.stack.readAddress(),
    };
  }

  async getAppId(provider: ContractProvider): Promise<bigint> {
    const result = await provider.get('app_id', []);
    return result.stack.readBigNumber();
  }
}

// ─── Payload builders ────────────────────────────────────────────────

export function buildMintLicensePayload(params: {
  queryId: bigint;
  buyerAddress: Address;
  escrowAddress: Address;
  transferLimit: number;
  individualContent: Cell;
  burnDeadline: number;
}): Cell {
  return beginCell()
    .storeUint(OP_MINT_LICENSE, 32)
    .storeUint(params.queryId, 64)
    .storeAddress(params.buyerAddress)
    .storeAddress(params.escrowAddress)
    .storeUint(params.transferLimit, 8)
    .storeRef(params.individualContent)
    .storeUint(params.burnDeadline, 32)
    .endCell();
}

export function buildBurnLicensePayload(params: {
  queryId: bigint;
  itemAddress: Address;
}): Cell {
  return beginCell()
    .storeUint(OP_BURN_LICENSE, 32)
    .storeUint(params.queryId, 64)
    .storeAddress(params.itemAddress)
    .endCell();
}

export function buildChangeOwnerPayload(params: {
  queryId: bigint;
  newOwner: Address;
}): Cell {
  return beginCell()
    .storeUint(OP_CHANGE_OWNER, 32)
    .storeUint(params.queryId, 64)
    .storeAddress(params.newOwner)
    .endCell();
}

export function buildOffchainContent(uri: string): Cell {
  return beginCell()
    .storeUint(0x01, 8)
    .storeStringTail(uri)
    .endCell();
}
