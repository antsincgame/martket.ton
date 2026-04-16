import { describe, it, expect } from 'vitest';
import { ROLES } from './roleCatalog';

describe('roleCatalog', () => {
  it('defines all expected roles', () => {
    expect(Object.keys(ROLES)).toEqual(
      expect.arrayContaining(['super_admin', 'admin', 'moderator', 'demiurge', 'viewer']),
    );
  });

  it('super_admin has wildcard permissions', () => {
    const superAdmin = ROLES.super_admin;
    expect(superAdmin.permissions).toHaveLength(1);
    expect(superAdmin.permissions[0].resource).toBe('*');
    expect(superAdmin.permissions[0].actions).toContain('create');
    expect(superAdmin.permissions[0].actions).toContain('delete');
    expect(superAdmin.permissions[0].actions).toContain('ban');
  });

  it('super_admin and admin require MFA', () => {
    expect(ROLES.super_admin.requiresMFA).toBe(true);
    expect(ROLES.admin.requiresMFA).toBe(true);
  });

  it('demiurge does not require MFA', () => {
    expect(ROLES.demiurge.requiresMFA).toBe(false);
  });

  it('viewer has read-only dashboard access', () => {
    const viewer = ROLES.viewer;
    expect(viewer.permissions).toHaveLength(1);
    expect(viewer.permissions[0].resource).toBe('dashboard');
    expect(viewer.permissions[0].actions).toEqual(['read']);
  });

  it('each role has a session duration > 0', () => {
    for (const role of Object.values(ROLES)) {
      expect(role.sessionDuration).toBeGreaterThan(0);
    }
  });

  it('super_admin has the shortest session (120 min)', () => {
    expect(ROLES.super_admin.sessionDuration).toBe(120);
  });

  it('demiurge has 480 min session', () => {
    expect(ROLES.demiurge.sessionDuration).toBe(480);
  });
});
