import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OP } from './contractSchemas.js';

/**
 * Drift guard: the backend's hand-written opcode constants MUST equal the
 * explicit `message(0x….) Name` prefixes declared in the Tact contracts.
 *
 * This is the safety net for the class of bug where contracts/src/*.tact is
 * edited (e.g. to pin explicit opcodes) but the backend payload builders are
 * not — which silently bounces every on-chain message (a buyer's PayEscrow
 * would never fund the escrow). The unit tests in contracts/ use Tact's typed
 * wrappers and therefore CANNOT catch this; only a cross-check against the raw
 * .tact source can.
 */

// Vitest runs from the repo root (root vitest.config.ts), so the contracts
// live at <cwd>/contracts/src. Using process.cwd() keeps this file valid under
// the backend's CommonJS tsc target (import.meta is disallowed there).
const contractsSrc = resolve(process.cwd(), 'contracts/src');

function parseOpcodes(file: string): Record<string, number> {
  const text = readFileSync(resolve(contractsSrc, file), 'utf8');
  const re = /message\(\s*(0x[0-9a-fA-F]+)\s*\)\s*([A-Za-z_][A-Za-z0-9_]*)/g;
  const out: Record<string, number> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out[m[2]!] = parseInt(m[1]!, 16);
  }
  return out;
}

// Message name in *.tact  →  OP key in contractSchemas.ts
const NAME_TO_OP: Record<string, keyof typeof OP> = {
  PayEscrow: 'PAY_ESCROW',
  ConfirmDelivery: 'CONFIRM_DELIVERY',
  TimeoutRelease: 'TIMEOUT_RELEASE',
  RegisterLicense: 'REGISTER_LICENSE',
  RefundOnBurn: 'REFUND_ON_BURN',
  MintLicense: 'MINT_LICENSE',
  Transfer: 'TRANSFER',
  Burn: 'BURN',
  GetStaticData: 'GET_STATIC_DATA',
  BuyerBurn: 'BUYER_BURN',
  BurnLicense: 'BURN_LICENSE',
  ChangeOwner: 'CHANGE_OWNER',
};

describe('contract opcodes ↔ .tact source of truth', () => {
  const tactOpcodes = {
    ...parseOpcodes('escrow.tact'),
    ...parseOpcodes('licenseItem.tact'),
    ...parseOpcodes('appCollection.tact'),
  };

  it('parses message opcodes from the .tact sources', () => {
    expect(Object.keys(tactOpcodes).length).toBeGreaterThan(8);
    // Spot-check the most critical one (live buyer payment path).
    expect(tactOpcodes.PayEscrow).toBe(0xd2e5b971);
  });

  for (const [tactName, opKey] of Object.entries(NAME_TO_OP)) {
    it(`OP.${opKey} matches message(${tactName}) in .tact`, () => {
      expect(tactOpcodes[tactName], `message ${tactName} not found in .tact`).toBeDefined();
      expect(OP[opKey]).toBe(tactOpcodes[tactName]);
    });
  }

  it('does not reintroduce the invented ORACLE_REFUND opcode', () => {
    expect('ORACLE_REFUND' in OP).toBe(false);
  });

  it('every OP entry (except the stdlib DEPLOY) maps to a real .tact message', () => {
    const mappedOpKeys = new Set<string>(Object.values(NAME_TO_OP));
    for (const key of Object.keys(OP)) {
      if (key === 'DEPLOY') continue; // @stdlib/deploy Deployable trait opcode
      expect(mappedOpKeys.has(key), `OP.${key} has no .tact counterpart`).toBe(true);
    }
  });
});
