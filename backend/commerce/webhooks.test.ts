// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { signWebhookBody, verifyWebhookSignature, validateWebhookUrl } from './webhooks.js';

describe('webhook signing', () => {
  it('round-trips a signature over the exact body', () => {
    const body = JSON.stringify({ event: 'order.paid', data: { orderId: 'o1' } });
    const sig = signWebhookBody(body, 'whsec_test');
    expect(sig.startsWith('sha256=')).toBe(true);
    expect(verifyWebhookSignature(body, 'whsec_test', sig)).toBe(true);
  });

  it('rejects a tampered body, wrong secret, or empty header', () => {
    const sig = signWebhookBody('{"a":1}', 'whsec_test');
    expect(verifyWebhookSignature('{"a":2}', 'whsec_test', sig)).toBe(false);
    expect(verifyWebhookSignature('{"a":1}', 'whsec_other', sig)).toBe(false);
    expect(verifyWebhookSignature('{"a":1}', 'whsec_test', '')).toBe(false);
  });
});

describe('validateWebhookUrl (SSRF guard)', () => {
  it('accepts a public https URL (IP literal)', async () => {
    expect(await validateWebhookUrl('https://8.8.8.8/hook')).toEqual({ ok: true });
  });

  it('rejects http, private/loopback IPs, and numeric hosts', async () => {
    expect((await validateWebhookUrl('http://8.8.8.8/hook')).ok).toBe(false); // not https
    expect((await validateWebhookUrl('https://127.0.0.1/hook')).ok).toBe(false); // loopback
    expect((await validateWebhookUrl('https://10.0.0.5/hook')).ok).toBe(false); // private
    expect((await validateWebhookUrl('https://169.254.169.254/latest')).ok).toBe(false); // cloud metadata
    expect((await validateWebhookUrl('https://2130706433/')).ok).toBe(false); // numeric host
    expect((await validateWebhookUrl('not a url')).ok).toBe(false);
  });
});
