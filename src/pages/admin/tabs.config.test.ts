import { describe, it, expect } from 'vitest';
import { ADMIN_TABS, DEFAULT_ADMIN_TAB_ID } from './tabs.config';

describe('admin tabs.config (characterization)', () => {
  it('exposes exactly 15 tabs in stable order', () => {
    expect(ADMIN_TABS).toHaveLength(15);
    expect(ADMIN_TABS.map((tab) => tab.id)).toEqual([
      'security',
      'users',
      'audit',
      'analytics',
      'products',
      'verified',
      'categories',
      'ledger',
      'commerce',
      'agent-docs',
      'aml',
      'email',
      'support',
      'errors',
      'system',
    ]);
  });

  it('uses unique tab ids', () => {
    const ids = ADMIN_TABS.map((tab) => tab.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('each tab has a non-empty label, icon and lazy component', () => {
    for (const tab of ADMIN_TABS) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.icon).toBeTypeOf('object');
      expect(tab.component).toBeDefined();
      expect(tab.component.$$typeof).toBeDefined();
    }
  });

  it('preserves required permissions per tab', () => {
    const expected: Record<string, { resource: string; action: string }> = {
      security: { resource: '*', action: 'read' },
      users: { resource: 'users', action: 'read' },
      audit: { resource: 'audit_logs', action: 'read' },
      analytics: { resource: 'analytics', action: 'read' },
      products: { resource: 'products', action: 'read' },
      verified: { resource: 'users', action: 'update' },
      categories: { resource: 'categories', action: 'read' },
      ledger: { resource: '*', action: 'read' },
      commerce: { resource: 'products', action: 'read' },
      'agent-docs': { resource: 'products', action: 'read' },
      aml: { resource: '*', action: 'read' },
      email: { resource: '*', action: 'update' },
      support: { resource: '*', action: 'read' },
      errors: { resource: 'audit_logs', action: 'read' },
      system: { resource: '*', action: 'update' },
    };

    for (const tab of ADMIN_TABS) {
      expect(tab.requiredPermission).toEqual(expected[tab.id]);
    }
  });

  it('default tab id matches first tab', () => {
    expect(DEFAULT_ADMIN_TAB_ID).toBe('security');
    expect(DEFAULT_ADMIN_TAB_ID).toBe(ADMIN_TABS[0].id);
  });
});
