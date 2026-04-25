import { describe, expect, it } from 'vitest';
import {
  patchProductSchema,
  patchSupportTicketSchema,
  createAuditLogSchema,
  createPurchaseSchema,
  createProductSchema,
  kycLiteSchema,
  AUDIT_LOG_CLIENT_ACTIONS,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_PRIORITIES,
} from './validation.js';

describe('patchProductSchema (status enum)', () => {
  it('accepts every supported status', () => {
    for (const s of ['draft', 'pending_review', 'published', 'suspended', 'rejected']) {
      const r = patchProductSchema.safeParse({ status: s });
      expect(r.success, `status="${s}" should be valid`).toBe(true);
    }
  });

  it('rejects unknown statuses (no silent passthrough)', () => {
    const r = patchProductSchema.safeParse({ status: 'archived' });
    expect(r.success).toBe(false);
  });

  it('rejects negative price_usd', () => {
    const r = patchProductSchema.safeParse({ price_usd: -1 });
    expect(r.success).toBe(false);
  });

  it('allows partial updates with just one field', () => {
    expect(patchProductSchema.safeParse({ price_usd: 10 }).success).toBe(true);
    expect(patchProductSchema.safeParse({ category: 'tools' }).success).toBe(true);
  });
});

describe('patchSupportTicketSchema', () => {
  it('accepts all SUPPORT_TICKET_STATUSES', () => {
    for (const s of SUPPORT_TICKET_STATUSES) {
      expect(patchSupportTicketSchema.safeParse({ status: s }).success).toBe(true);
    }
  });

  it('accepts all SUPPORT_TICKET_PRIORITIES', () => {
    for (const p of SUPPORT_TICKET_PRIORITIES) {
      expect(patchSupportTicketSchema.safeParse({ priority: p }).success).toBe(true);
    }
  });

  it('rejects free-form status', () => {
    expect(patchSupportTicketSchema.safeParse({ status: 'pwned' }).success).toBe(false);
  });

  it('rejects free-form priority', () => {
    expect(patchSupportTicketSchema.safeParse({ priority: 'critical' }).success).toBe(false);
  });

  it('requires at least one field', () => {
    expect(patchSupportTicketSchema.safeParse({}).success).toBe(false);
  });

  it('caps assigned_to length at 64', () => {
    expect(patchSupportTicketSchema.safeParse({ assigned_to: 'a'.repeat(65) }).success).toBe(false);
    expect(patchSupportTicketSchema.safeParse({ assigned_to: 'a'.repeat(64) }).success).toBe(true);
  });
});

describe('createAuditLogSchema (action whitelist)', () => {
  it('accepts every whitelisted action', () => {
    for (const a of AUDIT_LOG_CLIENT_ACTIONS) {
      const r = createAuditLogSchema.safeParse({ action: a, resource: 'product' });
      expect(r.success, `action="${a}" should be valid`).toBe(true);
    }
  });

  it('rejects forged actions (audit log integrity)', () => {
    // The whole point of this schema: an admin must NOT be able to fabricate
    // arbitrary audit events like "delete_user_evidence" or "purchase".
    const evil = ['delete_evidence', 'purchase', 'role_change', 'login', 'rescan_request'];
    for (const a of evil) {
      const r = createAuditLogSchema.safeParse({ action: a, resource: 'product' });
      expect(r.success, `action="${a}" must be rejected`).toBe(false);
    }
  });

  it('rejects unknown result values', () => {
    expect(createAuditLogSchema.safeParse({
      action: 'admin_note', resource: 'x', result: 'maybe',
    }).success).toBe(false);
  });

  it('defaults result to "success"', () => {
    const r = createAuditLogSchema.safeParse({ action: 'admin_note', resource: 'x' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.result).toBe('success');
  });
});

describe('createPurchaseSchema', () => {
  it('requires product_id', () => {
    expect(createPurchaseSchema.safeParse({}).success).toBe(false);
    expect(createPurchaseSchema.safeParse({ product_id: '' }).success).toBe(false);
  });

  it('accepts purchase without tx_hash (free product)', () => {
    expect(createPurchaseSchema.safeParse({ product_id: 'p1' }).success).toBe(true);
  });

  it('caps tx_hash length to 200 chars', () => {
    expect(createPurchaseSchema.safeParse({
      product_id: 'p1', tx_hash: 'a'.repeat(201),
    }).success).toBe(false);
  });
});

describe('createProductSchema (limits)', () => {
  it('rejects too-short and too-long names', () => {
    expect(createProductSchema.safeParse({ name: 'ab' }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'a'.repeat(61) }).success).toBe(false);
    expect(createProductSchema.safeParse({ name: 'valid name' }).success).toBe(true);
  });

  it('trims whitespace before length check', () => {
    expect(createProductSchema.safeParse({ name: '  valid  ' }).success).toBe(true);
  });

  it('rejects negative price', () => {
    expect(createProductSchema.safeParse({ name: 'valid', price_usd: -0.01 }).success).toBe(false);
  });

  it('defaults version to 1.0.0', () => {
    const r = createProductSchema.safeParse({ name: 'valid' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.version).toBe('1.0.0');
  });
});

describe('kycLiteSchema', () => {
  const VALID = {
    legalFirstName: 'John',
    legalLastName: 'Doe',
    dateOfBirth: '1990-05-15',
    countryCode: 'US',
    consent: true as const,
  };

  it('accepts valid Lite KYC data', () => {
    expect(kycLiteSchema.safeParse(VALID).success).toBe(true);
  });

  it('accepts with optional city', () => {
    expect(kycLiteSchema.safeParse({ ...VALID, city: 'New York' }).success).toBe(true);
  });

  it('rejects empty first name', () => {
    expect(kycLiteSchema.safeParse({ ...VALID, legalFirstName: '' }).success).toBe(false);
  });

  it('rejects empty last name', () => {
    expect(kycLiteSchema.safeParse({ ...VALID, legalLastName: '' }).success).toBe(false);
  });

  it('trims whitespace from names', () => {
    const r = kycLiteSchema.safeParse({ ...VALID, legalFirstName: '  John  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.legalFirstName).toBe('John');
  });

  it('rejects invalid date format', () => {
    expect(kycLiteSchema.safeParse({ ...VALID, dateOfBirth: '15-05-1990' }).success).toBe(false);
    expect(kycLiteSchema.safeParse({ ...VALID, dateOfBirth: '1990/05/15' }).success).toBe(false);
    expect(kycLiteSchema.safeParse({ ...VALID, dateOfBirth: 'not-a-date' }).success).toBe(false);
  });

  it('rejects countryCode that is not 2 characters', () => {
    expect(kycLiteSchema.safeParse({ ...VALID, countryCode: 'USA' }).success).toBe(false);
    expect(kycLiteSchema.safeParse({ ...VALID, countryCode: 'U' }).success).toBe(false);
    expect(kycLiteSchema.safeParse({ ...VALID, countryCode: '' }).success).toBe(false);
  });

  it('uppercases countryCode', () => {
    const r = kycLiteSchema.safeParse({ ...VALID, countryCode: 'de' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.countryCode).toBe('DE');
  });

  it('rejects consent=false', () => {
    expect(kycLiteSchema.safeParse({ ...VALID, consent: false }).success).toBe(false);
  });

  it('rejects missing consent', () => {
    const { consent: _, ...noConsent } = VALID;
    void _;
    expect(kycLiteSchema.safeParse(noConsent).success).toBe(false);
  });

  it('caps name length at 100', () => {
    expect(kycLiteSchema.safeParse({ ...VALID, legalFirstName: 'a'.repeat(101) }).success).toBe(false);
    expect(kycLiteSchema.safeParse({ ...VALID, legalFirstName: 'a'.repeat(100) }).success).toBe(true);
  });

  it('caps city length at 200', () => {
    expect(kycLiteSchema.safeParse({ ...VALID, city: 'a'.repeat(201) }).success).toBe(false);
  });
});
