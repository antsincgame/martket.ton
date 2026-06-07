import { describe, expect, it } from 'vitest';
import { agentCreateListingSchema, createListingSchema, patchListingSchema, tonAddressSchema } from './validation.js';

const VALID_EQ = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
const VALID_UQ = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ';
const VALID_KQ = 'kQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAXZp';
const VALID_0Q = '0QABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBASus';

const VALID_BASE = {
  sellerWallet: VALID_EQ,
  catalogProductId: 'cat_1',
  title: 'Test',
  deliveryType: 'download',
  deliveryPayload: 'something',
  priceUsd: 5,
} as const;

describe('tonAddressSchema', () => {
  it('accepts valid checksum TON addresses (EQ/UQ/kQ/0Q)', () => {
    expect(tonAddressSchema.safeParse(VALID_EQ).success).toBe(true);
    expect(tonAddressSchema.safeParse(VALID_UQ).success).toBe(true);
    expect(tonAddressSchema.safeParse(VALID_KQ).success).toBe(true);
    expect(tonAddressSchema.safeParse(VALID_0Q).success).toBe(true);
  });

  it('rejects addresses with correct format but bad checksum', () => {
    const badChecksum = VALID_EQ.slice(0, -2) + 'XX';
    expect(tonAddressSchema.safeParse(badChecksum).success).toBe(false);
  });

  it('rejects raw addresses, wrong prefix, wrong length', () => {
    expect(tonAddressSchema.safeParse('').success).toBe(false);
    expect(tonAddressSchema.safeParse('0:abcdef').success).toBe(false);
    expect(tonAddressSchema.safeParse('XQAaaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_a').success).toBe(false);
    expect(tonAddressSchema.safeParse('EQshort').success).toBe(false);
  });
});

describe('createListingSchema', () => {
  it('requires collectionAddress', () => {
    const result = createListingSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join('.'));
      expect(fields).toContain('collectionAddress');
    }
  });

  it('rejects empty collectionAddress', () => {
    const result = createListingSchema.safeParse({ ...VALID_BASE, collectionAddress: '' });
    expect(result.success).toBe(false);
  });

  it('rejects malformed collectionAddress', () => {
    const result = createListingSchema.safeParse({
      ...VALID_BASE,
      collectionAddress: 'not-a-ton-address',
    });
    expect(result.success).toBe(false);
  });

  it('rejects valid-format but bad-checksum collectionAddress', () => {
    const result = createListingSchema.safeParse({
      ...VALID_BASE,
      collectionAddress: VALID_EQ.slice(0, -2) + 'XX',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid TON collectionAddress', () => {
    const result = createListingSchema.safeParse({
      ...VALID_BASE,
      collectionAddress: VALID_EQ,
    });
    expect(result.success).toBe(true);
  });
});

describe('agentCreateListingSchema', () => {
  it('does not require sellerWallet in body', () => {
    const { sellerWallet: _ignored, ...withoutWallet } = {
      ...VALID_BASE,
      collectionAddress: VALID_EQ,
    };
    const result = agentCreateListingSchema.safeParse(withoutWallet);
    expect(result.success).toBe(true);
  });
});

describe('patchListingSchema', () => {
  it('allows omitting collectionAddress (no change)', () => {
    expect(patchListingSchema.safeParse({ status: 'paused' }).success).toBe(true);
  });

  it('rejects clearing collectionAddress to empty string', () => {
    expect(patchListingSchema.safeParse({ collectionAddress: '' }).success).toBe(false);
    expect(patchListingSchema.safeParse({ collectionAddress: '   ' }).success).toBe(false);
  });

  it('accepts a valid replacement collectionAddress', () => {
    expect(patchListingSchema.safeParse({ collectionAddress: VALID_EQ }).success).toBe(true);
  });
});
