/**
 * R2 (S3-compatible) source adapter.
 *
 * Uses per-developer S3 client (loaded from encrypted credentials).
 * - validate:        HeadObject — throws on 404 / 403
 * - getDownloadUrl:  presigned GET URL (default TTL 1h, max 6h)
 * - openReadStream:  GetObject body as Node Readable (for hashing/scanning)
 *
 * Bucket in manifest MUST equal demiurge's configured bucket. We refuse
 * cross-bucket fetches even if credentials would allow them — this prevents
 * a malicious manifest from exfiltrating other tenants' data via our verify path.
 */

import {
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { getDevS3Client } from '../../r2/devClient.js';
import type {
  DistributionManifest,
  ReadStreamResult,
  SourceAdapter,
  SourceContext,
} from '../manifest.js';

const DEFAULT_TTL_SEC = 3600;
const MAX_TTL_SEC = 21600; // 6 hours
const MIN_TTL_SEC = 60;

function assertR2(m: DistributionManifest): asserts m is Extract<DistributionManifest, { kind: 'r2' }> {
  if (m.kind !== 'r2') throw new Error(`R2 adapter received non-r2 manifest: ${m.kind}`);
}

async function getClientForManifest(m: Extract<DistributionManifest, { kind: 'r2' }>, ctx: SourceContext) {
  const { client, bucket } = await getDevS3Client(ctx.sellerId);
  if (m.bucket !== bucket) {
    throw new Error(
      `Manifest bucket "${m.bucket}" does not match seller's configured bucket "${bucket}"`,
    );
  }
  return { client, bucket };
}

export const r2Adapter: SourceAdapter = {
  async validate(manifest, ctx) {
    assertR2(manifest);
    const { client, bucket } = await getClientForManifest(manifest, ctx);
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: manifest.key }));
  },

  async getDownloadUrl(manifest, ctx, ttlSec = DEFAULT_TTL_SEC) {
    assertR2(manifest);
    const { client, bucket } = await getClientForManifest(manifest, ctx);
    const ttl = Math.min(MAX_TTL_SEC, Math.max(MIN_TTL_SEC, ttlSec));
    const filename = manifest.filename || manifest.key.split('/').pop() || 'download';
    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: manifest.key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    });
    return getSignedUrl(client, cmd, { expiresIn: ttl });
  },

  async openReadStream(manifest, ctx): Promise<ReadStreamResult> {
    assertR2(manifest);
    const { client, bucket } = await getClientForManifest(manifest, ctx);
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: manifest.key }));
    if (!obj.Body) throw new Error(`R2 GetObject returned empty body for ${manifest.key}`);
    const body = obj.Body as unknown as Readable;
    return {
      stream: body,
      size: typeof obj.ContentLength === 'number' ? obj.ContentLength : (manifest.size ?? 0),
      contentType: obj.ContentType,
    };
  },
};
