import { describe, expect, it } from 'vitest';
import { decideReconcileAction } from './mintWorker.js';

// Real testnet addresses from the staging E2E run (license NFT + collection).
const REAL_LICENSE = 'EQAjKFSmQeDWBChuG8huGX3JyeMyf85qZgn64AOQeK0msPHU';
const REAL_LICENSE_2 = 'kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-';
const ZERO_EQ = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
const ZERO_UQ = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

describe('decideReconcileAction — order reconciler state machine', () => {
  it('null escrow state (not found / query failed) → noop', () => {
    expect(decideReconcileAction(null, null).kind).toBe('noop');
    expect(decideReconcileAction(null, REAL_LICENSE).kind).toBe('noop');
  });

  it('escrow state 3 (released) → fulfilled, regardless of license', () => {
    expect(decideReconcileAction(3, null).kind).toBe('fulfilled');
    expect(decideReconcileAction(3, REAL_LICENSE).kind).toBe('fulfilled');
  });

  it('escrow state 4 (refunded) → refunded, regardless of license', () => {
    expect(decideReconcileAction(4, null).kind).toBe('refunded');
    expect(decideReconcileAction(4, REAL_LICENSE).kind).toBe('refunded');
  });

  it('unknown / pre-funding escrow states → noop', () => {
    expect(decideReconcileAction(0, null).kind).toBe('noop'); // unfunded
    expect(decideReconcileAction(2, null).kind).toBe('noop'); // some intermediate
    expect(decideReconcileAction(5, REAL_LICENSE).kind).toBe('noop');
  });

  it('FUNDED (1) with no license yet → wait (tonforge will mint)', () => {
    expect(decideReconcileAction(1, null).kind).toBe('wait');
    expect(decideReconcileAction(1, '').kind).toBe('wait');
    expect(decideReconcileAction(1, ZERO_EQ).kind).toBe('wait');
    expect(decideReconcileAction(1, ZERO_UQ).kind).toBe('wait');
  });

  it('FUNDED (1) with a registered (non-zero) license → finalize', () => {
    expect(decideReconcileAction(1, REAL_LICENSE).kind).toBe('finalize');
    expect(decideReconcileAction(1, REAL_LICENSE_2).kind).toBe('finalize');
  });

  it('does not mistake a real license for the zero address', () => {
    // The zero-address guard must only match the all-A prefix, not a real
    // address that merely starts with EQA…
    expect(decideReconcileAction(1, REAL_LICENSE).kind).not.toBe('wait');
  });
});
