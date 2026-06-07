/**
 * Guards LicenseItem address derivation via Tact init layout (not flat BitBuilder).
 */
import { describe, it, expect } from 'vitest';
import { Address, Cell } from '@ton/core';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildItemDataCell,
  buildIndividualContent,
  computeItemAddress,
  type LicenseItemInit,
} from './contractSchemas.js';

function loadItemCodeFromEnv(): Cell | null {
  const boc = (process.env.LICENSE_NFT_ITEM_CODE_BOC || '').trim();
  if (boc) return Cell.fromBase64(boc);
  return null;
}

function loadItemCodeFromBuildArtifact(): Cell | null {
  const buildPath = resolve(process.cwd(), 'contracts/build/LicenseItem_LicenseItem.ts');
  if (!existsSync(buildPath)) return null;
  const text = readFileSync(buildPath, 'utf8');
  const match = text.match(/Cell\.fromHex\('([0-9a-f]+)'\)/i);
  if (!match?.[1]) return null;
  return Cell.fromHex(match[1]);
}

function sampleInit(collection: Address, escrow: Address): LicenseItemInit {
  return {
    index: 1n,
    collection,
    ownerAddress: Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'),
    escrowAddress: escrow,
    transferLimit: 0,
    burnDeadline: 1_700_000_000,
    content: buildIndividualContent('https://cdn.example/items/1.json'),
  };
}

describe('buildItemDataCell', () => {
  it('rejects flat layout that overflows BitBuilder', () => {
    const params = sampleInit(
      Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'),
      Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'),
    );
    expect(() => buildItemDataCell(params)).toThrow(/deprecated/i);
  });
});

describe('computeItemAddress', () => {
  const code = loadItemCodeFromEnv() ?? loadItemCodeFromBuildArtifact();
  const hasCode = code !== null;

  it.skipIf(!hasCode)('returns deterministic parseable address via Tact init', async () => {
    const collection = Address.parse('kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-');
    const escrow = Address.parse('0QB29Gkp-BOr6cq8lVzIpFdCQQjUWyT8I1KcD02QTUEKEFt_');
    const params = sampleInit(collection, escrow);

    const first = await computeItemAddress(params);
    const second = await computeItemAddress(params);

    expect(first.toString()).toBe(second.toString());
    expect(() => Address.parse(first.toString())).not.toThrow();
    expect(first.toString()).toMatch(/^[EUk0]/);
  });
});
