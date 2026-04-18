/**
 * Distribution facade.
 *
 * Public API:
 *   - getAdapter(kind):     resolve a source adapter by kind
 *   - verifyManifest(...):  stream the file from source, compute SHA256, sanity-check
 *
 * Hash verification is the trust anchor: even if a demiurge tries to hot-swap
 * the file after approval, the next verify run detects drift (sha256 mismatch)
 * and the platform unlists the product automatically.
 */

import * as crypto from 'node:crypto';
import { r2Adapter } from './sources/r2.js';
import { githubAdapter } from './sources/github.js';
import type {
  DistributionManifest,
  ManifestKind,
  SourceAdapter,
  SourceContext,
} from './manifest.js';
import { logger } from '../logger.js';

const adapters: Record<ManifestKind, SourceAdapter> = {
  r2: r2Adapter,
  github: githubAdapter,
};

export function getAdapter(kind: ManifestKind): SourceAdapter {
  const adapter = adapters[kind];
  if (!adapter) throw new Error(`No adapter registered for kind: ${kind}`);
  return adapter;
}

export interface VerifyResult {
  sha256: string;
  size: number;
  matches: boolean;
  verifiedAt: string;
}

const HASH_TIMEOUT_MS = 10 * 60_000; // 10 minutes max per verify

/**
 * Streams the file from source and computes SHA256.
 * Compares with manifest.sha256 — returns { matches: false } if differ.
 *
 * Bounded memory: streaming hash, never loads full file into RAM.
 * Bounded time: aborts after HASH_TIMEOUT_MS.
 */
export async function verifyManifest(
  manifest: DistributionManifest,
  ctx: SourceContext,
): Promise<VerifyResult> {
  const adapter = getAdapter(manifest.kind);
  const { stream } = await adapter.openReadStream(manifest, ctx);
  const hash = crypto.createHash('sha256');
  let size = 0;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('verifyManifest: hash timeout')), HASH_TIMEOUT_MS),
  );

  const hashing = new Promise<{ digest: string; bytes: number }>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      size += chunk.length;
    });
    stream.on('end', () => resolve({ digest: hash.digest('hex'), bytes: size }));
    stream.on('error', reject);
  });

  try {
    const result = await Promise.race([hashing, timeout]);
    const matches = result.digest.toLowerCase() === manifest.sha256.toLowerCase();
    if (!matches) {
      logger.warn(
        `[distribution] manifest drift detected: expected=${manifest.sha256} actual=${result.digest}`,
      );
    }
    return {
      sha256: result.digest,
      size: result.bytes,
      matches,
      verifiedAt: new Date().toISOString(),
    };
  } finally {
    stream.destroy();
  }
}

export type { DistributionManifest, ManifestKind, SourceContext } from './manifest.js';
export { ManifestSchema, R2ManifestSchema, GitHubManifestSchema } from './manifest.js';
