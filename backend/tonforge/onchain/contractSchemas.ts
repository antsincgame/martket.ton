import { Address, beginCell, Cell, contractAddress, type StateInit } from '@ton/core';
import {
  coerceBuildAddress,
  coerceBuildCell,
  toBackendAddress,
  toBackendCell,
} from './tonBuildCoerce.js';

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

// Opcodes MUST match the explicit message prefixes declared in
// contracts/src/*.tact, e.g. `message(0xd2e5b971) PayEscrow`. A mismatch
// silently bounces the message → wasted gas + broken flow (a buyer's
// PayEscrow would never fund the escrow).
//
// `contractSchemas.opcodes.test.ts` parses the .tact sources and fails CI if
// any of these constants drift from the on-chain message prefixes. DEPLOY is
// the @stdlib/deploy Deployable trait opcode (not declared in our .tact).
export const OP = {
  DEPLOY: 0x946a98b6,
  MINT_LICENSE: 0x6a3aaa14,
  BURN_LICENSE: 0x4d8e8a14,
  CHANGE_OWNER: 0x4d8b8b8b,
  TRANSFER: 0x5fcc3d14,
  BURN: 0x595f07bc,
  GET_STATIC_DATA: 0x2fcb26a2,
  BUYER_BURN: 0x7a1b3c5d,
  PAY_ESCROW: 0xd2e5b971,
  CONFIRM_DELIVERY: 0x45dfb5a1,
  TIMEOUT_RELEASE: 0x7f8c9a12,
  REGISTER_LICENSE: 0x70e30189,
  REFUND_ON_BURN: 0x9b3c2d45,
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

export function buildItemDataCell(_p: LicenseItemInit): never {
  throw new Error(
    'buildItemDataCell is deprecated: flat layout overflows BitBuilder. Use computeItemAddress() instead.',
  );
}

interface LicenseItemContractStatic {
  init(
    index: bigint,
    collection: Address,
    ownerAddress: Address,
    escrowAddress: Address,
    transferLimit: bigint,
    content: Cell,
    burnDeadline: bigint,
  ): Promise<{ code: Cell; data: Cell }>;
}

let _licenseItemClass: LicenseItemContractStatic | null = null;

async function loadLicenseItemClass(): Promise<LicenseItemContractStatic> {
  if (!_licenseItemClass) {
    const mod = (await import('../../../contracts/build/LicenseItem_LicenseItem.js')) as {
      LicenseItem: LicenseItemContractStatic;
    };
    _licenseItemClass = mod.LicenseItem;
  }
  return _licenseItemClass;
}

/** Matches Tact LicenseItem storage (split data cell with ref). */
export async function computeItemAddress(code: Cell, p: LicenseItemInit): Promise<Address> {
  const LicenseItem = await loadLicenseItemClass();
  const buildCode = await coerceBuildCell(code);
  const init = await LicenseItem.init(
    p.index,
    await coerceBuildAddress(p.collection),
    await coerceBuildAddress(p.ownerAddress),
    await coerceBuildAddress(p.escrowAddress),
    BigInt(p.transferLimit),
    await coerceBuildCell(p.content),
    BigInt(p.burnDeadline),
  );
  void buildCode;
  return toBackendAddress(
    contractAddress(0, {
      code: toBackendCell(init.code),
      data: toBackendCell(init.data),
    }),
  );
}

// ─── RegisterLicense (oracle → escrow) ──────────────────────────────

export function buildRegisterLicensePayload(licenseAddress: Address): Cell {
  return beginCell()
    .storeUint(OP.REGISTER_LICENSE, 32)
    .storeAddress(licenseAddress)
    .endCell();
}

// NOTE: There is intentionally no buildOracleRefundPayload / ORACLE_REFUND.
// escrow.tact has no oracle-triggered refund receiver — the only pre-mint
// refund is RefundIfNotMinted (0x5a8e1f23), which the contract requires to be
// sent by the BUYER (sender() == self.buyer), not the oracle. Any oracle-side
// "refund" would bounce on-chain.

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
