import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { verifyBallerineWebhookSignature, isBallerineConfigured } from './ballerineIntegration.js';

const SECRET = 'test-webhook-secret';

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyBallerineWebhookSignature', () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env.BALLERINE_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    process.env = { ...prev };
  });

  it('accepts a correct HMAC over the raw body (string and Buffer)', () => {
    const body = JSON.stringify({ data: { vendorData: 'EQwallet', status: 'approved' } });
    const sig = sign(body);
    expect(verifyBallerineWebhookSignature(body, sig)).toBe(true);
    expect(verifyBallerineWebhookSignature(Buffer.from(body, 'utf-8'), sig)).toBe(true);
  });

  it('accepts a "sha256="-prefixed signature', () => {
    const body = '{"x":1}';
    expect(verifyBallerineWebhookSignature(body, `sha256=${sign(body)}`)).toBe(true);
  });

  it('rejects a signature computed over a different body (tamper)', () => {
    const sig = sign('{"x":1}');
    expect(verifyBallerineWebhookSignature('{"x":2}', sig)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const body = '{"x":1}';
    expect(verifyBallerineWebhookSignature(body, sign(body, 'wrong'))).toBe(false);
  });

  it('fails closed when the secret is unset', () => {
    delete process.env.BALLERINE_WEBHOOK_SECRET;
    const body = '{"x":1}';
    expect(verifyBallerineWebhookSignature(body, sign(body))).toBe(false);
  });

  it('rejects an empty/garbage signature header', () => {
    expect(verifyBallerineWebhookSignature('{"x":1}', '')).toBe(false);
    expect(verifyBallerineWebhookSignature('{"x":1}', 'not-hex')).toBe(false);
  });
});

describe('isBallerineConfigured', () => {
  const prev = { ...process.env };
  afterEach(() => {
    process.env = { ...prev };
  });

  it('is false when any of URL/KEY/FLOW is missing', () => {
    delete process.env.BALLERINE_API_URL;
    delete process.env.BALLERINE_API_KEY;
    delete process.env.BALLERINE_FLOW_URL;
    expect(isBallerineConfigured()).toBe(false);
    process.env.BALLERINE_API_URL = 'https://api.example';
    expect(isBallerineConfigured()).toBe(false);
  });

  it('is true when URL, KEY and FLOW are all set', () => {
    process.env.BALLERINE_API_URL = 'https://api.example';
    process.env.BALLERINE_API_KEY = 'k';
    process.env.BALLERINE_FLOW_URL = 'https://flow.example';
    expect(isBallerineConfigured()).toBe(true);
  });
});
