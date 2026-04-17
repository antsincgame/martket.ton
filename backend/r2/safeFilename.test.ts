import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { safeFilename } = require('./safeFilename.js') as {
  safeFilename: (raw: unknown) => string;
};

describe('safeFilename', () => {
  it('passes simple ASCII filenames through', () => {
    expect(safeFilename('my-build-1.0.0.zip')).toBe('my-build-1.0.0.zip');
    expect(safeFilename('app.apk')).toBe('app.apk');
  });

  it('falls back to build.zip for empty/non-string input', () => {
    expect(safeFilename('')).toBe('build.zip');
    expect(safeFilename(null)).toBe('build.zip');
    expect(safeFilename(undefined)).toBe('build.zip');
    expect(safeFilename(42)).toBe('build.zip');
  });

  it('strips CRLF header-injection attempts', () => {
    const malicious = 'safe.zip\r\nX-Evil-Header: pwned';
    const cleaned = safeFilename(malicious);
    expect(cleaned).not.toContain('\r');
    expect(cleaned).not.toContain('\n');
  });

  it('strips quotes that would escape the Content-Disposition attribute', () => {
    const malicious = 'file";filename="evil.exe';
    const cleaned = safeFilename(malicious);
    expect(cleaned).not.toContain('"');
  });

  it('strips path separators (both slashes)', () => {
    expect(safeFilename('../etc/passwd')).not.toContain('/');
    expect(safeFilename('C:\\Windows\\cmd.exe')).not.toContain('\\');
  });

  it('strips NUL byte and other control chars', () => {
    const withNul = 'safe\u0000.zip';
    expect(safeFilename(withNul)).not.toContain('\u0000');
    const withDel = 'safe\u007f.zip';
    expect(safeFilename(withDel)).not.toContain('\u007f');
  });

  it('collapses whitespace to underscores', () => {
    expect(safeFilename('my  build.zip')).toBe('my_build.zip');
  });

  it('caps length at 200 characters', () => {
    const long = 'a'.repeat(500) + '.zip';
    const cleaned = safeFilename(long);
    expect(cleaned.length).toBeLessThanOrEqual(200);
  });

  it('neutralises input that is entirely control chars / whitespace', () => {
    // Input like "\r\n\t" gets replaced with `_` — still safe for a header
    // value (no CRLF, no quotes, no separators).
    const cleaned = safeFilename('\r\n\t');
    expect(cleaned).not.toContain('\r');
    expect(cleaned).not.toContain('\n');
    expect(cleaned).not.toContain('"');
    expect(cleaned.length).toBeGreaterThan(0);
  });
});
