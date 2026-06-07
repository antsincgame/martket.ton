import { describe, expect, it } from 'vitest';
import { DEFAULT_INSTRUCTIONS, mergeInstructions } from './instructions.js';

describe('DEFAULT_INSTRUCTIONS', () => {
  it('covers the core onboarding sections', () => {
    const sections = DEFAULT_INSTRUCTIONS.map((d) => d.section);
    for (const s of ['service_overview', 'prerequisites', 'onboarding', 'kyc', 'behavior']) {
      expect(sections).toContain(s);
    }
  });

  it('encodes the honesty boundary and the no-KYC-circumvention rule', () => {
    const behavior = DEFAULT_INSTRUCTIONS.find((d) => d.section === 'behavior')!;
    expect(behavior.body).toMatch(/MUST NOT conceal material facts/);
    expect(behavior.body).toMatch(/honest/i);
    const kyc = DEFAULT_INSTRUCTIONS.find((d) => d.section === 'kyc')!;
    expect(kyc.body).toMatch(/straw person|circumvent/i);
  });
});

describe('mergeInstructions', () => {
  it('returns defaults sorted by order when there are no overrides', () => {
    const out = mergeInstructions([], { activeOnly: true });
    expect(out.length).toBe(DEFAULT_INSTRUCTIONS.length);
    expect(out.every((s) => s.source === 'default')).toBe(true);
    const orders = out.map((s) => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('overrides a default section by key and marks it admin-sourced', () => {
    const out = mergeInstructions(
      [{ section: 'kyc', title: 'Custom KYC', body: 'do the thing', order: 41 }],
      { activeOnly: true },
    );
    const kyc = out.find((s) => s.section === 'kyc')!;
    expect(kyc.title).toBe('Custom KYC');
    expect(kyc.body).toBe('do the thing');
    expect(kyc.source).toBe('admin');
  });

  it('appends unknown admin sections', () => {
    const out = mergeInstructions(
      [{ section: 'fees_promo', title: 'Promo', body: 'x', order: 5 }],
      { activeOnly: true },
    );
    expect(out[0].section).toBe('fees_promo'); // order 5 sorts first
  });

  it('hides inactive sections from the agent view but keeps them for admin', () => {
    const docs = [{ section: 'behavior', title: 'b', body: 'b', active: false }];
    expect(mergeInstructions(docs, { activeOnly: true }).some((s) => s.section === 'behavior')).toBe(false);
    expect(mergeInstructions(docs, { activeOnly: false }).some((s) => s.section === 'behavior')).toBe(true);
  });

  it('ignores override docs with no section key', () => {
    const out = mergeInstructions([{ title: 'orphan', body: 'x' }], { activeOnly: false });
    expect(out.length).toBe(DEFAULT_INSTRUCTIONS.length);
  });
});
