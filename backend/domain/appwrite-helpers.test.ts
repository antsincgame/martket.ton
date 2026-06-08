import { describe, it, expect } from 'vitest';
import { isUniqueViolation } from './appwrite-helpers.js';

describe('isUniqueViolation', () => {
  it('true for an Appwrite 409 code', () => {
    expect(isUniqueViolation({ code: 409 })).toBe(true);
    expect(isUniqueViolation({ code: 409, message: 'Document with the requested ID already exists' })).toBe(true);
  });

  it('true for "already exists" / "duplicate" messages without a code', () => {
    expect(isUniqueViolation(new Error('Document with the requested ID already exists'))).toBe(true);
    expect(isUniqueViolation(new Error('duplicate index detected'))).toBe(true);
  });

  it('false for unrelated errors', () => {
    expect(isUniqueViolation(new Error('network timeout'))).toBe(false);
    expect(isUniqueViolation({ code: 500 })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation('boom')).toBe(false);
  });
});
