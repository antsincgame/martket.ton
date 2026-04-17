import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { thresholdsFromEnv, verdictFromStats, parseRetryAfterMs } from './virustotal.js';

describe('thresholdsFromEnv (NaN guard)', () => {
  const originalMalicious = process.env.VIRUSTOTAL_THRESHOLD_MALICIOUS;
  const originalSuspicious = process.env.VIRUSTOTAL_THRESHOLD_SUSPICIOUS;

  beforeEach(() => {
    delete process.env.VIRUSTOTAL_THRESHOLD_MALICIOUS;
    delete process.env.VIRUSTOTAL_THRESHOLD_SUSPICIOUS;
  });

  afterEach(() => {
    if (originalMalicious !== undefined) process.env.VIRUSTOTAL_THRESHOLD_MALICIOUS = originalMalicious;
    if (originalSuspicious !== undefined) process.env.VIRUSTOTAL_THRESHOLD_SUSPICIOUS = originalSuspicious;
  });

  it('returns safe defaults when env is unset', () => {
    const t = thresholdsFromEnv();
    expect(t.malicious).toBe(1);
    expect(t.suspicious).toBe(3);
  });

  it('parses valid integer values', () => {
    process.env.VIRUSTOTAL_THRESHOLD_MALICIOUS = '2';
    process.env.VIRUSTOTAL_THRESHOLD_SUSPICIOUS = '5';
    const t = thresholdsFromEnv();
    expect(t.malicious).toBe(2);
    expect(t.suspicious).toBe(5);
  });

  it('falls back on non-numeric input (no NaN leak)', () => {
    process.env.VIRUSTOTAL_THRESHOLD_MALICIOUS = 'not-a-number';
    process.env.VIRUSTOTAL_THRESHOLD_SUSPICIOUS = 'abc';
    const t = thresholdsFromEnv();
    expect(t.malicious).toBe(1);
    expect(t.suspicious).toBe(3);
    expect(Number.isFinite(t.malicious)).toBe(true);
    expect(Number.isFinite(t.suspicious)).toBe(true);
  });

  it('falls back on zero and negative values (would silently allow everything)', () => {
    process.env.VIRUSTOTAL_THRESHOLD_MALICIOUS = '0';
    process.env.VIRUSTOTAL_THRESHOLD_SUSPICIOUS = '-1';
    const t = thresholdsFromEnv();
    expect(t.malicious).toBe(1);
    expect(t.suspicious).toBe(3);
  });

  it('falls back on empty string', () => {
    process.env.VIRUSTOTAL_THRESHOLD_MALICIOUS = '';
    process.env.VIRUSTOTAL_THRESHOLD_SUSPICIOUS = '';
    const t = thresholdsFromEnv();
    expect(t.malicious).toBe(1);
    expect(t.suspicious).toBe(3);
  });
});

const EMPTY_STATS = {
  malicious: 0,
  suspicious: 0,
  undetected: 0,
  harmless: 0,
  timeout: 0,
  failure: 0,
};

describe('parseRetryAfterMs', () => {
  it('returns server-specified delay when header is sane', () => {
    expect(parseRetryAfterMs('5', 0)).toBe(5000);
    expect(parseRetryAfterMs('30', 1)).toBe(30_000);
  });

  it('falls back when header is missing', () => {
    expect(parseRetryAfterMs(null, 0)).toBeGreaterThan(0);
  });

  it('falls back when header is non-numeric (no NaN ms)', () => {
    const v = parseRetryAfterMs('soon', 0);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
  });

  it('rejects unbounded server input (>= 1 hour)', () => {
    // A malicious or buggy server could send Retry-After: 999999.
    // We must not block the worker for that long.
    const v = parseRetryAfterMs('999999', 0);
    expect(v).toBeLessThan(3600 * 1000);
  });

  it('rejects negative header values', () => {
    expect(parseRetryAfterMs('-10', 0)).toBeGreaterThan(0);
  });

  it('linear backoff grows with attempt', () => {
    const a = parseRetryAfterMs(null, 0);
    const b = parseRetryAfterMs(null, 1);
    const c = parseRetryAfterMs(null, 2);
    expect(b).toBeGreaterThanOrEqual(a);
    expect(c).toBeGreaterThanOrEqual(b);
  });
});

describe('verdictFromStats', () => {
  const thresholds = { malicious: 1, suspicious: 3 };

  it('returns clean for zero detections', () => {
    expect(verdictFromStats(EMPTY_STATS, thresholds)).toBe('clean');
  });

  it('returns malicious when malicious count meets threshold', () => {
    expect(verdictFromStats({ ...EMPTY_STATS, malicious: 1 }, thresholds)).toBe('malicious');
    expect(verdictFromStats({ ...EMPTY_STATS, malicious: 50 }, thresholds)).toBe('malicious');
  });

  it('returns suspicious when suspicious count meets threshold but no malicious', () => {
    expect(verdictFromStats({ ...EMPTY_STATS, suspicious: 3 }, thresholds)).toBe('suspicious');
  });

  it('prioritises malicious verdict over suspicious', () => {
    expect(verdictFromStats({ ...EMPTY_STATS, malicious: 1, suspicious: 10 }, thresholds))
      .toBe('malicious');
  });

  it('does not flag on sub-threshold suspicious count', () => {
    expect(verdictFromStats({ ...EMPTY_STATS, suspicious: 2 }, thresholds)).toBe('clean');
  });
});
