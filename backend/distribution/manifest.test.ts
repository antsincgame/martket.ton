import { describe, expect, it } from 'vitest';
import {
  ManifestSchema,
  R2ManifestSchema,
  GitHubManifestSchema,
  manifestToStored,
  storedToManifest,
} from './manifest.js';

const VALID_SHA = 'a'.repeat(64);

describe('R2ManifestSchema', () => {
  it('accepts valid R2 manifest', () => {
    const r = R2ManifestSchema.safeParse({
      kind: 'r2',
      bucket: 'my-bucket',
      key: 'releases/v1/build.zip',
      sha256: VALID_SHA,
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid sha256', () => {
    const r = R2ManifestSchema.safeParse({
      kind: 'r2',
      bucket: 'my-bucket',
      key: 'k',
      sha256: 'not-hex',
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty bucket / key', () => {
    expect(R2ManifestSchema.safeParse({ kind: 'r2', bucket: '', key: 'k', sha256: VALID_SHA }).success).toBe(false);
    expect(R2ManifestSchema.safeParse({ kind: 'r2', bucket: 'b', key: '', sha256: VALID_SHA }).success).toBe(false);
  });
});

describe('GitHubManifestSchema', () => {
  it('accepts valid github manifest', () => {
    const r = GitHubManifestSchema.safeParse({
      kind: 'github',
      repo: 'acme/my-app',
      tag: 'v1.0.0',
      asset: 'build.zip',
      sha256: VALID_SHA,
    });
    expect(r.success).toBe(true);
  });

  it('rejects malformed repo', () => {
    expect(
      GitHubManifestSchema.safeParse({
        kind: 'github',
        repo: 'no-slash',
        tag: 'v1',
        asset: 'a',
        sha256: VALID_SHA,
      }).success,
    ).toBe(false);
  });
});

describe('ManifestSchema (discriminated)', () => {
  it('discriminates by kind', () => {
    expect(ManifestSchema.safeParse({ kind: 'r2', bucket: 'b', key: 'k', sha256: VALID_SHA }).success).toBe(true);
    expect(
      ManifestSchema.safeParse({ kind: 'github', repo: 'a/b', tag: 'v1', asset: 'a', sha256: VALID_SHA }).success,
    ).toBe(true);
    expect(ManifestSchema.safeParse({ kind: 'unknown' }).success).toBe(false);
  });
});

describe('stored ↔ manifest round-trip', () => {
  it('round-trips R2', () => {
    const m = { kind: 'r2' as const, bucket: 'b', key: 'k', sha256: VALID_SHA, size: 100, filename: 'f' };
    const back = storedToManifest(manifestToStored(m));
    expect(back).toEqual(m);
  });

  it('round-trips GitHub', () => {
    const m = {
      kind: 'github' as const,
      repo: 'a/b',
      tag: 'v1',
      asset: 'build.zip',
      sha256: VALID_SHA,
      size: 200,
      filename: 'f',
    };
    const back = storedToManifest(manifestToStored(m));
    expect(back).toEqual(m);
  });

  it('throws on incomplete stored manifest', () => {
    expect(() => storedToManifest({ kind: 'r2', sha256: VALID_SHA })).toThrow();
    expect(() => storedToManifest({ kind: 'github', sha256: VALID_SHA })).toThrow();
  });
});
