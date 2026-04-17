'use strict';

const { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

// Lazy-loaded to keep pure helpers (isQuarantineKey, quarantineKeyFor,
// publishedKeyFromQuarantine) importable by unit tests without pulling in
// the logger / R2 client dependency chain.
function getLogger() {
  return require('../logger').logger;
}
function getR2Client() {
  return require('./client').getR2Client();
}
function getBucketName() {
  return require('./client').getBucketName();
}

const QUARANTINE_PREFIX = 'quarantine/';
const PUBLISHED_PREFIX = 'builds/';
const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

function isSafeSegment(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= 200 && SAFE_SEGMENT.test(s);
}

/**
 * True only when the key is under `quarantine/builds/...` AND contains no
 * traversal segments (`.`, `..`, leading slashes, double slashes, NUL).
 */
function isQuarantineKey(key) {
  if (typeof key !== 'string') return false;
  if (!key.startsWith(QUARANTINE_PREFIX)) return false;
  if (key.includes('\u0000') || key.includes('//') || key.includes('\\')) return false;
  const parts = key.split('/');
  for (const part of parts) {
    if (part === '' || part === '.' || part === '..') return false;
  }
  return true;
}

function isPublishedKey(key) {
  return typeof key === 'string' && key.startsWith(PUBLISHED_PREFIX);
}

function quarantineKeyFor(productId, version, ext) {
  if (!isSafeSegment(productId)) {
    throw new Error(`quarantineKeyFor: unsafe productId "${productId}"`);
  }
  const safeVersion = isSafeSegment(version) ? version : '1.0.0';
  const safeExt = typeof ext === 'string' && /^\.[a-zA-Z0-9]{1,8}$/.test(ext) ? ext : '.zip';
  const ts = Date.now();
  return `${QUARANTINE_PREFIX}builds/${productId}/${safeVersion}-${ts}${safeExt}`;
}

/**
 * Derives the public key by stripping the quarantine prefix.
 * Validates the resulting key starts with `builds/` to reject path traversal
 * attempts via crafted quarantine keys.
 */
function publishedKeyFromQuarantine(quarantineKey) {
  if (!isQuarantineKey(quarantineKey)) {
    throw new Error('Source key is not under quarantine prefix');
  }
  const stripped = quarantineKey.slice(QUARANTINE_PREFIX.length);
  if (!stripped.startsWith('builds/')) {
    throw new Error(`publishedKeyFromQuarantine: refusing key outside builds/: ${stripped}`);
  }
  return stripped;
}

/**
 * Atomically promote a clean build from quarantine to the public builds prefix.
 * Returns the new public key.
 */
async function moveFromQuarantine(quarantineKey) {
  if (!isQuarantineKey(quarantineKey)) {
    throw new Error(`moveFromQuarantine: refusing key outside quarantine: ${quarantineKey}`);
  }
  const client = getR2Client();
  if (!client) throw new Error('R2 client not initialized');
  const bucket = getBucketName();
  const targetKey = publishedKeyFromQuarantine(quarantineKey);

  await client.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: targetKey,
    CopySource: `${bucket}/${encodeURIComponent(quarantineKey)}`,
    MetadataDirective: 'COPY',
  }));

  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: quarantineKey,
  }));

  getLogger().info(`[quarantine] moved ${quarantineKey} -> ${targetKey}`);
  return targetKey;
}

/** Removes a quarantined object (used on malicious verdict). */
async function deleteQuarantined(quarantineKey) {
  if (!isQuarantineKey(quarantineKey)) {
    throw new Error(`deleteQuarantined: refusing key outside quarantine: ${quarantineKey}`);
  }
  const client = getR2Client();
  if (!client) throw new Error('R2 client not initialized');
  await client.send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: quarantineKey,
  }));
  getLogger().info(`[quarantine] deleted ${quarantineKey}`);
}

async function headQuarantined(quarantineKey) {
  if (!isQuarantineKey(quarantineKey)) {
    throw new Error(`headQuarantined: refusing key outside quarantine: ${quarantineKey}`);
  }
  const client = getR2Client();
  if (!client) throw new Error('R2 client not initialized');
  return client.send(new HeadObjectCommand({
    Bucket: getBucketName(),
    Key: quarantineKey,
  }));
}

module.exports = {
  QUARANTINE_PREFIX,
  PUBLISHED_PREFIX,
  isQuarantineKey,
  isPublishedKey,
  quarantineKeyFor,
  publishedKeyFromQuarantine,
  moveFromQuarantine,
  deleteQuarantined,
  headQuarantined,
};
