import { describe, it, expect } from 'vitest';
import { Address, beginCell } from '@ton/core';
import { buildMintLicensePayload, OP } from './contractSchemas.js';

// Golden-cell guard for the MintLicense payload byte layout. The opcode-drift
// test pins the OP.* *values*; this pins the field ORDER and WIDTHS — the
// silent-bounce class the contract-schema comment warns about (a misordered or
// mis-sized field deserializes wrong on-chain and the message bounces).
//
// MintLicense (contracts/src/escrow.tact):
//   op(32) queryId(64) buyerAddress escrowAddress transferLimit(8)
//   individualContent(ref) burnDeadline(32)

const BUYER = Address.parse('EQAjKFSmQeDWBChuG8huGX3JyeMyf85qZgn64AOQeK0msPHU');
const ESCROW = Address.parse('kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-');

describe('buildMintLicensePayload — byte layout (golden cell)', () => {
  it('round-trips every field in the exact MintLicense order and width', () => {
    const content = beginCell().storeUint(0x01, 8).storeStringTail('ipfs://meta.json').endCell();
    const cell = buildMintLicensePayload({
      queryId: 123456789n,
      buyerAddress: BUYER,
      escrowAddress: ESCROW,
      transferLimit: 3,
      burnDeadline: 1893456000,
      individualContent: content,
    });

    const s = cell.beginParse();
    expect(s.loadUint(32)).toBe(OP.MINT_LICENSE); // opcode prefix
    expect(s.loadUintBig(64)).toBe(123456789n); // queryId
    expect(s.loadAddress().equals(BUYER)).toBe(true); // buyerAddress
    expect(s.loadAddress().equals(ESCROW)).toBe(true); // escrowAddress
    expect(s.loadUint(8)).toBe(3); // transferLimit
    expect(s.loadRef().equals(content)).toBe(true); // individualContent (ref)
    expect(s.loadUint(32)).toBe(1893456000); // burnDeadline
    expect(s.remainingBits).toBe(0);
    expect(s.remainingRefs).toBe(0);
  });

  it('carries the canonical MintLicense opcode tag', () => {
    const cell = buildMintLicensePayload({
      queryId: 0n,
      buyerAddress: BUYER,
      escrowAddress: ESCROW,
      transferLimit: 0,
      burnDeadline: 0,
      individualContent: beginCell().endCell(),
    });
    expect(cell.beginParse().loadUint(32)).toBe(OP.MINT_LICENSE);
    expect(OP.MINT_LICENSE).toBe(0x6a3aaa14); // matches escrow.tact message(0x6a3aaa14)
  });
});
