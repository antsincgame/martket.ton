import { describe, it, expect } from 'vitest';
import { deriveNextAction, type OnboardingChecklist } from './status.js';

type Checklist = Pick<OnboardingChecklist, 'kyc' | 'storage' | 'catalog' | 'distribution'>;

// Fully-onboarded baseline; each test knocks out one rung of the ladder.
const ready: Checklist = {
  kyc: { status: 'approved', ok: true },
  storage: { status: 'connected', connected: true, provider: 'r2' },
  catalog: { listings: 1, hasListings: true },
  distribution: { configured: true, verified: true },
};

describe('deriveNextAction — Copilot-Lite guidance ladder', () => {
  it('points to KYC first — no agent API, external owner action', () => {
    const a = deriveNextAction({ ...ready, kyc: { status: 'none', ok: false } });
    expect(a.step).toBe('kyc');
    expect(a.section).toBe('kyc');
    expect(a.api).toBeNull();
    expect(a.external).toMatch(/KYC/i);
    expect(a.ui.label.length).toBeGreaterThan(0);
  });

  it('after KYC, points to distribution/storage with the PUT affordance', () => {
    const a = deriveNextAction({
      ...ready,
      storage: { status: 'unconfigured', connected: false, provider: null },
      distribution: { configured: false, verified: false },
    });
    expect(a.step).toBe('storage');
    expect(a.section).toBe('prerequisites');
    expect(a.api).toEqual({ method: 'PUT', path: '/api/v1/agent/listings/:id/distribution' });
    expect(a.external).toMatch(/R2|S3|GitHub/);
  });

  it('with storage but no listings, points to create a draft (POST /products)', () => {
    const a = deriveNextAction({ ...ready, catalog: { listings: 0, hasListings: false } });
    expect(a.step).toBe('create_product');
    expect(a.api).toEqual({ method: 'POST', path: '/api/v1/agent/products' });
    expect(a.external).toBeNull();
  });

  it('with listings but unverified distribution, points to verify', () => {
    const a = deriveNextAction({ ...ready, distribution: { configured: true, verified: false } });
    expect(a.step).toBe('verify_distribution');
    expect(a.api?.method).toBe('PUT');
  });

  it('fully onboarded → done (behavior section, no api, no external)', () => {
    const a = deriveNextAction(ready);
    expect(a.step).toBe('done');
    expect(a.section).toBe('behavior');
    expect(a.api).toBeNull();
    expect(a.external).toBeNull();
  });
});
