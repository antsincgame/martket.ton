import { describe, it, expect } from 'vitest';
import { profileRowToAuthenticatedUser, type ProfileRow } from './authProfileMap';

const baseRow: ProfileRow = {
  id: 'profile-1',
  email: 'test@example.com',
  ton_address: 'EQtest123',
  name: 'TestUser',
  display_name: 'Test Display',
  role: 'demiurge',
  avatar: 'https://img.test/a.png',
  bio: 'A bio',
  security_level: 'medium',
  is_active: true,
};

describe('profileRowToAuthenticatedUser', () => {
  it('maps basic fields correctly', () => {
    const result = profileRowToAuthenticatedUser(baseRow);
    expect(result.id).toBe('profile-1');
    expect(result.email).toBe('test@example.com');
    expect(result.tonAddress).toBe('EQtest123');
    expect(result.isActive).toBe(true);
    expect(result.securityLevel).toBe('medium');
  });

  it('resolves role from roleCatalog', () => {
    const result = profileRowToAuthenticatedUser(baseRow);
    expect(result.role).toBe('demiurge');
    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].name).toBe('demiurge');
  });

  it('falls back to demiurge when role is unknown', () => {
    const row = { ...baseRow, role: 'nonexistent_role' };
    const result = profileRowToAuthenticatedUser(row);
    expect(result.role).toBe('demiurge');
    expect(result.roles[0].name).toBe('demiurge');
  });

  it('handles null/undefined fields gracefully', () => {
    const minimal: ProfileRow = { id: 'min-1' };
    const result = profileRowToAuthenticatedUser(minimal);
    expect(result.id).toBe('min-1');
    expect(result.email).toBeUndefined();
    expect(result.tonAddress).toBe('');
    expect(result.role).toBe('demiurge');
    expect(result.profile.displayName).toBe('Demiurge');
    expect(result.isActive).toBe(true);
  });

  it('sets is_active=false when explicitly false', () => {
    const row = { ...baseRow, is_active: false };
    const result = profileRowToAuthenticatedUser(row);
    expect(result.isActive).toBe(false);
  });

  it('maps profile sub-object correctly', () => {
    const row: ProfileRow = {
      ...baseRow,
      slug: 'test-slug',
      banner_url: 'https://banner.test',
      website: 'https://example.com',
      github: 'testgithub',
      telegram: '@test',
      twitter: '@twittertest',
    };
    const result = profileRowToAuthenticatedUser(row);
    expect(result.profile.slug).toBe('test-slug');
    expect(result.profile.bannerUrl).toBe('https://banner.test');
    expect(result.profile.website).toBe('https://example.com');
    expect(result.profile.github).toBe('testgithub');
    expect(result.profile.telegram).toBe('@test');
    expect(result.profile.twitter).toBe('@twittertest');
  });

  it('sets correct session duration from role', () => {
    const result = profileRowToAuthenticatedUser(baseRow);
    expect(result.sessionDuration).toBe(480);
  });

  it('sets MFA requirement from role', () => {
    const adminRow = { ...baseRow, role: 'admin' };
    const adminResult = profileRowToAuthenticatedUser(adminRow);
    expect(adminResult.requiresMFA).toBe(true);

    const demiurgeResult = profileRowToAuthenticatedUser(baseRow);
    expect(demiurgeResult.requiresMFA).toBe(false);
  });

  it('initializes stats with zeros', () => {
    const result = profileRowToAuthenticatedUser(baseRow);
    expect(result.stats.totalSpent).toBe(0);
    expect(result.stats.karmaPoints).toBe(0);
    expect(result.stats.appsOwned).toBe(0);
  });

  it('initializes empty arrays for library and products', () => {
    const result = profileRowToAuthenticatedUser(baseRow);
    expect(result.library).toEqual([]);
    expect(result.products).toEqual([]);
    expect(result.achievements).toEqual([]);
  });

  it('parses featured_product_ids as JSON array', () => {
    const row = { ...baseRow, featured_product_ids: '["p1","p2","p3"]' };
    const result = profileRowToAuthenticatedUser(row);
    expect(result.profile.featuredProductIds).toEqual(['p1', 'p2', 'p3']);
  });

  it('handles invalid featured_product_ids JSON gracefully', () => {
    const row = { ...baseRow, featured_product_ids: 'not-json' };
    const result = profileRowToAuthenticatedUser(row);
    expect(result.profile.featuredProductIds).toBeUndefined();
  });
});
