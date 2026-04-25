import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../appwrite.js', () => {
  const listDocuments = vi.fn();
  return {
    databases: () => ({ listDocuments }),
    Query: { equal: (k: string, v: string) => `${k}=${v}`, limit: (n: number) => `limit=${n}` },
    __listDocuments: listDocuments,
  };
});

vi.mock('../../sanctions/screen.js', () => ({
  screenWallet: vi.fn(),
}));
vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { requireSellerKyc } from './requireSellerKyc.js';
import { screenWallet } from '../../sanctions/screen.js';

const WALLET = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
const PROFILE_DOC_ID = 'sp_123';

async function getListDocuments() {
  const mod = await import('../appwrite.js');
  return (mod as unknown as { __listDocuments: ReturnType<typeof vi.fn> }).__listDocuments;
}

function mockSellerProfile(kycStatus: string) {
  return getListDocuments().then((ld) =>
    ld.mockResolvedValue({
      documents: [{ $id: PROFILE_DOC_ID, wallet: WALLET, kyc_status: kycStatus }],
    }),
  );
}

function mockNoProfile() {
  return getListDocuments().then((ld) =>
    ld.mockResolvedValue({ documents: [] }),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  (screenWallet as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ ok: true });
  await mockSellerProfile('none');
});

describe('requireSellerKyc (Appwrite)', () => {
  it('rejects empty wallet', async () => {
    const r = await requireSellerKyc('');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('KYC_REQUIRED');
      expect(r.status).toBe(400);
    }
  });

  it('rejects with 451 when wallet is sanctioned', async () => {
    (screenWallet as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: false,
      reason: 'OFAC_SDN',
    });
    await mockSellerProfile('approved');
    const r = await requireSellerKyc(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(451);
      expect(r.code).toBe('SANCTIONED');
    }
  });

  it('passes when KYC is approved', async () => {
    await mockSellerProfile('approved');
    const r = await requireSellerKyc(WALLET);
    expect(r.ok).toBe(true);
  });

  it('returns KYC_PENDING for pending status', async () => {
    await mockSellerProfile('pending');
    const r = await requireSellerKyc(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('KYC_PENDING');
  });

  it('returns KYC_REJECTED for rejected status', async () => {
    await mockSellerProfile('rejected');
    const r = await requireSellerKyc(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('KYC_REJECTED');
  });

  it('returns KYC_REQUIRED for none / unknown status', async () => {
    await mockSellerProfile('none');
    const none = await requireSellerKyc(WALLET);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.code).toBe('KYC_REQUIRED');
  });

  it('returns KYC_REQUIRED when no seller profile exists', async () => {
    await mockNoProfile();
    const r = await requireSellerKyc(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('KYC_REQUIRED');
  });

  it('returns 500 if Appwrite lookup throws', async () => {
    const ld = await getListDocuments();
    ld.mockRejectedValue(new Error('connection refused'));
    const r = await requireSellerKyc(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(500);
  });
});
