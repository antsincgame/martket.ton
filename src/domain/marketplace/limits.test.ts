import { describe, it, expect } from 'vitest';
import {
  PRODUCT_NAME_MIN,
  PRODUCT_NAME_MAX,
  DEVELOPER_DISPLAY_NAME_MIN,
  DEVELOPER_DISPLAY_NAME_MAX,
  DEVELOPER_SLUG_MAX,
  BIO_MAX,
  ABOUT_LONG_MAX,
} from './limits';

describe('marketplace limits', () => {
  it('PRODUCT_NAME_MIN is a positive integer', () => {
    expect(PRODUCT_NAME_MIN).toBeGreaterThan(0);
    expect(Number.isInteger(PRODUCT_NAME_MIN)).toBe(true);
  });

  it('PRODUCT_NAME_MAX is greater than PRODUCT_NAME_MIN', () => {
    expect(PRODUCT_NAME_MAX).toBeGreaterThan(PRODUCT_NAME_MIN);
  });

  it('DEVELOPER_DISPLAY_NAME range is reasonable', () => {
    expect(DEVELOPER_DISPLAY_NAME_MIN).toBeGreaterThanOrEqual(1);
    expect(DEVELOPER_DISPLAY_NAME_MAX).toBeGreaterThan(DEVELOPER_DISPLAY_NAME_MIN);
    expect(DEVELOPER_DISPLAY_NAME_MAX).toBeLessThanOrEqual(100);
  });

  it('DEVELOPER_SLUG_MAX is reasonable', () => {
    expect(DEVELOPER_SLUG_MAX).toBeGreaterThan(0);
    expect(DEVELOPER_SLUG_MAX).toBeLessThanOrEqual(100);
  });

  it('BIO_MAX matches Twitter-style short bio constraint', () => {
    expect(BIO_MAX).toBeGreaterThanOrEqual(100);
    expect(BIO_MAX).toBeLessThanOrEqual(300);
  });

  it('ABOUT_LONG_MAX is between 300 and 2000 chars', () => {
    expect(ABOUT_LONG_MAX).toBeGreaterThanOrEqual(300);
    expect(ABOUT_LONG_MAX).toBeLessThanOrEqual(2000);
  });
});
