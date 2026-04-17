'use strict';

/**
 * Streaming upload helpers for R2.
 *
 * Bridge between multer.diskStorage() output (a temp file on disk) and
 * Cloudflare R2 (S3 API). Avoids holding the full file in RAM.
 *
 * Design notes:
 *   - SHA-256 is computed in a separate streaming pass *before* upload so
 *     that the value we record is verified against the bytes the client
 *     actually sent (no race with the upload stream).
 *   - We require an explicit ContentLength because R2 (S3) does not allow
 *     unknown-length streams without enabling chunked-encoded uploads.
 *   - tmp files are NEVER deleted by these helpers — the caller owns the
 *     lifecycle (typically `finally { await safeUnlink(...) }`).
 */

const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

/**
 * Streaming SHA-256 of a file on disk. O(file size) reads, O(1) memory.
 *
 * @param {string} filePath
 * @returns {Promise<string>} hex digest
 */
async function computeFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
}

/**
 * Streams a file on disk into R2 via the provided S3 client.
 *
 * Caller must pass the already-known ContentLength (from `fs.stat` or from
 * multer's `req.file.size`) so S3 receives a valid Content-Length header
 * without buffering.
 *
 * @param {object} args
 * @param {object} args.client    S3Client (or compatible)
 * @param {Function} args.PutObjectCommand  AWS SDK constructor (injected for testability)
 * @param {string} args.bucket
 * @param {string} args.key
 * @param {string} args.filePath
 * @param {number} args.contentLength
 * @param {string} [args.contentType]
 * @param {Record<string, string>} [args.metadata]
 * @returns {Promise<unknown>} S3 SDK response
 */
async function streamFileToR2(args) {
  const {
    client,
    PutObjectCommand,
    bucket,
    key,
    filePath,
    contentLength,
    contentType = 'application/octet-stream',
    metadata = {},
  } = args;

  if (!client) throw new Error('streamFileToR2: client is required');
  if (typeof PutObjectCommand !== 'function') {
    throw new Error('streamFileToR2: PutObjectCommand constructor is required');
  }
  if (!bucket || !key || !filePath) {
    throw new Error('streamFileToR2: bucket, key, filePath are required');
  }
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw new Error(`streamFileToR2: invalid contentLength=${contentLength}`);
  }

  const body = fs.createReadStream(filePath);
  // Attach a no-op error listener so unhandled 'error' events (e.g. file
  // gone after upload starts, or fd closed by AWS SDK abort) don't crash
  // the process. The thrown error from `client.send` is what callers see.
  body.on('error', () => undefined);
  try {
    return await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength,
      Metadata: metadata,
    }));
  } finally {
    // Streams created via createReadStream are auto-closed when fully
    // consumed, but on early errors we make sure the descriptor is freed.
    if (!body.destroyed) body.destroy();
  }
}

/**
 * Best-effort delete of a temp file. Never throws — used in finally blocks
 * where any error here would mask the original failure.
 *
 * @param {string | undefined | null} filePath
 */
async function safeUnlink(filePath) {
  if (!filePath || typeof filePath !== 'string') return;
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    // ENOENT is fine — file may have already been moved or never created.
    if (err && err.code !== 'ENOENT') {
      console.warn(`[streamUpload] failed to unlink ${filePath}:`, err.message);
    }
  }
}

module.exports = { computeFileSha256, streamFileToR2, safeUnlink };
