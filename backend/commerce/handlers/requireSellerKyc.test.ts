import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../tonforge/service.js', () => ({
  getTonForgeService: vi.fn(),
}));
vi.mock('../../sanctions/screen.js', () => ({
  screenWallet: vi.fn(),
}));
vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { requireSellerKyc } from './requireSellerKyc.js';
import { getTonForgeService } from '../../tonforge/service.js';
import { screenWallet } from '../../sanctions/screen.js';

// requireSellerKyc itself doesn't parse the address — it just delegates to
// screenWallet (mocked here) and the TonForge service. So the format only
// needs to be non-empty.
const WALLET = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

function setKycStatus(status: string) {
  (getTonForgeService as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    getDeveloperWorkspace: () => ({ developer: { kycStatus: status } }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (screenWallet as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ ok: true });
});

describe('requireSellerKyc', () => {
  it('rejects empty wallet', () => {
    const r = requireSellerKyc('');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('KYC_REQUIRED');
      expect(r.status).toBe(400);
    }
  });

  it('rejects with 451 when wallet is sanctioned (regardless of KYC status)', () => {
    (screenWallet as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: false,
      reason: 'OFAC_SDN',
    });
    setKycStatus('approved');
    const r = requireSellerKyc(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(451);
      expect(r.code).toBe('SANCTIONED');
    }
  });

  it('passes when KYC is approved', () => {
    setKycStatus('approved');
    expect(requireSellerKyc(WALLET).ok).toBe(true);
  });

  it('returns KYC_PENDING for under_review', () => {
    setKycStatus('under_review');
    const r = requireSellerKyc(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('KYC_PENDING');
  });

  it('returns KYC_REJECTED for rejected status', () => {
    setKycStatus('rejected');
    const r = requireSellerKyc(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('KYC_REJECTED');
  });

  it('returns KYC_REQUIRED for draft / unknown status', () => {
    setKycStatus('draft');
    const draft = requireSellerKyc(WALLET);
    expect(draft.ok).toBe(false);
    if (!draft.ok) expect(draft.code).toBe('KYC_REQUIRED');

    setKycStatus('mystery');
    const unknown = requireSellerKyc(WALLET);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe('KYC_REQUIRED');
  });

  it('returns 500 if the developer profile lookup throws', () => {
    (getTonForgeService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('boom');
    });
    const r = requireSellerKyc(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(500);
  });
});
