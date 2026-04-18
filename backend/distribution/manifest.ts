/**
 * Distribution Manifest — agnostic descriptor of where a product's build lives.
 *
 * Each product has a manifest pointing to either:
 *   - kind='r2': demiurge's own R2/S3-compatible bucket (private, signed URLs)
 *   - kind='github': public GitHub Release asset (anyone can download)
 *
 * The platform stores ONLY the manifest (locator + sha256). It does not host
 * the file. Downloads are served via 302 redirect → zero egress on our side.
 *
 * Adapters live in ./sources/* and implement:
 *   - validate:        check the source is reachable
 *   - getDownloadUrl:  produce a URL the buyer can fetch directly
 *   - openReadStream:  stream the file (for hash verification + VT scanning)
 */

import { z } from 'zod';
import type { Readable } from 'node:stream';

export const R2ManifestSchema = z.object({
  kind: z.literal('r2'),
  bucket: z.string().min(1).max(64),
  key: z.string().min(1).max(1024),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  size: z.number().int().nonnegative().optional(),
  filename: z.string().max(255).optional(),
});

export const GitHubManifestSchema = z.object({
  kind: z.literal('github'),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'Expected owner/name format'),
  tag: z.string().min(1).max(128),
  asset: z.string().min(1).max(255),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  size: z.number().int().nonnegative().optional(),
  filename: z.string().max(255).optional(),
});

export const ManifestSchema = z.discriminatedUnion('kind', [
  R2ManifestSchema,
  GitHubManifestSchema,
]);

export type R2Manifest = z.infer<typeof R2ManifestSchema>;
export type GitHubManifest = z.infer<typeof GitHubManifestSchema>;
export type DistributionManifest = z.infer<typeof ManifestSchema>;

export interface SourceContext {
  /** Demiurge ID (for R2 — to pick credentials; for GitHub — for audit). */
  sellerId: string;
}

export interface ReadStreamResult {
  stream: Readable;
  size: number;
  contentType?: string;
}

export interface SourceAdapter {
  /** Throws if the source is unreachable, key/asset missing, or auth invalid. */
  validate(manifest: DistributionManifest, ctx: SourceContext): Promise<void>;

  /**
   * Returns a URL the buyer can fetch directly. For private sources (R2) this
   * is a presigned GET URL with TTL. For public sources (GitHub) this is the
   * raw download URL. The TTL is best-effort — public URLs ignore it.
   */
  getDownloadUrl(manifest: DistributionManifest, ctx: SourceContext, ttlSec: number): Promise<string>;

  /**
   * Opens a Node Readable stream of the file. Used for SHA256 verification
   * and VirusTotal scan. Caller must consume or destroy the stream.
   */
  openReadStream(manifest: DistributionManifest, ctx: SourceContext): Promise<ReadStreamResult>;
}

export type ManifestKind = DistributionManifest['kind'];

/** Storage value: products.distribution_locator JSON column. */
export interface StoredManifest {
  kind: ManifestKind;
  // R2 fields
  bucket?: string;
  key?: string;
  // GitHub fields
  repo?: string;
  tag?: string;
  asset?: string;
  // Common
  sha256: string;
  size?: number;
  filename?: string;
}

export function manifestToStored(m: DistributionManifest): StoredManifest {
  if (m.kind === 'r2') {
    return {
      kind: 'r2',
      bucket: m.bucket,
      key: m.key,
      sha256: m.sha256,
      size: m.size,
      filename: m.filename,
    };
  }
  return {
    kind: 'github',
    repo: m.repo,
    tag: m.tag,
    asset: m.asset,
    sha256: m.sha256,
    size: m.size,
    filename: m.filename,
  };
}

export function storedToManifest(s: StoredManifest): DistributionManifest {
  if (s.kind === 'r2') {
    if (!s.bucket || !s.key) throw new Error('R2 manifest missing bucket/key');
    return {
      kind: 'r2',
      bucket: s.bucket,
      key: s.key,
      sha256: s.sha256,
      size: s.size,
      filename: s.filename,
    };
  }
  if (!s.repo || !s.tag || !s.asset) throw new Error('GitHub manifest missing repo/tag/asset');
  return {
    kind: 'github',
    repo: s.repo,
    tag: s.tag,
    asset: s.asset,
    sha256: s.sha256,
    size: s.size,
    filename: s.filename,
  };
}
