import { describe, it, expect, vi, beforeEach } from 'vitest';

// Gate helpers stay real (they have their own tests); we drive their inputs.
vi.mock('../scan/virustotal.js', () => ({ isVtConfigured: () => false }));
vi.mock('./licenseRepository.js', () => ({ findLicenseByBuyerAndListing: vi.fn() }));
vi.mock('../distribution/manifest.js', () => ({
  storedToManifest: (s: unknown) => ({ kind: (s as { kind: string }).kind }),
}));

import { resolveBuyerDownload, DOWNLOAD_RATE_LIMIT_PER_DAY, type DownloadListingDoc } from './buyerDownload.js';
import { findLicenseByBuyerAndListing } from './licenseRepository.js';

const mockFindLicense = vi.mocked(findLicenseByBuyerAndListing);

const WALLET = 'EQbuyer';
const goodLocator = JSON.stringify({ bucket: 'b', key: 'k' });

function baseDoc(overrides: Partial<DownloadListingDoc> = {}): DownloadListingDoc {
  return {
    $id: 'listing1',
    sellerWallet: 'EQseller',
    distribution_kind: 'r2',
    distribution_locator: goodLocator,
    distribution_sha256: 'abc',
    distribution_state: 'verified',
    distribution_ttl_sec: 3600,
    scan_status: 'clean',
    ...overrides,
  };
}

// Minimal db stub: entitlements present, no recent downloads, seller found.
function makeDb(opts: { entitlements?: number; recent?: number; seller?: boolean } = {}) {
  const { entitlements = 1, recent = 0, seller = true } = opts;
  return {
    listDocuments: vi.fn(async (_dbId: string, col: string) => {
      if (col === 'entitlements') {
        return { documents: Array.from({ length: entitlements }, (_, i) => ({ $id: `ent${i}` })) };
      }
      if (col === 'download_audit') {
        return { documents: Array.from({ length: recent }, () => ({})) };
      }
      if (col === 'seller_profiles') {
        return { documents: seller ? [{ $id: 'sellerDoc' }] : [] };
      }
      return { documents: [] };
    }),
  } as never;
}

beforeEach(() => {
  mockFindLicense.mockReset();
  // Default: a clean minted license that decideDownloadGate will allow.
  mockFindLicense.mockResolvedValue({
    $id: 'lic1', state: 'minted', nftAddress: 'EQnft', scanStatus: 'clean',
  } as never);
});

describe('resolveBuyerDownload — gate ordering', () => {
  it('denies NO_BUILD when distribution not verified', async () => {
    const r = await resolveBuyerDownload(makeDb(), baseDoc({ distribution_state: 'draft' }), WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(404); expect(r.code).toBe('NO_BUILD'); }
  });

  it('denies NO_MANIFEST when locator missing', async () => {
    const r = await resolveBuyerDownload(makeDb(), baseDoc({ distribution_locator: '' }), WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NO_MANIFEST');
  });

  it('denies NO_ENTITLEMENT when the wallet has no purchase', async () => {
    const r = await resolveBuyerDownload(makeDb({ entitlements: 0 }), baseDoc(), WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(403); expect(r.code).toBe('NO_ENTITLEMENT'); }
  });

  it('denies when the license gate denies (no minted NFT)', async () => {
    mockFindLicense.mockResolvedValue(null as never);
    const r = await resolveBuyerDownload(makeDb(), baseDoc(), WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('denies DOWNLOAD_RATE_LIMIT at the daily cap', async () => {
    const r = await resolveBuyerDownload(makeDb({ recent: DOWNLOAD_RATE_LIMIT_PER_DAY }), baseDoc(), WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(429); expect(r.code).toBe('DOWNLOAD_RATE_LIMIT'); }
  });

  it('grants with manifest, sellerId, ttl and sha on the happy path', async () => {
    const r = await resolveBuyerDownload(makeDb(), baseDoc(), WALLET);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sellerId).toBe('sellerDoc');
      expect(r.ttlSec).toBe(3600);
      expect(r.sha256).toBe('abc');
      expect(r.entitlementId).toBe('ent0');
      expect(r.manifest.kind).toBe('r2');
    }
  });

  it('clamps an out-of-range TTL into [60, 21600]', async () => {
    const hi = await resolveBuyerDownload(makeDb(), baseDoc({ distribution_ttl_sec: 99999 }), WALLET);
    const lo = await resolveBuyerDownload(makeDb(), baseDoc({ distribution_ttl_sec: 1 }), WALLET);
    if (hi.ok) expect(hi.ttlSec).toBe(21600);
    if (lo.ok) expect(lo.ttlSec).toBe(60);
  });

  it('falls back to sellerWallet when no seller profile doc exists', async () => {
    const r = await resolveBuyerDownload(makeDb({ seller: false }), baseDoc(), WALLET);
    if (r.ok) expect(r.sellerId).toBe('EQseller');
  });
});
