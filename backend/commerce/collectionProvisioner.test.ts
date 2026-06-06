import { describe, expect, it } from 'vitest';
import {
  buildOffchainContent,
  deriveAppId,
  buildSellerMetadataUris,
} from './collectionProvisioner.js';

const WALLET_A = 'EQABCDEFabcdef0123456789ABCDEFabcdef0123456789ABCD';
const WALLET_B = 'EQ0000000000000000000000000000000000000000000000';

describe('buildOffchainContent', () => {
  it('encodes a TEP-64 off-chain snake string with 0x01 prefix', () => {
    const uri = 'https://cdn.example.com/x/collection.json';
    const slice = buildOffchainContent(uri).beginParse();
    expect(slice.loadUint(8)).toBe(0x01);
    expect(slice.loadStringTail()).toBe(uri);
  });
});

describe('deriveAppId', () => {
  it('is deterministic for the same (wallet, network)', () => {
    expect(deriveAppId(WALLET_A, 'testnet')).toBe(deriveAppId(WALLET_A, 'testnet'));
  });

  it('differs by wallet and by network', () => {
    expect(deriveAppId(WALLET_A, 'testnet')).not.toBe(deriveAppId(WALLET_B, 'testnet'));
    expect(deriveAppId(WALLET_A, 'testnet')).not.toBe(deriveAppId(WALLET_A, 'mainnet'));
  });

  it('fits in uint256', () => {
    const id = deriveAppId(WALLET_A, 'mainnet');
    expect(id >= 0n).toBe(true);
    expect(id < (1n << 256n)).toBe(true);
  });
});

describe('buildSellerMetadataUris', () => {
  it('builds deterministic per-seller URIs', () => {
    const { metadataUri, itemBaseUri } = buildSellerMetadataUris(WALLET_A, 'testnet');
    expect(metadataUri.endsWith(`/testnet/${WALLET_A}/collection.json`)).toBe(true);
    expect(itemBaseUri.endsWith(`/testnet/${WALLET_A}/items/`)).toBe(true);
    // Stable across calls (part of the address derivation).
    expect(buildSellerMetadataUris(WALLET_A, 'testnet')).toEqual({ metadataUri, itemBaseUri });
  });
});
