import { describe, expect, it } from 'vitest';

// Pure helpers are loaded lazily — the CJS module only requires logger/client
// inside async functions, so these imports don't pull in the R2 stack.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const quarantine = require('./quarantine.js') as {
  isQuarantineKey: (key: unknown) => boolean;
  isPublishedKey: (key: unknown) => boolean;
  quarantineKeyFor: (productId: string, version: string, ext: string) => string;
  publishedKeyFromQuarantine: (key: string) => string;
};
const { isQuarantineKey, isPublishedKey, quarantineKeyFor, publishedKeyFromQuarantine } = quarantine;

describe('isQuarantineKey', () => {
  it('accepts well-formed quarantine keys', () => {
    expect(isQuarantineKey('quarantine/builds/prod_1/1.0.0-123.zip')).toBe(true);
  });

  it('rejects non-string input', () => {
    expect(isQuarantineKey(null)).toBe(false);
    expect(isQuarantineKey(undefined)).toBe(false);
    expect(isQuarantineKey(42)).toBe(false);
  });

  it('rejects keys outside the quarantine prefix', () => {
    expect(isQuarantineKey('builds/prod_1/1.0.0.zip')).toBe(false);
    expect(isQuarantineKey('random/quarantine/file.zip')).toBe(false);
  });

  it('rejects path-traversal segments', () => {
    expect(isQuarantineKey('quarantine/../secret/file.zip')).toBe(false);
    expect(isQuarantineKey('quarantine/./builds/prod/v.zip')).toBe(false);
    expect(isQuarantineKey('quarantine/builds/../../root')).toBe(false);
  });

  it('rejects empty segments (double slashes)', () => {
    expect(isQuarantineKey('quarantine//builds/prod/v.zip')).toBe(false);
  });

  it('rejects NUL byte and backslash injections', () => {
    expect(isQuarantineKey('quarantine/builds/prod\u0000/v.zip')).toBe(false);
    expect(isQuarantineKey('quarantine\\builds\\prod\\v.zip')).toBe(false);
  });
});

describe('isPublishedKey', () => {
  it('matches builds/ prefix and nothing else', () => {
    expect(isPublishedKey('builds/prod_1/v.zip')).toBe(true);
    expect(isPublishedKey('quarantine/builds/prod/v.zip')).toBe(false);
    expect(isPublishedKey(null)).toBe(false);
  });
});

describe('quarantineKeyFor', () => {
  it('produces a key under quarantine/builds/{productId}', () => {
    const key: string = quarantineKeyFor('prod_42', '1.0.0', '.zip');
    expect(key.startsWith('quarantine/builds/prod_42/')).toBe(true);
    expect(key.endsWith('.zip')).toBe(true);
    expect(isQuarantineKey(key)).toBe(true);
  });

  it('rejects unsafe productId', () => {
    expect(() => quarantineKeyFor('../evil', '1.0.0', '.zip')).toThrow();
    expect(() => quarantineKeyFor('a/b', '1.0.0', '.zip')).toThrow();
    expect(() => quarantineKeyFor('', '1.0.0', '.zip')).toThrow();
  });

  it('falls back to safe defaults for bad version/ext', () => {
    const key: string = quarantineKeyFor('prod', '../bad', '../evil');
    expect(key).toContain('/1.0.0-');
    expect(key.endsWith('.zip')).toBe(true);
  });

  it('allows standard binary extensions', () => {
    expect(quarantineKeyFor('p', '1.0', '.exe').endsWith('.exe')).toBe(true);
    expect(quarantineKeyFor('p', '1.0', '.apk').endsWith('.apk')).toBe(true);
  });
});

describe('publishedKeyFromQuarantine', () => {
  it('strips the quarantine/ prefix for legit keys', () => {
    expect(publishedKeyFromQuarantine('quarantine/builds/prod/v.zip'))
      .toBe('builds/prod/v.zip');
  });

  it('refuses traversal attempts even if isQuarantineKey were bypassed', () => {
    expect(() => publishedKeyFromQuarantine('quarantine/../secret')).toThrow();
    expect(() => publishedKeyFromQuarantine('not-quarantine/builds/v.zip')).toThrow();
    expect(() => publishedKeyFromQuarantine('quarantine/notbuilds/v.zip')).toThrow();
  });
});
