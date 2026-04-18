import { Address, beginCell, Cell, contractAddress, type StateInit } from '@ton/core';

/**
 * Backend-side mirror of contracts/src/{AppCollection,LicenseItem}Wrapper.ts.
 * Kept in-tree so backend tsc doesn't need to traverse outside its rootDir.
 *
 * If the Tact source changes, update both this file and the corresponding
 * wrapper in contracts/. Tests in contracts/tests verify on-chain behaviour;
 * a smoke check via /api/tonforge/config could compare opcode hashes if we
 * ever fear drift.
 */

// ─── Opcodes ─────────────────────────────────────────────────────────

export const OP = {
  DEPLOY: 0x946a98b6,
  MINT_LICENSE: 0x6a3aaa14,
  BURN_LICENSE: 0x4d8e8a14,
  CHANGE_OWNER: 0x4d8b8b8b,
  TRANSFER: 0x5fcc3d14,
  BURN: 0x595f07bc,
  GET_STATIC_DATA: 0x2fcb26a2,
  BUYER_BURN: 0x7a1b3c5d,
  REGISTER_LICENSE: 0x70e30189,
  REFUND_ON_BURN: 0x7e16b985,
} as const;

// ─── AppCollection ───────────────────────────────────────────────────

export interface AppCollectionInit {
  appId: bigint;
  ownerAddress: Address;
  collectionContent: Cell;
  commonContent: Cell;
}

export function buildCollectionDataCell(p: AppCollectionInit): Cell {
  return beginCell()
    .storeUint(p.appId, 256)
    .storeAddress(p.ownerAddress)
    .storeUint(0, 64)
    .storeRef(p.collectionContent)
    .storeRef(p.commonContent)
    .endCell();
}

export function computeCollectionAddress(code: Cell, p: AppCollectionInit): Address {
  return contractAddress(0, { code, data: buildCollectionDataCell(p) });
}

export function collectionStateInit(code: Cell, p: AppCollectionInit): StateInit {
  return { code, data: buildCollectionDataCell(p) };
}

export function buildMintLicensePayload(args: {
  queryId: bigint;
  buyerAddress: Address;
  escrowAddress: Address;
  transferLimit: number;
  burnDeadline: number;
  individualContent: Cell;
}): Cell {
  return beginCell()
    .storeUint(OP.MINT_LICENSE, 32)
    .storeUint(args.queryId, 64)
    .storeAddress(args.buyerAddress)
    .storeAddress(args.escrowAddress)
    .storeUint(args.transferLimit, 8)
    .storeUint(args.burnDeadline, 32)
    .storeRef(args.individualContent)
    .endCell();
}

export function buildBurnLicensePayload(args: {
  queryId: bigint;
  itemAddress: Address;
}): Cell {
  return beginCell()
    .storeUint(OP.BURN_LICENSE, 32)
    .storeUint(args.queryId, 64)
    .storeAddress(args.itemAddress)
    .endCell();
}

// ─── LicenseItem ─────────────────────────────────────────────────────

export interface LicenseItemInit {
  index: bigint;
  collection: Address;
  ownerAddress: Address;
  escrowAddress: Address;
  transferLimit: number;
  burnDeadline: number;
  content: Cell;
}

export function buildItemDataCell(p: LicenseItemInit): Cell {
  return beginCell()
    .storeUint(p.index, 256)
    .storeAddress(p.collection)
    .storeAddress(p.ownerAddress)
    .storeAddress(p.escrowAddress)
    .storeUint(p.transferLimit, 8)
    .storeUint(0, 8)
    .storeUint(p.burnDeadline, 32)
    .storeRef(p.content)
    .endCell();
}

export function computeItemAddress(code: Cell, p: LicenseItemInit): Address {
  return contractAddress(0, { code, data: buildItemDataCell(p) });
}

// ─── RegisterLicense (oracle → escrow) ──────────────────────────────

export function buildRegisterLicensePayload(licenseAddress: Address): Cell {
  return beginCell()
    .storeUint(OP.REGISTER_LICENSE, 32)
    .storeAddress(licenseAddress)
    .endCell();
}

// ─── Off-chain content helper ────────────────────────────────────────

export function buildOffchainContent(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}

export function buildIndividualContent(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}
