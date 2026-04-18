import { describe, expect, it } from 'vitest';

/**
 * Tests the status transition matrix and scan exemption logic
 * extracted from the PATCH /api/products/:id handler.
 */

type ProductStatus = 'draft' | 'pending_review' | 'published' | 'suspended' | 'rejected';

const ownerAllowed: Record<ProductStatus, ProductStatus[]> = {
  draft: ['pending_review'],
  pending_review: ['draft'],
  published: ['draft'],
  suspended: [],
  rejected: ['draft'],
};

const modAllowed: Record<ProductStatus, ProductStatus[]> = {
  draft: ['pending_review', 'published', 'suspended'],
  pending_review: ['published', 'rejected', 'suspended', 'draft'],
  published: ['draft', 'suspended'],
  suspended: ['draft', 'published'],
  rejected: ['draft', 'published'],
};

function isTransitionAllowed(
  from: ProductStatus,
  to: ProductStatus,
  isStaff: boolean,
): boolean {
  const matrix = isStaff ? modAllowed : ownerAllowed;
  const allowed = matrix[from];
  return !!allowed && allowed.includes(to);
}

function requiresCleanScan(target: ProductStatus): boolean {
  return target === 'published' || target === 'pending_review';
}

function isScanExempt(hasNoBuild: boolean, isStaff: boolean): boolean {
  return hasNoBuild || isStaff;
}

describe('Product status transitions (owner)', () => {
  it('allows draft → pending_review', () => {
    expect(isTransitionAllowed('draft', 'pending_review', false)).toBe(true);
  });

  it('allows pending_review → draft (withdraw)', () => {
    expect(isTransitionAllowed('pending_review', 'draft', false)).toBe(true);
  });

  it('allows published → draft (unpublish)', () => {
    expect(isTransitionAllowed('published', 'draft', false)).toBe(true);
  });

  it('forbids owner from publishing directly', () => {
    expect(isTransitionAllowed('draft', 'published', false)).toBe(false);
    expect(isTransitionAllowed('pending_review', 'published', false)).toBe(false);
  });

  it('forbids transitions from suspended for owner', () => {
    expect(isTransitionAllowed('suspended', 'draft', false)).toBe(false);
    expect(isTransitionAllowed('suspended', 'published', false)).toBe(false);
  });

  it('allows rejected → draft', () => {
    expect(isTransitionAllowed('rejected', 'draft', false)).toBe(true);
  });
});

describe('Product status transitions (moderator/admin)', () => {
  it('allows draft → published for staff', () => {
    expect(isTransitionAllowed('draft', 'published', true)).toBe(true);
  });

  it('allows pending_review → published for staff', () => {
    expect(isTransitionAllowed('pending_review', 'published', true)).toBe(true);
  });

  it('allows pending_review → rejected for staff', () => {
    expect(isTransitionAllowed('pending_review', 'rejected', true)).toBe(true);
  });

  it('allows suspended → published for staff', () => {
    expect(isTransitionAllowed('suspended', 'published', true)).toBe(true);
  });

  it('allows rejected → published for staff', () => {
    expect(isTransitionAllowed('rejected', 'published', true)).toBe(true);
  });
});

describe('Scan exemption for MVP/seed products', () => {
  it('requires clean scan for published/pending_review', () => {
    expect(requiresCleanScan('published')).toBe(true);
    expect(requiresCleanScan('pending_review')).toBe(true);
  });

  it('does not require clean scan for draft/rejected/suspended', () => {
    expect(requiresCleanScan('draft')).toBe(false);
    expect(requiresCleanScan('rejected')).toBe(false);
    expect(requiresCleanScan('suspended')).toBe(false);
  });

  it('exempts products without builds (no buildR2Key and no quarantineKey)', () => {
    expect(isScanExempt(true, false)).toBe(true);
  });

  it('exempts staff regardless of build status', () => {
    expect(isScanExempt(false, true)).toBe(true);
  });

  it('does NOT exempt owner with a build uploaded', () => {
    expect(isScanExempt(false, false)).toBe(false);
  });
});
