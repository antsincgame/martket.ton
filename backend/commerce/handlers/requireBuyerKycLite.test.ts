import { describe, expect, it, vi, beforeEach } from 'vitest';

const listDocuments = vi.fn();

vi.mock('../../core/db.js', () => ({
  databases: () => ({ listDocuments }),
}));
vi.mock('../../core/constants.js', () => ({
  CORE_DATABASE_ID: 'core',
  COL_PROFILES: 'profiles',
}));
vi.mock('../../domain/appwrite-helpers.js', () => ({
  asDoc: (d: Record<string, unknown>) => d,
}));
vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { requireBuyerKycLite } from './requireBuyerKycLite.js';

const WALLET = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireBuyerKycLite', () => {
  it('fails for empty wallet', async () => {
    const r = await requireBuyerKycLite('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('KYC_LITE_REQUIRED');
  });

  it('fails when no profile found', async () => {
    listDocuments.mockResolvedValue({ documents: [] });
    const r = await requireBuyerKycLite(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('KYC_LITE_REQUIRED');
      expect(r.status).toBe(403);
    }
  });

  it('fails when profile has no kyc_lite_completed_at', async () => {
    listDocuments.mockResolvedValue({
      documents: [{ $id: 'p1', ton_address: WALLET }],
    });
    const r = await requireBuyerKycLite(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('KYC_LITE_REQUIRED');
  });

  it('passes when profile has kyc_lite_completed_at', async () => {
    listDocuments.mockResolvedValue({
      documents: [{
        $id: 'p1',
        ton_address: WALLET,
        kyc_lite_completed_at: '2026-04-25T12:00:00.000Z',
      }],
    });
    const r = await requireBuyerKycLite(WALLET);
    expect(r.ok).toBe(true);
  });

  it('fails gracefully when Appwrite throws', async () => {
    listDocuments.mockRejectedValue(new Error('connection refused'));
    const r = await requireBuyerKycLite(WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('KYC_LITE_REQUIRED');
  });
});
