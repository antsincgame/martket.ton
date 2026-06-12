import { describe, expect, it } from 'vitest';
import { Address } from '@ton/core';
import { decideReconcileAction } from './mintWorker.js';

// Real testnet addresses from the staging E2E run (license NFT + collection).
const REAL_LICENSE = 'EQAjKFSmQeDWBChuG8huGX3JyeMyf85qZgn64AOQeK0msPHU';
const REAL_LICENSE_2 = 'kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-';
const ZERO_EQ = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
const ZERO_UQ = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

// The same zero address rendered in non-mainnet forms — derived, not hard-coded.
const ZERO_RAW = `0:${'0'.repeat(64)}`;
const ZERO_TESTNET_BOUNCEABLE = Address.parse(ZERO_RAW).toString({ testOnly: true, bounceable: true });
const ZERO_TESTNET_NONBOUNCEABLE = Address.parse(ZERO_RAW).toString({ testOnly: true, bounceable: false });

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

  it('FUNDED (1) with a registered (non-zero) license → finalize (legacy 2-arg)', () => {
    expect(decideReconcileAction(1, REAL_LICENSE).kind).toBe('finalize');
    expect(decideReconcileAction(1, REAL_LICENSE_2).kind).toBe('finalize');
  });

  // M-7 / CON-01: when the expected (minted) address is known, finalize ONLY on
  // a match — a foreign address registered via front-run must NOT finalize.
  it('FUNDED (1) finalizes only when escrow license matches the expected mint', () => {
    expect(decideReconcileAction(1, REAL_LICENSE, REAL_LICENSE).kind).toBe('finalize');
    // escrow reports a different (attacker) address than the one we minted → wait
    expect(decideReconcileAction(1, REAL_LICENSE_2, REAL_LICENSE).kind).toBe('wait');
    // expected not yet known (mint pending) → wait, never finalize on trust
    expect(decideReconcileAction(1, REAL_LICENSE, '').kind).toBe('wait');
    // address-format differences (raw vs friendly) still match
    const rawForm = Address.parse(REAL_LICENSE).toString({ bounceable: true });
    expect(decideReconcileAction(1, rawForm, REAL_LICENSE).kind).toBe('finalize');
  });

  it('does not mistake a real license for the zero address', () => {
    // The zero-address guard must only match the structural zero, not a real
    // address that merely starts with EQA…
    expect(decideReconcileAction(1, REAL_LICENSE).kind).not.toBe('wait');
  });

  it('treats the zero license in ANY address form as not-yet-minted', () => {
    // Regression: the old prefix regex only matched mainnet EQAAAA…/UQAAAA…, so a
    // testnet- or raw-form zero would have been read as a real license and the
    // order finalized to PAID *before any NFT existed*. The structural hash
    // check catches every form.
    expect(decideReconcileAction(1, ZERO_RAW).kind).toBe('wait');
    expect(decideReconcileAction(1, ZERO_TESTNET_BOUNCEABLE).kind).toBe('wait');
    expect(decideReconcileAction(1, ZERO_TESTNET_NONBOUNCEABLE).kind).toBe('wait');
  });

  it('treats an unparseable license string as not-yet-minted (safe: wait, never finalize)', () => {
    expect(decideReconcileAction(1, 'not-a-ton-address').kind).toBe('wait');
  });
});
