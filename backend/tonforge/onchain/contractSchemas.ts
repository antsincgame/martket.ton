import { Address, beginCell, Cell, contractAddress, type StateInit } from '@ton/core';

/**
 * Backend-side mirror of contracts/src/{AppCollection,LicenseItem}Wrapper.ts.
 * Kept in-tree so backend tsc doesn't need to traverse outside its rootDir.
 *
 * If the Tact source changes, update both this file and the corresponding
 * wrapper in contracts/. Tests in contracts/tests verify on-chain behaviour;
 * a smoke check via /api/tonforge/config could compare opcode hashes if we
 * ever fear drift.
 *
 * v4.1: MintLicense payload layout соответствует natural Tact order:
 * content (ref) идёт ПЕРЕД burnDeadline (uint32). Это совпадает с Tact
 * сериализацией `message(0x6a3aaa14) MintLicense { ... individualContent:
 * Cell; burnDeadline: Int as uint32; }`.
 */

// ─── Opcodes ─────────────────────────────────────────────────────────

// Opcodes MUST match Tact-generated TL-B prefixes in contracts/build/*.md.
// Mismatch silently bounces the message → wasted gas + broken flow.
// Verified against:
//   contracts/build/Escrow_Escrow.md
//   contracts/build/AppCollection_AppCollection.md
//   contracts/build/LicenseItem_LicenseItem.md
export const OP = {
  DEPLOY: 0x946a98b6,
  MINT_LICENSE: 0x6a3aaa14,
  BURN_LICENSE: 0x4d8e8a14,
  CHANGE_OWNER: 0x4d8b8b8b,
  TRANSFER: 0x5fcc3d14,
  BURN: 0x595f07bc,
  GET_STATIC_DATA: 0x2fcb26a2,
  BUYER_BURN: 0x7a1b3c5d,
  PAY_ESCROW: 0xcddea230,
  CONFIRM_DELIVERY: 0xf4a8bfa0,
  TIMEOUT_RELEASE: 0x19c74777,
  REGISTER_LICENSE: 0x70db9989,
  REFUND_ON_BURN: 0x7e083215,
  ORACLE_REFUND: 0xbf21e1ee,
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

/**
 * Порядок полей должен совпадать с Tact natural order из
 * `message(0x6a3aaa14) MintLicense { ... }` в contracts/src/escrow.tact:
 * queryId(64) · buyer(addr) · escrow(addr) · transferLimit(8) ·
 * individualContent(ref) · burnDeadline(32).
 */
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
    .storeRef(args.individualContent)
    .storeUint(args.burnDeadline, 32)
    .endCell();
}

// Note: BurnLicense (oracle → collection → item) is intentionally not
// exported. The only burn path is BuyerBurn sent directly from the buyer's
// wallet to the LicenseItem contract (see src/pages/demiurge/MyLicensesPanel).
// Allowing the oracle to burn user NFTs would be a centralization risk that
// contradicts the buyer-initiated refund design.

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

// ─── OracleRefund (treasury → escrow, only before RegisterLicense) ──

export function buildOracleRefundPayload(): Cell {
  return beginCell().storeUint(OP.ORACLE_REFUND, 32).endCell();
}

// ─── PayEscrow (buyer → escrow) ─────────────────────────────────────

export function buildPayEscrowPayload(): Cell {
  return beginCell().storeUint(OP.PAY_ESCROW, 32).endCell();
}

// ─── ConfirmDelivery (buyer → escrow, releases funds early to seller) ──

export function buildConfirmDeliveryPayload(): Cell {
  return beginCell().storeUint(OP.CONFIRM_DELIVERY, 32).endCell();
}

// ─── TimeoutRelease (anyone → escrow, after trial window) ───────────

export function buildTimeoutReleasePayload(): Cell {
  return beginCell().storeUint(OP.TIMEOUT_RELEASE, 32).endCell();
}

// ─── Off-chain content helper ────────────────────────────────────────

export function buildOffchainContent(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}

export function buildIndividualContent(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}
