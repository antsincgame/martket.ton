import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { verifyDiditWebhookSignature } from './diditIntegration.js';

const SECRET = 'test-webhook-secret';
function sign(body: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyDiditWebhookSignature (fail-closed)', () => {
  const orig = process.env.DIDIT_WEBHOOK_SECRET;
  afterEach(() => {
    if (orig === undefined) delete process.env.DIDIT_WEBHOOK_SECRET;
    else process.env.DIDIT_WEBHOOK_SECRET = orig;
  });

  it('rejects when the secret is not configured (fail-closed, was fail-open)', () => {
    delete process.env.DIDIT_WEBHOOK_SECRET;
    const body = '{"status":"Approved"}';
    expect(verifyDiditWebhookSignature(body, sign(body))).toBe(false);
  });

  it('accepts a correctly signed body', () => {
    process.env.DIDIT_WEBHOOK_SECRET = SECRET;
    const body = '{"status":"Approved","vendor_data":"EQabc"}';
    expect(verifyDiditWebhookSignature(body, sign(body))).toBe(true);
  });

  it('rejects a forged body (valid signature for different content)', () => {
    process.env.DIDIT_WEBHOOK_SECRET = SECRET;
    const real = '{"status":"Declined"}';
    const forged = '{"status":"Approved"}';
    expect(verifyDiditWebhookSignature(forged, sign(real))).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    process.env.DIDIT_WEBHOOK_SECRET = SECRET;
    const body = '{"status":"Approved"}';
    expect(verifyDiditWebhookSignature(body, sign(body, 'attacker-secret'))).toBe(false);
  });

  it('rejects an empty or non-hex signature', () => {
    process.env.DIDIT_WEBHOOK_SECRET = SECRET;
    const body = '{"status":"Approved"}';
    expect(verifyDiditWebhookSignature(body, '')).toBe(false);
    expect(verifyDiditWebhookSignature(body, 'zzzz')).toBe(false);
  });
});
