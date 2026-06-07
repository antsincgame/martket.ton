/**
 * Coerce backend @ton/core values into contracts/build @ton/core instances.
 * Autogen Tact wrappers reject Address/Cell from a different module copy.
 */
import { Address, Cell, beginCell } from '@ton/core';

type BuildCore = typeof import('@ton/core');

let buildCore: BuildCore | null = null;

async function loadBuildCore(): Promise<BuildCore> {
  if (!buildCore) {
    buildCore = (await import(
      '../../../contracts/node_modules/@ton/core/dist/index.js'
    )) as BuildCore;
  }
  return buildCore;
}

export async function coerceBuildAddress(raw: string | Address): Promise<Address> {
  const { Address: BuildAddress } = await loadBuildCore();
  const parsed = typeof raw === 'string' ? Address.parse(raw) : raw;
  return BuildAddress.parse(parsed.toRawString());
}

export async function coerceBuildCell(cell: Cell): Promise<Cell> {
  const { Cell: BuildCell } = await loadBuildCore();
  return BuildCell.fromBoc(cell.toBoc())[0]!;
}

export async function buildOffchainContentForContract(uri: string): Promise<Cell> {
  const { beginCell: buildBeginCell } = await loadBuildCore();
  return buildBeginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}

/** Convert contracts/build Cell back to backend @ton/core Cell. */
export function toBackendCell(cell: Cell): Cell {
  return Cell.fromBoc(cell.toBoc())[0]!;
}

/** Convert contracts/build Address back to backend @ton/core Address. */
export function toBackendAddress(addr: Address): Address {
  return Address.parse(addr.toRawString());
}

export function buildBackendOffchainContent(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}
