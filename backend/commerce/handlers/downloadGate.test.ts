import { describe, expect, it } from 'vitest';
import { decideDownloadGate, type LicenseLike } from './downloadGate.js';
import { LICENSE_STATE } from '../constants.js';

const NFT_ADDR = 'EQNftaaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_aaa_aa_a';

function lic(state: LicenseLike['state'], nftAddress = ''): LicenseLike {
  return { $id: 'lic_x', state, nftAddress };
}

describe('decideDownloadGate', () => {
  it('denies with NO_LICENSE when license is missing', () => {
    const r = decideDownloadGate(null);
    expect(r.kind).toBe('deny');
    if (r.kind === 'deny') {
      expect(r.status).toBe(403);
      expect(r.code).toBe('NO_LICENSE');
    }
  });

  it('returns 425 MINT_PENDING while NFT is being minted', () => {
    const r = decideDownloadGate(lic(LICENSE_STATE.MINT_PENDING));
    expect(r.kind).toBe('deny');
    if (r.kind === 'deny') {
      expect(r.status).toBe(425);
      expect(r.code).toBe('MINT_PENDING');
      expect(r.licenseId).toBe('lic_x');
    }
  });

  it('allows download when state is MINTED and nftAddress is set', () => {
    const r = decideDownloadGate(lic(LICENSE_STATE.MINTED, NFT_ADDR));
    expect(r.kind).toBe('allow');
  });

  it('denies MINTED without nftAddress (legacy / corrupted record)', () => {
    const r = decideDownloadGate(lic(LICENSE_STATE.MINTED, ''));
    expect(r.kind).toBe('deny');
    if (r.kind === 'deny') {
      expect(r.status).toBe(403);
      expect(r.code).toBe('LICENSE_INVALID');
    }
  });

  it('denies MINT_FAILED', () => {
    const r = decideDownloadGate(lic(LICENSE_STATE.MINT_FAILED));
    expect(r.kind).toBe('deny');
    if (r.kind === 'deny') {
      expect(r.code).toBe('MINT_FAILED');
      expect(r.status).toBe(403);
    }
  });

  it('denies REFUND_PENDING', () => {
    const r = decideDownloadGate(lic(LICENSE_STATE.REFUND_PENDING, NFT_ADDR));
    expect(r.kind).toBe('deny');
    if (r.kind === 'deny') expect(r.code).toBe('REFUND_PENDING');
  });

  it('denies BURNED', () => {
    const r = decideDownloadGate(lic(LICENSE_STATE.BURNED, NFT_ADDR));
    expect(r.kind).toBe('deny');
    if (r.kind === 'deny') expect(r.code).toBe('BURNED');
  });

  it('denies REFUNDED', () => {
    const r = decideDownloadGate(lic(LICENSE_STATE.REFUNDED, NFT_ADDR));
    expect(r.kind).toBe('deny');
    if (r.kind === 'deny') expect(r.code).toBe('REFUNDED');
  });
});
