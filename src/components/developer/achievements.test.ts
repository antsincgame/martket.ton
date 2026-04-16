import { describe, it, expect } from 'vitest';
import type { PublicDeveloperProfile } from '../../domain/marketplace/types';
import { buildAchievements } from './achievements';

function makeProfile(overrides: Partial<PublicDeveloperProfile> = {}): PublicDeveloperProfile {
  return {
    slug: 'test-dev',
    displayName: 'Test Dev',
    avatar: 'https://img.test/avatar.png',
    bio: 'Test bio',
    aboutLong: '',
    bannerUrl: '',
    joinedDate: new Date().toISOString(),
    productCount: 0,
    totalDownloads: 0,
    avgRating: 0,
    featuredProductIds: [],
    products: [],
    ...overrides,
  };
}

describe('buildAchievements', () => {
  it('returns empty for a new developer', () => {
    const result = buildAchievements(makeProfile());
    expect(result).toEqual([]);
  });

  it('grants Ancient Guild for 1+ year membership', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const result = buildAchievements(makeProfile({ joinedDate: twoYearsAgo.toISOString() }));
    const ancient = result.find((a) => a.id === 'ancient');
    expect(ancient).toBeDefined();
    expect(ancient!.title).toBe('Ancient Guild');
    expect(ancient!.description).toContain('2+');
  });

  it('grants Sovereign Creator for 5+ products', () => {
    const result = buildAchievements(makeProfile({ productCount: 7 }));
    const sovereign = result.find((a) => a.id === 'sovereign');
    expect(sovereign).toBeDefined();
    expect(sovereign!.description).toContain('7');
  });

  it('does not grant Sovereign Creator for less than 5 products', () => {
    const result = buildAchievements(makeProfile({ productCount: 4 }));
    expect(result.find((a) => a.id === 'sovereign')).toBeUndefined();
  });

  it('grants Beloved by Multitudes for 10K+ downloads', () => {
    const result = buildAchievements(makeProfile({ totalDownloads: 15_000 }));
    const beloved = result.find((a) => a.id === 'beloved');
    expect(beloved).toBeDefined();
    expect(beloved!.description).toContain('15K');
  });

  it('grants Divine Resonance for 4.7+ average rating', () => {
    const result = buildAchievements(makeProfile({ avgRating: 4.85 }));
    const divine = result.find((a) => a.id === 'divine');
    expect(divine).toBeDefined();
    expect(divine!.description).toContain('4.85');
  });

  it('does not grant Divine Resonance for 4.6 rating', () => {
    const result = buildAchievements(makeProfile({ avgRating: 4.6 }));
    expect(result.find((a) => a.id === 'divine')).toBeUndefined();
  });

  it('grants Featured Demiurge when has featured products', () => {
    const result = buildAchievements(makeProfile({ featuredProductIds: ['p1', 'p2'] }));
    const featured = result.find((a) => a.id === 'featured');
    expect(featured).toBeDefined();
    expect(featured!.description).toContain('2 works');
  });

  it('grants all achievements for a veteran developer', () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const result = buildAchievements(
      makeProfile({
        joinedDate: fiveYearsAgo.toISOString(),
        productCount: 10,
        totalDownloads: 50_000,
        avgRating: 4.9,
        featuredProductIds: ['p1'],
      }),
    );
    expect(result).toHaveLength(5);
    expect(result.map((a) => a.id).sort()).toEqual(
      ['ancient', 'beloved', 'divine', 'featured', 'sovereign'],
    );
  });

  it('each achievement has required fields', () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const result = buildAchievements(
      makeProfile({
        joinedDate: fiveYearsAgo.toISOString(),
        productCount: 10,
        totalDownloads: 50_000,
        avgRating: 4.9,
        featuredProductIds: ['p1'],
      }),
    );
    for (const a of result) {
      expect(a.id).toBeTruthy();
      expect(a.title).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(a.icon).toBeDefined();
    }
  });
});
